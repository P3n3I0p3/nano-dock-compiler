// =====================================================================
// Das Display zeigt die Ampel
// Jede Ampelfunktion schaltet die LEDs UND schreibt auf das Display.
// =====================================================================

#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 20, 4);

int A_rot = 14;  int A_gelb = 12;  int A_gruen = 11;

int DauerRot   = 3000;  int DauerRotGelb = 1000;
int DauerGruen = 3000;  int DauerGelb    = 1000;

void ampelA_rot() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, LOW);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Ampel A:");
  lcd.setCursor(0, 1);
  lcd.print("ROT - Stopp!");
}

void ampelA_rotGelb() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  HIGH);
  digitalWrite(A_gruen, LOW);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Ampel A:");
  lcd.setCursor(0, 1);
  lcd.print("Gleich geht es los");
}

void ampelA_gruen() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, HIGH);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Ampel A:");
  lcd.setCursor(0, 1);
  lcd.print("GRUEN - Fahr los!");
}

void ampelA_gelb() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  HIGH);
  digitalWrite(A_gruen, LOW);
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Ampel A:");
  lcd.setCursor(0, 1);
  lcd.print("Gleich ist Schluss");
}

void setup() {
  pinMode(A_rot,   OUTPUT);
  pinMode(A_gelb,  OUTPUT);
  pinMode(A_gruen, OUTPUT);

  lcd.init();
  lcd.backlight();
}

void loop() {
  ampelA_rot();
  delay(DauerRot);

  ampelA_rotGelb();
  delay(DauerRotGelb);

  ampelA_gruen();
  delay(DauerGruen);

  ampelA_gelb();
  delay(DauerGelb);
}
