# Slim Zephyr build image — ARM toolchain only (~2 GB vs ~29 GB).
# Build once:  docker build -t nxs-zephyr .
# Then build firmware:  docker run --rm -v ./:/app nxs-zephyr

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Minimal system deps for Zephyr build
RUN apt-get update && apt-get install -y --no-install-recommends \
    git cmake ninja-build gperf python3 python3-pip python3-venv \
    ccache dfu-util device-tree-compiler wget xz-utils file make gcc libc6-dev \
    python3-setuptools python3-wheel \
    && rm -rf /var/lib/apt/lists/*

# Install Zephyr SDK — ARM toolchain only (~300 MB vs ~4 GB full)
ARG ZSDK_VERSION=1.0.1
ENV ZEPHYR_SDK_INSTALL_DIR=/opt/zephyr-sdk
RUN wget -q https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v${ZSDK_VERSION}/zephyr-sdk-${ZSDK_VERSION}_linux-x86_64_minimal.tar.xz \
    && tar xf zephyr-sdk-${ZSDK_VERSION}_linux-x86_64_minimal.tar.xz -C /opt \
    && mv /opt/zephyr-sdk-${ZSDK_VERSION} ${ZEPHYR_SDK_INSTALL_DIR} \
    && cd ${ZEPHYR_SDK_INSTALL_DIR} \
    && ./setup.sh -t arm-zephyr-eabi \
    && rm /zephyr-sdk-${ZSDK_VERSION}_linux-x86_64_minimal.tar.xz

# Python venv + west
WORKDIR /workdir
RUN python3 -m venv .venv
ENV PATH="/workdir/.venv/bin:$PATH"
RUN pip install --no-cache-dir west

# Init Zephyr workspace, pull only modules needed for nRF52840 + BLE + USB
RUN west init -m https://github.com/zephyrproject-rtos/zephyr --mr main . \
    && west update --narrow -o=--depth=1 \
        hal_nordic cmsis cmsis_6 mbedtls tf-psa-crypto \
    && west zephyr-export \
    && pip install --no-cache-dir -r zephyr/scripts/requirements-base.txt

# Default: build the app mounted at /app, copy UF2 to /app/firmware.uf2
WORKDIR /workdir/zephyr
ENTRYPOINT ["bash", "-c", "\
    west build -p auto -b adafruit_feather_nrf52840 /app \
      -- -DOVERLAY_CONFIG=/app/prj.conf \
         -DDTC_OVERLAY_FILE=/app/boards/adafruit_feather_nrf52840.overlay \
    && cp build/zephyr/zephyr.uf2 /app/firmware.uf2 \
    && echo 'OK: firmware.uf2 written' \
"]
