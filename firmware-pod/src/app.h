/* firmware-pod/src/app.h — shared application state */
#pragma once

#include <zephyr/kernel.h>
#include <zephyr/bluetooth/conn.h>
#include <zephyr/logging/log.h>
#include "gatt.h"

/*── Shared mutable state ──*/
struct app_state {
    struct bt_conn *current_conn;
    volatile bool   radio_sleeping;
    volatile bool   usb_active;
    int32_t         battery_mv;     /* updated every 15min, on connect, and on 'v' */
    uint8_t         pending_shift;  /* btn_id to send once hub connects (0xFF = none) */
    bool            latency_relaxed;
    bool            lever_adc_debug;
    uint8_t         mfr_data[11];   /* 2 company ID + 2 type + 6 MAC + 1 flag */
};

extern struct app_state app;

/*── Button IDs ──*/
#define BTN_SHIFT_UP   0x00
#define BTN_SHIFT_DOWN 0x01
#define BTN_TUNE       0x02

/* Log to both console and BLE NUS (if subscribed). */
#define NUS_LOG(fmt, ...) do { \
    LOG_INF(fmt, ##__VA_ARGS__); \
    if (gatt_nus_is_subscribed()) { \
        char _nb[80]; \
        int _nl = snprintf(_nb, sizeof(_nb), fmt "\n", ##__VA_ARGS__); \
        if (_nl > 0) { gatt_nus_send(_nb, MIN((size_t)_nl, sizeof(_nb))); } \
    } \
} while (0)
