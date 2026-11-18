// Stufe 1: Blink nur mit avr-libc, ohne Arduino-Core.
// Die LED des Nano hängt an D13 = PB5.
#include <avr/io.h>
#include <util/delay.h>

int main(void) {
    DDRB |= _BV(PB5);
    for (;;) {
        PORTB ^= _BV(PB5);
        _delay_ms(500);
    }
}
