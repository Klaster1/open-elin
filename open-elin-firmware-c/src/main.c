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
#include <nrfx.h>

#include "protocol.h"
#include "gatt.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

#define LED0_NODE DT_ALIAS(led0)
static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(LED0_NODE, gpios);

/*── Bootloader entry ──*/
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

static uint8_t mfr_data[12];

static const struct bt_data ad[] = {
    BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR),
    BT_DATA(BT_DATA_MANUFACTURER_DATA, mfr_data, sizeof(mfr_data)),
    BT_DATA(BT_DATA_NAME_COMPLETE, "NXS MTB Pod", 11),
};

static const struct bt_data sd[] = {
    BT_DATA(BT_DATA_UUID128_ALL, svc_uuid_le, sizeof(svc_uuid_le)),
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
    mfr_data[10] = 0x00;
    mfr_data[11] = 0x00;
}

static void start_advertising(void)
{
    int err = bt_le_adv_start(BT_LE_ADV_CONN_FAST_1, ad, ARRAY_SIZE(ad), sd, ARRAY_SIZE(sd));
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

/*── BLE connection callbacks ──*/
static struct bt_conn *current_conn;

static void connected(struct bt_conn *conn, uint8_t err)
{
    if (err) {
        LOG_ERR("Connection failed (err %u)", err);
        return;
    }
    current_conn = bt_conn_ref(conn);
    LOG_INF("HUB CONNECTED");
    gpio_pin_set_dt(&led, 1);
}

static void disconnected(struct bt_conn *conn, uint8_t reason)
{
    LOG_INF("HUB DISCONNECTED (reason %u)", reason);
    gpio_pin_set_dt(&led, 0);
    if (current_conn) {
        bt_conn_unref(current_conn);
        current_conn = NULL;
    }
    /* Schedule advertising restart after BLE stack cleanup completes */
    k_work_schedule(&adv_restart_work, K_MSEC(500));
}

BT_CONN_CB_DEFINE(conn_callbacks) = {
    .connected = connected,
    .disconnected = disconnected,
};

/*── GATT callbacks ──*/
static void on_msg_write(const uint8_t *data, uint16_t len)
{
    struct shift_complete sc;
    if (protocol_parse_shift_complete(data, len, &sc) == 0) {
        LOG_INF("ShiftComplete: gear=%u", sc.gear);
    }
}

static void on_pin_write(const uint8_t *data, uint16_t len)
{
    LOG_INF("PIN exchange (%u bytes) -> ACK", len);
    static const uint8_t ack = 0x01;
    gatt_notify_pin(&ack, 1);
}

/*── Button helpers ──*/
#define BTN_SHIFT_UP   0x00
#define BTN_SHIFT_DOWN 0x01
#define BATTERY_MV     3000

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

    LOG_INF("-> button 0x%02X press+release", btn_id);
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
    usb_enable(NULL);
    k_msleep(1000);

    gpio_pin_configure_dt(&led, GPIO_OUTPUT_INACTIVE);

    LOG_INF("NXS pod firmware v0.1.0 (Zephyr)");
    LOG_INF("Commands: u=up d=down B=bootloader");

    /* BLE init */
    int err = bt_enable(NULL);
    if (err) {
        LOG_ERR("BT init failed (err %d)", err);
        return 1;
    }

    fill_mfr_data();
    gatt_set_msg_write_cb(on_msg_write);
    gatt_set_pin_write_cb(on_pin_write);
    start_advertising();

    /* Battery report every 5s via timer (runs in ISR context) */
    k_timer_start(&battery_timer, K_SECONDS(5), K_SECONDS(5));

    /* Main loop: poll serial (USB CDC doesn't support interrupt-driven rx) */
    const struct device *console = DEVICE_DT_GET(DT_CHOSEN(zephyr_console));
    uint8_t ch;

    while (1) {
        if (uart_poll_in(console, &ch) == 0) {
            if (ch == 'u') {
                send_press_release(BTN_SHIFT_UP);
            } else if (ch == 'd') {
                send_press_release(BTN_SHIFT_DOWN);
            } else if (ch == 'B') {
                LOG_INF("Entering bootloader...");
                k_msleep(100);
                enter_bootloader();
            }
        }

        k_msleep(50);
    }
    return 0;
}
