# firmware-pod/CMakeLists.txt
cmake_minimum_required(VERSION 3.20.0)
find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(nxs-pod-firmware)

target_sources(app PRIVATE
  src/main.c
  src/protocol.c
  src/gatt.c
)
