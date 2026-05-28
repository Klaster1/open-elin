/* firmware-pod/src/gatt.c */
#include "gatt.h"
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/bluetooth/gatt.h>
#include <zephyr/logging/log.h>
#include <stdbool.h>
#include <string.h>

LOG_MODULE_REGISTER(gatt, LOG_LEVEL_INF);

/* BikeNet service UUID: a5c1c000-cc20-ba91-0c1a-ef3f9e643d79 */
static struct bt_uuid_128 svc_uuid = BT_UUID_INIT_128(
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x00, 0xC0, 0xC1, 0xA5);

/* MSG characteristic UUID: a5c1cc01-cc20-ba91-0c1a-ef3f9e643d79 */
static struct bt_uuid_128 msg_uuid = BT_UUID_INIT_128(
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x01, 0xCC, 0xC1, 0xA5);

/* PIN characteristic UUID: a5c1cc02-cc20-ba91-0c1a-ef3f9e643d79 */
static struct bt_uuid_128 pin_uuid = BT_UUID_INIT_128(
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x02, 0xCC, 0xC1, 0xA5);

static gatt_write_cb_t msg_write_cb;
static gatt_write_cb_t pin_write_cb;

static uint8_t msg_buf[20];
static uint8_t pin_buf[20];

void gatt_set_msg_write_cb(gatt_write_cb_t cb) { msg_write_cb = cb; }
void gatt_set_pin_write_cb(gatt_write_cb_t cb) { pin_write_cb = cb; }

static ssize_t msg_write(struct bt_conn *conn, const struct bt_gatt_attr *attr,
                         const void *buf, uint16_t len, uint16_t offset, uint8_t flags)
{
    if (offset + len > sizeof(msg_buf)) {
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_OFFSET);
    }
    memcpy(msg_buf + offset, buf, len);
    LOG_HEXDUMP_INF(msg_buf, len, "<- MSG");
    if (msg_write_cb) {
        msg_write_cb(msg_buf, len);
    }
    return len;
}

static ssize_t pin_write(struct bt_conn *conn, const struct bt_gatt_attr *attr,
                         const void *buf, uint16_t len, uint16_t offset, uint8_t flags)
{
    if (offset + len > sizeof(pin_buf)) {
        return BT_GATT_ERR(BT_ATT_ERR_INVALID_OFFSET);
    }
    memcpy(pin_buf + offset, buf, len);
    LOG_HEXDUMP_INF(pin_buf, len, "<- PIN");
    if (pin_write_cb) {
        pin_write_cb(pin_buf, len);
    }
    return len;
}

static void msg_ccc_changed(const struct bt_gatt_attr *attr, uint16_t value)
{
    LOG_INF("MSG notifications %s", value == BT_GATT_CCC_NOTIFY ? "enabled" : "disabled");
}

static void pin_ccc_changed(const struct bt_gatt_attr *attr, uint16_t value)
{
    LOG_INF("PIN notifications %s", value == BT_GATT_CCC_NOTIFY ? "enabled" : "disabled");
}

/* GATT service layout:
 * [0] Primary Service declaration
 * [1] MSG Characteristic declaration
 * [2] MSG Value attribute (write handler)
 * [3] MSG CCC descriptor
 * [4] PIN Characteristic declaration
 * [5] PIN Value attribute (write handler)
 * [6] PIN CCC descriptor
 */
BT_GATT_SERVICE_DEFINE(bikenet_svc,
    BT_GATT_PRIMARY_SERVICE(&svc_uuid),

    /* MSG: write + write_no_resp + notify */
    BT_GATT_CHARACTERISTIC(&msg_uuid.uuid,
        BT_GATT_CHRC_WRITE | BT_GATT_CHRC_WRITE_WITHOUT_RESP | BT_GATT_CHRC_NOTIFY,
        BT_GATT_PERM_WRITE,
        NULL, msg_write, NULL),
    BT_GATT_CCC(msg_ccc_changed, BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),

    /* PIN: write + write_no_resp + notify */
    BT_GATT_CHARACTERISTIC(&pin_uuid.uuid,
        BT_GATT_CHRC_WRITE | BT_GATT_CHRC_WRITE_WITHOUT_RESP | BT_GATT_CHRC_NOTIFY,
        BT_GATT_PERM_WRITE,
        NULL, pin_write, NULL),
    BT_GATT_CCC(pin_ccc_changed, BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),
);

int gatt_notify_msg(const uint8_t *data, size_t len)
{
    return bt_gatt_notify(NULL, &bikenet_svc.attrs[2], data, len);
}

int gatt_notify_pin(const uint8_t *data, size_t len)
{
    return bt_gatt_notify(NULL, &bikenet_svc.attrs[5], data, len);
}

/*── Nordic UART Service (NUS) ──────────────────────────────────────────────*/
/* UUID: 6e400001-b5a3-f393-e0a9-e50e24dcca9e */
static struct bt_uuid_128 nus_svc_uuid = BT_UUID_INIT_128(
    0x9E, 0xCA, 0xDC, 0x24, 0x0E, 0xE5, 0xA9, 0xE0,
    0x93, 0xF3, 0xA3, 0xB5, 0x01, 0x00, 0x40, 0x6E);

/* NUS TX (pod→phone): 6e400003-b5a3-f393-e0a9-e50e24dcca9e */
static struct bt_uuid_128 nus_tx_uuid = BT_UUID_INIT_128(
    0x9E, 0xCA, 0xDC, 0x24, 0x0E, 0xE5, 0xA9, 0xE0,
    0x93, 0xF3, 0xA3, 0xB5, 0x03, 0x00, 0x40, 0x6E);

/* NUS RX (phone→pod): 6e400002-b5a3-f393-e0a9-e50e24dcca9e */
static struct bt_uuid_128 nus_rx_uuid = BT_UUID_INIT_128(
    0x9E, 0xCA, 0xDC, 0x24, 0x0E, 0xE5, 0xA9, 0xE0,
    0x93, 0xF3, 0xA3, 0xB5, 0x02, 0x00, 0x40, 0x6E);

static volatile bool nus_subscribed;
static gatt_write_cb_t nus_rx_cb;
static gatt_nus_subscribe_cb_t nus_subscribe_cb;

void gatt_set_nus_rx_cb(gatt_write_cb_t cb) { nus_rx_cb = cb; }
void gatt_set_nus_subscribe_cb(gatt_nus_subscribe_cb_t cb) { nus_subscribe_cb = cb; }

static void nus_ccc_changed(const struct bt_gatt_attr *attr, uint16_t value)
{
    nus_subscribed = (value == BT_GATT_CCC_NOTIFY);
    LOG_INF("NUS TX notifications %s", nus_subscribed ? "enabled" : "disabled");
    if (nus_subscribe_cb) {
        nus_subscribe_cb(nus_subscribed);
    }
}

static ssize_t nus_rx_write(struct bt_conn *conn, const struct bt_gatt_attr *attr,
                            const void *buf, uint16_t len, uint16_t offset, uint8_t flags)
{
    if (len > 0 && nus_rx_cb) {
        nus_rx_cb(buf, len);
    }
    return len;
}

BT_GATT_SERVICE_DEFINE(nus_svc,
    BT_GATT_PRIMARY_SERVICE(&nus_svc_uuid),

    /* TX: notify only (pod → phone) */
    BT_GATT_CHARACTERISTIC(&nus_tx_uuid.uuid,
        BT_GATT_CHRC_NOTIFY,
        BT_GATT_PERM_NONE,
        NULL, NULL, NULL),
    BT_GATT_CCC(nus_ccc_changed, BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),

    /* RX: write (phone → pod) */
    BT_GATT_CHARACTERISTIC(&nus_rx_uuid.uuid,
        BT_GATT_CHRC_WRITE | BT_GATT_CHRC_WRITE_WITHOUT_RESP,
        BT_GATT_PERM_WRITE,
        NULL, nus_rx_write, NULL),
);

bool gatt_nus_is_subscribed(void)
{
    return nus_subscribed;
}

int gatt_nus_send(const char *str, size_t len)
{
    if (!nus_subscribed || len == 0) {
        return 0;
    }
    return bt_gatt_notify(NULL, &nus_svc.attrs[1], str, len);
}
