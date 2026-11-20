#include <Wire.h>
#include <Adafruit_BMP280.h>
Adafruit_BMP280 bmp;
void setup() { Serial.begin(9600); if (!bmp.begin(0x76)) Serial.println("Kein BMP280"); }
void loop() { Serial.println(bmp.readTemperature()); delay(2000); }
