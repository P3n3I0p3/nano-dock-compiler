// =====================================================================
// Das Lauflicht
// Die drei Lichter leuchten nacheinander - immer nur eins gleichzeitig.
// =====================================================================

int A_rot   = 14;
int A_gelb  = 12;
int A_gruen = 11;

void ampelA_rot() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, LOW);
}

void ampelA_gelb() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  HIGH);
  digitalWrite(A_gruen, LOW);
}

void ampelA_gruen() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, HIGH);
}

void setup() {
  pinMode(A_rot,   OUTPUT);
  pinMode(A_gelb,  OUTPUT);
  pinMode(A_gruen, OUTPUT);
}

void loop() {
  // Rot an, die anderen aus.
  ampelA_rot();
  delay(500);

  // Gelb an, die anderen aus.
  ampelA_gelb();
  delay(500);

  // Gruen an, die anderen aus.
  ampelA_gruen();
  delay(500);
}
