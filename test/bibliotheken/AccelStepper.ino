#include <AccelStepper.h>
AccelStepper motor(AccelStepper::HALF4WIRE, 8, 10, 9, 11);
void setup() { motor.setMaxSpeed(800); motor.setAcceleration(200); motor.moveTo(4096); }
void loop() { if (motor.distanceToGo() == 0) motor.moveTo(-motor.currentPosition()); motor.run(); }
