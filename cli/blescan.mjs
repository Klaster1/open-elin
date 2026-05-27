import noble from "@abandonware/noble";
noble.on("stateChange", s => { if (s==="poweredOn") noble.startScanning([],true); });
noble.on("discover", p => {
  const name = p.advertisement?.localName || "";
  const mfr  = p.advertisement?.manufacturerData;
  if (name.toLowerCase().includes("nxs") || name.toLowerCase().includes("pod") || (mfr && mfr[0]===0x98 && mfr[1]===0xde))
    console.log("FOUND addr="+p.address+" name='"+name+"' mfr="+(mfr?mfr.toString("hex"):"none")+" rssi="+p.rssi);
});
setTimeout(()=>{noble.stopScanning();process.exit(0);},8000);
