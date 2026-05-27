import { ExitCode } from "./exit-codes.ts";
import { printJson } from "./output.ts";

export function run(): void {
  printJson({
    schema_version: "1",
    binary: "open-elin",
    description: "Agent-native CLI for the NXS BikeNet hub",
    commands: {
      scan: {
        syntax: "open-elin scan [--timeout=<ms>] [--limit=<n>] [--json]",
        description: "Scan for nearby BikeNet hubs via BLE",
        flags: {
          "--timeout": "Scan duration in ms (default 5000)",
          "--limit": "Return at most N results",
          "--json": "Emit JSON array of { address, name, rssi }",
        },
      },
      "hub list": {
        syntax: "open-elin hub list --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "List devices paired to the hub",
      },
      "hub get": {
        syntax: "open-elin hub get <MAC> --address=<HUB_MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Get a single paired device by MAC",
      },
      "hub blink": {
        syntax: "open-elin hub blink --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Blink the hub LED",
      },
      "hub shift-up": {
        syntax: "open-elin hub shift-up --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Send shift-up command",
      },
      "hub shift-down": {
        syntax: "open-elin hub shift-down --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Send shift-down command",
      },
      "hub move": {
        syntax: "open-elin hub move <POSITION> --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Move derailleur to absolute position (0–6553.5)",
      },
      "hub get-position": {
        syntax: "open-elin hub get-position --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Read current absolute and gear position",
      },
      "hub get-rear-cog": {
        syntax: "open-elin hub get-rear-cog --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Read rear cog cable-position table",
      },
      "hub set-rear-cog": {
        syntax: "open-elin hub set-rear-cog --positions=<CSV> [--teeth=<CSV>] --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Write rear cog cable-position table",
      },
      "hub read-button-map": {
        syntax: "open-elin hub read-button-map --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Read raw button map bytes from hub",
      },
      "hub read-button-table": {
        syntax: "open-elin hub read-button-table --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Read parsed button-table notification (waits up to 8 s)",
      },
      "hub get-motor-params": {
        syntax: "open-elin hub get-motor-params --address=<MAC> [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Read motor parameter block",
      },
      "hub set-name": {
        syntax: "open-elin hub set-name <NAME> --address=<HUB_MAC> [--target-mac=<DEV_MAC>] [--pin=<pin>] [--timeout=<ms>] [--json]",
        description: "Rename a device (default: the hub itself)",
      },
      "hub monitor": {
        syntax: "open-elin hub monitor --address=<MAC> [--deliver=stdout|file:<path>] [--pin=<pin>] [--timeout=<ms>]",
        description: "Stream BLE events (battery-voltage, button-action, shift-complete) as JSON lines until Ctrl-C",
      },
      "agent-context": {
        syntax: "open-elin agent-context",
        description: "Print this schema document",
      },
    },
    exit_codes: {
      "0": "success",
      "1": "general error",
      "2": "invalid arguments",
      "3": "BLE adapter unavailable",
      "4": "hub not found during scan",
      "5": "connect failed",
      "6": "command returned error status",
    },
    notes: [
      "Default PIN is 1111 (pass --pin if different).",
      "--address accepts any MAC format (colons optional, case-insensitive).",
      "All JSON outputs are newline-terminated.",
    ],
  } satisfies Record<string, unknown>);
}

export { ExitCode };
