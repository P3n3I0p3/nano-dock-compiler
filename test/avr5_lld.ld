/* Linkerskript für ATmega328P (avr5) mit ld.lld.
 *
 * Das Skript von GNU ld (avr5.xn) nutzt Schreibweisen, die lld nicht versteht.
 * Dieses hier ist auf das Nötige gekürzt:
 *   Flash  0x000000  32 KB   Vektoren, Code, PROGMEM-Daten, Startwerte von .data
 *   RAM    0x800100   2 KB   .data, .bss, .noinit, danach Heap
 *   EEPROM 0x810000   1 KB
 * Die Adressen 0x800000/0x810000 sind die übliche ELF-Konvention für AVR.
 */
OUTPUT_FORMAT("elf32-avr")
OUTPUT_ARCH(avr:5)

MEMORY
{
  text   (rx)   : ORIGIN = 0x000000, LENGTH = 32K
  data   (rw!x) : ORIGIN = 0x800100, LENGTH = 2K
  eeprom (rw!x) : ORIGIN = 0x810000, LENGTH = 1K
}

SECTIONS
{
  .text :
  {
    KEEP(*(.vectors))
    *(.progmem.gcc*)
    . = ALIGN(2);
    __trampolines_start = .;
    *(.trampolines*)
    __trampolines_end = .;
    *(.progmem*)                     /* PROGMEM: siehe -D__ATTR_PROGMEM__ in build.sh */
    . = ALIGN(2);
    *(.jumptables*)
    *(.lowtext*)
    /* Konstruktoren globaler C++-Objekte (z. B. Serial). clang legt sie in .init_array,
       avr-gcc in .ctors; libgcc ruft alles zwischen __ctors_start und __ctors_end auf. */
    __ctors_start = .;
    KEEP(*(.ctors))
    KEEP(*(SORT(.init_array.*)))
    KEEP(*(.init_array))
    __ctors_end = .;
    __dtors_start = .;
    KEEP(*(.dtors))
    KEEP(*(.fini_array))
    __dtors_end = .;
    /* Startcode von avr-libc und libgcc, in dieser Reihenfolge */
    KEEP(*(.init0)) KEEP(*(.init1)) KEEP(*(.init2)) KEEP(*(.init3)) KEEP(*(.init4))
    KEEP(*(.init5)) KEEP(*(.init6)) KEEP(*(.init7)) KEEP(*(.init8)) KEEP(*(.init9))
    *(.text)
    . = ALIGN(2);
    *(.text.*)
    . = ALIGN(2);
    KEEP(*(.fini9)) KEEP(*(.fini8)) KEEP(*(.fini7)) KEEP(*(.fini6)) KEEP(*(.fini5))
    KEEP(*(.fini4)) KEEP(*(.fini3)) KEEP(*(.fini2)) KEEP(*(.fini1)) KEEP(*(.fini0))
    _etext = .;
  } > text

  .data :
  {
    PROVIDE(__data_start = .);
    *(.data) *(.data.*)
    *(.rodata) *(.rodata.*)          /* const ohne PROGMEM liegt beim AVR im RAM */
    . = ALIGN(2);
    _edata = .;
    PROVIDE(__data_end = .);
  } > data AT> text

  __data_load_start = LOADADDR(.data);
  __data_load_end = __data_load_start + SIZEOF(.data);

  .bss (NOLOAD) :
  {
    PROVIDE(__bss_start = .);
    *(.bss) *(.bss.*) *(COMMON)
    PROVIDE(__bss_end = .);
  } > data

  .noinit (NOLOAD) :
  {
    PROVIDE(__noinit_start = .);
    *(.noinit*)
    PROVIDE(__noinit_end = .);
    _end = .;
    PROVIDE(__heap_start = .);
  } > data

  .eeprom :
  {
    KEEP(*(.eeprom*))
    __eeprom_end = .;
  } > eeprom
}
