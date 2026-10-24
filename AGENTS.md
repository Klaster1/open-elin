# AGENTS.md — nxs (open-elin)

Open-source control, protocol, and DIY firmware for the NXS/BikeNet wireless
electronic bike-shifting system: a browser app, a Node.js CLI, a shared
protocol library, our own pod/hub firmware, and supporting tools. Published as
github.com/Klaster1/open-elin.

Claude and ZCode share this file: `CLAUDE.md` imports it (`@AGENTS.md`), and
ZCode reads it directly. Skills live in `.claude/skills/`; `.zcode/skills` is a
symlink to them so both tools see the same set.

## Working style (2026-09-05, user directive)

Keep going until the task is done or the user says stop. When a sub-task
finishes, continue with the next step from the plan rather than idling or
asking "should I continue?". Time-boxed goals ("work until 20:00") mean
working through the whole window. Save wrap-ups and end-of-session steps for
when the user ends the session.

**Never use `sleep` in the session loop.** No `sleep N && check`, no bounded
waits, no "wait then peek" shell commands — not for builds, boots, or test
runs. Long-running work goes into a background task that notifies on
completion; until then, do something else useful or end the turn. Timing
belongs inside harnesses/tools that run unattended, never as a waiting
mechanism in the conversation.

## Layout

| Folder          | Purpose                                                            |
| --------------- | ----------------------------------------------------------------- |
| `lib/`          | Shared protocol library (commands, protocol) — Node.js + browser  |
| `cli/`          | Node.js CLI for controlling NXS hubs over BLE (TypeScript, ESM)   |
| `web/`          | Lit web app for hub configuration via Web Bluetooth               |
| `firmware-pod/` | Zephyr C pod firmware for SuperMini nRF52840                      |
| `firmware-hub/` | Hub-side firmware work                                             |
| `documents/`    | Protocol specs, hardware maps, observed-behaviour notes           |
| `plans/`        | Implementation plans                                              |
| `jig/`          | Test / programming jigs                                           |
| `prints/`       | 3D-printable parts (FreeCAD, 3MF)                                 |
| `tools/`        | Serial probing scripts and utilities                             |

## Tech stack

- **CLI**: Node.js ≥ 26.2.0, TypeScript (type-strip, no build step), ESM,
  `@abandonware/noble` for BLE.
- **Web**: Lit + `@lit-labs/signals`, Vite, Shoelace, Web Bluetooth API,
  Playwright for E2E.
- **Package manager**: npm workspaces (root `package.json`).

## Hardware

| Device              | MAC                 | Name                           |
| ------------------- | ------------------- | ------------------------------ |
| Hub                 | `D7:BA:AB:52:A0:E5` | NXS eLink hub                  |
| Pod (real)          | `D5:89:B2:13:FA:04` | NXS MTB Pod                    |
| Pod (DIY, Zephyr)   | `F7:3A:3D:75:99:A0` | Zephyr C firmware on SuperMini |

## Conventions

- All JS/TS packages use `"type": "module"` (ESM only).
- Run the CLI with `npm run cli -- <args>` from the workspace root; `--json`
  gives machine-readable output.
- Protocol docs in `documents/` are the source of truth.
- When asked to plan, write the plan directly to `plans/YYYY-MM-DD-<name>.md` —
  no brainstorming skill, no design doc, just the plan.
- Plans use red/green TDD: write the failing test first, run it to confirm it
  fails, write the minimal implementation to make it pass, run it to confirm it
  passes. Every task that produces code follows this cycle.
- When a plan step is done, change `- [ ]` to `- [✅]` in the plan file.

## Skills

Project skills live in `.claude/skills/`:

- `open-elin-cli` — interacting with an NXS hub over BLE via the CLI.
- `connect-pod` — pairing a pod to a hub and writing its button map.
- `write-test` — authoring deterministic Playwright E2E tests for `web/`.
- `make-feature` — the repo's feature-implementation workflow for `web/`.
- `accessibility-auditor` — auditing `web/` UI changes for accessibility.
