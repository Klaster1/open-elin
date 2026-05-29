/* firmware-pod/src/radio.h — BLE advertising, connection, and protocol */
#pragma once

#include <stdbool.h>
#include <stdint.h>

void radio_init(void);
void start_advertising(void);
void radio_wake(void);
void radio_force_sleep(void);
void radio_force_latency_escalation(void);
void set_pairing_mode(bool enable);
void send_shift_or_queue(uint8_t btn_id);
void send_battery(void);
