/* open-elin-firmware-c/src/main.c */
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
#include <nrfx.h>

#include "protocol.h"
#include "gatt.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

#define LED0_NODE DT_ALIAS(led0)
static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(LED0_NODE, gpios);

static const struct gpio_dt_spec btn_up = GPIO_DT_SPEC_GET(DT_ALIAS(sw0), gpios);   /* P0.17 */
static const struct gpio_dt_spec btn_down = GPIO_DT_SPEC_GET(DT_ALIAS(sw1), gpios); /* P0.31 */
static const struct gpio_dt_spec btn_pair = GPIO_DT_SPEC_GET(DT_ALIAS(sw2), gpios); /* P0.20 */
static struct gpio_callback btn_up_cb_data;
static struct gpio_callback btn_down_cb_data;
static struct gpio_callback btn_pair_cb_data;

/*── USB VBUS detection ──*/
static volatile bool usb_active;

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

/*── BLE connection callbacks ──*/
static struct bt_conn *current_conn;

static void connected(struct bt_conn *conn, uint8_t err)
{
    if (err) {
        LOG_ERR("Connection failed (err %u)", err);
        return;
    }
    current_conn = bt_conn_ref(conn);
    NUS_LOG("HUB CONNECTED");
}

static void disconnected(struct bt_conn *conn, uint8_t reason)
{
    NUS_LOG("HUB DISCONNECTED (reason %u)", reason);
    if (current_conn) {
        bt_conn_unref(current_conn);
        current_conn = NULL;
    }
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
    }
}

BT_CONN_CB_DEFINE(conn_callbacks) = {
    .connected = connected,
    .disconnected = disconnected,
    .security_changed = security_changed,
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
    LOG_ERR("SMP: pairing FAILED (reason %d)", reason);
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

/* Forward declaration for NUS command processing */
static void send_press_release(uint8_t btn_id);
static void set_pairing_mode(bool enable);

#define BTN_SHIFT_UP   0x00
#define BTN_SHIFT_DOWN 0x01

static void handle_command(uint8_t ch)
{
    if (ch == 'u') {
        send_press_release(BTN_SHIFT_UP);
    } else if (ch == 'd') {
        send_press_release(BTN_SHIFT_DOWN);
    } else if (ch == 'p') {
        set_pairing_mode(true);
    } else if (ch == 'B') {
        NUS_LOG("Entering bootloader...");
        k_msleep(100);
        enter_bootloader();
    }
}

static void on_nus_rx(const uint8_t *data, uint16_t len)
{
    if (len == 0) return;
    handle_command(data[0]);
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

/*── GPIO button interrupts ──*/
static void btn_up_work_handler(struct k_work *work);
static void btn_down_work_handler(struct k_work *work);
static void btn_pair_work_handler(struct k_work *work);
static K_WORK_DEFINE(btn_up_work, btn_up_work_handler);
static K_WORK_DEFINE(btn_down_work, btn_down_work_handler);
static K_WORK_DEFINE(btn_pair_work, btn_pair_work_handler);

static void btn_up_isr(const struct device *dev, struct gpio_callback *cb, uint32_t pins)
{
    ARG_UNUSED(dev); ARG_UNUSED(cb); ARG_UNUSED(pins);
    k_work_submit(&btn_up_work);
}

static void btn_down_isr(const struct device *dev, struct gpio_callback *cb, uint32_t pins)
{
    ARG_UNUSED(dev); ARG_UNUSED(cb); ARG_UNUSED(pins);
    k_work_submit(&btn_down_work);
}

static void btn_pair_isr(const struct device *dev, struct gpio_callback *cb, uint32_t pins)
{
    ARG_UNUSED(dev); ARG_UNUSED(cb); ARG_UNUSED(pins);
    k_work_submit(&btn_pair_work);
}

/*── Button helpers ──*/
#define BATTERY_MV     3000
#define DEBOUNCE_MS    150

static int64_t last_btn_up_ms;
static int64_t last_btn_down_ms;
static int64_t last_btn_pair_ms;

static void get_own_mac(uint8_t mac_le[MAC_LEN])
{
    bt_addr_le_t addr;
    size_t count = 1;
    bt_id_get(&addr, &count);
    memcpy(mac_le, addr.a.val, 6);
}

static void send_press_release(uint8_t btn_id)
{
    uint8_t mac[MAC_LEN];
    get_own_mac(mac);

    uint8_t frame[FRAME_LEN];
    protocol_encode_button(frame, mac, btn_id, ACTION_PRESS);
    gatt_notify_msg(frame, sizeof(frame));
    k_msleep(50);
    protocol_encode_button(frame, mac, btn_id, ACTION_RELEASE);
    gatt_notify_msg(frame, sizeof(frame));

    NUS_LOG("-> button 0x%02X press+release", btn_id);
    led_blink();
}

static void btn_up_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    int64_t now = k_uptime_get();
    if (now - last_btn_up_ms < DEBOUNCE_MS) { return; }
    last_btn_up_ms = now;
    send_press_release(BTN_SHIFT_UP);
}

static void btn_down_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    int64_t now = k_uptime_get();
    if (now - last_btn_down_ms < DEBOUNCE_MS) { return; }
    last_btn_down_ms = now;
    send_press_release(BTN_SHIFT_DOWN);
}

static void btn_pair_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    int64_t now = k_uptime_get();
    if (now - last_btn_pair_ms < DEBOUNCE_MS) { return; }
    last_btn_pair_ms = now;
    set_pairing_mode(true);
}

static void send_battery(void)
{
    uint8_t mac[MAC_LEN];
    get_own_mac(mac);

    uint8_t frame[FRAME_LEN];
    protocol_encode_battery(frame, mac, BATTERY_MV);
    gatt_notify_msg(frame, sizeof(frame));
}

/*── Battery timer ──*/
static void battery_timer_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    send_battery();
}
static K_TIMER_DEFINE(battery_timer, battery_timer_handler, NULL);

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
    LOG_INF("Commands: u=up d=down p=pair B=bootloader");

    /* BLE init */
    int err = bt_enable(NULL);
    if (err) {
        LOG_ERR("BT init failed (err %d)", err);
        return 1;
    }

    /* Load bond info from NVS */
    settings_subsys_init();
    settings_load();
    LOG_INF("Settings loaded (bonds from NVS)");

    fill_mfr_data();
    bt_conn_auth_cb_register(&auth_cb);
    bt_conn_auth_info_cb_register(&auth_info_cb);
    gatt_set_pin_write_cb(on_pin_write);
    gatt_set_nus_rx_cb(on_nus_rx);

    /* GPIO buttons */
    gpio_pin_configure_dt(&btn_up, GPIO_INPUT);
    gpio_pin_configure_dt(&btn_down, GPIO_INPUT);
    gpio_pin_interrupt_configure_dt(&btn_up, GPIO_INT_EDGE_TO_ACTIVE);
    gpio_pin_interrupt_configure_dt(&btn_down, GPIO_INT_EDGE_TO_ACTIVE);
    gpio_init_callback(&btn_up_cb_data, btn_up_isr, BIT(btn_up.pin));
    gpio_init_callback(&btn_down_cb_data, btn_down_isr, BIT(btn_down.pin));
    gpio_add_callback(btn_up.port, &btn_up_cb_data);
    gpio_add_callback(btn_down.port, &btn_down_cb_data);
    gpio_pin_configure_dt(&btn_pair, GPIO_INPUT);
    gpio_pin_interrupt_configure_dt(&btn_pair, GPIO_INT_EDGE_TO_ACTIVE);
    gpio_init_callback(&btn_pair_cb_data, btn_pair_isr, BIT(btn_pair.pin));
    gpio_add_callback(btn_pair.port, &btn_pair_cb_data);
    LOG_INF("GPIO buttons: P0.17=up P0.31=down P0.20=pair");

    start_advertising();

    /* Battery report every 5s via timer (runs in ISR context) */
    k_timer_start(&battery_timer, K_SECONDS(5), K_SECONDS(5));

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
