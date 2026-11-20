#include <U8g2lib.h>
#include <Wire.h>
U8G2_SSD1306_128X64_NONAME_1_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);
void setup() { u8g2.begin(); }
void loop() {
  u8g2.firstPage();
  do { u8g2.setFont(u8g2_font_ncenB14_tr); u8g2.drawStr(0, 24, "Hallo!"); u8g2.drawCircle(100, 40, 15); } while (u8g2.nextPage());
  delay(1000);
}
