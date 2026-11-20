#include <EEPROM.h>
void setup() { Serial.begin(9600); byte starts = EEPROM.read(0); EEPROM.update(0, starts + 1); Serial.println(starts); }
void loop() {}
