# Zephyr build environment with SDK + source tree baked in.
# Build once:  docker build -t nxs-zephyr .
# Then build firmware:  docker run --rm -v ./:/app nxs-zephyr

FROM ghcr.io/zephyrproject-rtos/ci:latest

ENV ZEPHYR_SDK_INSTALL_DIR=/opt/toolchains/zephyr-sdk-1.0.1

# Initialize Zephyr workspace (shallow clone — ~2 GB instead of ~8 GB)
WORKDIR /workdir
RUN west init -m https://github.com/zephyrproject-rtos/zephyr --mr main . \
    && west update --narrow -o=--depth=1 \
    && west zephyr-export

# Verify toolchain works
RUN cd zephyr && west build -p always -b adafruit_feather_nrf52840 samples/basic/blinky \
    && rm -rf build

# Default: build the app mounted at /app, copy UF2 to /app/firmware.uf2
WORKDIR /workdir/zephyr
ENTRYPOINT ["bash", "-c", "\
    west build -p auto -b adafruit_feather_nrf52840 /app \
      -- -DOVERLAY_CONFIG=/app/prj.conf \
         -DDTC_OVERLAY_FILE=/app/boards/adafruit_feather_nrf52840.overlay \
    && cp build/zephyr/zephyr.uf2 /app/firmware.uf2 \
    && echo 'OK: firmware.uf2 written' \
"]
