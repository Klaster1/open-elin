# NXS BikeNet — What You See

Physical, human-observable behavior of the real NXS system. What happens when you press buttons, look at LEDs, watch the derailleur. No hex dumps, no opcodes.

Last updated: 2026-05-21.

---

## The System

- **Pod** = small unit on the handlebar. Has buttons. No motor.
- **Hub** (eLink) = unit on the derailleur. Has the motor that moves the chain.
- They talk to each other over Bluetooth. The app talks to the hub only — never directly to the pod.

---

## Buttons

4 physical buttons on the pod:

| # | Name | Physical feel | What it does |
|---|------|--------------|--------------|
| 1 | Up | Tactile click | Shift up (smaller cog) |
| 2 | Down | Tactile click | Shift down (larger cog) |
| 3 | Fn | Spring contact | Toggle fine-tune mode |
| 4 | Pairing | Hidden under "N" logo, no bump | Hold 6s → enter pairing mode |

"Up"/"Down" refer to shift direction, which is **inverted** from physical button position on the pod body.

---

## What Happens When You Press a Button

1. Press a shift button on the pod.
2. ~0.5 s later, the derailleur physically moves.
3. Hub LED blinks (confirmation).

If nothing happens: the button map is empty. The hub silently ignores button presses when no map is written. This is the default state after a factory reset.

---

## Pairing (from OG Bikeworks docs)

1. **Hub**: hold function button 10 seconds → factory reset + enters auto-pairing mode for 1 minute.
2. **Pod**: hold hidden reset button (under "N" logo) 6 seconds → pod LED blinks.
3. Pod connects to hub automatically.
4. **Verify**: press any pod button → hub LED blinks, derailleur moves.

---

## Battery

- Pod uses a **CR2032 coin cell** (3 V).

---

## Hub Reset

When you reset the hub (hold button 10 s):
- Derailleur moves to the smallest cog.
- All pod connections are removed.
- Button map is cleared — pod buttons do nothing until re-paired and map is re-written.

---

## Drivetrain

- 12-speed rear cassette.
- Teeth: 11, 12, 13, 14, 15, 16, 17, 19, 22, 25, 28, 32.
- This is the default config after hub reset — set via app or CLI, not intrinsic to the hardware.

---

## Motor / Cable

- Clockwise shaft rotation → pulls cable shuttle in (retracts cable).
- Counterclockwise shaft rotation → pushes cable shuttle out (extends cable).

# Troubleshooting

## If stuck at 203mm retraction

1. Unscrew shaft lid with 2mm hex
2. Use 3mm flat screwdriver to place shuttle roughly at cable slot
3. Run homing
4. Maybe run drive calibration

Symptom: shuttle all the way in, cable anchor touching gears

## WCH connections

        WCH   Board
black   clk   clk
white   io    dio
grey    gnd   gnd
purple  3v3   vdd