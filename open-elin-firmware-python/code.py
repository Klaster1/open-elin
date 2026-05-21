"""
NXS MTB Pod Emulator
CircuitPython 9.x · nRF52840 SuperMini

Emulates a BikeNet pod peripheral so the NXS hub can pair with it via
  node open-elin-cli/src/cli.ts hub add-device --address d7:ba:ab:52:a0:e5 <BOARD-MAC>

Uses _bleio (built-in) — no extra libraries needed.

Pinout:
  board.P0_17  — button (pull-up, active-low)  →  sends shift-UP to hub
  board.LED    — status
      off        = advertising, waiting for hub
      solid on   = connected
      blink      = connecting / button press / PIN exchange
"""

import time
import struct
import sys
import board
import digitalio
import usb_cdc
import _bleio

# ── Configuration ─────────────────────────────────────────────────────────────
# Hub to emulate pairing with.  Change if your hub MAC differs.
HUB_MAC_LE = bytes([0xe5, 0xa0, 0x52, 0xab, 0xba, 0xd7])  # d7:ba:ab:52:a0:e5 reversed LE

DEVICE_NAME    = "NXS MTB Pod"
# Button IDs per hub button map (--use-captured template):
#   0x0D → fn:0A (Shift Up)    0x06 → fn:0B (Shift Down)
BTN_SHIFT_UP   = 0x0D
BTN_SHIFT_DOWN = 0x06
DEBOUNCE_S     = 0.05
NUM_GEARS      = 12
SHIFT_TIMEOUT  = 1.2   # s — flip direction if no ShiftComplete within this time

# ── Advertisement data ────────────────────────────────────────────────────────
def _ad(ad_type, data):
    """Pack one AD record: [length][type][data]."""
    return bytes([len(data) + 1, ad_type]) + bytes(data)

# Manufacturer specific: company 0xDE98 (LE) + device type 0x08/0x01 + hub MAC LE
_MFR = struct.pack("<H", 0xDE98) + b"\x08\x01" + HUB_MAC_LE

# Total must stay ≤ 31 bytes. Name=13 B + Mfr=12 B = 25 B — OK.
# Service UUID AD record (18 B) is omitted; hub connects by MAC so it's not needed.
ADV_DATA = (
    _ad(0x09, DEVICE_NAME.encode()) +   # Complete Local Name  (13 B)
    _ad(0xFF, _MFR)                     # Manufacturer Specific Data (12 B)
)

# ── GATT service ──────────────────────────────────────────────────────────────
# CircuitPython 9.x nRF52840: Service takes only uuid (no characteristics kwarg).
# Characteristics are created via Characteristic.add_to_service() class method.
# Property values on this build: WRITE=16, NOTIFY=4, Attribute.OPEN=17
_OPEN = _bleio.Attribute.OPEN
_WNR  = _bleio.Characteristic.WRITE | _bleio.Characteristic.WRITE_NO_RESPONSE | _bleio.Characteristic.NOTIFY

_service = _bleio.Service(_bleio.UUID("a5c1c000-cc20-ba91-0c1a-ef3f9e643d79"))

msg_char = _bleio.Characteristic.add_to_service(
    _service,
    _bleio.UUID("a5c1cc01-cc20-ba91-0c1a-ef3f9e643d79"),
    properties=_WNR,
    read_perm=_OPEN,
    write_perm=_OPEN,
    max_length=20,
    fixed_length=False,
)

pin_char = _bleio.Characteristic.add_to_service(
    _service,
    _bleio.UUID("a5c1cc02-cc20-ba91-0c1a-ef3f9e643d79"),
    properties=_WNR,
    read_perm=_OPEN,
    write_perm=_OPEN,
    max_length=20,
    fixed_length=False,
)

# CharacteristicBuffers — queue-based detection of incoming hub writes
pin_buf = _bleio.CharacteristicBuffer(pin_char, buffer_size=64)
msg_buf = _bleio.CharacteristicBuffer(msg_char, buffer_size=64)

# ── Hardware ──────────────────────────────────────────────────────────────────
led = digitalio.DigitalInOut(board.LED)
led.direction = digitalio.Direction.OUTPUT
led.value = False

btn = digitalio.DigitalInOut(board.P0_17)
btn.direction = digitalio.Direction.INPUT
btn.pull = digitalio.Pull.UP    # active-low: False = pressed

def blink(n=1, t=0.08):
    for _ in range(n):
        led.value = True
        time.sleep(t)
        led.value = False
        time.sleep(t)

# ── BLE helpers ───────────────────────────────────────────────────────────────
adapter = _bleio.adapter

def mac_le() -> bytes:
    """Own BLE address as 6-byte little-endian (used in notification payload)."""
    return bytes(adapter.address.address_bytes)

def send_button(btn_id: int, action: int = 0) -> None:
    """Send a button-press notification to the hub via MSG characteristic."""
    payload = b"\x01\x40" + mac_le() + bytes([btn_id, action])
    print(f"→ button 0x{btn_id:02X}  payload {payload.hex()}")
    msg_char.value = payload

def send_shift() -> None:
    """Send shift in current bounce direction; arms the ShiftComplete timeout."""
    global _shift_time
    btn_id = BTN_SHIFT_UP if _shift_dir else BTN_SHIFT_DOWN
    label  = "UP" if _shift_dir else "DOWN"
    print(f"→ SHIFT {label}  gear={_cur_gear}")
    send_button(btn_id)
    _shift_time = time.monotonic()

def start_adv() -> None:
    print(f"Advertising '{DEVICE_NAME}'  addr={adapter.address}")
    adapter.start_advertising(bytes(ADV_DATA), connectable=True, interval=0.1)
    blink(2)

# ── Main loop ─────────────────────────────────────────────────────────────────
print("NXS pod emulator starting …")
blink(3, 0.05)
start_adv()

_btn_prev = True  # pull-up → True = released
_was_connected = False
_shift_dir  = False  # False = DOWN (toward gear 12) — hub always starts at gear 1 after reset
_cur_gear   = None   # last known gear (1–12), updated from ShiftComplete
_shift_time = None   # monotonic() of last button send; None = idle

while True:
    # ── Not connected: keep advertising ──────────────────────────────────────
    if not adapter.connected:
        if _was_connected:
            print("HUB DISCONNECTED")
            _was_connected = False
        led.value = False
        if not adapter.advertising:
            start_adv()
        time.sleep(0.05)
        continue

    # ── Connected ─────────────────────────────────────────────────────────────
    if not _was_connected:
        print("HUB CONNECTED  — serial: u/b=shift-up  d=shift-down  P0_17=shift-up")
        _was_connected = True
        _last_pin_val = None
        _last_msg_val = None
        # Check CCCD subscription on MSG and PIN chars
        try:
            print(f"  msg_char descriptors: {list(msg_char.descriptors)}")
            for d in msg_char.descriptors:
                print(f"    desc uuid={d.uuid} val={bytes(d.value).hex()}")
        except Exception as e:
            print(f"  (descriptor check failed: {e})")
        print(f"  adapter.connections = {adapter.connections}")
    led.value = True

    # CharacteristicBuffer path
    n = pin_buf.in_waiting
    if n:
        data = pin_buf.read(n)
        print(f"← PIN (buf)  {data.hex()}  →  ACK 0x01")
        pin_char.value = b"\x01"
        blink(1)

    n = msg_buf.in_waiting
    if n:
        data = msg_buf.read(n)
        print(f"← MSG (buf)  {data.hex()}")

    # Direct .value polling fallback
    try:
        pv = bytes(pin_char.value or b'')
        if pv and pv != _last_pin_val:
            print(f"← PIN (val)  {pv.hex()}  →  ACK 0x01")
            pin_char.value = b"\x01"
            _last_pin_val = pv
            blink(1)
    except Exception:
        pass
    try:
        mv = bytes(msg_char.value or b'')
        if mv and mv != _last_msg_val:
            print(f"← MSG (val)  {mv.hex()}")
            _last_msg_val = mv
            # Parse ShiftComplete (opcode 0x4003) — hub tells us the new gear
            if len(mv) >= 11 and (mv[0] | (mv[1] << 8)) == 0x4003:
                gear = mv[10]
                _cur_gear  = gear
                _shift_time = None   # shift completed, clear timeout
                if gear <= 1:
                    _shift_dir = False
                    print(f"  ShiftComplete gear={gear} → at bottom, switching to DOWN")
                elif gear >= NUM_GEARS:
                    _shift_dir = True
                    print(f"  ShiftComplete gear={gear} → at top, switching to UP")
                else:
                    print(f"  ShiftComplete gear={gear}")
    except Exception:
        pass

    # Physical button (P0_17, active-low) → shift up
    cur = btn.value
    if not cur and _btn_prev:           # falling edge = press
        time.sleep(DEBOUNCE_S)
        if not btn.value:               # debounce confirmed
            send_shift()
    _btn_prev = cur

    # Serial triggers (for testing without physical button)
    if usb_cdc.console and usb_cdc.console.in_waiting:
        ch = usb_cdc.console.read(1)
        if ch in (b'u', b'b'):
            send_button(BTN_SHIFT_UP)
            blink(3, 0.05)
        elif ch == b'd':
            send_button(BTN_SHIFT_DOWN)
            blink(2, 0.05)

    # Shift timeout → no ShiftComplete received, assume we hit a gear limit
    if _shift_time is not None and time.monotonic() - _shift_time > SHIFT_TIMEOUT:
        _shift_time = None
        _shift_dir  = not _shift_dir
        label = "UP" if _shift_dir else "DOWN"
        print(f"  shift timeout → flipped direction to {label}")

    time.sleep(0.02)
