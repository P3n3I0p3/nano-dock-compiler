#include <Wire.h>
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);
byte herz[8] = { 0, 10, 31, 31, 14, 4, 0, 0 };
void setup() { lcd.init(); lcd.backlight(); lcd.createChar(0, herz); lcd.print("Hallo "); lcd.write(0); }
void loop() { lcd.setCursor(0, 1); lcd.print(millis() / 1000); lcd.print(" s"); delay(200); }
