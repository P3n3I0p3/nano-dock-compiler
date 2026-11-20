#include <DHT.h>
DHT dht(2, DHT11);
void setup() { Serial.begin(9600); dht.begin(); }
void loop() {
  float t = dht.readTemperature(), h = dht.readHumidity();
  Serial.print(t); Serial.print(" C, "); Serial.print(h); Serial.println(" %");
  delay(2000);
}
