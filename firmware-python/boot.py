"""boot.py — runs before code.py.
Disables HID (not needed for BLE pod), keeps USB serial for debug output.
"""
import usb_cdc
import usb_hid

usb_hid.disable()
usb_cdc.enable(console=True, data=False)
