/* open-elin-firmware-c/src/gatt.h */
#ifndef GATT_H
#define GATT_H

#include <zephyr/bluetooth/gatt.h>
#include <stdint.h>
#include <stddef.h>

/* Send a notification on the MSG characteristic. */
int gatt_notify_msg(const uint8_t *data, size_t len);

/* Send a notification on the PIN characteristic. */
int gatt_notify_pin(const uint8_t *data, size_t len);

/* Send a string over BLE NUS TX (no-op if nobody subscribed). */
int gatt_nus_send(const char *str, size_t len);

/* Returns true if a NUS client has subscribed to TX notifications. */
bool gatt_nus_is_subscribed(void);

/* Callback type for incoming writes. */
typedef void (*gatt_write_cb_t)(const uint8_t *data, uint16_t len);

void gatt_set_msg_write_cb(gatt_write_cb_t cb);
void gatt_set_pin_write_cb(gatt_write_cb_t cb);
void gatt_set_nus_rx_cb(gatt_write_cb_t cb);

/* Called when NUS TX notifications are enabled/disabled. */
typedef void (*gatt_nus_subscribe_cb_t)(bool subscribed);
void gatt_set_nus_subscribe_cb(gatt_nus_subscribe_cb_t cb);

#endif /* GATT_H */
