#include <Bounce2.h>
Bounce2::Button taster;
int zaehler = 0;
void setup() { Serial.begin(9600); taster.attach(2, INPUT_PULLUP); taster.interval(5); taster.setPressedState(LOW); }
void loop() { taster.update(); if (taster.pressed()) Serial.println(++zaehler); }
