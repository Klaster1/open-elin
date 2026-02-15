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

## Testing and Validation

- ALWAYS use Chrome MCP to test changes in demo mode.
- Use the existing page when possible.
- Start Vite to access the app at https://localhost:5173/.
- Avoid getting stuck in tool loops; if a tool call fails repeatedly, stop and reassess before continuing.
