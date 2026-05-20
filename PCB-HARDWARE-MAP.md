# Pod PCB Hardware Map

Sources: `images/pod-pcb-front.jpg`, `images/pod-pcb-back.jpg`, `images/nrf52-qfn-reference-schematic.PNG`.

---

## SoC

**nRF52832 QFAA QFN48** (lot Q2509AL). **APPROTECT enabled** — SWD read-back blocked.

**Chip orientation on PCB** (pin 1 marker visible at upper-left corner of chip surface in `pod-pcb-front.jpg`):

| Physical chip side | Faces PCB direction | Pin numbers | Signals |
|--------------------|---------------------|-------------|---------|
| Left   | PCB left   | 1 – 12  | P0.00–P0.10, DEC1 |
| Bottom | PCB bottom | 13 – 24 | P0.11–P0.21, GND |
| Right  | PCB right  | 25 – 36 | P0.22–P0.24, GND, VDD, ANT, VSS, VDD, DEC2, DEC3, XC1, XC2, VDD |
| Top    | PCB top    | 37 – 48 | VDD, GND, P0.31/AIN7–P0.28/AIN4, SWDIO, SWDCLK, P0.27–P0.25, VDD |

*Confirm orientation by probing pin 12 (DEC1) continuity to the DCDC inductor pad.*

---

## Complete pin table

**Status legend:**
- `[REF]` — matches reference schematic exactly
- `[REF ABSENT]` — reference specifies this; pod does not fit it
- `[POD EXTRA]` — pod adds this; reference schematic has NC here
- `[TRACED]` — visually confirmed from PCB photo
- `[INFERRED]` — reasonable inference from photo + context; probe to confirm
- `[UNKNOWN]` — cannot determine from photo; probe required

| Pin | Signal | Ref schematic connection | Pod PCB | Status |
|-----|--------|--------------------------|---------|--------|
| 1  | P0.00 / XL1    | NC; opt. 32.768 kHz crystal XL1 | Unknown — probe required | `[UNKNOWN]` |
| 2  | P0.01 / XL2    | NC; opt. 32.768 kHz crystal XL2 | Unknown — probe required | `[UNKNOWN]` |
| 3  | P0.02 / AIN0   | NC | Possibly button ADC input (resistor ladder) | `[INFERRED]` |
| 4  | P0.03 / AIN1   | NC | Unknown — probe required | `[UNKNOWN]` |
| 5  | P0.04 / AIN2   | NC | Unknown — probe required | `[UNKNOWN]` |
| 6  | P0.05 / AIN3   | NC | Unknown — probe required | `[UNKNOWN]` |
| 7  | P0.06          | NC | Unknown — probe required | `[UNKNOWN]` |
| 8  | P0.07          | NC | Unknown — probe required | `[UNKNOWN]` |
| 9  | P0.08          | NC | Unknown — probe required | `[UNKNOWN]` |
| 10 | P0.09          | NC | Unknown — probe required | `[UNKNOWN]` |
| 11 | P0.10          | NC | Unknown — probe required | `[UNKNOWN]` |
| 12 | DEC1           | L3 (15 nH) + L2 (10 µH) DCDC inductor; C4 (100 nF) + C9 (4.7 µF) to GND | DCDC inductor + decoupling caps visible lower-left of chip | `[REF][TRACED]` |
| 13 | P0.11          | NC | Unknown — probe required | `[UNKNOWN]` |
| 14 | P0.12          | NC | Unknown — probe required | `[UNKNOWN]` |
| 15 | P0.13          | NC | Unknown — probe required | `[UNKNOWN]` |
| 16 | P0.14          | NC | Unknown — probe required | `[UNKNOWN]` |
| 17 | P0.15          | NC | Unknown — probe required | `[UNKNOWN]` |
| 18 | P0.16          | NC | Unknown — probe required | `[UNKNOWN]` |
| 19 | P0.17          | NC | Unknown — probe required | `[UNKNOWN]` |
| 20 | P0.18          | NC | Unknown — probe required | `[UNKNOWN]` |
| 21 | P0.19          | NC | Unknown — probe required | `[UNKNOWN]` |
| 22 | P0.20          | NC | Unknown — probe required | `[UNKNOWN]` |
| 23 | P0.21 / nRESET | NC (nRESET assignable via UICR) | Unknown — probe required | `[UNKNOWN]` |
| 24 | GND            | GND | GND rail | `[REF]` |
| 25 | P0.22          | NC | Unknown — probe required | `[UNKNOWN]` |
| 26 | P0.23          | NC | Unknown — probe required | `[UNKNOWN]` |
| 27 | P0.24          | NC | Unknown — probe required | `[UNKNOWN]` |
| 28 | GND            | GND | GND rail | `[REF]` |
| 29 | VDD            | VDD | VDD | `[REF]` |
| 30 | ANT            | L1 (3.9 nH) + C3 (0.8 pF) + C6 (100 pF) RF matching | RF matching components visible right of chip | `[REF][TRACED]` |
| 31 | VSS            | GND | GND rail | `[REF]` |
| 32 | DEC2           | Decoupling cap to GND (DCDC) | Decoupling cap present | `[REF][TRACED]` |
| 33 | DEC3           | Decoupling cap to GND (DCDC) | Decoupling cap present | `[REF][TRACED]` |
| 34 | XC1            | 32 MHz crystal X1 + C13 (12 pF) load cap | Crystal T10A + load caps, upper-right of chip | `[REF][TRACED]` |
| 35 | XC2            | 32 MHz crystal X1 + C14 (12 pF) load cap | Crystal T10A + load caps, upper-right of chip | `[REF][TRACED]` |
| 36 | VDD            | C8 (100 nF) decoupling to GND | VDD + decoupling cap | `[REF]` |
| 37 | VDD            | C10 (1 µF) bulk decoupling; VDD_nRF supply rail | VDD rail | `[REF]` |
| 38 | GND            | GND | GND rail | `[REF]` |
| 39 | P0.31 / AIN7   | NC | Unknown — probe required | `[UNKNOWN]` |
| 40 | P0.30 / AIN6   | NC | Unknown — probe required | `[UNKNOWN]` |
| 41 | P0.29 / AIN5   | NC | Unknown — probe required | `[UNKNOWN]` |
| 42 | P0.28 / AIN4   | NC | Unknown — probe required | `[UNKNOWN]` |
| 43 | SWDIO          | SWD debug | IO header pad (right edge) | `[REF][TRACED]` |
| 44 | SWDCLK         | SWD debug | CLK header pad (right edge) | `[REF][TRACED]` |
| 45 | P0.27          | NC | Unknown — probe required | `[UNKNOWN]` |
| 46 | P0.26          | NC | Unknown — probe required | `[UNKNOWN]` |
| 47 | P0.25          | NC | Unknown — probe required | `[UNKNOWN]` |
| 48 | VDD            | VDD; DCDC output | VDD | `[REF]` |
| EP | GND (exp. pad) | GND thermal pad | GND (soldered) | `[REF]` |

---

## Reference design components — status on pod PCB

| Ref | Value | Purpose | Pod PCB |
|-----|-------|---------|---------|
| L2  | 10 µH  | DCDC main inductor | **Present** `[TRACED]` |
| L3  | 15 nH  | DCDC HF choke | **Present** `[TRACED]` |
| C4  | 100 nF | DEC1 decoupling | **Present** `[TRACED]` |
| C9  | 4.7 µF | DEC1 bulk cap | **Present** `[TRACED]` |
| C5  | 100 nF | VDD decoupling | Present (assumed) `[REF]` |
| C8  | 100 nF | VDD pin-36 decoupling | Present (assumed) `[REF]` |
| C10 | 1 µF   | VDD_nRF bulk cap | Present (assumed) `[REF]` |
| X1  | 32 MHz | RF crystal oscillator | **Present** (marked T10A) `[TRACED]` |
| C13 | 12 pF  | XC1 load cap | **Present** `[TRACED]` |
| C14 | 12 pF  | XC2 load cap | **Present** `[TRACED]` |
| C2, C7 | 12 pF | Crystal stabilisation | Present (assumed) `[REF]` |
| L1  | 3.9 nH | RF matching (ANT) | **Present** `[TRACED]` |
| C3  | 0.8 pF | RF matching (ANT) | **Present** `[TRACED]` |
| C6  | 100 pF | RF matching (ANT) | **Present** `[TRACED]` |
| X2  | 32.768 kHz | Optional RTC crystal | **ABSENT** — not fitted; use internal 32 kHz RC oscillator `[REF ABSENT]` |
| C11, C12 | 12 pF | X2 crystal load caps | **ABSENT** `[REF ABSENT]` |

---

## Pod-specific components (not in reference design)

| Location | Component | Probable function | Connected pin(s) |
|----------|-----------|-------------------|-----------------|
| Upper-left front  | Tactile button      | Shift button (Up or Down)          | Left-side GPIO (pins 1–12) `[INFERRED]` |
| Middle-left front | Tactile button      | Shift button (Down or Up)          | Left-side GPIO (pins 1–12) `[INFERRED]` |
| Upper-right front | Spring-contact button | Shift or Fn button               | Unknown `[UNKNOWN]` |
| Lower-right front | Spring-contact button | Shift, Fn, or hidden Pairing     | Unknown `[UNKNOWN]` |
| Between left buttons and chip left edge | Row of ~7 identical SMD passives | Pull-up resistors or ADC resistor ladder | Connects to pins 1–12 (left side) `[INFERRED]` |
| Lower-left front  | Blue LED + series resistor | Status / pairing indicator  | GPIO TBD `[UNKNOWN]` |
| Right edge        | 6-pad header V/IO/CLK/G/TX/RX | SWD + UART debug | IO→pin 43, CLK→pin 44; TX/RX GPIO `[UNKNOWN]` `[POD EXTRA]` |
| Back center       | CR2032 coin cell holder | 3 V power supply | VDD rail |

---

## Probing checklist to fill all [UNKNOWN] entries

Priority order:

1. **Confirm chip orientation** — continuity from DEC1 inductor pad to candidate chip corner pin. Establishes which physical side = which pin numbers.
2. **UART TX** — connect logic analyser to TX pad; UART frame visible on startup or deliberate log → identify GPIO with continuity to pad.
3. **UART RX** — similarly.
4. **LED** — probe LED anode/cathode to chip; or toggle GPIOs and watch LED.
5. **Buttons** — press each button one at a time, multimeter between the passive-row junction and GND:
   - Voltage changes in discrete steps → ADC resistor ladder → single AIN pin (AIN0–AIN3, pins 3–6, or AIN4–AIN7, pins 39–42)
   - Pulls to GND or VCC → simple GPIO pull-up, one pin per button
6. **Battery voltage sense** — probe all AIN pins against a variable supply; the one that tracks Vbatt is the sense pin (or use VDDHDIV5 which needs no external pin).
7. **Spring-contact buttons** — after button GPIO method is established from tactile buttons, probe spring-contact pads similarly.
