#![no_std]
#![no_main]

mod protocol;

use embassy_executor::Spawner;
use embassy_time::Timer;

// P0 GPIO registers for LED on P0.15 (active HIGH)
const P0: u32 = 0x5000_0000;
const PIN_CNF_15: *mut u32 = (P0 + 0x700 + 15 * 4) as *mut u32;
const OUTSET: *mut u32 = (P0 + 0x508) as *mut u32;
const OUTCLR: *mut u32 = (P0 + 0x50C) as *mut u32;

unsafe fn led_init() {
    core::ptr::write_volatile(PIN_CNF_15, 1); // output
}
unsafe fn led_on() {
    core::ptr::write_volatile(OUTSET, 1 << 15);
}
unsafe fn led_off() {
    core::ptr::write_volatile(OUTCLR, 1 << 15);
}

/// Custom panic handler — solid LED ON
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    unsafe {
        led_init();
        led_on();
    }
    loop { cortex_m::asm::nop(); }
}

/// HardFault handler — rapid blink (distinguishable from panic = solid)
#[cortex_m_rt::exception]
unsafe fn HardFault(_frame: &cortex_m_rt::ExceptionFrame) -> ! {
    led_init();
    loop {
        led_on();
        for _ in 0..100_000 { cortex_m::asm::nop(); }
        led_off();
        for _ in 0..100_000 { cortex_m::asm::nop(); }
    }
}

/// Stop peripherals the bootloader may have left running.
#[cortex_m_rt::pre_init]
unsafe fn pre_init() {
    // Stop RTC1
    core::ptr::write_volatile(0x40011004u32 as *mut u32, 1);
    core::ptr::write_volatile(0x40011008u32 as *mut u32, 1);
    core::ptr::write_volatile(0x40011308u32 as *mut u32, 0xFFFF_FFFF);
    core::ptr::write_volatile(0x40011100u32 as *mut u32, 0);
    core::ptr::write_volatile(0x40011104u32 as *mut u32, 0);
    core::ptr::write_volatile(0x40011140u32 as *mut u32, 0);
    core::ptr::write_volatile(0x40011144u32 as *mut u32, 0);
    core::ptr::write_volatile(0x40011148u32 as *mut u32, 0);
    core::ptr::write_volatile(0x4001114Cu32 as *mut u32, 0);
    core::ptr::write_volatile(0x40011508u32 as *mut u32, 0);
    // Stop RTC0
    core::ptr::write_volatile(0x4000B004u32 as *mut u32, 1);
    core::ptr::write_volatile(0x4000B308u32 as *mut u32, 0xFFFF_FFFF);
    // Stop LFCLK
    core::ptr::write_volatile(0x40000014u32 as *mut u32, 1);
    // Clear all NVIC pending interrupts
    core::ptr::write_volatile(0xE000E180u32 as *mut u32, 0xFFFF_FFFF);
    core::ptr::write_volatile(0xE000E184u32 as *mut u32, 0xFFFF_FFFF);
    core::ptr::write_volatile(0xE000E280u32 as *mut u32, 0xFFFF_FFFF);
    core::ptr::write_volatile(0xE000E284u32 as *mut u32, 0xFFFF_FFFF);
}

#[embassy_executor::main]
async fn main(_spawner: Spawner) {
    let mut config = embassy_nrf::config::Config::default();
    config.lfclk_source = embassy_nrf::config::LfclkSource::InternalRC;
    let _p = embassy_nrf::init(config);

    unsafe { led_init(); }

    // THE KEY TEST: Does Timer::after_millis work on crates.io Embassy?
    // On git main, the second .await panics. Let's see if stable is different.
    // Stage 1: one blink with Timer (if you see this, first Timer works)
    unsafe { led_on(); }
    Timer::after_millis(500).await;
    unsafe { led_off(); }
    Timer::after_millis(500).await;

    // Stage 2: second blink (if you see this, Timer works repeatedly!)
    unsafe { led_on(); }
    Timer::after_millis(500).await;
    unsafe { led_off(); }
    Timer::after_millis(500).await;

    // Stage 3: third blink — Timer definitely works
    unsafe { led_on(); }
    Timer::after_millis(500).await;
    unsafe { led_off(); }
    Timer::after_millis(500).await;

    // Stage 4: victory — continuous fast blink means Timer is fully working
    loop {
        unsafe { led_on(); }
        Timer::after_millis(100).await;
        unsafe { led_off(); }
        Timer::after_millis(100).await;
    }
}
