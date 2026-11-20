#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <Wire.h>
Adafruit_MPU6050 mpu;
void setup() { Serial.begin(9600); if (!mpu.begin()) Serial.println("Kein MPU6050"); }
void loop() {
  sensors_event_t a, g, t;
  mpu.getEvent(&a, &g, &t);
  Serial.println(a.acceleration.x);
  delay(500);
}
