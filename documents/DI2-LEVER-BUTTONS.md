# Di2 Lever Button Block — Observed Behavior

## Physical description

Shimano Di2 shift lever button block. Very flat and compact — looks like a PCB sandwiched in plastic. Three wires exit the block. In the stock Di2 setup, these connect to a controller module under the lever hood, which then speaks 2-wire Di2 protocol (i2c variant) to the rest of the Di2 network.

## Wiring

3 wires:
- Wire 1: Ground (connected to board GND)
- Wire 2: Upshift signal
- Wire 3: Downshift signal

All three wires show ~0Ω resistance between each other when measured with a multimeter (disconnected from any board). This is the lever's internal low-resistance path (~2–3.5Ω between signal lines and ground).

## Electrical behavior (measured on SuperMini nRF52840)

### With internal 13kΩ pull-up only (no external components)

**Signal to GND (DC voltage):**

| State | Voltage |
|-------|---------|
| Idle | 0V (lever's ~3Ω drags pin to ground through 13kΩ pull-up) |
| Own button pressed | Spike to 0.7–1.7V, briefly |
| Other button pressed | No change visible on multimeter (transient too fast) |

**Between signal wires (no ground reference):**

| Button pressed | Voltage |
|----------------|---------|
| Downshift | −1.7V (varies up to that) |
| Upshift | +0.7V (varies up to that) |

### Key observations

- Buttons are NOT simple open/close switches. They appear to be a **resistor ladder** — pressing a button increases resistance on that wire, causing voltage to rise briefly.
- Different buttons produce different voltage levels: ~0.7V (up) vs ~1.7V (down).
- The voltage spike is transient — the multimeter catches it at varying points, reading 0.04V to 1.7V.
- All wires are connected through very low resistance (~3Ω) at all times, even with buttons unpressed.

## Why GPIO edge interrupts don't work

The lever's low internal resistance (~3Ω) overwhelms the SuperMini's 13kΩ internal pull-up. GPIO pins sit at ~0V permanently (active/low for ACTIVE_LOW config). The button press creates a brief voltage spike that triggers edge interrupts on ALL signal pins simultaneously due to the shared internal path. Results:

- Both up and down ISRs fire for every single button press
- Touching a GPIO pin with a finger triggers a shift (pins are at threshold boundary)
- Adding 100nF filter caps doesn't help (the signal path is DC, not transient)
- Stronger external pull-ups (4.7kΩ) can't fight the ~3Ω lever resistance

## Why the same buttons work on the OEM NXS pod

The OEM pod PCB has a row of ~7 identical SMD passives between the button pads and the nRF52832 chip (visible on PCB photo). These likely include series resistors and/or a voltage divider network that conditions the signal for ADC reading. Pin 3 (P0.02/AIN0) is inferred as the button ADC input.

When Di2 lever wires are soldered to the OEM pod's button signal pads and GND, the signal passes through these passives before reaching the chip — the hardware conditioning makes it work.

## Correct approach for SuperMini

**ADC polling** — not GPIO edge interrupts.

- Connect upshift wire to an AIN-capable pin (e.g. P0.29/AIN5)
- Connect downshift wire to P0.31/AIN7
- Connect ground wire to GND
- Poll ADC every 5–10ms
- Detect button press when voltage exceeds ~300mV threshold
- Different voltage levels (0.7V vs 1.7V) can distinguish which button if needed

## Components purchased (not yet used)

- 100nF 275V X2 film capacitors — did not fix the GPIO problem
- 4.7kΩ resistors — available for external pull-ups if needed
