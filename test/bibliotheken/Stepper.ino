#include <Stepper.h>
Stepper motor(2048, 8, 10, 9, 11);   // 28BYJ-48 mit ULN2003
void setup() { motor.setSpeed(10); }
void loop() { motor.step(2048); delay(500); motor.step(-2048); delay(500); }
