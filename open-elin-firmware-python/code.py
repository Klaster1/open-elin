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
# Button IDs matching real NXS MTB Pod:
#   0x00 → slot "-" (Shift Up in default map)
#   0x01 → slot "A-1" (Shift Down in default map)
BTN_SHIFT_UP   = 0x00
BTN_SHIFT_DOWN = 0x01
DEBOUNCE_S     = 0.05
NUM_GEARS      = 12
SHIFT_TIMEOUT  = 1.2   # s — flip direction if no ShiftComplete within this time
BATTERY_MV     = 3000  # fake battery voltage (USB-powered, report a fixed value)

# ── Advertisement data ────────────────────────────────────────────────────────
def _ad(ad_type, data):
    """Pack one AD record: [length][type][data]."""
    return bytes([len(data) + 1, ad_type]) + bytes(data)

# Service UUID (128-bit, LE byte order) for BikeNet GATT service
_SVC_UUID_LE = bytes([
    0x79, 0x3D, 0x64, 0x9E, 0x3F, 0xEF, 0x1A, 0x0C,
    0x91, 0xBA, 0x20, 0xCC, 0x00, 0xC0, 0xC1, 0xA5,
])

def _build_adv_data(own_mac_le: bytes) -> tuple:
    """Build (adv_data, scan_response) matching the real NXS MTB Pod.

    Real pod raw advertisement (49 B total, split across adv + scan response):
      Flags(3) + Name(14) + ServiceUUID(18) + Manufacturer(14) = 49 B
    Legacy BLE limit is 31 B per packet, so we split:
      adv_data:      Flags(3) + ServiceUUID(18) + Manufacturer(14) = 35 B — still over,
    Actual real pod likely uses:
      adv_data:      Flags(3) + Manufacturer(14) + Name(14) = 31 B
      scan_response: ServiceUUID(18) = 18 B
    """
    # Manufacturer specific: company 0xDE98 (LE) + device bytes + own MAC + trailing 0x00
    mfr = struct.pack("<H", 0xDE98) + b"\x0A\x10" + own_mac_le + b"\x00"

    adv = (
        _ad(0x01, b"\x06") +                    # Flags: LE General Discoverable + BR/EDR Not Supported (3 B)
        _ad(0xFF, mfr) +                         # Manufacturer Specific Data (14 B)
        _ad(0x09, DEVICE_NAME.encode())           # Complete Local Name (14 B)
    )  # total 31 B

    scan_rsp = _ad(0x07, _SVC_UUID_LE)            # 128-bit Service UUID (18 B)

    return adv, scan_rsp

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
    """Send a button notification to the hub via MSG characteristic.
    action: 0 = press, 1 = release."""
    payload = b"\x01\x40" + mac_le() + bytes([btn_id, action])
    print(f"→ button 0x{btn_id:02X}  action={action}  payload {payload.hex()}")
    msg_char.value = payload

def send_battery(mv: int = BATTERY_MV) -> None:
    """Send battery voltage notification (opcode 0x4000)."""
    payload = b"\x00\x40" + mac_le() + struct.pack("<H", mv)
    print(f"→ battery {mv} mV  payload {payload.hex()}")
    msg_char.value = payload

def send_press_release(btn_id: int) -> None:
    """Send a press then release event (for serial triggers)."""
    send_button(btn_id, 0)   # press
    time.sleep(0.05)
    send_button(btn_id, 1)   # release

def _cur_shift_btn() -> int:
    """Return the button code for the current shift direction."""
    return BTN_SHIFT_UP if _shift_dir else BTN_SHIFT_DOWN

def send_shift() -> None:
    """Send shift in current bounce direction; arms the ShiftComplete timeout."""
    global _shift_time
    btn_id = BTN_SHIFT_UP if _shift_dir else BTN_SHIFT_DOWN
    label  = "UP" if _shift_dir else "DOWN"
    print(f"→ SHIFT {label}  gear={_cur_gear}")
    send_press_release(btn_id)
    _shift_time = time.monotonic()

def start_adv() -> None:
    adv_data, scan_rsp = _build_adv_data(mac_le())
    print(f"Advertising '{DEVICE_NAME}'  addr={adapter.address}")
    adapter.start_advertising(bytes(adv_data), scan_response=bytes(scan_rsp), connectable=True, interval=0.1)
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
        _last_battery = 0  # force immediate send
        # Check CCCD subscription on MSG and PIN chars
        try:
            print(f"  msg_char descriptors: {list(msg_char.descriptors)}")
            for d in msg_char.descriptors:
                print(f"    desc uuid={d.uuid} val={bytes(d.value).hex()}")
        except Exception as e:
            print(f"  (descriptor check failed: {e})")
        print(f"  adapter.connections = {adapter.connections}")
    led.value = True

    # CharacteristicBuffer path — PIN exchange triggers battery report
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

    # Physical button (P0_17, active-low) → shift
    cur = btn.value
    if not cur and _btn_prev:           # falling edge = press
        time.sleep(DEBOUNCE_S)
        if not btn.value:               # debounce confirmed
            send_button(_cur_shift_btn(), 0)  # press
            _shift_time = time.monotonic()
    elif cur and not _btn_prev:         # rising edge = release
        time.sleep(DEBOUNCE_S)
        if btn.value:                   # debounce confirmed
            send_button(_cur_shift_btn(), 1)  # release
    _btn_prev = cur

    # Serial triggers (for testing without physical button)
    if usb_cdc.console and usb_cdc.console.in_waiting:
        ch = usb_cdc.console.read(1)
        if ch in (b'u', b'b'):
            send_press_release(BTN_SHIFT_UP)
            blink(3, 0.05)
        elif ch == b'd':
            send_press_release(BTN_SHIFT_DOWN)
            blink(2, 0.05)

    # Shift timeout → no ShiftComplete received, assume we hit a gear limit
    if _shift_time is not None and time.monotonic() - _shift_time > SHIFT_TIMEOUT:
        _shift_time = None
        _shift_dir  = not _shift_dir
        label = "UP" if _shift_dir else "DOWN"
        print(f"  shift timeout → flipped direction to {label}")

    # Periodic battery report every 5 seconds
    now = time.monotonic()
    if now - _last_battery >= 5:
        _last_battery = now
        send_battery()

    time.sleep(0.02)
