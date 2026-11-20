// =====================================================================
// Erstes Blinken
// Suche dir ein Ampellicht aus und lasse es blinken.
// =====================================================================

int A_rot = 14;              // steckt bei uns an D14

void setup() {
  pinMode(A_rot, OUTPUT);     // hier haengt eine LED
}

void loop() {
  digitalWrite(A_rot, HIGH);  // Licht an
  delay(1000);                // 1 Sekunde warten
  digitalWrite(A_rot, LOW);   // Licht aus
  delay(1000);                // 1 Sekunde warten
}
