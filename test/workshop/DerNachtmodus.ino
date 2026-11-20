// =====================================================================
// Der Nachtmodus
// Ein Druck schaltet in den Nachtmodus (nur Gelb blinkt), der naechste zurueck.
// =====================================================================

int A_rot = 14;  int A_gelb = 12;  int A_gruen = 11;
int knopf = 16;   // ein freier Pin: D16

bool nacht = false;   // false = normal, true = Nacht

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
void ampelA_aus() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, LOW);
}

void setup() {
  pinMode(A_rot,   OUTPUT);
  pinMode(A_gelb,  OUTPUT);
  pinMode(A_gruen, OUTPUT);

  pinMode(knopf, INPUT);
}

void loop() {
  if (digitalRead(knopf) == HIGH) {
    nacht = !nacht;
    delay(300);  // Ein Druck soll nur einmal umschalten.
  }

  if (nacht == true) {
    // ---- Nachtmodus: nur Gelb blinkt ----
    ampelA_gelb();
    delay(600);
    ampelA_aus();
    delay(600);

  } else {
    // ---- normaler Betrieb ----
    ampelA_rot();
    delay(3000);
    ampelA_rotGelb();
    delay(1000);
    ampelA_gruen();
    delay(3000);
    ampelA_gelb();
    delay(1000);
  }
}
