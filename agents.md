# Agents Guidance

## What This Repo Is

This is a web-based configuration app for the NXS rear derailleur electronic shifter. It provides a browser UI to connect to a hub, read device data, and send commands, with a demo mode for testing.

- App name: `OpenElin`.
- Use `OpenElin` for all app/product naming in UI text, tests, docs, comments, and new code.

## Working Directory

- The main project root is `demo-node`.
- Run all development and test commands from the `demo-node` directory.
- If your terminal is elsewhere, change directory first: `cd demo-node`.

## App Architecture (High Level)

- Web UI: Lit components render pages for device data, logs, and actions.
- State and actions: A central store manages app state, log lines, and command actions.
- Protocol and commands: the protocol layer encodes/decodes messages and exposes command APIs.
- Transports:
  - Web Bluetooth transport for real devices.
  - Demo transport that simulates device notifications and command responses.

## NXS System Architecture (Basic)

- Pod: The user-facing control device. Button actions trigger shift or tune requests.
- Hub: The bike-mounted controller that actuates the rear derailleur and serves as the API gateway for the hub/pod system.
- Communication: Pod and hub exchange protocol messages; the app subscribes to hub notifications and issues commands to manage shifts and read state.

## Technology Guidelines

- Frontend: Lit + @lit-labs/signals for reactive UI.
- Top-level route view components should use the `page-` prefix (for example: `page-landing.ts` + `page-landing`, `page-mac.ts` + `page-mac`).
- The device container is a shell and must be named `shell-device.ts` + `shell-device` + `ShellDevice`.
- Device subpage component file names and custom element names must use the `page-device-` prefix (for example: `page-device-list.ts` + `page-device-list`).
- Device subpage component class names must use `PageDevice*` (for example: `PageDeviceList`).
- Root app component class/file naming should be `App` in `app.ts`.
- Always use Lit signals for component state (including local UI state) instead of plain mutable fields and manual `requestUpdate()`.
- UI components: Shoelace for buttons, dialogs, inputs, and tags.
- Build tooling: Vite.
- Prefer colocating component-specific styles inside component TS files.
- Keep shared styles minimal and only for truly global tokens or base rules.
- Always make sure any edits in UI are accessible, use "accessibility-auditor" skill for that.
- Keep HMR wiring in sync with component changes: the Vite `vite-plugin-web-components-hmr` plugin should stay enabled in [vite.config.ts](vite.config.ts) and components should guard `customElements.define(...)` to avoid re-define errors on hot updates.

## Testing and Validation

### E2E Testing Principles

- Use the `write-test` skill for all e2e test authoring/refactors: [.github/skills/write-test/SKILL.md](.github/skills/write-test/SKILL.md).
- Keep test code and comments aligned with that skill (deterministic setup, branch-free flows, explicit assertion contracts, `data-test-id` first selectors).

### Running Tests

- Run headless e2e (from `demo-node`): `npm run test:e2e`
- Run headed e2e (from `demo-node`): `npm run test:e2e:headed`
- Run one spec (from `demo-node`): `npx playwright test e2e/cogs.demo.spec.ts`
- Always run full tests (`npm run test:e2e`) at task completion unless already run in the same task.
- Never ask the user whether to run full tests; run and report results.

- ALWAYS run Chrome MCP to test changes in demo mode. DO NOT ask the user first. NEVER ASK USER TO DO THIS. When editing UI, always take a screenshot and evaluate if everything looks good - if not, fix that.
- Use the existing page when possible.
- Start Vite to access the app at https://localhost:5173/. When you go to this page, you almost always need to click on "Demo".
- ONLY EVER use `npm run dev` to start the dev server (from `demo-node`).
- Never deviate from `npm run dev` for dev server startup.
- Always re-use the same terminal session for `npm run dev`; do not start another terminal for the dev server.
- NEVER run `npm run build` to check for compile errors. Use the active `npm run dev` Vite process and its diagnostics/output for compilation validation.
- NEVER add UI status/feedback elements (success/error/info text, toasts/snackbars, banners, badges, progress messages, helper status copy, etc.) unless the user explicitly asks for them in that task.
- Avoid getting stuck in tool loops; if a tool call fails repeatedly, stop and reassess before continuing.
