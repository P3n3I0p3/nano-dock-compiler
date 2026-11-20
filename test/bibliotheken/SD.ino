#include <SPI.h>
#include <SD.h>
void setup() {
  Serial.begin(9600);
  if (!SD.begin(10)) { Serial.println("Keine SD-Karte"); return; }
  File f = SD.open("log.txt", FILE_WRITE);
  if (f) { f.println("Hallo"); f.close(); }
}
void loop() {}
