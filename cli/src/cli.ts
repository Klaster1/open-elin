#!/usr/bin/env node
import { merge, object, or } from "@optique/core/constructs";
import { optional, withDefault } from "@optique/core/modifiers";
import { argument, command, constant, option } from "@optique/core/primitives";
import { float, integer, string } from "@optique/core/valueparser";
import { run } from "@optique/run";
import process from "node:process";

import * as agentContextCmd from "./agent-context.ts";
import * as addDeviceCmd from "./commands/hub/add-device.ts";
import * as blinkCmd from "./commands/hub/blink.ts";
import * as disconnectDeviceCmd from "./commands/hub/disconnect-device.ts";
import * as getMotorParamsCmd from "./commands/hub/get-motor-params.ts";
import * as getPositionCmd from "./commands/hub/get-position.ts";
import * as getRearCogCmd from "./commands/hub/get-rear-cog.ts";
import * as getCmd from "./commands/hub/get.ts";
import * as listCmd from "./commands/hub/list.ts";
import * as monitorCmd from "./commands/hub/monitor.ts";
import * as moveCmd from "./commands/hub/move.ts";
import * as readButtonMapCmd from "./commands/hub/read-button-map.ts";
import * as readButtonTableCmd from "./commands/hub/read-button-table.ts";
import * as removeDeviceCmd from "./commands/hub/remove-device.ts";
import * as setBikeNetCmd from "./commands/hub/set-bikenet.ts";
import * as setNameCmd from "./commands/hub/set-name.ts";
import * as setRearCogCmd from "./commands/hub/set-rear-cog.ts";
import * as shiftDownCmd from "./commands/hub/shift-down.ts";
import * as shiftUpCmd from "./commands/hub/shift-up.ts";
import * as sleepCmd from "./commands/hub/sleep.ts";
import * as writeButtonMapCmd from "./commands/hub/write-button-map.ts";
import * as writeDefaultButtonMapCmd from "./commands/hub/write-default-button-map.ts";
import * as scanCmd from "./commands/scan.ts";
import { ExitCode } from "./exit-codes.ts";

// -- Shared hub connection flags (required --address + optional --pin / --timeout / --json) --
const hubFlags = object("Connection", {
  address: option("--address", string({ metavar: "MAC" })),
  pin: withDefault(option("--pin", string({ metavar: "PIN" })), "1111"),
  timeout: withDefault(option("--timeout", integer({ min: 1, metavar: "MS" })), 8000),
  json: option("--json"),
});

// -- Hub subcommand parsers --
const addDevParser    = merge(object({ type: constant("add-device"), podMac: argument(string({ metavar: "POD-MAC" })), waitForPod: withDefault(option("--wait-for-pod", integer({ min: 0, metavar: "SECS" })), 0) }), hubFlags);
const removeDevParser = merge(object({ type: constant("remove-device"), podMac: argument(string({ metavar: "POD-MAC" })) }), hubFlags);
const disconnectDevParser = merge(object({ type: constant("disconnect-device"), podMac: argument(string({ metavar: "POD-MAC" })) }), hubFlags);
const setBikeNetParser = merge(object({ type: constant("set-bikenet") }), hubFlags);
const listParser      = merge(object({ type: constant("list") }), hubFlags);
const getParser     = merge(object({ type: constant("get"), mac: argument(string({ metavar: "MAC" })) }), hubFlags);
const blinkParser   = merge(object({ type: constant("blink") }), hubFlags);
const sleepParser   = merge(object({ type: constant("sleep") }), hubFlags);
const shiftUpParser = merge(object({ type: constant("shift-up") }), hubFlags);
const shiftDnParser = merge(object({ type: constant("shift-down") }), hubFlags);
const moveParser    = merge(object({ type: constant("move"), position: argument(float({ min: 0, max: 6553.5, metavar: "POS" })) }), hubFlags);
const getPosParser  = merge(object({ type: constant("get-position") }), hubFlags);
const getRcParser   = merge(object({ type: constant("get-rear-cog") }), hubFlags);
const setRcParser   = merge(
  object({
    type: constant("set-rear-cog"),
    positions: option("--positions", string({ metavar: "CSV" })),
    teeth: optional(option("--teeth", string({ metavar: "CSV" }))),
  }),
  hubFlags,
);
const readBmParser    = merge(object({ type: constant("read-button-map") }), hubFlags);
const readBtParser    = merge(object({ type: constant("read-button-table") }), hubFlags);
const writeBmParser   = merge(object({ type: constant("write-button-map"), entriesJson: optional(option("--entries-json", string({ metavar: "JSON" }))), useCaptured: option("--use-captured"), podMac: optional(option("--pod-mac", string({ metavar: "MAC" }))) }), hubFlags);
const writeDefBmParser = merge(object({ type: constant("write-default-button-map"), podMac: option("--pod-mac", string({ metavar: "MAC" })) }), hubFlags);
const getMotParser  = merge(object({ type: constant("get-motor-params") }), hubFlags);
const setNameParser = merge(
  object({
    type: constant("set-name"),
    name: argument(string({ metavar: "NAME" })),
    targetMac: optional(option("--target-mac", string({ metavar: "MAC" }))),
  }),
  hubFlags,
);
const monitorParser = merge(
  object({
    type: constant("monitor"),
    deliver: withDefault(option("--deliver", string({ metavar: "DEST" })), "stdout"),
  }),
  hubFlags,
);

// Split into two groups to stay within or() arity limit.
const hubGroup1 = or(
  command("add-device",         addDevParser),
  command("remove-device",      removeDevParser),
  command("disconnect-device",  disconnectDevParser),
  command("set-bikenet",        setBikeNetParser),
  command("list",        listParser),
  command("get",         getParser),
  command("blink",       blinkParser),
  command("sleep",       sleepParser),
  command("shift-up",    shiftUpParser),
  command("shift-down",  shiftDnParser),
  command("move",        moveParser),
  command("get-position", getPosParser),
  command("get-rear-cog", getRcParser),
);

const hubGroup2 = or(
  command("set-rear-cog",      setRcParser),
  command("read-button-map",   readBmParser),
  command("read-button-table", readBtParser),
  command("write-button-map",          writeBmParser),
  command("write-default-button-map",  writeDefBmParser),
  command("get-motor-params",  getMotParser),
  command("set-name",          setNameParser),
  command("monitor",           monitorParser),
);

const hubParser = or(hubGroup1, hubGroup2);

// -- Top-level parser --
const parser = or(
  command("scan", object("Scan options", {
    type: constant("scan"),
    timeout: withDefault(option("--timeout", integer({ min: 1, metavar: "MS" })), 8000),
    limit: optional(option("--limit", integer({ min: 1, metavar: "N" }))),
    json: option("--json"),
  })),
  command("hub", hubParser),
  command("agent-context", object({ type: constant("agent-context") })),
);

// -- Parse --
const result = run(parser, {
  programName: "open-elin",
  help: "both",
  errorExitCode: ExitCode.InvalidArgs,
});

// -- Dispatch --
switch (result.type) {
  case "scan":
    await scanCmd.run(result);
    break;
  case "add-device":
    await addDeviceCmd.run(result);
    break;
  case "remove-device":
    await removeDeviceCmd.run(result);
    break;
  case "disconnect-device":
    await disconnectDeviceCmd.run(result);
    break;
  case "set-bikenet":
    await setBikeNetCmd.run(result);
    break;
  case "list":
    await listCmd.run(result);
    break;
  case "get":
    await getCmd.run(result);
    break;
  case "blink":
    await blinkCmd.run(result);
    break;
  case "sleep":
    await sleepCmd.run(result);
    break;
  case "shift-up":
    await shiftUpCmd.run(result);
    break;
  case "shift-down":
    await shiftDownCmd.run(result);
    break;
  case "move":
    await moveCmd.run(result);
    break;
  case "get-position":
    await getPositionCmd.run(result);
    break;
  case "get-rear-cog":
    await getRearCogCmd.run(result);
    break;
  case "set-rear-cog":
    await setRearCogCmd.run(result);
    break;
  case "read-button-map":
    await readButtonMapCmd.run(result);
    break;
  case "read-button-table":
    await readButtonTableCmd.run(result);
    break;
  case "write-button-map":
    await writeButtonMapCmd.run(result);
    break;
  case "write-default-button-map":
    await writeDefaultButtonMapCmd.run(result);
    break;
  case "get-motor-params":
    await getMotorParamsCmd.run(result);
    break;
  case "set-name":
    await setNameCmd.run(result);
    break;
  case "monitor":
    await monitorCmd.run(result);
    break;
  case "agent-context":
    agentContextCmd.run();
    break;
}

process.exit(ExitCode.Success);
