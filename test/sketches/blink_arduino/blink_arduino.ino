// Stufe 2: Blink mit dem Arduino-Core (pinMode, digitalWrite, delay).
// Absichtlich schnell (200 ms), damit man den Unterschied zu Stufe 1 sieht.
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(200);
  digitalWrite(LED_BUILTIN, LOW);
  delay(200);
}
