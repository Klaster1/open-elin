# Agents Guidance

## What This Repo Is

This is a web-based configuration app for the NXS rear derailleur electronic shifter. It provides a browser UI to connect to a hub, read device data, and send commands, with a demo mode for testing.

## App Architecture (High Level)

- Web UI: Lit components render pages and tabs for device data, logs, and actions.
- State and actions: A central store manages app state, log lines, and command actions.
- Protocol and commands: The BikeNet protocol layer encodes/decodes messages and exposes command APIs.
- Transports:
  - Web Bluetooth transport for real devices.
  - Demo transport that simulates device notifications and command responses.

## NXS System Architecture (Basic)

- Pod: The user-facing control device. Button actions trigger shift or tune requests.
- Hub: The bike-mounted controller that actuates the rear derailleur and serves as the API gateway for the hub/pod system.
- Communication: Pod and hub exchange protocol messages; the app subscribes to hub notifications and issues commands to manage shifts and read state.

## Technology Guidelines

- Frontend: Lit + @lit-labs/signals for reactive UI.
- UI components: Shoelace for buttons, dialogs, inputs, and tags.
- Build tooling: Vite.
- Prefer colocating component-specific styles inside component TS files.
- Keep shared styles minimal and only for truly global tokens or base rules.
- Always make sure any edits in UI are accessible, use "accessibility-auditor" skill for that.
- Keep HMR wiring in sync with component changes: the Vite `vite-plugin-web-components-hmr` plugin should stay enabled in [vite.config.ts](vite.config.ts) and components should guard `customElements.define(...)` to avoid re-define errors on hot updates.

## Testing and Validation

### E2E Testing Principles

- Always start by writing a comment-structured test plan in the spec (step comments first), then implement assertions/actions under those comments.
- Keep tests deterministic: seed demo state up front via custom fixture mutators in [e2e/fixtures.ts](e2e/fixtures.ts).
- Prefer asserting behavior through UI contracts (active nav state, visible data, busy/loading state, and final rendered outcome).
- Assert in specs, not in page models: page models should only expose interactions and reads.
- Prefer `data-test-id` selectors over brittle structure/style selectors.
- Use absolute assertions when seed is controlled (exact gear/offset expectations, not relative drift).
- Make async behavior testable by design: expose mock timing controls in store/demo state so tests can induce long-running requests.
- Keep test scope tight: validate requested behavior only (demo mode + cogs flow), avoid extra UX/test complexity.
- Prefer fixture ergonomics over plumbing: expose test-specific helpers through `test.extend`.
- Keep tests self-contained: do not add cross-test cleanup/reset logic in a test body.

### Running Tests

- Run headless e2e: `npm run test:e2e`
- Run headed e2e: `npm run test:e2e:headed`
- Run one spec: `npx playwright test e2e/cogs.demo.spec.ts`

- ALWAYS run Chrome MCP to test changes in demo mode. DO NOT ask the user first. NEVER ASK USER TO DO THIS. When editing UI, always take a screenshot and evaluate if everything looks good - if not, fix that.
- Use the existing page when possible.
- Start Vite to access the app at https://localhost:5173/. When you go to this page, you almost always need to click on "Demo".
- Always start the dev server with `npm run dev` in a non-hidden terminal.
- Always re-use the same terminal session for `npm run dev`; do not start another terminal for the dev server.
- Avoid getting stuck in tool loops; if a tool call fails repeatedly, stop and reassess before continuing.
