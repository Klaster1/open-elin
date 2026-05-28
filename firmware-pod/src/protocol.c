/* firmware-c/src/protocol.c */
#include "protocol.h"
#include <string.h>

void protocol_encode_button(uint8_t out[FRAME_LEN],
                            const uint8_t mac_le[MAC_LEN],
                            uint8_t button_id, uint8_t action)
{
    put_le16(&out[OFF_OPCODE], OPCODE_BUTTON);
    memcpy(&out[OFF_MAC], mac_le, MAC_LEN);
    out[OFF_PAYLOAD]     = button_id;
    out[OFF_PAYLOAD + 1] = action;
}

void protocol_encode_battery(uint8_t out[FRAME_LEN],
                             const uint8_t mac_le[MAC_LEN],
                             uint16_t mv)
{
    put_le16(&out[OFF_OPCODE], OPCODE_BATTERY);
    memcpy(&out[OFF_MAC], mac_le, MAC_LEN);
    put_le16(&out[OFF_PAYLOAD], mv);
}
