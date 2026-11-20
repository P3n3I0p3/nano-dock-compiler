// =====================================================================
// Dein Text auf dem Display
// Text anzeigen, in alle vier Zeilen schreiben, zwei Texte abwechseln.
// =====================================================================

#include <LiquidCrystal_I2C.h>

// Adresse 0x27, 20 Spalten, 4 Zeilen.
LiquidCrystal_I2C lcd(0x27, 20, 4);

void setup() {
  lcd.init();        // Display starten
  lcd.backlight();   // Hintergrundlicht an

  // Alle vier Zeilen fuellen. Gezaehlt wird ab 0!
  // Nachricht wird einmal am Anfang angezeigt
  lcd.setCursor(0, 0);
  lcd.print("Hallo!");
  lcd.setCursor(0, 1);
  lcd.print("Ich bin Ada.");
  lcd.setCursor(0, 2);
  lcd.print("Das hier ist");
  lcd.setCursor(0, 3);
  lcd.print("mein Arduino.");

  delay(3000);
}

void loop() {
  // ---- erste Nachricht ----
  lcd.clear();      // ohne clear schreibt der neue
                    // Text ueber den alten
  lcd.setCursor(0, 0);
  lcd.print("Nachricht A:");
  lcd.setCursor(0, 1);
  lcd.print("Ich mag Informatik");
  delay(3000);

  // ---- zweite Nachricht ----
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Nachricht B:");
  lcd.setCursor(0, 1);
  lcd.print("Ada-Lovelace-Projekt");
  delay(3000);
}
