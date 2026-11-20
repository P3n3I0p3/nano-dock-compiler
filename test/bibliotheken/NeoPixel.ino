#include <Adafruit_NeoPixel.h>
Adafruit_NeoPixel ring(12, 6, NEO_GRB + NEO_KHZ800);
void setup() { ring.begin(); ring.setBrightness(40); }
void loop() {
  for (int i = 0; i < 12; i++) { ring.clear(); ring.setPixelColor(i, ring.Color(249, 115, 22)); ring.show(); delay(80); }
}
