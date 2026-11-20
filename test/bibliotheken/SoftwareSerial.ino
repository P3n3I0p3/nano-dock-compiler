#include <SoftwareSerial.h>
SoftwareSerial bt(10, 11);   // HC-05: RX, TX
void setup() { Serial.begin(9600); bt.begin(9600); }
void loop() { if (bt.available()) Serial.write(bt.read()); if (Serial.available()) bt.write(Serial.read()); }
