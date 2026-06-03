# firmware-pod/CMakeLists.txt
cmake_minimum_required(VERSION 3.20.0)
find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(open-elin-pod-firmware)

target_sources(app PRIVATE
  src/main.c
  src/led.c
  src/battery.c
  src/radio.c
  src/buttons.c
  src/commands.c
  src/protocol.c
  src/gatt.c
)
