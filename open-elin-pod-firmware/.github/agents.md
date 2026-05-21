# Agent Instructions — open-elin-pod-firmware

## What this project is

A drop-in replacement pod firmware for the **NXS BikeNet** cycling system, running on a **nice!nano v2** (nRF52840) board. The original pod is a BLE peripheral (nRF52832, APPROTECT enabled — cannot be dumped). We reverse-engineer the hub↔pod BLE protocol empirically, then implement it in Zephyr.

The workspace root for this project is **`c:\dev\nxs\open-elin-pod-firmware`**. Other directories under `c:\dev\nxs\` (APK decompile, demo-node app, blutter, ble-sniff) are reference material — do not modify them unless explicitly asked.

---

## Plans directory

```
plans/
  PLAN.md          ← overview: 5 numbered steps with completion checkboxes
  1-hub-cli.md     ← detailed plan for step 1 (created when work begins)
  2-fake-pod.md    ← detailed plan for step 2
  ...
```

**`plans/PLAN.md`** is the master overview. It has 5 items with `- [ ]` checkboxes. When an item is completed, mark it `- [x]`.

**Each step gets its own detailed plan file** in `plans/`, named `<N>-<slug>.md` matching the step number in the overview. That file contains the full spec, decisions, implementation notes, and a checklist for that step. Create it before starting work on the step; update it as you go.

**Never modify `plans/PLAN.md` overview content** (constraints, hardware sections, protocol notes) unless explicitly asked — it is the ground truth for the whole project. Only the checkboxes change as steps complete.

---

## Key constraints (read before doing anything)

- **No hub↔pod traffic visibility.** btsnoop = phone HCI log (phone↔hub only). nRF sniffer = advertisements only. Hub↔pod packet content is entirely unknown until Step 2 runs. Do not invent or assume protocol details.
- **Everything about hub↔pod wire format is a hypothesis** until empirically observed via the fake pod (Step 2).
- **PC BLE peripheral stack:** On Windows, `bleno` variants require Zadig/WinUSB which conflicts with `noble` (WinRT) on the same adapter. For Step 2 the fake pod must coexist with the Hub CLI (noble/central). Chosen approach: **C# child process** using WinRT `GattServiceProvider` (no driver swap, no conflict), communicating with Node over stdin/stdout JSON. See `plans/2-fake-pod.md` for details when that file exists.
- **nice!nano flash path:** The board ships with Adafruit UF2 bootloader. Decide before Step 3 whether to use SWD (overwrites bootloader) or build Zephyr as a UF2-compatible image.

---

## Reference files (read-only, outside this repo)

| Path | What's in it |
|------|-------------|
| `c:\dev\nxs\demo-node\src\node\transport-noble.ts` | Noble BLE central transport — reuse for Hub CLI |
| `c:\dev\nxs\demo-node\src\node\app.ts` | BikeNetApp wrapper |
| `c:\dev\nxs\demo-node\src\commands.ts` | All AppCommand encoders/decoders |
| `c:\dev\nxs\demo-node\src\protocol.ts` | Protocol framing |
| `c:\dev\nxs\apk-extracted-project\PROTOCOL.md` | Full hub BLE protocol (old app decompile) |
| `c:\dev\nxs\apk-extracted-project-bikenet-new\PROTOCOL_NEW.md` | Flutter app protocol, button map |
| `c:\dev\nxs\ble-sniff\FS\data\misc\bluetooth\logs\btsnoop_hci.log` | Phone HCI capture — phone↔hub only |
| `PCB-HARDWARE-MAP.md` | Pod PCB pin/component map (in this repo) |
| `images/nicenano-schematic.png` | nice!nano v2 schematic |

---

## BLE protocol constants

- **Service UUID:** `A5C1C000-CC20-BA91-0C1A-EF3F9E643D79`
- **MSG char:** `A5C1CC01-CC20-BA91-0C1A-EF3F9E643D79` — write + notify
- **PIN char:** `A5C1CC02-CC20-BA91-0C1A-EF3F9E643D79` — write + notify
- Default PIN: `0000` (never enforced in practice)
- Battery notify opcode: `0x4000`, payload = 2-byte LE mV at bytes 8–9 (pod format)

---

## Tools available

- **Webcam** — pointed at the bike for visual confirmation of hub LED states. Open a browser tab with `getUserMedia` (one Allow click, stays open), agent takes screenshots on demand.
- **Hub hardware** — physical NXS hub + original pod are available for testing.
- **nice!nano v2** — the target dev board (nRF52840, Pro Micro footprint).
