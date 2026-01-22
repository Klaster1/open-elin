import noble from "@abandonware/noble";

const BIKE_NET_SERVICE = "a5c1c000cc20ba910c1aef3f9e643d79";

function bufToHex(buf?: Buffer | null) {
  if (!buf) return "";
  return Buffer.from(buf).toString("hex");
}

function normalizeUuid(u: string) {
  return u.replace(/-/g, "").toLowerCase();
}

console.log("BikeNet scanner prototype starting...");

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

noble.on("discover", (peripheral: any) => {
  const id: string = peripheral.id || peripheral.uuid || "<no-id>";
  const addr: string = peripheral.address || "<unknown-address>";
  const name: string = peripheral.advertisement?.localName || "<no-name>";
  const uuids: string[] = peripheral.advertisement?.serviceUuids || [];
  const man = peripheral.advertisement?.manufacturerData;
  const rssi = peripheral.rssi;

  const isBikeNet = uuids.some(
    (u: string) =>
      normalizeUuid(u) === BIKE_NET_SERVICE ||
      normalizeUuid(u).startsWith(BIKE_NET_SERVICE.slice(0, 8)),
  );

  const now = Date.now();
  const last = seen.get(id) || 0;
  // throttle logs per device to once per 2000ms
  if (now - last < 2000) return;
  seen.set(id, now);

  console.log("---");
  console.log(`${id} ${addr} "${name}" RSSI:${rssi} BikeNet:${isBikeNet}`);
  console.log(" serviceUuids:", uuids.join(", "));
  if (man) console.log(" manufacturerData:", bufToHex(man));
});

process.on("SIGINT", () => {
  console.log("\nStopping scan...");
  try {
    noble.stopScanning();
  } catch (e) {}
  process.exit(0);
});
