/* firmware-c/src/main.c */
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/drivers/uart.h>
#include <zephyr/usb/usb_device.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/reboot.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/conn.h>
#include <zephyr/bluetooth/gap.h>
#include <zephyr/settings/settings.h>
#include <zephyr/drivers/adc.h>
#include <zephyr/drivers/pwm.h>
#include <hal/nrf_gpio.h>

#include "protocol.h"
#include "gatt.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

#define LED0_NODE DT_ALIAS(led0)
static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(LED0_NODE, gpios);


static const struct gpio_dt_spec btn_pair = GPIO_DT_SPEC_GET(DT_ALIAS(sw2), gpios); /* P0.20 */
static const struct gpio_dt_spec btn_tune = GPIO_DT_SPEC_GET(DT_ALIAS(sw3), gpios); /* P0.22 */
static struct gpio_callback btn_pair_cb_data;
static struct gpio_callback btn_tune_cb_data;

/*── Lever button ADC channels ──*/
static const struct adc_dt_spec adc_lever_up =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 1);
static const struct adc_dt_spec adc_lever_down =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 2);

#define LEVER_THRESHOLD_MV  300   /* <300mV = button pressed (switch shorts to GND) */
#define LEVER_POLL_MS       10    /* poll every 10ms */
static bool lever_adc_debug;      /* toggle with 'a' serial command */

/*── USB VBUS detection ──*/
static volatile bool usb_active;

/*── Radio sleep (advertising timeout) ──*/
#define ADV_TIMEOUT_MIN       15    /* Stop advertising after this many minutes idle */
#define ADV_WAKE_TIMEOUT_SEC  60    /* After wake, stop again if hub doesn't connect */

static volatile bool radio_sleeping;  /* true = advertising stopped to save power */

/* Pending shift — btn_id to send once hub connects (0xFF = none) */
static uint8_t pending_shift = 0xFF;

static void adv_timeout_handler(struct k_timer *timer);
static K_TIMER_DEFINE(adv_timeout_timer, adv_timeout_handler, NULL);

/*── Connection parameter renegotiation (parked bike power saving) ──*/
#define LATENCY_ESCALATION_MIN  60    /* Minutes idle before requesting wider latency */
#define LATENCY_NORMAL          10    /* Hub's default slave latency */
#define LATENCY_RELAXED         50    /* Wider latency for idle saving */
#define CONN_INTERVAL           48    /* 60ms — keep hub's interval unchanged */

static bool latency_relaxed;

static void latency_escalation_handler(struct k_timer *timer);
static K_TIMER_DEFINE(latency_timer, latency_escalation_handler, NULL);

/*── Battery ADC ──*/
static const struct adc_dt_spec adc_battery =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 0);

/* Cached reading (updated every 15min, on connect, and on 'v' command) */
static int32_t battery_mv;

/* VDDHDIV5: internal 1/5 divider on VDDH pin */
#define VDIV_FACTOR 5

static int battery_init(void)
{
    if (!adc_is_ready_dt(&adc_battery)) {
        LOG_ERR("ADC device not ready");
        return -ENODEV;
    }
    int err = adc_channel_setup_dt(&adc_battery);
    if (err) {
        LOG_ERR("ADC channel setup failed: %d", err);
        return err;
    }
    LOG_INF("Battery ADC ready (VDDHDIV5 internal)");

    /* Lever button ADC channels */
    err = adc_channel_setup_dt(&adc_lever_up);
    if (err) {
        LOG_ERR("ADC lever-up setup failed: %d", err);
        return err;
    }
    err = adc_channel_setup_dt(&adc_lever_down);
    if (err) {
        LOG_ERR("ADC lever-down setup failed: %d", err);
        return err;
    }
    LOG_INF("Lever ADC ready (AIN5=up, AIN7=down)");
    return 0;
}

static int32_t read_battery_mv(void)
{
    int16_t buf;
    struct adc_sequence seq = {
        .buffer = &buf,
        .buffer_size = sizeof(buf),
    };
    adc_sequence_init_dt(&adc_battery, &seq);
    int err = adc_read_dt(&adc_battery, &seq);
    if (err) {
        LOG_ERR("ADC read failed: %d", err);
        return -1;
    }
    int32_t mv = buf;
    adc_raw_to_millivolts_dt(&adc_battery, &mv);
    return mv * VDIV_FACTOR;
}

static int32_t read_lever_mv(const struct adc_dt_spec *spec)
{
    int16_t buf;
    struct adc_sequence seq = {
        .buffer = &buf,
        .buffer_size = sizeof(buf),
    };
    adc_sequence_init_dt(spec, &seq);
    int err = adc_read_dt(spec, &seq);
    if (err) {
        return -1;
    }
    int32_t mv = buf;
    adc_raw_to_millivolts_dt(spec, &mv);
    return mv;
}

static void usb_status_cb(enum usb_dc_status_code status, const uint8_t *param)
{
    ARG_UNUSED(param);
    switch (status) {
    case USB_DC_CONFIGURED:
    case USB_DC_RESUME:
        usb_active = true;
        break;
    case USB_DC_DISCONNECTED:
    case USB_DC_SUSPEND:
        usb_active = false;
        break;
    default:
        break;
    }
}

/*── Bootloader entry ──*/

/* Log to both console and BLE NUS (if subscribed). */
#define NUS_LOG(fmt, ...) do { \
    LOG_INF(fmt, ##__VA_ARGS__); \
    if (gatt_nus_is_subscribed()) { \
        char _nb[80]; \
        int _nl = snprintf(_nb, sizeof(_nb), fmt "\n", ##__VA_ARGS__); \
        if (_nl > 0) { gatt_nus_send(_nb, MIN((size_t)_nl, sizeof(_nb))); } \
    } \
} while (0)

static void enter_bootloader(void)
{
    NRF_POWER->GPREGRET = 0x57;
    sys_reboot(SYS_REBOOT_COLD);
}

/*── BLE advertising data ──*/
/* BikeNet service UUID: a5c1c000-cc20-ba91-0c1a-ef3f9e643d79 (128-bit, LE) */
static const uint8_t svc_uuid_le[16] = {
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x00, 0xC0, 0xC1, 0xA5,
};

static uint8_t mfr_data[11];  /* 2 company ID + 2 type + 6 MAC + 1 flag (matches real pod) */

#define MFR_FLAG_NORMAL  0x00
#define MFR_FLAG_PAIRING 0xAC

static const struct bt_data ad[] = {
    BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR),
    BT_DATA(BT_DATA_NAME_COMPLETE, "NXS MTB Pod", 11),
};

static const struct bt_data sd[] = {
    BT_DATA(BT_DATA_UUID128_ALL, svc_uuid_le, sizeof(svc_uuid_le)),
    BT_DATA(BT_DATA_MANUFACTURER_DATA, mfr_data, sizeof(mfr_data)),
};

static void fill_mfr_data(void)
{
    bt_addr_le_t addr;
    size_t count = 1;
    bt_id_get(&addr, &count);

    mfr_data[0] = 0x98;  /* company ID 0xDE98 LE */
    mfr_data[1] = 0xDE;
    mfr_data[2] = 0x0A;  /* device type */
    mfr_data[3] = 0x10;
    memcpy(&mfr_data[4], addr.a.val, 6);
    mfr_data[10] = MFR_FLAG_NORMAL;
}

static void start_advertising(void)
{
    /* ~128ms interval to match real pod (0xCC * 0.625ms ≈ 127.5ms) */
    static const struct bt_le_adv_param adv_param = BT_LE_ADV_PARAM_INIT(
        BT_LE_ADV_OPT_CONN, 0x00CC, 0x00CC, NULL);
    int err = bt_le_adv_start(&adv_param, ad, ARRAY_SIZE(ad), sd, ARRAY_SIZE(sd));
    if (err) {
        LOG_ERR("Advertising failed (err %d)", err);
    } else {
        LOG_INF("Advertising as 'NXS MTB Pod'");
        /* Reset inactivity timer — hub has ADV_TIMEOUT_MIN to connect */
        k_timer_start(&adv_timeout_timer, K_MINUTES(ADV_TIMEOUT_MIN), K_NO_WAIT);
    }
}

/*── Delayed advertising restart after disconnect ──*/
static void adv_restart_work_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(adv_restart_work, adv_restart_work_handler);

static void adv_restart_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    start_advertising();
}

/*── Radio sleep helpers ──*/
static struct bt_conn *current_conn;  /* forward — used by adv_timeout_handler */
static void send_press_release(uint8_t btn_id);  /* forward — used by pending_shift_flush */

/*── Latency escalation helpers ──*/

/* Compute minimum supervision timeout for given latency (BLE spec constraint) */
static uint16_t supervision_to_for(uint16_t latency)
{
    /* timeout > (1 + latency) * interval * 2, in 10ms units */
    /* interval is in 1.25ms units, so interval_ms = CONN_INTERVAL * 1.25 */
    /* We need: timeout_10ms > (1 + latency) * CONN_INTERVAL * 1.25 * 2 / 10 */
    /* = (1 + latency) * CONN_INTERVAL / 4 */
    uint16_t min_to = (uint16_t)(((1u + latency) * CONN_INTERVAL + 3u) / 4u) + 1u;
    /* Clamp to BLE max (3200 = 32s) */
    return min_to > 3200 ? 3200 : min_to;
}

static void latency_escalation_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    if (!current_conn || latency_relaxed) {
        return;
    }
    uint16_t sv_to = supervision_to_for(LATENCY_RELAXED);
    struct bt_le_conn_param param = BT_LE_CONN_PARAM_INIT(
        CONN_INTERVAL, CONN_INTERVAL, LATENCY_RELAXED, sv_to);
    int err = bt_conn_le_param_update(current_conn, &param);
    if (err) {
        NUS_LOG("Latency escalation failed: %d", err);
    } else {
        latency_relaxed = true;
        NUS_LOG("Latency relaxed (%u)", LATENCY_RELAXED);
    }
}

static void latency_tighten(void)
{
    if (!current_conn || !latency_relaxed) {
        return;
    }
    uint16_t sv_to = supervision_to_for(LATENCY_NORMAL);
    struct bt_le_conn_param param = BT_LE_CONN_PARAM_INIT(
        CONN_INTERVAL, CONN_INTERVAL, LATENCY_NORMAL, sv_to);
    int err = bt_conn_le_param_update(current_conn, &param);
    if (err) {
        NUS_LOG("Latency tighten failed: %d", err);
    } else {
        NUS_LOG("Latency normal (%d)", LATENCY_NORMAL);
    }
    latency_relaxed = false;
}

static void adv_timeout_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    if (current_conn) {
        return;  /* Don't sleep while connected */
    }
    bt_le_adv_stop();
    radio_sleeping = true;
    NUS_LOG("Radio sleep (no hub for %d min)", ADV_TIMEOUT_MIN);
}

static void pending_shift_set(uint8_t btn_id)
{
    pending_shift = btn_id;  /* Last press wins */
}

static void pending_shift_flush(void)
{
    if (pending_shift != 0xFF) {
        uint8_t btn_id = pending_shift;
        pending_shift = 0xFF;
        send_press_release(btn_id);
    }
}

static void radio_wake(void)
{
    if (!radio_sleeping) {
        return;
    }
    radio_sleeping = false;
    start_advertising();
    /* Give hub ADV_WAKE_TIMEOUT_SEC to connect, then sleep again */
    k_timer_start(&adv_timeout_timer, K_SECONDS(ADV_WAKE_TIMEOUT_SEC), K_NO_WAIT);
    NUS_LOG("Radio wake (button press)");
}

/*── LED blink on activity ──*/
static void led_off_work_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(led_off_work, led_off_work_handler);

static void led_off_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    gpio_pin_set_dt(&led, 0);
}

static void led_blink(void)
{
    gpio_pin_set_dt(&led, 1);
    k_work_schedule(&led_off_work, K_MSEC(50));
}

/* PWM LED for battery indicator pulses.
 * Pulse count = charge bucket (1–9): 10%→1 pulse, 90%→9 pulses.
 * Each pulse: smooth fade-in → hold → fade-out at low brightness. */
static const struct pwm_dt_spec pwm_led = PWM_DT_SPEC_GET(DT_NODELABEL(pwm_led0));

static void led_pulse_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(led_pulse_work, led_pulse_handler);

#define FADE_STEPS     12
#define FADE_STEP_MS   6
#define HOLD_MS        50
#define GAP_MS         80
#define PULSE_PCT       5  /* low brightness — just visible */

enum pulse_phase { PHASE_FADE_IN, PHASE_HOLD, PHASE_FADE_OUT, PHASE_GAP };
static uint8_t pulse_total;    /* how many pulses to emit */
static uint8_t pulse_current;  /* which pulse we're on (0-based) */
static enum pulse_phase pulse_phase;
static uint8_t fade_step;

static inline void pwm_set_pct(uint8_t pct)
{
    pwm_set_pulse_dt(&pwm_led, pwm_led.period * pct / 100);
}

static void led_pulse_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    switch (pulse_phase) {
    case PHASE_FADE_IN:
        fade_step++;
        pwm_set_pct(fade_step * PULSE_PCT / FADE_STEPS);
        if (fade_step >= FADE_STEPS) {
            pulse_phase = PHASE_HOLD;
            k_work_schedule(&led_pulse_work, K_MSEC(HOLD_MS));
        } else {
            k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
        }
        break;
    case PHASE_HOLD:
        pulse_phase = PHASE_FADE_OUT;
        fade_step = FADE_STEPS;
        k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
        break;
    case PHASE_FADE_OUT:
        fade_step--;
        pwm_set_pct(fade_step * PULSE_PCT / FADE_STEPS);
        if (fade_step == 0) {
            pulse_current++;
            if (pulse_current < pulse_total) {
                pulse_phase = PHASE_GAP;
                k_work_schedule(&led_pulse_work, K_MSEC(GAP_MS));
            }
            /* else done — LED already off */
        } else {
            k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
        }
        break;
    case PHASE_GAP:
        /* Start next pulse */
        pulse_phase = PHASE_FADE_IN;
        fade_step = 0;
        k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
        break;
    }
}

static void led_battery_flash(int32_t mv)
{
    /* Clamp to 3000–4200mV range */
    if (mv < 3000) { mv = 3000; }
    if (mv > 4200) { mv = 4200; }

    /* Map to 1–9 pulses: 3000mV→1, 4200mV→9 */
    uint8_t pulses = 1 + (uint8_t)((uint32_t)(mv - 3000) * 8 / 1200);

    k_work_cancel_delayable(&led_pulse_work);
    pulse_total = pulses;
    pulse_current = 0;
    pulse_phase = PHASE_FADE_IN;
    fade_step = 0;

    pwm_set_pct(0);
    LOG_INF("Battery pulse: %u pulses (%d mV)", pulses, mv);

    k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
}

/*── BLE connection callbacks ──*/
static void set_pairing_mode(bool enable);

static void connected(struct bt_conn *conn, uint8_t err)
{
    if (err) {
        LOG_ERR("Connection failed (err %u)", err);
        return;
    }
    current_conn = bt_conn_ref(conn);
    NUS_LOG("HUB CONNECTED");
    set_pairing_mode(false);
    k_timer_stop(&adv_timeout_timer);
    radio_sleeping = false;
    /* Start latency escalation timer */
    latency_relaxed = false;
    k_timer_start(&latency_timer, K_MINUTES(LATENCY_ESCALATION_MIN), K_NO_WAIT);
}

static void disconnected(struct bt_conn *conn, uint8_t reason)
{
    NUS_LOG("HUB DISCONNECTED (reason %u)", reason);
    if (current_conn) {
        bt_conn_unref(current_conn);
        current_conn = NULL;
    }
    k_timer_stop(&latency_timer);
    latency_relaxed = false;
    /* Schedule advertising restart after BLE stack cleanup completes */
    k_work_schedule(&adv_restart_work, K_MSEC(500));
}

static void pending_flush_work_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(pending_flush_work, pending_flush_work_handler);

static void pending_blink_work_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(pending_blink_work, pending_blink_work_handler);

static void pending_blink_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    if (pending_shift != 0xFF) {
        led_blink();
        k_work_schedule(&pending_blink_work, K_MSEC(300));
    }
}

static void pending_flush_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    k_work_cancel_delayable(&pending_blink_work);
    pending_shift_flush();
}

static void send_battery(void);  /* forward */

static void security_changed(struct bt_conn *conn, bt_security_t level,
                              enum bt_security_err err)
{
    if (err) {
        LOG_ERR("Security change FAILED (level %u, err %d)", level, err);
    } else {
        LOG_INF("Security changed to level %u", level);
        send_battery();
        /* Hub needs ~3s after connection before it accepts button presses */
        k_work_schedule(&pending_flush_work, K_MSEC(3000));
        if (pending_shift != 0xFF) {
            k_work_schedule(&pending_blink_work, K_MSEC(100));
        }
    }
}

static void le_param_updated(struct bt_conn *conn, uint16_t interval,
                             uint16_t latency, uint16_t timeout)
{
    /* interval is in 1.25ms units; use integer math (Zephyr has no %f) */
    unsigned int ms_x100 = interval * 125u;
    NUS_LOG("Conn params: interval=%u (%u.%02ums) latency=%u timeout=%u",
            interval, ms_x100 / 100, ms_x100 % 100, latency, timeout);
}

BT_CONN_CB_DEFINE(conn_callbacks) = {
    .connected = connected,
    .disconnected = disconnected,
    .security_changed = security_changed,
    .le_param_updated = le_param_updated,
};

/*── SMP auth callbacks (diagnostic) ──*/
static void auth_cancel(struct bt_conn *conn)
{
    LOG_INF("SMP: auth cancelled");
}

static struct bt_conn_auth_cb auth_cb = {
    .cancel = auth_cancel,
};

static void auth_pairing_complete(struct bt_conn *conn, bool bonded)
{
    NUS_LOG("SMP: pairing complete (bonded=%d)", bonded);
}

static void auth_pairing_failed(struct bt_conn *conn, enum bt_security_err reason)
{
    struct bt_conn_info info;
    bt_conn_get_info(conn, &info);
    LOG_ERR("SMP: pairing FAILED (reason %d), deleting bond", reason);
    bt_unpair(BT_ID_DEFAULT, info.le.dst);
}

static struct bt_conn_auth_info_cb auth_info_cb = {
    .pairing_complete = auth_pairing_complete,
    .pairing_failed = auth_pairing_failed,
};

/*── GATT callbacks ──*/
static void on_pin_write(const uint8_t *data, uint16_t len)
{
    LOG_INF("PIN exchange (%u bytes) -> ACK", len);
    static const uint8_t ack = 0x01;
    gatt_notify_pin(&ack, 1);
    led_blink();
}

#define BTN_SHIFT_UP   0x00
#define BTN_SHIFT_DOWN 0x01
#define BTN_TUNE       0x02

static void send_shift_or_queue(uint8_t btn_id)
{
    if (radio_sleeping || !current_conn) {
        pending_shift_set(btn_id);
        radio_wake();
    } else {
        send_press_release(btn_id);
    }
}

static void print_help(void)
{
    /* Serial: ANSI colored (bold keys, yellow header) */
    printk("\033[1;33mCommands:\033[0m "
           "\033[1mu\033[0m=up \033[1md\033[0m=down \033[1mt\033[0m=tune\n"
           "         \033[1mp\033[0m=wake \033[1mP\033[0m=pair \033[1mB\033[0m=boot "
           "\033[1mS\033[0m=sleep\n"
           "         \033[1mL\033[0m=latency \033[1mv\033[0m=battery "
           "\033[1m0-9\033[0m=sim bat\n"
           "         \033[1ma\033[0m=adc "
           "\033[1m?\033[0m=help\n");
    /* NUS: plain text (no ANSI) */
    if (gatt_nus_is_subscribed()) {
        gatt_nus_send("Commands: u=up d=down t=tune\n", 30);
        gatt_nus_send("p=wake P=pair B=boot S=sleep\n", 29);
        gatt_nus_send("L=latency v=bat 0-9=sim a=adc\n", 31);
        gatt_nus_send("?=help\n", 7);
    }
}

static void handle_command(uint8_t ch)
{
    if (ch == 'u') {
        send_shift_or_queue(BTN_SHIFT_UP);
    } else if (ch == 'd') {
        send_shift_or_queue(BTN_SHIFT_DOWN);
    } else if (ch == 't') {
        send_shift_or_queue(BTN_TUNE);
    } else if (ch == 'p') {
        if (radio_sleeping) {
            radio_wake();
        }
    } else if (ch == 'P') {
        set_pairing_mode(true);
    } else if (ch == 'B') {
        NUS_LOG("Entering bootloader...");
        k_msleep(100);
        enter_bootloader();
    } else if (ch == 'S') {
        if (current_conn) {
            NUS_LOG("Can't sleep while connected");
        } else {
            k_timer_stop(&adv_timeout_timer);
            bt_le_adv_stop();
            radio_sleeping = true;
            NUS_LOG("Radio sleep (forced)");
        }
    } else if (ch == 'L') {
        latency_escalation_handler(NULL);
    } else if (ch == 'v') {
        battery_mv = read_battery_mv();
        NUS_LOG("Battery: %d mV%s", battery_mv, usb_active ? " (USB)" : "");
    } else if (ch >= '0' && ch <= '9') {
        /* Simulate battery level: 0=3000mV(dead) .. 9=4200mV(full) */
        int32_t sim_mv = 3000 + (ch - '0') * 1200 / 9;
        battery_mv = sim_mv;
        led_battery_flash(sim_mv);
        NUS_LOG("Sim battery: %d mV (key %c)", sim_mv, ch);
    } else if (ch == 'a') {
        lever_adc_debug = !lever_adc_debug;
        NUS_LOG("Lever ADC debug: %s", lever_adc_debug ? "ON (10ms)" : "OFF");
    } else if (ch == '?') {
        print_help();
    }
}

static void on_nus_rx(const uint8_t *data, uint16_t len)
{
    if (len == 0) return;
    handle_command(data[0]);
}

static void on_nus_subscribe(bool subscribed)
{
    if (subscribed) {
        print_help();
    }
}

/*── Pairing mode ──*/
static void pairing_timeout_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(pairing_timeout_work, pairing_timeout_handler);

static void set_pairing_mode(bool enable)
{
    /* Update flag byte in manufacturer data (already in ad[] by reference) */
    mfr_data[10] = enable ? MFR_FLAG_PAIRING : MFR_FLAG_NORMAL;

    /* Restart advertising with updated data (skip if connected — no slot available) */
    if (!current_conn) {
        bt_le_adv_stop();
        start_advertising();
    }

    /* LED solid on during pairing mode */
    gpio_pin_set_dt(&led, enable ? 1 : 0);

    if (enable) {
        NUS_LOG("PAIRING MODE ON (10s)");
        k_work_schedule(&pairing_timeout_work, K_SECONDS(10));
    } else {
        NUS_LOG("PAIRING MODE OFF");
        k_work_cancel_delayable(&pairing_timeout_work);
    }
}

static void pairing_timeout_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    set_pairing_mode(false);
}

/*── Lever button ADC polling ──*/
#define DEBOUNCE_MS    150

static int64_t last_shift_ms;     /* shared across up/down to suppress crosstalk */
static bool lever_up_pressed;
static bool lever_down_pressed;

static void lever_poll_work_handler(struct k_work *work);
static K_WORK_DEFINE(lever_poll_work, lever_poll_work_handler);

static void lever_poll_timer_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    k_work_submit(&lever_poll_work);
}

static K_TIMER_DEFINE(lever_poll_timer, lever_poll_timer_handler, NULL);

static void lever_poll_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    int32_t mv_up = read_lever_mv(&adc_lever_up);
    int32_t mv_down = read_lever_mv(&adc_lever_down);

    if (lever_adc_debug) {
        static int32_t prev_up = -1, prev_down = -1;
        if (mv_up != prev_up || mv_down != prev_down) {
            printk("ADC up=%d dn=%d\n", (int)mv_up, (int)mv_down);
            prev_up = mv_up;
            prev_down = mv_down;
        }
    }

    /* Lever switches are normally-open to GND: idle=VDD(2399mV), pressed=~0mV */
    bool up_now = (mv_up < LEVER_THRESHOLD_MV);
    bool down_now = (mv_down < LEVER_THRESHOLD_MV);

    if (up_now && !lever_up_pressed) {
        lever_up_pressed = true;
        int64_t now = k_uptime_get();
        if (now - last_shift_ms >= DEBOUNCE_MS) {
            last_shift_ms = now;
            send_shift_or_queue(BTN_SHIFT_UP);
        }
    } else if (!up_now) {
        lever_up_pressed = false;
    }

    if (down_now && !lever_down_pressed) {
        lever_down_pressed = true;
        int64_t now = k_uptime_get();
        if (now - last_shift_ms >= DEBOUNCE_MS) {
            last_shift_ms = now;
            send_shift_or_queue(BTN_SHIFT_DOWN);
        }
    } else if (!down_now) {
        lever_down_pressed = false;
    }
}

/*── GPIO button interrupts ──*/
static void btn_pair_work_handler(struct k_work *work);
static void btn_pair_hold_handler(struct k_work *work);
static void btn_tune_work_handler(struct k_work *work);
static K_WORK_DEFINE(btn_pair_work, btn_pair_work_handler);
static K_WORK_DELAYABLE_DEFINE(btn_pair_hold_work, btn_pair_hold_handler);
static K_WORK_DEFINE(btn_tune_work, btn_tune_work_handler);

static void btn_pair_isr(const struct device *dev, struct gpio_callback *cb, uint32_t pins)
{
    ARG_UNUSED(dev); ARG_UNUSED(cb); ARG_UNUSED(pins);
    k_work_submit(&btn_pair_work);
}

static void btn_tune_isr(const struct device *dev, struct gpio_callback *cb, uint32_t pins)
{
    ARG_UNUSED(dev); ARG_UNUSED(cb); ARG_UNUSED(pins);
    k_work_submit(&btn_tune_work);
}

/*── Button helpers ──*/
static int64_t last_btn_pair_ms;
static int64_t last_btn_tune_ms;

static void get_own_mac(uint8_t mac_le[MAC_LEN])
{
    bt_addr_le_t addr;
    size_t count = 1;
    bt_id_get(&addr, &count);
    memcpy(mac_le, addr.a.val, 6);
}

static void send_press_release(uint8_t btn_id)
{
    /* Tighten latency and reset escalation timer on every shift */
    latency_tighten();
    k_timer_start(&latency_timer, K_MINUTES(LATENCY_ESCALATION_MIN), K_NO_WAIT);

    uint8_t mac[MAC_LEN];
    get_own_mac(mac);

    uint8_t frame[FRAME_LEN];
    protocol_encode_button(frame, mac, btn_id, ACTION_PRESS);
    gatt_notify_msg(frame, sizeof(frame));
    k_msleep(50);
    protocol_encode_button(frame, mac, btn_id, ACTION_RELEASE);
    gatt_notify_msg(frame, sizeof(frame));

    NUS_LOG("-> button 0x%02X", btn_id);
    led_blink();
}

static void btn_pair_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    int64_t now = k_uptime_get();
    if (now - last_btn_pair_ms < DEBOUNCE_MS) { return; }
    last_btn_pair_ms = now;

    /* Check if button is pressed (active) or released */
    if (gpio_pin_get_dt(&btn_pair)) {
        /* Button pressed — wake radio, flash battery level, start 6s hold timer */
        if (radio_sleeping) {
            radio_wake();
        }
        /* Fresh battery read + PWM brightness flash */
        battery_mv = read_battery_mv();
        led_battery_flash(battery_mv);
        NUS_LOG("Battery: %d mV%s", battery_mv, usb_active ? " (USB)" : "");
        /* Send battery to hub if connected */
        if (current_conn) {
            send_battery();
        }
        k_work_schedule(&btn_pair_hold_work, K_SECONDS(6));
    } else {
        /* Button released — cancel if held less than 6s */
        k_work_cancel_delayable(&btn_pair_hold_work);
    }
}

static void btn_pair_hold_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    set_pairing_mode(true);
}

static void btn_tune_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    int64_t now = k_uptime_get();
    if (now - last_btn_tune_ms < DEBOUNCE_MS) { return; }
    last_btn_tune_ms = now;
    send_shift_or_queue(BTN_TUNE);
}

static void send_battery(void)
{
    uint8_t mac[MAC_LEN];
    get_own_mac(mac);

    uint8_t frame[FRAME_LEN];
    protocol_encode_battery(frame, mac, (uint16_t)(battery_mv > 0 ? battery_mv : 0));
    gatt_notify_msg(frame, sizeof(frame));
}

/*── Battery background check (every 15min, silent) ──*/
static void battery_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    battery_mv = read_battery_mv();
}
static K_WORK_DEFINE(battery_work, battery_work_handler);

static void periodic_timer_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    k_work_submit(&battery_work);
}
static K_TIMER_DEFINE(periodic_timer, periodic_timer_handler, NULL);

/*── Main ──*/
int main(void)
{
    usb_enable(usb_status_cb);

    /* Only wait for USB enumeration if cable is plugged in */
    if (NRF_POWER->USBREGSTATUS & POWER_USBREGSTATUS_VBUSDETECT_Msk) {
        k_msleep(1000);
    }

    gpio_pin_configure_dt(&led, GPIO_OUTPUT_INACTIVE);

    LOG_INF("NXS pod firmware v0.1.0 (Zephyr)");

    battery_init();

    /* PWM LED for battery pulse indicator */
    if (!pwm_is_ready_dt(&pwm_led)) {
        LOG_ERR("PWM LED not ready");
    }

    /* BLE init */
    int err = bt_enable(NULL);
    if (err) {
        LOG_ERR("BT init failed (err %d)", err);
        return 1;
    }

    /* NVS is clean — init settings subsystem only */
    int rc = settings_subsys_init();
    LOG_INF("Settings init: %d", rc);
    if (rc == 0) {
        settings_load();
        LOG_INF("Settings loaded");
    }

    fill_mfr_data();
    bt_conn_auth_cb_register(&auth_cb);
    bt_conn_auth_info_cb_register(&auth_info_cb);
    gatt_set_pin_write_cb(on_pin_write);
    gatt_set_nus_rx_cb(on_nus_rx);
    gatt_set_nus_subscribe_cb(on_nus_subscribe);

    /* GPIO buttons */
    gpio_pin_configure_dt(&btn_pair, GPIO_INPUT);
    gpio_pin_interrupt_configure_dt(&btn_pair, GPIO_INT_EDGE_BOTH);  /* need both edges for long-press */
    gpio_init_callback(&btn_pair_cb_data, btn_pair_isr, BIT(btn_pair.pin));
    gpio_add_callback(btn_pair.port, &btn_pair_cb_data);
    gpio_pin_configure_dt(&btn_tune, GPIO_INPUT);
    gpio_pin_interrupt_configure_dt(&btn_tune, GPIO_INT_EDGE_TO_ACTIVE);
    gpio_init_callback(&btn_tune_cb_data, btn_tune_isr, BIT(btn_tune.pin));
    gpio_add_callback(btn_tune.port, &btn_tune_cb_data);
    LOG_INF("GPIO buttons: P0.20=pair P0.22=tune");

    /* Internal pull-ups on lever ADC pins (P0.29=AIN5, P0.31=AIN7).
     * Di2 lever buttons are normally-open switches to GND.
     * Idle: pin pulled to VDD (~2400mV) by pull-up.  Pressed: ~0mV.
     * INPUT=Disconnect avoids digital buffer loading the analog signal. */
    nrf_gpio_cfg(29, NRF_GPIO_PIN_DIR_INPUT, NRF_GPIO_PIN_INPUT_DISCONNECT,
                 NRF_GPIO_PIN_PULLUP, NRF_GPIO_PIN_S0S1, NRF_GPIO_PIN_NOSENSE);
    nrf_gpio_cfg(31, NRF_GPIO_PIN_DIR_INPUT, NRF_GPIO_PIN_INPUT_DISCONNECT,
                 NRF_GPIO_PIN_PULLUP, NRF_GPIO_PIN_S0S1, NRF_GPIO_PIN_NOSENSE);
    LOG_INF("Internal pull-ups enabled on P0.29 and P0.31");

    /* Start lever ADC polling (10ms interval for Di2 lever buttons) */
    k_timer_start(&lever_poll_timer, K_MSEC(LEVER_POLL_MS), K_MSEC(LEVER_POLL_MS));
    LOG_INF("Lever ADC polling: P0.29=up P0.31=down (%dms, <%dmV)",
            LEVER_POLL_MS, LEVER_THRESHOLD_MV);

    /* Print idle ADC values at boot to help verify pull-ups */
    {
        int32_t up0 = read_lever_mv(&adc_lever_up);
        int32_t dn0 = read_lever_mv(&adc_lever_down);
        LOG_INF("Lever ADC idle: up=%dmV down=%dmV", up0, dn0);
    }

    start_advertising();

    /* Print help banner to serial */
    print_help();

    /* Silent battery check every 15min (updates cached battery_mv) */
    k_timer_start(&periodic_timer, K_MINUTES(15), K_MINUTES(15));

    /* Main loop: poll serial (USB CDC doesn't support interrupt-driven rx) */
    const struct device *console = DEVICE_DT_GET(DT_CHOSEN(zephyr_console));
    uint8_t ch;

    while (1) {
        if (usb_active && uart_poll_in(console, &ch) == 0) {
            handle_command(ch);
        }

        /* Sleep longer when no USB — serial polling is pointless without a host.
         * Buttons and BLE are interrupt-driven, so nothing is missed. */
        k_msleep(usb_active ? 50 : 5000);
    }
    return 0;
}
