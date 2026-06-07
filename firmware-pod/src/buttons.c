/* firmware-pod/src/buttons.c — GPIO buttons and lever ADC polling */
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/logging/log.h>
#include <hal/nrf_gpio.h>

#include "app.h"
#include "buttons.h"
#include "radio.h"
#include "led.h"
#include "battery.h"

LOG_MODULE_DECLARE(main, LOG_LEVEL_INF);

/*── GPIO button specs ──*/
static const struct gpio_dt_spec btn_pair = GPIO_DT_SPEC_GET(DT_ALIAS(sw2), gpios); /* P0.20 */
static const struct gpio_dt_spec btn_tune = GPIO_DT_SPEC_GET(DT_ALIAS(sw3), gpios); /* P0.22 */
static struct gpio_callback btn_pair_cb_data;
static struct gpio_callback btn_tune_cb_data;

/*── Lever ADC polling ──*/
#define LEVER_THRESHOLD_MV  300   /* <300mV = button pressed (switch shorts to GND) */
#define LEVER_POLL_MS       10    /* poll every 10ms */
#define DEBOUNCE_MS         150

static int64_t last_shift_ms;     /* shared across up/down to suppress crosstalk */
static bool lever_up_pressed;
static bool lever_down_pressed;

static void lever_poll_work_handler(struct k_work *work);
static K_WORK_DEFINE(lever_poll_work, lever_poll_work_handler);

static void lever_poll_timer_handler(struct k_timer *timer);
static K_TIMER_DEFINE(lever_poll_timer, lever_poll_timer_handler, NULL);

static void lever_poll_timer_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    k_work_submit(&lever_poll_work);
}

static void lever_poll_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    int32_t mv_up = read_lever_up_mv();
    int32_t mv_down = read_lever_down_mv();

    if (app.lever_adc_debug) {
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

void buttons_lever_poll_start(void)
{
    k_timer_start(&lever_poll_timer, K_MSEC(LEVER_POLL_MS), K_MSEC(LEVER_POLL_MS));
}

void buttons_lever_poll_stop(void)
{
    k_timer_stop(&lever_poll_timer);
}

/*── GPIO button handlers ──*/
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

static int64_t last_btn_pair_ms;
static int64_t last_btn_tune_ms;

static void btn_pair_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);

    if (gpio_pin_get_dt(&btn_pair)) {
        /* Button pressed — debounce only the press edge so a quick tap's
         * release is never swallowed (else the 6s hold timer would fire). */
        int64_t now = k_uptime_get();
        if (now - last_btn_pair_ms < DEBOUNCE_MS) { return; }
        last_btn_pair_ms = now;

        /* Wake radio, flash battery level, start 6s hold timer */
        if (app.radio_sleeping) {
            radio_wake();
        }
        /* Fresh battery read + PWM brightness flash */
        app.battery_mv = read_battery_mv();
        led_battery_flash(app.battery_mv);
        NUS_LOG("Battery: %d mV%s", app.battery_mv, app.usb_active ? " (USB)" : "");
        /* Send battery to hub if connected */
        if (app.current_conn) {
            send_battery();
        }
        k_work_schedule(&btn_pair_hold_work, K_SECONDS(6));
    } else {
        /* Button released — always cancel the pending hold (no debounce gate) */
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

/*── Init ──*/
void buttons_init(void)
{
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

    /* Lever ADC polling starts when hub connects (not at boot — saves power) */
    int32_t up0 = read_lever_up_mv();
    int32_t dn0 = read_lever_down_mv();
    LOG_INF("Lever ADC ready: P0.29=up P0.31=down (%dms, <%dmV)",
            LEVER_POLL_MS, LEVER_THRESHOLD_MV);
    LOG_INF("Lever ADC idle: up=%dmV down=%dmV", up0, dn0);
}
