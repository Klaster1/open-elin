import noble from "@abandonware/noble";
import { BikeNetCommands } from "./commands.ts";
import { BikeNetProtocol, bufToHex } from "./protocol.ts";
import { NobleTransport } from "./transport-noble.ts";

const BIKE_NET_SERVICE = "a5c1c000cc20ba910c1aef3f9e643d79";

function normalizeUuid(u: string) {
  return u.replace(/-/g, "").toLowerCase();
}

console.log("BikeNet scanner prototype starting...");

// Command to send: '0x0000' for BLE_CMD_GET_LIST, '0x0015' for BLE_CMD_READ_BUTTON_MAP
const PIN_CODE = "1111"; // default per app

noble.on("stateChange", (state: string) => {
  console.log("adapter state:", state);

  if (state === "poweredOn") {
    noble.startScanning([], true);
    console.log("scanning (allow duplicates)...");
  } else {
    noble.stopScanning();
  }
});

const seen = new Map<string, number>();

// Discover by device name only (no CLI target)

function tryConnect(peripheral: any) {
  const id = peripheral.id || peripheral.uuid;
  console.log(`\nConnecting to ${id} ...`);
  noble.stopScanning();

  peripheral.connect((err: Error | null) => {
    if (err) {
      console.error("connect error", err);
      return;
    }
    console.log("connected");
    peripheral.discoverServices([], (err2: Error | null, services: any[]) => {
      if (err2) {
        console.error("discoverServices error", err2);
        return;
      }
      console.log(`found ${services.length} services`);

      const MSG_UUID = "a5c1cc01cc20ba910c1aef3f9e643d79";
      const PIN_UUID = "a5c1cc02cc20ba910c1aef3f9e643d79";
      let msgChar: any | null = null;
      let pinChar: any | null = null;

      let pendingNotifications: Buffer[] = [];

      // discover characteristics for each service and look for MSG char
      let toProcess = services.length;
      services.forEach((s: any) => {
        s.discoverCharacteristics([], (cErr: Error | null, chars: any[]) => {
          if (cErr) {
            console.error("discoverCharacteristics err", cErr);
          } else {
            chars.forEach((c: any) => {
              console.log(
                `  Char: ${c.uuid} props=[${c.properties.join(",")} ]`,
              );
              if (c.uuid.replace(/-/g, "").toLowerCase() === MSG_UUID) {
                msgChar = c;
              }
              if (c.uuid.replace(/-/g, "").toLowerCase() === PIN_UUID) {
                pinChar = c;
              }
            });
          }
          toProcess--;
          if (toProcess === 0) {
            // after all chars discovered
            const man = peripheral.advertisement?.manufacturerData;
            const svcData = peripheral.advertisement?.serviceData;
            console.log(" advertisement manufacturerData:", bufToHex(man));
            if (svcData && svcData.length) {
              svcData.forEach((sd: any) => {
                console.log(" serviceData:", sd.uuid, bufToHex(sd.data));
              });
            }

            if (!msgChar) {
              console.log("MSG characteristic not found, disconnecting");
              peripheral.disconnect(() => process.exit(0));
              return;
            }

            const macAddress = peripheral.address || "";
            const writeWithoutResponse = msgChar.properties.includes(
              "writeWithoutResponse",
            );

            const transport = new NobleTransport({
              msgChar,
              pinChar,
              onMsgNotify: (data) => {
                console.log("RAW NOTIFY:", bufToHex(data));
                pendingNotifications.push(data);
              },
              onPinNotify: (data) => {
                console.log("RAW PIN NOTIFY:", bufToHex(data));
              },
            });

            const protocol = new BikeNetProtocol(transport, {
              macAddress,
              writeWithoutResponse,
              responseTimeoutMs: 8000,
            });

            const commands = new BikeNetCommands(protocol);

            (async () => {
              try {
                if (pinChar) {
                  console.log("Sending PIN...");
                }
                await protocol.connect(PIN_CODE, () => {
                  console.log("PIN accepted");
                });
                console.log("Requesting GET_LIST...");
                const list = await commands.getList();
                if (list.status === "success" && list.entries?.length) {
                  console.log("\nGET_LIST parsed entries:");
                  list.entries.forEach((e, idx) => {
                    console.log(
                      ` [${idx}] mac=${e.mac} name='${e.name}' type=${e.type} flag=${e.flag} num=${e.num} extra=${e.extra}`,
                    );
                  });
                } else {
                  console.log("GET_LIST response:", list.code);
                }
              } catch (err) {
                console.error("GET_LIST error", err);
              }
            })();

            // Wait for notifications (event-driven). Disconnect after a timeout
            const WAIT_MS = 8000;
            console.log(`Waiting up to ${WAIT_MS}ms for notifications...`);
            setTimeout(() => {
              console.log(
                `\nWait timeout (${WAIT_MS}ms). Received ${pendingNotifications.length} notifications.`,
              );
              peripheral.disconnect(() => {
                console.log("disconnected");
                process.exit(0);
              });
            }, WAIT_MS);
          }
        });
      });
    });
  });
}

noble.on("discover", (peripheral: any) => {
  const id: string = (
    peripheral.id ||
    peripheral.uuid ||
    "<no-id>"
  ).toLowerCase();
  const addr: string = (
    peripheral.address || "<unknown-address>"
  ).toLowerCase();
  const name: string = (
    peripheral.advertisement?.localName || "<no-name>"
  ).toLowerCase();
  const uuids: string[] = peripheral.advertisement?.serviceUuids || [];
  const man = peripheral.advertisement?.manufacturerData;
  const rssi = peripheral.rssi;

  const isBikeNet = uuids.some(
    (u: string) =>
      normalizeUuid(u) === BIKE_NET_SERVICE ||
      normalizeUuid(u).startsWith(BIKE_NET_SERVICE.slice(0, 8)),
  );

  // only log/connect devices that advertise the NXS Shifter name
  const isNxsName =
    name.includes("nxs shifter") ||
    name.includes("nxsshifter") ||
    name === "nxs shifter rr" ||
    name.includes("nxs");
  if (!isNxsName) return; // skip all non-NXS devices

  const now = Date.now();
  const last = seen.get(id) || 0;
  // throttle logs per device to once per 2000ms
  if (now - last < 2000) return;
  seen.set(id, now);

  console.log("---");
  console.log(`${id} ${addr} "${name}" RSSI:${rssi} BikeNet:${isBikeNet}`);
  console.log(" serviceUuids:", uuids.join(", "));
  if (man) console.log(" manufacturerData:", bufToHex(man));

  // connect when advertisement name looks like NXS shifter
  if (isNxsName) {
    tryConnect(peripheral);
  }
});

process.on("SIGINT", () => {
  console.log("\nStopping scan...");
  try {
    noble.stopScanning();
  } catch (e) {}
  process.exit(0);
});
