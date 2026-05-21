/**
 * Connect to the fake pod peripheral, subscribe to MSG char notifications,
 * then wait. When the board sends a button press (via 'b' on serial or physical
 * button), this script should receive the notification.
 *
 * Usage: node test-pod-notify.mjs <POD_MAC>
 *   e.g. node test-pod-notify.mjs c2:4f:23:0b:b5:43
 */
import noble from "@abandonware/noble";

const TARGET_MAC = (process.argv[2] || "c2:4f:23:0b:b5:43").toLowerCase().replace(/:/g, "");
const SVC_UUID   = "a5c1c000cc20ba910c1aef3f9e643d79";
const MSG_UUID   = "a5c1cc01cc20ba910c1aef3f9e643d79";

console.log(`Scanning for pod ${TARGET_MAC}…`);

noble.on("stateChange", (state) => {
  if (state === "poweredOn") noble.startScanning([], false);
});

noble.on("discover", async (peripheral) => {
  if (peripheral.id !== TARGET_MAC) return;
  noble.stopScanning();
  console.log(`Found: ${peripheral.address}  RSSI=${peripheral.rssi}`);

  await peripheral.connectAsync();
  console.log("Connected.");

  const services = await peripheral.discoverServicesAsync([SVC_UUID]);
  if (!services || !services.length) { console.log("Service not found!"); process.exit(1); }

  const characteristics = await services[0].discoverCharacteristicsAsync([MSG_UUID]);
  if (!characteristics || !characteristics.length) { console.log("MSG char not found!"); process.exit(1); }

  const msgChar = characteristics[0];
  console.log(`MSG char: ${msgChar.uuid}  properties=${msgChar.properties}`);

  // Subscribe to notifications
  await msgChar.subscribeAsync();
  console.log("Subscribed to MSG notifications. Waiting for button press…");

  msgChar.on("data", (data, isNotification) => {
    console.log(`NOTIFICATION received (isNotification=${isNotification}): ${data.toString("hex")}`);
    if (data.length >= 2) {
      const code = data[0] | (data[1] << 8);
      console.log(`  code=0x${code.toString(16).padStart(4,"0")}`);
    }
  });

  // Keep alive
  process.on("SIGINT", async () => {
    await peripheral.disconnectAsync().catch(() => {});
    process.exit(0);
  });
});
