// LiquidCrystal_I2C für die Bitbrücke IDE (nano-dock-compiler), Apache 2.0.
// Eigene Umsetzung mit derselben Schnittstelle wie die verbreitete Arduino-Bibliothek
// „LiquidCrystal I2C“: Textdisplays mit HD44780-Controller (16x2, 20x4 …) und I2C-Adapter
// mit PCF8574 (Adresse meist 0x27, bei PCF8574A meist 0x3F).
//
//   #include <LiquidCrystal_I2C.h>
//   LiquidCrystal_I2C lcd(0x27, 20, 4);
//   lcd.init(); lcd.backlight(); lcd.setCursor(0, 0); lcd.print("Hallo!");
#ifndef LiquidCrystal_I2C_h
#define LiquidCrystal_I2C_h

#include <Arduino.h>
#include <Print.h>

#define LCD_5x8DOTS  0x00
#define LCD_5x10DOTS 0x04

class LiquidCrystal_I2C : public Print {
public:
  LiquidCrystal_I2C(uint8_t addr, uint8_t cols, uint8_t rows, uint8_t charsize = LCD_5x8DOTS);

  void init();                                   // Wire starten und Display einrichten
  void begin(uint8_t cols = 0, uint8_t rows = 0, uint8_t charsize = LCD_5x8DOTS);
  void begin(uint8_t cols, uint8_t rows, uint8_t charsize, bool) { begin(cols, rows, charsize); }

  void clear();
  void home();
  void setCursor(uint8_t col, uint8_t row);

  void noDisplay();  void display();
  void noCursor();   void cursor();
  void noBlink();    void blink();
  void scrollDisplayLeft();  void scrollDisplayRight();
  void leftToRight();        void rightToLeft();
  void autoscroll();         void noAutoscroll();

  void noBacklight();  void backlight();
  void setBacklight(uint8_t on) { on ? backlight() : noBacklight(); }
  bool getBacklight() { return _backlight != 0; }

  void createChar(uint8_t location, const uint8_t charmap[]);
  void createChar(uint8_t location, const char *charmap) { createChar(location, (const uint8_t *)charmap); }

  void command(uint8_t value);
  virtual size_t write(uint8_t value);
  size_t write(int value) { return write((uint8_t)value); }   // lcd.write(0) für eigenes Zeichen 0
  using Print::write;

  // ältere Namen derselben Bibliothek
  void cursor_on()  { cursor(); }   void cursor_off() { noCursor(); }
  void blink_on()   { blink(); }    void blink_off()  { noBlink(); }
  void load_custom_character(uint8_t n, uint8_t *rows) { createChar(n, rows); }
  void printstr(const char *s) { print(s); }
  void setBacklightPin(uint8_t, int) {}
  void oled_init() { init(); }

private:
  void send(uint8_t value, uint8_t mode);
  void write4bits(uint8_t value);
  void expanderWrite(uint8_t data);
  void pulseEnable(uint8_t data);

  uint8_t _addr, _cols, _rows, _charsize;
  uint8_t _function, _control, _mode, _backlight;
};

#endif
