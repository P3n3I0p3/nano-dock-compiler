// =====================================================================
// Ampel auf Knopfdruck
// Knopf gedrueckt -> rot. Knopf losgelassen -> gruen.
// =====================================================================

int A_rot   = 14;
int A_gelb  = 12;
int A_gruen = 11;

int knopf = 16;   // ein freier Pin: D16

void ampelA_rot() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  LOW);
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

  pinMode(knopf, INPUT);          // hier: der Knopf
}

void loop() {

  // ACHTUNG: gedrueckt = HIGH !
  if (digitalRead(knopf) == HIGH) {

    // Knopf ist gedrueckt -> Ampel rot
    ampelA_rot();

  } else {

    // Knopf ist losgelassen -> Ampel gruen
    ampelA_gruen();
  }
}
