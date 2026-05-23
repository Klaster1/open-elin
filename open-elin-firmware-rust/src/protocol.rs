// When compiled as a standalone lib (cargo test), this is the crate root and needs no_std.
// When included as `mod protocol;` from main.rs, the outer crate already has #![no_std].
#![cfg_attr(not(test), no_std)]

/// BikeNet protocol opcodes (stored as little-endian byte pairs, ready to copy into frames)
const OPCODE_BUTTON: [u8; 2] = 0x4001_u16.to_le_bytes();
const OPCODE_BATTERY: [u8; 2] = 0x4000_u16.to_le_bytes();

/// Button action flags
pub const ACTION_PRESS: u8 = 0x00;
pub const ACTION_RELEASE: u8 = 0x01;

/// Encode a button notification frame (10 bytes).
/// Format: [opcode 2B LE] [pod MAC 6B LE] [buttonId 1B] [actionFlag 1B]
pub fn encode_button(mac_le: &[u8; 6], button_id: u8, action: u8) -> [u8; 10] {
    let mut buf = [0u8; 10];
    buf[0..2].copy_from_slice(&OPCODE_BUTTON);
    buf[2..8].copy_from_slice(mac_le);
    buf[8] = button_id;
    buf[9] = action;
    buf
}

/// Encode a battery voltage notification frame (10 bytes).
/// Format: [opcode 2B LE] [pod MAC 6B LE] [voltage_mV 2B LE]
pub fn encode_battery(mac_le: &[u8; 6], mv: u16) -> [u8; 10] {
    let mut buf = [0u8; 10];
    buf[0..2].copy_from_slice(&OPCODE_BATTERY);
    buf[2..8].copy_from_slice(mac_le);
    buf[8..10].copy_from_slice(&mv.to_le_bytes());
    buf
}

/// Opcode for shift-complete (hub → pod via MSG write, if it happens): 0x4003
const OPCODE_SHIFT_COMPLETE: u16 = 0x4003;

/// Parsed ShiftComplete message from the hub.
pub struct ShiftComplete {
    pub gear: u8,
}

/// Parse a ShiftComplete message from raw MSG characteristic data.
/// Returns `None` if the data isn't a ShiftComplete frame.
pub fn parse_shift_complete(data: &[u8]) -> Option<ShiftComplete> {
    if data.len() < 11 {
        return None;
    }
    let opcode = u16::from_le_bytes([data[0], data[1]]);
    if opcode != OPCODE_SHIFT_COMPLETE {
        return None;
    }
    Some(ShiftComplete { gear: data[10] })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FAKE_MAC: [u8; 6] = [0x43, 0xB5, 0x0B, 0x23, 0x4F, 0xC2]; // C2:4F:23:0B:B5:43 LE

    #[test]
    fn button_press_encodes_correctly() {
        let frame = encode_button(&FAKE_MAC, 0x01, ACTION_PRESS);
        assert_eq!(frame[0], 0x01);
        assert_eq!(frame[1], 0x40);
        assert_eq!(&frame[2..8], &FAKE_MAC);
        assert_eq!(frame[8], 0x01);
        assert_eq!(frame[9], ACTION_PRESS);
    }

    #[test]
    fn button_release_encodes_correctly() {
        let frame = encode_button(&FAKE_MAC, 0x00, ACTION_RELEASE);
        assert_eq!(frame[8], 0x00);
        assert_eq!(frame[9], ACTION_RELEASE);
    }

    #[test]
    fn battery_encodes_mv_little_endian() {
        let frame = encode_battery(&FAKE_MAC, 2871); // 0x0B37
        assert_eq!(frame[0], 0x00);
        assert_eq!(frame[1], 0x40);
        assert_eq!(&frame[2..8], &FAKE_MAC);
        assert_eq!(frame[8], 0x37);
        assert_eq!(frame[9], 0x0B);
    }

    #[test]
    fn parse_shift_complete_valid() {
        let data: [u8; 11] = [
            0x03, 0x40,
            0xE5, 0xA0, 0x52, 0xAB, 0xBA, 0xD7,
            0x1F, 0x00, 0x01,
        ];
        let result = parse_shift_complete(&data).unwrap();
        assert_eq!(result.gear, 0x01);
    }

    #[test]
    fn parse_shift_complete_wrong_opcode() {
        let data: [u8; 11] = [
            0x01, 0x40,
            0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        assert!(parse_shift_complete(&data).is_none());
    }

    #[test]
    fn parse_shift_complete_too_short() {
        let data: [u8; 5] = [0x03, 0x40, 0, 0, 0];
        assert!(parse_shift_complete(&data).is_none());
    }
}
