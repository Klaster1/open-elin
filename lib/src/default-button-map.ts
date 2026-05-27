import type { ButtonMapEntry } from "./commands.ts";

function macToHexLE(mac: string): string {
  return mac.split(":").reverse().map((b) => b.toUpperCase()).join("");
}

/**
 * Build the 7 standard button map entries for any pod+hub pair.
 * MACs should be colon-separated (e.g. "D5:89:B2:13:FA:04").
 */
export function buildDefaultButtonMap(podMac: string, hubMac: string): ButtonMapEntry[] {
  const podHex = macToHexLE(podMac);
  const hubHex = macToHexLE(hubMac);

  const entries: Array<[string, string]> = [
    ["00", "0A"], // button A  → Shift Up
    ["06", "0B"], // button B  → Shift Down
    ["0C", "11"], // button C  → Tune Mode
    ["0D", "0A"], // button C-1 → Shift Up
    ["01", "0B"], // button A-1 → Shift Down
    ["12", "0B"], // button D  → Shift Down
    ["02", "11"], // button A-2 → Tune Mode
  ];

  return entries.map(([btn, fn], i) => ({
    podAddressHex: podHex,
    elinkAddressHex: hubHex,
    button1: { code: btn },
    button2: { code: "00" },
    action: { code: "00" },
    function: { code: fn },
    index: i,
  }));
}
