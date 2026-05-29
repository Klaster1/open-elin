/* firmware-pod/src/buttons.h — GPIO buttons and lever ADC polling */
#pragma once

void buttons_init(void);
void buttons_lever_poll_start(void);
void buttons_lever_poll_stop(void);
