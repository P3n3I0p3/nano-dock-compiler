#include <OneWire.h>
#include <DallasTemperature.h>
OneWire bus(2);
DallasTemperature sensoren(&bus);
void setup() { Serial.begin(9600); sensoren.begin(); }
void loop() { sensoren.requestTemperatures(); Serial.println(sensoren.getTempCByIndex(0)); delay(1000); }
