// =====================================================================
// Gelb blinkt 5-mal
// Mit einer for-Schleife - ohne die Zeilen fuenfmal zu kopieren.
// =====================================================================

int A_rot = 14;  int A_gelb = 12;  int A_gruen = 11;

void gelbBlinkt() {
  // 5 Durchgaenge: i = 0, 1, 2, 3, 4
  for (int i = 0; i < 5; i++) {
    digitalWrite(A_gelb, HIGH);
    delay(500);
    digitalWrite(A_gelb, LOW);
    delay(500);
  }
}

// Extra: das Blinken wird von Mal zu Mal schneller.
void gelbBlinktSchneller() {
  // rueckwaerts zaehlen: 5, 4, 3, 2, 1
  for (int i = 5; i > 0; i--) {
    digitalWrite(A_gelb, HIGH);
    delay(i * 100);    // erst 500 ms, dann 400, 300
    digitalWrite(A_gelb, LOW);
    delay(i * 100);
  }
}

void setup() {
  pinMode(A_rot,   OUTPUT);
  pinMode(A_gelb,  OUTPUT);
  pinMode(A_gruen, OUTPUT);
}

void loop() {
  gelbBlinkt();
  delay(1000);

  gelbBlinktSchneller();
  delay(1000);
}
