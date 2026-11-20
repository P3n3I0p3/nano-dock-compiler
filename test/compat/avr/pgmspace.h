/* avr/pgmspace.h für clang (nano-dock-compiler, Apache 2.0)
 *
 * Bindet das Original von avr-libc ein und ersetzt danach nur die Lesebefehle für 32 Bit
 * (pgm_read_dword, pgm_read_float). avr-libc liest dort vier Bytes mit Inline-Assembler und
 * einem 32-Bit-Register-Operanden "=r"; clang kann dafür auf AVR kein Register finden
 * ("could not allocate output register for constraint 'r'"). Betrifft z. B. ArduinoJson und
 * IRremote. Ersatz: zweimal 16 Bit lesen, das ergibt dieselben vier Bytes.
 */
#ifndef NANODOCK_PGMSPACE_H
#define NANODOCK_PGMSPACE_H
#include_next <avr/pgmspace.h>

#if defined(__clang__)
#undef __LPM_dword
#define __LPM_dword(addr)                                                    \
  ((uint32_t)__LPM_word((uint16_t)(addr)) |                                  \
   ((uint32_t)__LPM_word((uint16_t)(addr) + 2) << 16))
#undef __LPM_float
#define __LPM_float(addr)                                                    \
  (__extension__({                                                           \
    union { uint32_t __i; float __f; } __u;                                  \
    __u.__i = __LPM_dword(addr);                                             \
    __u.__f;                                                                 \
  }))
#endif

#endif
