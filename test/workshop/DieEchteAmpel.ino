// =====================================================================
// Die echte Ampel
// Rot (3s) -> Rot+Gelb (1s) -> Gruen (3s) -> Gelb (1s) -> von vorn.
// =====================================================================

int A_rot   = 14;
int A_gelb  = 12;
int A_gruen = 11;

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
  // ---- ROT: alle stehen ----
  ampelA_rot();
  delay(3000);

  // ---- ROT + GELB: gleich geht es los ----
  ampelA_rotGelb();
  delay(1000);

  // ---- GRUEN: fahren ----
  ampelA_gruen();
  delay(3000);

  // ---- GELB: gleich ist Schluss ----
  ampelA_gelb();
  delay(1000);
}
