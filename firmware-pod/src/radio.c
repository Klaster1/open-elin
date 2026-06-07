/* firmware-pod/src/radio.c — BLE advertising, connection, and protocol */
#include <zephyr/kernel.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/conn.h>
#include <zephyr/bluetooth/gap.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/poweroff.h>
#include <hal/nrf_gpio.h>

#include "app.h"
#include "radio.h"
#include "led.h"
#include "buttons.h"
#include "protocol.h"
#include "gatt.h"

LOG_MODULE_DECLARE(main, LOG_LEVEL_INF);

/*── Advertising constants ──*/
#define ADV_TIMEOUT_MIN       15    /* Stop advertising after this many minutes idle */
#define ADV_WAKE_TIMEOUT_SEC  60    /* After wake, stop again if hub doesn't connect */

#define MFR_FLAG_NORMAL  0x00
#define MFR_FLAG_PAIRING 0xAC

/* BikeNet service UUID: a5c1c000-cc20-ba91-0c1a-ef3f9e643d79 (128-bit, LE) */
static const uint8_t svc_uuid_le[16] = {
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x00, 0xC0, 0xC1, 0xA5,
};

static const struct bt_data ad[] = {
    BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR),
    BT_DATA(BT_DATA_NAME_COMPLETE, "NXS MTB Pod", 11),
};

static const struct bt_data sd[] = {
    BT_DATA(BT_DATA_UUID128_ALL, svc_uuid_le, sizeof(svc_uuid_le)),
    BT_DATA(BT_DATA_MANUFACTURER_DATA, app.mfr_data, sizeof(app.mfr_data)),
};

/*── Connection parameters ──*/
#define LATENCY_ESCALATION_MIN  60    /* Minutes idle before requesting wider latency */
#define LATENCY_NORMAL          10    /* Hub's default slave latency */
#define LATENCY_RELAXED         50    /* Wider latency for idle saving */
#define CONN_INTERVAL           48    /* 60ms — keep hub's interval unchanged */

/*── Deep sleep ──*/
#define WAKE_PIN_PAIR  20    /* P0.20 — pair button (active low) wakes from System OFF */

/*── Forward declarations ──*/
static void send_press_release(uint8_t btn_id);
static void enter_system_off(void);

/*── Timer/work objects ──*/
static void adv_timeout_work_handler(struct k_work *work);
static K_WORK_DEFINE(adv_timeout_work, adv_timeout_work_handler);
static void adv_timeout_handler(struct k_timer *timer);
static K_TIMER_DEFINE(adv_timeout_timer, adv_timeout_handler, NULL);

static void latency_escalation_work_handler(struct k_work *work);
static K_WORK_DEFINE(latency_escalation_work, latency_escalation_work_handler);
static void latency_escalation_timer_handler(struct k_timer *timer);
static K_TIMER_DEFINE(latency_timer, latency_escalation_timer_handler, NULL);

static void adv_restart_work_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(adv_restart_work, adv_restart_work_handler);

static void pairing_timeout_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(pairing_timeout_work, pairing_timeout_handler);

static void pending_blink_work_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(pending_blink_work, pending_blink_work_handler);

static void pending_flush_work_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(pending_flush_work, pending_flush_work_handler);

/*── Helpers ──*/
static void get_own_mac(uint8_t mac_le[6])
{
    bt_addr_le_t addr;
    size_t count = 1;
    bt_id_get(&addr, &count);
    memcpy(mac_le, addr.a.val, 6);
}

static uint16_t supervision_to_for(uint16_t latency)
{
    /* timeout > (1 + latency) * interval * 2, in 10ms units */
    uint16_t min_to = (uint16_t)(((1u + latency) * CONN_INTERVAL + 3u) / 4u) + 1u;
    return min_to > 3200 ? 3200 : min_to;
}

static void fill_mfr_data(void)
{
    bt_addr_le_t addr;
    size_t count = 1;
    bt_id_get(&addr, &count);

    app.mfr_data[0] = 0x98;  /* company ID 0xDE98 LE */
    app.mfr_data[1] = 0xDE;
    app.mfr_data[2] = 0x0A;  /* device type */
    app.mfr_data[3] = 0x10;
    memcpy(&app.mfr_data[4], addr.a.val, 6);
    app.mfr_data[10] = MFR_FLAG_NORMAL;
}

/*── Advertising ──*/
void start_advertising(void)
{
    /* ~128ms interval to match real pod (0xCC * 0.625ms ≈ 127.5ms) */
    static const struct bt_le_adv_param adv_param = BT_LE_ADV_PARAM_INIT(
        BT_LE_ADV_OPT_CONN, 0x00CC, 0x00CC, NULL);
    int err = bt_le_adv_start(&adv_param, ad, ARRAY_SIZE(ad), sd, ARRAY_SIZE(sd));
    if (err) {
        LOG_ERR("Advertising failed (err %d)", err);
    } else {
        LOG_INF("Advertising as 'NXS MTB Pod'");
        k_timer_start(&adv_timeout_timer, K_MINUTES(ADV_TIMEOUT_MIN), K_NO_WAIT);
    }
}

static void adv_restart_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    start_advertising();
}

/*── Advertising timeout ──*/
static void adv_timeout_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    k_work_submit(&adv_timeout_work);
}

static void adv_timeout_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    if (app.current_conn) {
        return;  /* Don't sleep while connected */
    }
    NUS_LOG("Idle %d min — sleeping", ADV_TIMEOUT_MIN);
    enter_system_off();
}

/*── Pending shift ──*/
static void pending_shift_set(uint8_t btn_id)
{
    app.pending_shift = btn_id;  /* Last press wins */
}

static void pending_shift_flush(void)
{
    if (app.pending_shift != 0xFF) {
        uint8_t btn_id = app.pending_shift;
        app.pending_shift = 0xFF;
        send_press_release(btn_id);
    }
}

/*── Deep sleep (System OFF) ──*/
static void enter_system_off(void)
{
    /* On USB (dev/charging) don't power off — just stop advertising so the
     * board stays alive for the serial console. radio_wake() resumes it. */
    if (NRF_POWER->USBREGSTATUS & POWER_USBREGSTATUS_VBUSDETECT_Msk) {
        bt_le_adv_stop();
        app.radio_sleeping = true;
        NUS_LOG("Radio sleep (USB present — no System OFF)");
        return;
    }

    NUS_LOG("System OFF (wake: pair button)");
    bt_le_adv_stop();
    k_msleep(50);  /* let the NUS/serial message flush before powering down */

    /* Arm pair button (P0.20, active low) as the System OFF wake source.
     * SENSE_LOW fires DETECT when the button is pressed, triggering a reset.
     * Pull-up is retained through System OFF. */
    nrf_gpio_cfg_input(WAKE_PIN_PAIR, NRF_GPIO_PIN_PULLUP);
    nrf_gpio_cfg_sense_set(WAKE_PIN_PAIR, NRF_GPIO_PIN_SENSE_LOW);

    sys_poweroff();  /* does not return — wake is a cold boot */
}

/*── Radio sleep/wake ──*/
void radio_wake(void)
{
    if (!app.radio_sleeping) {
        return;
    }
    app.radio_sleeping = false;
    start_advertising();
    /* Give hub ADV_WAKE_TIMEOUT_SEC to connect, then sleep again */
    k_timer_start(&adv_timeout_timer, K_SECONDS(ADV_WAKE_TIMEOUT_SEC), K_NO_WAIT);
    NUS_LOG("Radio wake (button press)");
}

void radio_force_sleep(void)
{
    k_timer_stop(&adv_timeout_timer);
    enter_system_off();
}

/*── Latency management ──*/
static void latency_escalation_timer_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    k_work_submit(&latency_escalation_work);
}

static void latency_escalation_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    if (!app.current_conn || app.latency_relaxed) {
        return;
    }
    uint16_t sv_to = supervision_to_for(LATENCY_RELAXED);
    struct bt_le_conn_param param = BT_LE_CONN_PARAM_INIT(
        CONN_INTERVAL, CONN_INTERVAL, LATENCY_RELAXED, sv_to);
    int err = bt_conn_le_param_update(app.current_conn, &param);
    if (err) {
        NUS_LOG("Latency escalation failed: %d", err);
    } else {
        app.latency_relaxed = true;
        NUS_LOG("Latency relaxed (%u)", LATENCY_RELAXED);
    }
}

static void latency_tighten(void)
{
    if (!app.current_conn || !app.latency_relaxed) {
        return;
    }
    uint16_t sv_to = supervision_to_for(LATENCY_NORMAL);
    struct bt_le_conn_param param = BT_LE_CONN_PARAM_INIT(
        CONN_INTERVAL, CONN_INTERVAL, LATENCY_NORMAL, sv_to);
    int err = bt_conn_le_param_update(app.current_conn, &param);
    if (err) {
        NUS_LOG("Latency tighten failed: %d", err);
    } else {
        NUS_LOG("Latency normal (%d)", LATENCY_NORMAL);
    }
    app.latency_relaxed = false;
}

void radio_force_latency_escalation(void)
{
    latency_escalation_work_handler(NULL);
}

/*── Send protocol messages ──*/
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

void send_battery(void)
{
    uint8_t mac[MAC_LEN];
    get_own_mac(mac);

    uint8_t frame[FRAME_LEN];
    protocol_encode_battery(frame, mac, (uint16_t)(app.battery_mv > 0 ? app.battery_mv : 0));
    gatt_notify_msg(frame, sizeof(frame));
}

void send_shift_or_queue(uint8_t btn_id)
{
    if (app.radio_sleeping || !app.current_conn) {
        pending_shift_set(btn_id);
        radio_wake();
    } else {
        send_press_release(btn_id);
    }
}

/*── Pairing mode ──*/
void set_pairing_mode(bool enable)
{
    app.mfr_data[10] = enable ? MFR_FLAG_PAIRING : MFR_FLAG_NORMAL;

    if (!app.current_conn) {
        bt_le_adv_stop();
        start_advertising();
    }

    led_set(enable ? 1 : 0);

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

/*── Pending blink/flush ──*/
static void pending_blink_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    if (app.pending_shift != 0xFF) {
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

/*── GATT PIN callback ──*/
static void on_pin_write(const uint8_t *data, uint16_t len)
{
    LOG_INF("PIN exchange (%u bytes) -> ACK", len);
    static const uint8_t ack = 0x01;
    gatt_notify_pin(&ack, 1);
    led_blink();
}

/*── BLE connection callbacks ──*/
static void connected(struct bt_conn *conn, uint8_t err)
{
    if (err) {
        LOG_ERR("Connection failed (err %u)", err);
        return;
    }
    app.current_conn = bt_conn_ref(conn);
    NUS_LOG("HUB CONNECTED");
    set_pairing_mode(false);
    k_timer_stop(&adv_timeout_timer);
    app.radio_sleeping = false;
    /* Start lever ADC polling — only needed while connected */
    buttons_lever_poll_start();
    /* Start latency escalation timer */
    app.latency_relaxed = false;
    k_timer_start(&latency_timer, K_MINUTES(LATENCY_ESCALATION_MIN), K_NO_WAIT);
}

static void disconnected(struct bt_conn *conn, uint8_t reason)
{
    NUS_LOG("HUB DISCONNECTED (reason %u)", reason);
    if (app.current_conn) {
        bt_conn_unref(app.current_conn);
        app.current_conn = NULL;
    }
    /* Stop lever ADC polling — no hub to send shifts to */
    buttons_lever_poll_stop();
    k_timer_stop(&latency_timer);
    app.latency_relaxed = false;
    /* Schedule advertising restart after BLE stack cleanup completes */
    k_work_schedule(&adv_restart_work, K_MSEC(500));
}

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
        if (app.pending_shift != 0xFF) {
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

/*── SMP auth callbacks ──*/
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

/*── Init ──*/
void radio_init(void)
{
    fill_mfr_data();
    bt_conn_auth_cb_register(&auth_cb);
    bt_conn_auth_info_cb_register(&auth_info_cb);
    gatt_set_pin_write_cb(on_pin_write);
    start_advertising();
}
