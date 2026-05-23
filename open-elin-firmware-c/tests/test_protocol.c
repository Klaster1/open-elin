/* open-elin-firmware-c/tests/test_protocol.c */
#include <stdio.h>
#include <string.h>
#include <assert.h>
#include "../src/protocol.h"

static const uint8_t FAKE_MAC[MAC_LEN] = {0x43, 0xB5, 0x0B, 0x23, 0x4F, 0xC2};

static void test_button_press_encoding(void)
{
    uint8_t frame[FRAME_LEN];
    protocol_encode_button(frame, FAKE_MAC, 0x01, ACTION_PRESS);
    assert(get_le16(&frame[OFF_OPCODE]) == OPCODE_BUTTON);
    assert(memcmp(&frame[OFF_MAC], FAKE_MAC, MAC_LEN) == 0);
    assert(frame[OFF_PAYLOAD] == 0x01);       /* button id */
    assert(frame[OFF_PAYLOAD + 1] == ACTION_PRESS);
    printf("  PASS: test_button_press_encoding\n");
}

static void test_button_release_encoding(void)
{
    uint8_t frame[FRAME_LEN];
    protocol_encode_button(frame, FAKE_MAC, 0x00, ACTION_RELEASE);
    assert(get_le16(&frame[OFF_OPCODE]) == OPCODE_BUTTON);
    assert(frame[OFF_PAYLOAD + 1] == ACTION_RELEASE);
    printf("  PASS: test_button_release_encoding\n");
}

static void test_battery_encoding(void)
{
    uint8_t frame[FRAME_LEN];
    protocol_encode_battery(frame, FAKE_MAC, 3000);
    assert(get_le16(&frame[OFF_OPCODE]) == OPCODE_BATTERY);
    assert(memcmp(&frame[OFF_MAC], FAKE_MAC, MAC_LEN) == 0);
    assert(get_le16(&frame[OFF_PAYLOAD]) == 3000);
    printf("  PASS: test_battery_encoding\n");
}

static void test_shift_complete_parse(void)
{
    uint8_t data[SHIFT_COMPLETE_LEN] = {0};
    put_le16(&data[OFF_OPCODE], OPCODE_SHIFT_COMPLETE);
    data[OFF_SC_GEAR] = 7;

    struct shift_complete result;
    assert(protocol_parse_shift_complete(data, sizeof(data), &result) == 0);
    assert(result.gear == 7);
    printf("  PASS: test_shift_complete_parse\n");
}

static void test_shift_complete_wrong_opcode(void)
{
    uint8_t data[SHIFT_COMPLETE_LEN] = {0};
    put_le16(&data[OFF_OPCODE], OPCODE_BUTTON);  /* wrong opcode */
    data[OFF_SC_GEAR] = 5;

    struct shift_complete result;
    assert(protocol_parse_shift_complete(data, sizeof(data), &result) != 0);
    printf("  PASS: test_shift_complete_wrong_opcode\n");
}

static void test_shift_complete_too_short(void)
{
    uint8_t data[FRAME_LEN] = {0};  /* 10 bytes, need 11 */
    put_le16(&data[OFF_OPCODE], OPCODE_SHIFT_COMPLETE);

    struct shift_complete result;
    assert(protocol_parse_shift_complete(data, sizeof(data), &result) != 0);
    printf("  PASS: test_shift_complete_too_short\n");
}

int main(void)
{
    printf("Running protocol tests...\n");
    test_button_press_encoding();
    test_button_release_encoding();
    test_battery_encoding();
    test_shift_complete_parse();
    test_shift_complete_wrong_opcode();
    test_shift_complete_too_short();
    printf("All 6 tests passed.\n");
    return 0;
}
