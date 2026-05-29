/* firmware-pod/src/battery.h — ADC battery and lever reading */
#pragma once

#include <stdint.h>

int     battery_init(void);
int32_t read_battery_mv(void);
int32_t read_lever_up_mv(void);
int32_t read_lever_down_mv(void);
void    battery_periodic_start(void);
