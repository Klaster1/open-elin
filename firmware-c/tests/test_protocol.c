/* firmware-c/tests/test_protocol.c */
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

int main(void)
{
    printf("Running protocol tests...\n");
    test_button_press_encoding();
    test_button_release_encoding();
    test_battery_encoding();
    printf("All 3 tests passed.\n");
    return 0;
}
