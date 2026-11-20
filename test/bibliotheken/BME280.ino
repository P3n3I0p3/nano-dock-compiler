#include <Wire.h>
#include <Adafruit_BME280.h>
Adafruit_BME280 bme;
void setup() { Serial.begin(9600); if (!bme.begin(0x76)) Serial.println("Kein BME280"); }
void loop() { Serial.println(bme.readTemperature()); Serial.println(bme.readPressure() / 100.0); delay(2000); }
