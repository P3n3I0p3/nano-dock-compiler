#include <ArduinoJson.h>
void setup() {
  Serial.begin(9600);
  JsonDocument doc;
  doc["sensor"] = "dht11";
  doc["wert"] = 21.5;
  serializeJson(doc, Serial);
}
void loop() {}
