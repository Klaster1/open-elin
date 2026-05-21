# Plan 2 — PC Fake Pod (`open-elin-pc-pod`)

## Goal

A Node.js BLE peripheral that impersonates an NXS BikeNet pod. Runs on the **MacBook Pro** (macOS 26.3, arm64) via SSH from the dev PC. Hub connects to it; we log every byte the hub writes. Only viable way to observe hub→pod wire format without custom hardware.

**Repo (PC):** `c:\dev\nxs\open-elin-pc-pod`  
**Mac copy:** `~/dev/open-elin-pc-pod` (synced via `scp`)  
**Node version:** 26.2.0 — installed at `~/node-v26.2.0-darwin-arm64/bin/node`  
**Mac BT adapter MAC:** `84:2f:57:31:36:f3` (use this in manufacturer data)

---

## What we're trying to find out

| Question | Experiment |
|----------|------------|
| Does hub use service UUID, manufacturer data, or both to discover pods? | Exp 1: advertise minimal → add manufacturer data if needed |
| Does hub send a PIN unlock to the pod? | Observe first write after connection |
| What does hub write on connection init (opcode, payload)? | Log all MSG + PIN char writes |
| What does hub write when a shift or app command references the pod? | Use open-elin-cli + app while hub is connected to fake pod |
| Does hub expect a specific ACK/response to stay connected? | Log disconnects; try replying to writes |
| Button notify format (pod→hub)? | After establishing stable connection, send candidate payloads and observe hub reaction via open-elin hub monitor |

---

## Technology

### BLE peripheral library

`@stoprocent/bleno` — maintained fork of bleno; uses CoreBluetooth on macOS (no raw HCI, no USB dongle needed).

**Platform confirmed: MacBook Pro (macOS 26.3, arm64).** bleno uses the Mac's built-in Bluetooth adapter via CoreBluetooth natively. The Mac runs as BLE peripheral; the Windows PC runs `open-elin-cli` as BLE central. Hub connects to both simultaneously — no adapter conflict.

**Bluetooth permission**: one-time grant required. Run `node src/smoke.ts` from Terminal.app on the Mac; click Allow when macOS prompts. After that, SSH runs work too.

**Smoke test verified** (`node src/smoke.ts`): device `84:2f:57:31:36:f3` advertising service UUID `A5C1C000-…` visible in nRF Connect. ✅

**Sync workflow** (PC → Mac):
```powershell
# after editing on PC:
scp -i ~/.ssh/id_ed25519 -r c:\dev\nxs\open-elin-pc-pod\src klaster_1@192.168.1.34:~/dev/open-elin-pc-pod/src
```
Run on Mac via SSH:
```powershell
ssh -i ~/.ssh/id_ed25519 klaster_1@192.168.1.34 "export PATH=/Users/klaster_1/node-v26.2.0-darwin-arm64/bin:/usr/local/bin:/usr/bin:/bin && cd ~/dev/open-elin-pc-pod && node src/smoke.ts"
```

### Advertisement format

The hub filters by BikeNet service UUID + non-empty manufacturer data (from `listDevices()` in `open-elin-cli`). Whether the hub's **own** scan-for-pods firmware uses the same filter is unknown — this is what Exp 1 determines.

Start with the same manufacturer data format as the hub:
```
company ID:  0xDE98 (LE: 98 DE)
data bytes:  08 01 <MAC reversed 6 bytes>
```
The "MAC" here should be the fake pod's address (the PC BT adapter MAC, or a synthetic address). If hub ignores manufacturer data content during pairing we can simplify; if it parses the MAC from it we need to make it consistent.

---

## Directory structure

```
open-elin-pc-pod/
  .node-version            ← "26.2.0"
  .gitignore
  package.json
  tsconfig.json
  src/
    main.ts                ← entry; starts peripheral; handles SIGINT
    gatt.ts                ← GATT service (MSG + PIN characteristics)
    advertise.ts           ← advertisement data builder
    logger.ts              ← JSON-line log to stdout (+ optional file)
```

---

## Source reuse

`open-elin-pc-pod` is an npm workspace sibling. Root `c:\dev\nxs\package.json` workspaces will include it. It imports from `demo-node` for protocol frame decoding:

```ts
// Decode incoming hub writes using known frame format
import { parseResponsePacket } from "demo-node/src/protocol.ts";
```

All decoded frames are logged alongside the raw hex so that known opcodes are human-readable immediately.

---

## Implementation checklist

- [x] Scaffold `open-elin-pc-pod` (package.json, tsconfig, .node-version, .gitignore)
- [x] Add to root workspace (`c:\dev\nxs\package.json`)
- [x] Install `@stoprocent/bleno`; verify it can advertise on macOS (smoke test ✅ — `84:2f:57:31:36:f3` visible in nRF Connect)
- [ ] `advertise.ts` — build BikeNet service UUID + manufacturer data advertisement
- [ ] `gatt.ts` — MSG characteristic (write + notify); PIN characteristic (write + notify); log all writes
- [ ] `logger.ts` — JSON-line output: `{ts, char, raw_hex, decoded?}`
- [ ] `main.ts` — wire up bleno, start advertising, handle connect/disconnect events, SIGINT cleanup
- [ ] **Exp 1** — trigger hub factory reset + pairing mode; run fake pod; confirm hub connects
- [ ] **Exp 2** — log and analyse every write the hub sends immediately after connection
- [ ] **Exp 3** — with hub connected to fake pod, run `open-elin hub list / shift-down / get-position` and observe what (if anything) the hub forwards to the pod
- [ ] **Exp 4** — use the BikeNet app while hub is connected to fake pod; observe additional hub→pod traffic
- [ ] **Exp 5** — send candidate `BLE_MSG_BAT_V` (0x4000) notify from fake pod → hub; confirm hub accepts it (verify via `open-elin hub list` — battery voltage field updates)
- [ ] Document findings in `FINDINGS.md` inside `open-elin-pc-pod/`

---

## Log format

Every characteristic write is emitted as a JSON line to stdout:

```json
{"ts":"2026-05-20T16:00:00.000Z","event":"write","char":"MSG","raw":"00 00 09 00 e5 a0 52 ab ba d7 4e 58 53 20 4d 54 42 20 50 6f 64","decoded":{"opcode":"0x0009","name":"BLE_CMD_SET_NAME","targetMac":"D5:89:B2:13:FA:04","payload":"..."}}
{"ts":"...","event":"connect","central":"d7:ba:ab:52:a0:e5"}
{"ts":"...","event":"disconnect","central":"d7:ba:ab:52:a0:e5","reason":"..."}
```

`decoded` is best-effort using the known protocol frame format; `null` for unknown opcodes.

---

## Success criteria

- [ ] Fake pod advertises on Windows with BikeNet service UUID + manufacturer data
- [ ] Hub (in pairing mode) connects to fake pod
- [ ] All hub→pod writes captured and logged in hex
- [ ] At least the first hub→pod write decoded (opcode identified)
- [ ] `BLE_MSG_BAT_V` notify accepted by hub (battery reading visible via `open-elin hub list`)
- [ ] Enough data captured to describe the hub→pod connection init sequence in `FINDINGS.md`

---

## Known unknowns (to be resolved by experiments)

- Does the hub send a PIN auth write to the pod? (likely no — pod PIN is `0000` by default)
- What is the first opcode the hub writes to a freshly-paired pod?
- Does the hub write anything when app-side gear commands are issued?
- What is the button notify payload format?
- Does the hub expect a response to stay connected, or is it fire-and-forget?
