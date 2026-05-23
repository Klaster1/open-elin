/* UF2 bootloader layout (Adafruit nRF52 bootloader on SuperMini):       */
/*   0x00000000..0x00001000  MBR (Master Boot Record, 4 KB)               */
/*   0x00001000..0x000F4000  Application (972 KB)                          */
/*   0x000F4000..0x00100000  Bootloader + settings (48 KB)                 */
/*                                                                         */
/* No SoftDevice installed (INFO_UF2.TXT says "SoftDevice: not found").    */
/* CURRENT.UF2 confirms app starts at 0x1000, not 0x26000.                 */
/* Bootloader family ID: 0x239A00B3 (Adafruit nRF52840).                   */
/*                                                                         */
/* RAM: full 256 KB available.                                              */

MEMORY
{
    FLASH : ORIGIN = 0x00001000, LENGTH = 972K
    RAM   : ORIGIN = 0x20000000, LENGTH = 256K
}
