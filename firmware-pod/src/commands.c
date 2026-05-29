/* firmware-pod/src/commands.c — Serial and NUS command handling */
#include <zephyr/kernel.h>
#include <zephyr/sys/reboot.h>
#include <zephyr/logging/log.h>
#include <hal/nrf_gpio.h>

#include "app.h"
#include "commands.h"
#include "radio.h"
#include "led.h"
#include "battery.h"
#include "gatt.h"

LOG_MODULE_DECLARE(main, LOG_LEVEL_INF);

static void enter_bootloader(void)
{
    NRF_POWER->GPREGRET = 0x57;
    sys_reboot(SYS_REBOOT_COLD);
}

void print_help(void)
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

void handle_command(uint8_t ch)
{
    if (ch == 'u') {
        send_shift_or_queue(BTN_SHIFT_UP);
    } else if (ch == 'd') {
        send_shift_or_queue(BTN_SHIFT_DOWN);
    } else if (ch == 't') {
        send_shift_or_queue(BTN_TUNE);
    } else if (ch == 'p') {
        if (app.radio_sleeping) {
            radio_wake();
        }
    } else if (ch == 'P') {
        set_pairing_mode(true);
    } else if (ch == 'B') {
        NUS_LOG("Entering bootloader...");
        k_msleep(100);
        enter_bootloader();
    } else if (ch == 'S') {
        if (app.current_conn) {
            NUS_LOG("Can't sleep while connected");
        } else {
            radio_force_sleep();
        }
    } else if (ch == 'L') {
        radio_force_latency_escalation();
    } else if (ch == 'v') {
        app.battery_mv = read_battery_mv();
        NUS_LOG("Battery: %d mV%s", app.battery_mv, app.usb_active ? " (USB)" : "");
    } else if (ch >= '0' && ch <= '9') {
        /* Simulate battery level: 0=3000mV(dead) .. 9=4200mV(full) */
        int32_t sim_mv = 3000 + (ch - '0') * 1200 / 9;
        app.battery_mv = sim_mv;
        led_battery_flash(sim_mv);
        NUS_LOG("Sim battery: %d mV (key %c)", sim_mv, ch);
    } else if (ch == 'a') {
        app.lever_adc_debug = !app.lever_adc_debug;
        NUS_LOG("Lever ADC debug: %s", app.lever_adc_debug ? "ON (10ms)" : "OFF");
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

void commands_init(void)
{
    gatt_set_nus_rx_cb(on_nus_rx);
    gatt_set_nus_subscribe_cb(on_nus_subscribe);
}
