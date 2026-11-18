// Stufe 3: Serial, millis() und Gleitkomma – prüft Interrupts, C++-Klassen
// und die Rechenhilfen (Division, float), die der Compiler mitbringen muss.
unsigned long last = 0;
int counter = 0;

void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println(F("clang-Test gestartet"));
}

void loop() {
  if (millis() - last >= 1000) {
    last = millis();
    counter++;
    float volt = analogRead(A0) * 5.0 / 1023.0;
    Serial.print(F("Sekunde "));
    Serial.print(counter);
    Serial.print(F("  A0 = "));
    Serial.print(volt, 2);
    Serial.println(F(" V"));
    digitalWrite(LED_BUILTIN, counter % 2);
  }
}
