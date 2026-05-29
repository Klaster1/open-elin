/* firmware-pod/src/commands.h — Serial and NUS command handling */
#pragma once

#include <stdint.h>

void commands_init(void);
void handle_command(uint8_t ch);
void print_help(void);
