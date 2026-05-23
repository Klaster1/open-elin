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

/* Callback type for incoming writes. */
typedef void (*gatt_write_cb_t)(const uint8_t *data, uint16_t len);

void gatt_set_msg_write_cb(gatt_write_cb_t cb);
void gatt_set_pin_write_cb(gatt_write_cb_t cb);

#endif /* GATT_H */
