/* firmware-pod/src/main.c — application entry point */
#include <zephyr/kernel.h>
#include <zephyr/drivers/uart.h>
#include <zephyr/usb/usb_device.h>
#include <zephyr/logging/log.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/settings/settings.h>
#include <hal/nrf_gpio.h>
#include <zephyr/drivers/watchdog.h>

#include "app.h"
#include "led.h"
#include "battery.h"
#include "radio.h"
#include "buttons.h"
#include "commands.h"

LOG_MODULE_REGISTER(main, LOG_LEVEL_INF);

struct app_state app = {
    .pending_shift = 0xFF,
};

static void usb_status_cb(enum usb_dc_status_code status, const uint8_t *param)
{
    ARG_UNUSED(param);
    switch (status) {
    case USB_DC_CONFIGURED:
    case USB_DC_RESUME:
        app.usb_active = true;
        break;
    case USB_DC_DISCONNECTED:
    case USB_DC_SUSPEND:
        app.usb_active = false;
        break;
    default:
        break;
    }
}

int main(void)
{
    usb_enable(usb_status_cb);

    /* Only wait for USB enumeration if cable is plugged in */
    if (NRF_POWER->USBREGSTATUS & POWER_USBREGSTATUS_VBUSDETECT_Msk) {
        k_msleep(1000);
    }

    led_init();
    LOG_INF("NXS pod firmware v0.1.0 (Zephyr)");

    battery_init();

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

    radio_init();
    buttons_init();
    commands_init();

    /* Print help banner to serial */
    print_help();

    /* Silent battery check every 15min (updates cached battery_mv) */
    battery_periodic_start();

    /* Watchdog: reboot if main loop stalls for >10s */
    const struct device *wdt = DEVICE_DT_GET(DT_NODELABEL(wdt0));
    int wdt_channel = -1;
    if (device_is_ready(wdt)) {
        struct wdt_timeout_cfg wdt_cfg = {
            .window.min = 0,
            .window.max = 10000,
            .callback = NULL,
            .flags = WDT_FLAG_RESET_SOC,
        };
        wdt_channel = wdt_install_timeout(wdt, &wdt_cfg);
        if (wdt_channel >= 0) {
            wdt_setup(wdt, WDT_OPT_PAUSE_HALTED_BY_DBG);
            LOG_INF("Watchdog started (10s timeout)");
        } else {
            LOG_WRN("Watchdog timeout install failed: %d", wdt_channel);
        }
    } else {
        LOG_WRN("Watchdog device not ready");
    }

    /* Main loop: poll serial (USB CDC doesn't support interrupt-driven rx) */
    const struct device *console = DEVICE_DT_GET(DT_CHOSEN(zephyr_console));
    uint8_t ch;

    while (1) {
        if (wdt_channel >= 0) {
            wdt_feed(wdt, wdt_channel);
        }

        if (app.usb_active && uart_poll_in(console, &ch) == 0) {
            handle_command(ch);
        }

        /* Sleep longer when no USB — serial polling is pointless without a host.
         * Buttons and BLE are interrupt-driven, so nothing is missed. */
        k_msleep(app.usb_active ? 50 : 5000);
    }
    return 0;
}
