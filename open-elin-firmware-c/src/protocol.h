/* open-elin-firmware-c/src/protocol.h */
#ifndef PROTOCOL_H
#define PROTOCOL_H

#include <stdint.h>
#include <stddef.h>

/*── Opcodes (little-endian on the wire) ──*/
#define OPCODE_BATTERY        0x4000
#define OPCODE_BUTTON         0x4001
#define OPCODE_SHIFT_COMPLETE 0x4003

/*── Button actions ──*/
#define ACTION_PRESS   0x00
#define ACTION_RELEASE 0x01

/*── Common frame layout: [opcode 2B LE][mac 6B LE][payload 2B] ──*/
#define FRAME_LEN       10
#define MAC_LEN          6

enum frame_offsets {
    OFF_OPCODE  = 0,   /* 2 bytes, little-endian */
    OFF_MAC     = 2,   /* 6 bytes, little-endian */
    OFF_PAYLOAD = 8,   /* 2 bytes — meaning depends on opcode */
};

/*── ShiftComplete is longer: 11 bytes, gear at byte 10 ──*/
#define SHIFT_COMPLETE_LEN  11
#define OFF_SC_GEAR         10

/*── LE16 wire helpers ──*/
static inline void put_le16(uint8_t *dst, uint16_t val)
{
    dst[0] = (uint8_t)(val & 0xFF);
    dst[1] = (uint8_t)(val >> 8);
}

static inline uint16_t get_le16(const uint8_t *src)
{
    return (uint16_t)src[0] | ((uint16_t)src[1] << 8);
}

/*── Parsed result types ──*/
struct shift_complete {
    uint8_t gear;
};

/*── Encoding ──*/
void protocol_encode_button(uint8_t out[FRAME_LEN],
                            const uint8_t mac_le[MAC_LEN],
                            uint8_t button_id, uint8_t action);

void protocol_encode_battery(uint8_t out[FRAME_LEN],
                             const uint8_t mac_le[MAC_LEN],
                             uint16_t mv);

/*── Parsing — returns 0 on success, -1 on invalid frame ──*/
int protocol_parse_shift_complete(const uint8_t *data, size_t len,
                                  struct shift_complete *out);

#endif /* PROTOCOL_H */
