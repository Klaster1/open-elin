/* firmware-pod/src/battery.c — ADC battery and lever reading */
#include <zephyr/kernel.h>
#include <zephyr/drivers/adc.h>
#include <zephyr/logging/log.h>

#include "app.h"
#include "battery.h"

LOG_MODULE_DECLARE(main, LOG_LEVEL_INF);

/*── ADC channel specs ──*/
static const struct adc_dt_spec adc_battery =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 0);
static const struct adc_dt_spec adc_lever_up =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 1);
static const struct adc_dt_spec adc_lever_down =
    ADC_DT_SPEC_GET_BY_IDX(DT_PATH(zephyr_user), 2);

/* VDDHDIV5: internal 1/5 divider on VDDH pin */
#define VDIV_FACTOR 5

int battery_init(void)
{
    if (!adc_is_ready_dt(&adc_battery)) {
        LOG_ERR("ADC device not ready");
        return -ENODEV;
    }
    int err = adc_channel_setup_dt(&adc_battery);
    if (err) {
        LOG_ERR("ADC channel setup failed: %d", err);
        return err;
    }
    LOG_INF("Battery ADC ready (VDDHDIV5 internal)");

    err = adc_channel_setup_dt(&adc_lever_up);
    if (err) {
        LOG_ERR("ADC lever-up setup failed: %d", err);
        return err;
    }
    err = adc_channel_setup_dt(&adc_lever_down);
    if (err) {
        LOG_ERR("ADC lever-down setup failed: %d", err);
        return err;
    }
    LOG_INF("Lever ADC ready (AIN5=up, AIN7=down)");
    return 0;
}

int32_t read_battery_mv(void)
{
    int16_t buf;
    struct adc_sequence seq = {
        .buffer = &buf,
        .buffer_size = sizeof(buf),
    };
    adc_sequence_init_dt(&adc_battery, &seq);
    int err = adc_read_dt(&adc_battery, &seq);
    if (err) {
        LOG_ERR("ADC read failed: %d", err);
        return -1;
    }
    int32_t mv = buf;
    adc_raw_to_millivolts_dt(&adc_battery, &mv);
    return mv * VDIV_FACTOR;
}

static int32_t read_lever_mv(const struct adc_dt_spec *spec)
{
    int16_t buf;
    struct adc_sequence seq = {
        .buffer = &buf,
        .buffer_size = sizeof(buf),
    };
    adc_sequence_init_dt(spec, &seq);
    int err = adc_read_dt(spec, &seq);
    if (err) {
        return -1;
    }
    int32_t mv = buf;
    adc_raw_to_millivolts_dt(spec, &mv);
    return mv;
}

int32_t read_lever_up_mv(void)
{
    return read_lever_mv(&adc_lever_up);
}

int32_t read_lever_down_mv(void)
{
    return read_lever_mv(&adc_lever_down);
}

/*── Background battery check (every 15min) ──*/
static void battery_work_handler(struct k_work *work)
{
    ARG_UNUSED(work);
    app.battery_mv = read_battery_mv();
}
static K_WORK_DEFINE(battery_work, battery_work_handler);

static void periodic_timer_handler(struct k_timer *timer)
{
    ARG_UNUSED(timer);
    k_work_submit(&battery_work);
}
static K_TIMER_DEFINE(periodic_timer, periodic_timer_handler, NULL);

void battery_periodic_start(void)
{
    k_timer_start(&periodic_timer, K_MINUTES(15), K_MINUTES(15));
}
