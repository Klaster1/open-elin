/* firmware-pod/src/led.c — LED blink and battery pulse indicator */
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/drivers/pwm.h>
#include <zephyr/logging/log.h>

#include "led.h"

LOG_MODULE_DECLARE(main, LOG_LEVEL_INF);

#define LED0_NODE DT_ALIAS(led0)
static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(LED0_NODE, gpios);

static const struct pwm_dt_spec pwm_led = PWM_DT_SPEC_GET(DT_NODELABEL(pwm_led0));

/*── LED blink ──*/
static void led_off_work_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(led_off_work, led_off_work_handler);

static void led_off_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    gpio_pin_set_dt(&led, 0);
}

void led_blink(void)
{
    gpio_pin_set_dt(&led, 1);
    k_work_schedule(&led_off_work, K_MSEC(50));
}

void led_set(int value)
{
    gpio_pin_set_dt(&led, value);
}

/*── PWM battery pulse ──*/
static void led_pulse_handler(struct k_work *work);
static K_WORK_DELAYABLE_DEFINE(led_pulse_work, led_pulse_handler);

#define FADE_STEPS     12
#define FADE_STEP_MS   6
#define HOLD_MS        50
#define GAP_MS         80
#define PULSE_PCT       5  /* low brightness — just visible */

enum pulse_phase { PHASE_FADE_IN, PHASE_HOLD, PHASE_FADE_OUT, PHASE_GAP };
static uint8_t pulse_total;
static uint8_t pulse_current;
static enum pulse_phase pulse_phase;
static uint8_t fade_step;

static inline void pwm_set_pct(uint8_t pct)
{
    pwm_set_pulse_dt(&pwm_led, pwm_led.period * pct / 100);
}

static void led_pulse_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    switch (pulse_phase) {
    case PHASE_FADE_IN:
        fade_step++;
        pwm_set_pct(fade_step * PULSE_PCT / FADE_STEPS);
        if (fade_step >= FADE_STEPS) {
            pulse_phase = PHASE_HOLD;
            k_work_schedule(&led_pulse_work, K_MSEC(HOLD_MS));
        } else {
            k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
        }
        break;
    case PHASE_HOLD:
        pulse_phase = PHASE_FADE_OUT;
        fade_step = FADE_STEPS;
        k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
        break;
    case PHASE_FADE_OUT:
        fade_step--;
        pwm_set_pct(fade_step * PULSE_PCT / FADE_STEPS);
        if (fade_step == 0) {
            pulse_current++;
            if (pulse_current < pulse_total) {
                pulse_phase = PHASE_GAP;
                k_work_schedule(&led_pulse_work, K_MSEC(GAP_MS));
            }
            /* else done — LED already off */
        } else {
            k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
        }
        break;
    case PHASE_GAP:
        pulse_phase = PHASE_FADE_IN;
        fade_step = 0;
        k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
        break;
    }
}

void led_battery_flash(int32_t mv)
{
    if (mv < 3000) { mv = 3000; }
    if (mv > 4200) { mv = 4200; }

    uint8_t pulses = 1 + (uint8_t)((uint32_t)(mv - 3000) * 8 / 1200);

    k_work_cancel_delayable(&led_pulse_work);
    pulse_total = pulses;
    pulse_current = 0;
    pulse_phase = PHASE_FADE_IN;
    fade_step = 0;

    pwm_set_pct(0);
    LOG_INF("Battery pulse: %u pulses (%d mV)", pulses, mv);

    k_work_schedule(&led_pulse_work, K_MSEC(FADE_STEP_MS));
}

int led_init(void)
{
    gpio_pin_configure_dt(&led, GPIO_OUTPUT_INACTIVE);
    if (!pwm_is_ready_dt(&pwm_led)) {
        LOG_ERR("PWM LED not ready");
    }
    return 0;
}
