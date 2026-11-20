// =====================================================================
// Ordnung mit Funktionen
// Jede Ampelphase steckt in einer eigenen Funktion - wie ein eigenes Rezept.
// =====================================================================

int A_rot   = 14;
int A_gelb  = 12;
int A_gruen = 11;

// Auch die Zeiten bekommen Namen:
int DauerRot     = 3000;
int DauerRotGelb = 1000;
int DauerGruen   = 3000;
int DauerGelb    = 1000;

// ---- unsere eigenen "Rezepte" ----
void ampelA_rot() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, LOW);
}

void ampelA_rotGelb() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  HIGH);
  digitalWrite(A_gruen, LOW);
}

void ampelA_gruen() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, HIGH);
}

void ampelA_gelb() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  HIGH);
  digitalWrite(A_gruen, LOW);
}

void setup() {
  pinMode(A_rot,   OUTPUT);
  pinMode(A_gelb,  OUTPUT);
  pinMode(A_gruen, OUTPUT);
}

void loop() {
  ampelA_rot();       delay(DauerRot);
  ampelA_rotGelb();   delay(DauerRotGelb);
  ampelA_gruen();     delay(DauerGruen);
  ampelA_gelb();      delay(DauerGelb);
}
