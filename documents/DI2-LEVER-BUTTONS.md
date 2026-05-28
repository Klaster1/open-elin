# Di2 Lever Button Block — Observed Behavior

## Physical description

Shimano Di2 shift lever button block. Very flat and compact — looks like a PCB sandwiched in plastic. Three wires exit the block. In the stock Di2 setup, these connect to a controller module under the lever hood, which then speaks 2-wire Di2 protocol (i2c variant) to the rest of the Di2 network.

## Wiring

3 wires:
- Wire 1: Ground (connected to board GND)
- Wire 2: Upshift signal → P0.29 (AIN5)
- Wire 3: Downshift signal → P0.31 (AIN7)

## Electrical behavior (measured via nRF52840 SAADC)

### With internal ~13kΩ pull-up (nrf_gpio_cfg PULLUP)

The lever buttons are **normally-open switches to GND** — not a resistor ladder as initially assumed from multimeter readings.

| State | Up channel (P0.29) | Down channel (P0.31) |
|-------|--------------------|----------------------|
| Idle | ~2400mV (VDD, open circuit) | ~2400mV (VDD, open circuit) |
| Upshift pressed | ~0mV (shorted to GND) | ~2400mV (unaffected) |
| Downshift pressed | ~2400mV (unaffected) | ~0mV (shorted to GND) |

No crosstalk between channels — pressing one button does not affect the other.

### Earlier multimeter observations (misleading)

Initial multimeter resistance measurements showed ~0Ω between all three wires at idle, and 0.7–1.7V voltage spikes during button presses. These readings were misleading — the multimeter's low test current interacted with semiconductor junctions inside the button block. The actual behavior under 3.3V pull-up is simple normally-open switching as shown above.

## Why GPIO edge interrupts don't work

With no pull-ups, all ADC pins float at VDD. With internal pull-ups configured as GPIO inputs, the nRF52840's edge detection is too sensitive to the transition — both up and down ISRs fire for every single button press due to noise coupling through the shared ground wire. Additionally:

- Touching a GPIO pin with a finger triggers a shift (pins are at threshold boundary)
- Adding 100nF filter caps doesn't help
- The lever block's internal semiconductor junctions create unpredictable behavior for digital GPIO sensing

## Why the same buttons work on the OEM NXS pod

The OEM pod PCB has a row of ~7 identical SMD passives between the button pads and the nRF52832 chip (visible on PCB photo). These likely include series resistors and/or a voltage divider network that conditions the signal for ADC reading. Pin 3 (P0.02/AIN0) is inferred as the button ADC input.

## Implementation on SuperMini nRF52840

**ADC polling** — replaces GPIO edge interrupts for shift buttons.

- Internal pull-ups via `nrf_gpio_cfg()` with `NRF_GPIO_PIN_PULLUP` and `INPUT_DISCONNECT`
- Zephyr SAADC driver does NOT strip pull-ups on nRF52840 (only nRF54 series has that behavior)
- ADC channels: channel@1 (AIN5/P0.29 = up), channel@2 (AIN7/P0.31 = down)
- ADC gain: 1/4, internal 0.6V reference → full-scale 2.4V
- Polled every 10ms via Zephyr timer → work queue
- Threshold: voltage **below** 300mV = button pressed (normally-open switches)
- Debounce: 150ms shared timer
- Bar-end buttons (pair P0.20, tune P0.22) remain GPIO interrupts
- Serial command `a` toggles ADC debug output (prints on value change only)

No external components needed — internal pull-ups are sufficient.
