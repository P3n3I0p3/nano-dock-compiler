// =====================================================================
// Zwei Ampeln an der Kreuzung
// A und B stehen sich gegenueber. Nie sind beide gleichzeitig gruen!
// =====================================================================

int A_rot = 14;  int A_gelb = 12;  int A_gruen = 11;
int B_rot = 10;  int B_gelb =  9;  int B_gruen =  8;

int DauerGruen    = 4000;
int DauerGelb     = 1000;
int DauerRotGelb  = 1000;
int DauerBeideRot = 1000;   // Sicherheitspause

// ---- Ampel A ----
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

// ---- Ampel B: genauso, nur mit B_ ----
void ampelB_rot() {
  digitalWrite(B_rot,   HIGH);
  digitalWrite(B_gelb,  LOW);
  digitalWrite(B_gruen, LOW);
}
void ampelB_rotGelb() {
  digitalWrite(B_rot,   HIGH);
  digitalWrite(B_gelb,  HIGH);
  digitalWrite(B_gruen, LOW);
}
void ampelB_gruen() {
  digitalWrite(B_rot,   LOW);
  digitalWrite(B_gelb,  LOW);
  digitalWrite(B_gruen, HIGH);
}
void ampelB_gelb() {
  digitalWrite(B_rot,   LOW);
  digitalWrite(B_gelb,  HIGH);
  digitalWrite(B_gruen, LOW);
}

void setup() {
  pinMode(A_rot,   OUTPUT);
  pinMode(A_gelb,  OUTPUT);
  pinMode(A_gruen, OUTPUT);
  pinMode(B_rot,   OUTPUT);
  pinMode(B_gelb,  OUTPUT);
  pinMode(B_gruen, OUTPUT);

  ampelA_rot();
  ampelB_rot();   // Start: beide rot
  delay(2000);
}

void loop() {
  // ---- Richtung A darf fahren, B bleibt rot ----
  ampelB_rot();
  ampelA_rotGelb();
  delay(DauerRotGelb);
  ampelA_gruen();
  delay(DauerGruen);
  ampelA_gelb();
  delay(DauerGelb);
  ampelA_rot();
  delay(DauerBeideRot);        // beide rot

  // ---- Richtung B darf fahren ----
  ampelB_rotGelb();
  delay(DauerRotGelb);
  ampelB_gruen();
  delay(DauerGruen);
  ampelB_gelb();
  delay(DauerGelb);
  ampelB_rot();
  delay(DauerBeideRot);
}

// Warum sind kurz BEIDE rot? Damit die Kreuzung
// wirklich leer ist, bevor die naechste losfaehrt.
