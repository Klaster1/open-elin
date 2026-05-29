/* firmware-pod/src/led.h — LED blink and battery pulse indicator */
#pragma once

#include <stdint.h>

int  led_init(void);
void led_blink(void);
void led_set(int value);
void led_battery_flash(int32_t mv);
