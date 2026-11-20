#include <Servo.h>
Servo s;
void setup() { s.attach(9); }
void loop() { for (int w = 0; w <= 180; w += 10) { s.write(w); delay(50); } }
