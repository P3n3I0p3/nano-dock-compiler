// =====================================================================
// Die ganze Kreuzung mit Display
// Das Display zeigt, welche Fahrtrichtung fahren darf.
// =====================================================================

#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 20, 4);

int A_rot = 14;  int A_gelb = 12;  int A_gruen = 11;
int B_rot = 10;  int B_gelb =  9;  int B_gruen =  8;
int C_rot =  7;  int C_gelb =  6;  int C_gruen =  5;
int D_rot =  4;  int D_gelb =  3;  int D_gruen =  2;

int DauerGruen    = 5000;  int DauerGelb     = 2000;
int DauerRotGelb  = 1000;  int DauerBeideRot = 1000;

void ampelnAC_rot() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, LOW);
  digitalWrite(C_rot,   HIGH);
  digitalWrite(C_gelb,  LOW);
  digitalWrite(C_gruen, LOW);
}

void ampelnAC_rotGelb() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  HIGH);
  digitalWrite(A_gruen, LOW);
  digitalWrite(C_rot,   HIGH);
  digitalWrite(C_gelb,  HIGH);
  digitalWrite(C_gruen, LOW);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("A + C: gleich los");
  lcd.setCursor(0, 1);
  lcd.print("B + D: warten");
}

void ampelnAC_gruen() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, HIGH);
  digitalWrite(C_rot,   LOW);
  digitalWrite(C_gelb,  LOW);
  digitalWrite(C_gruen, HIGH);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("A + C fahren jetzt");
  lcd.setCursor(0, 1);
  lcd.print("B + D: warten");
}

void ampelnAC_gelb() {
  digitalWrite(A_rot,   LOW);
  digitalWrite(A_gelb,  HIGH);
  digitalWrite(A_gruen, LOW);
  digitalWrite(C_rot,   LOW);
  digitalWrite(C_gelb,  HIGH);
  digitalWrite(C_gruen, LOW);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("A + C: bald Stopp");
  lcd.setCursor(0, 1);
  lcd.print("B + D: warten");
}

void ampelnBD_rot() {
  digitalWrite(B_rot,   HIGH);
  digitalWrite(B_gelb,  LOW);
  digitalWrite(B_gruen, LOW);
  digitalWrite(D_rot,   HIGH);
  digitalWrite(D_gelb,  LOW);
  digitalWrite(D_gruen, LOW);
}

void ampelnBD_rotGelb() {
  digitalWrite(B_rot,   HIGH);
  digitalWrite(B_gelb,  HIGH);
  digitalWrite(B_gruen, LOW);
  digitalWrite(D_rot,   HIGH);
  digitalWrite(D_gelb,  HIGH);
  digitalWrite(D_gruen, LOW);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("A + C: warten");
  lcd.setCursor(0, 1);
  lcd.print("B + D: gleich los");
}

void ampelnBD_gruen() {
  digitalWrite(B_rot,   LOW);
  digitalWrite(B_gelb,  LOW);
  digitalWrite(B_gruen, HIGH);
  digitalWrite(D_rot,   LOW);
  digitalWrite(D_gelb,  LOW);
  digitalWrite(D_gruen, HIGH);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("A + C: warten");
  lcd.setCursor(0, 1);
  lcd.print("B + D fahren jetzt");
}

void ampelnBD_gelb() {
  digitalWrite(B_rot,   LOW);
  digitalWrite(B_gelb,  HIGH);
  digitalWrite(B_gruen, LOW);
  digitalWrite(D_rot,   LOW);
  digitalWrite(D_gelb,  HIGH);
  digitalWrite(D_gruen, LOW);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("A + C: warten");
  lcd.setCursor(0, 1);
  lcd.print("B + D: bald Stopp");
}

void alleAmpelnRot() {
  digitalWrite(A_rot,   HIGH);
  digitalWrite(A_gelb,  LOW);
  digitalWrite(A_gruen, LOW);
  digitalWrite(B_rot,   HIGH);
  digitalWrite(B_gelb,  LOW);
  digitalWrite(B_gruen, LOW);
  digitalWrite(C_rot,   HIGH);
  digitalWrite(C_gelb,  LOW);
  digitalWrite(C_gruen, LOW);
  digitalWrite(D_rot,   HIGH);
  digitalWrite(D_gelb,  LOW);
  digitalWrite(D_gruen, LOW);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Sicherheitspause");
  lcd.setCursor(0, 1);
  lcd.print("Alle warten");
}

void setup() {
  pinMode(A_rot, OUTPUT);    pinMode(A_gelb, OUTPUT);
  pinMode(A_gruen, OUTPUT);
  pinMode(B_rot, OUTPUT);    pinMode(B_gelb, OUTPUT);
  pinMode(B_gruen, OUTPUT);
  pinMode(C_rot, OUTPUT);    pinMode(C_gelb, OUTPUT);
  pinMode(C_gruen, OUTPUT);
  pinMode(D_rot, OUTPUT);    pinMode(D_gelb, OUTPUT);
  pinMode(D_gruen, OUTPUT);

  lcd.init();
  lcd.backlight();

  // Sicherer Start: Alle Ampeln stehen auf Rot.
  alleAmpelnRot();
  delay(2000);
}

void loop() {
  // A und C dürfen fahren, während B und D auf Rot bleiben.
  ampelnAC_rotGelb();
  delay(DauerRotGelb);

  ampelnAC_gruen();
  delay(DauerGruen);

  ampelnAC_gelb();
  delay(DauerGelb);

  alleAmpelnRot();
  delay(DauerBeideRot);

  // B und D dürfen fahren, während A und C auf Rot bleiben.
  ampelnBD_rotGelb();
  delay(DauerRotGelb);

  ampelnBD_gruen();
  delay(DauerGruen);

  ampelnBD_gelb();
  delay(DauerGelb);

  alleAmpelnRot();
  delay(DauerBeideRot);
}
