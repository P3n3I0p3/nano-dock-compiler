// =====================================================================
// Die Fußgängerampel
// Autos fahren. Wer drueckt, bekommt Gruen - danach geht alles zurueck.
// =====================================================================

int A_rot = 14;  int A_gelb = 12;  int A_gruen = 11;

int F_rot   = 10;   // Fussgaengerampel: zwei Lichter
int F_gruen =  8;

int knopf = 16;   // ein freier Pin: D16

void autoGruen() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, HIGH);
}
void autoGelb() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  HIGH);
  digitalWrite(A_gruen, LOW);
}
void autoRot() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, LOW);
}
void autoRotGelb() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  HIGH);
  digitalWrite(A_gruen, LOW);
}

void fussRot() {
  digitalWrite(F_rot,   HIGH);
  digitalWrite(F_gruen, LOW);
}
void fussGruen() {
  digitalWrite(F_rot,   LOW);
  digitalWrite(F_gruen, HIGH);
}

void setup() {
  pinMode(A_rot,   OUTPUT);
  pinMode(A_gelb,  OUTPUT);
  pinMode(A_gruen, OUTPUT);
  pinMode(F_rot,   OUTPUT);
  pinMode(F_gruen, OUTPUT);

  pinMode(knopf, INPUT);
}

void loop() {

  // Normal: Autos fahren, Fussgaenger warten.
  autoGruen();
  fussRot();

  // Moechte jemand ueber die Strasse?
  if (digitalRead(knopf) == HIGH) {

    delay(2000);      // echte Ampeln warten kurz
    autoGelb();
    delay(1000);
    autoRot();
    delay(1000);      // Strasse wird leer

    fussGruen();      // jetzt darf man laufen
    delay(6000);

    fussRot();
    delay(1000);      // Sicherheitspause

    autoRotGelb();
    delay(1000);
    // danach faengt loop() von vorn an
  }
}
