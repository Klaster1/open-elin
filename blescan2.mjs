import noble from "@abandonware/noble";
const seen = new Map();
noble.on("stateChange", s => { if (s==="poweredOn") noble.startScanning([],true); });
noble.on("discover", p => {
  if (!seen.has(p.address)) {
    seen.set(p.address, true);
    const name = p.advertisement?.localName || "";
    const mfr  = p.advertisement?.manufacturerData;
    console.log("  "+p.address+"  '"+name+"'  mfr="+(mfr&&mfr.length?mfr.toString("hex"):"")+"  rssi="+p.rssi);
  }
});
setTimeout(()=>{noble.stopScanning();console.log("done, "+seen.size+" devices");process.exit(0);},8000);
