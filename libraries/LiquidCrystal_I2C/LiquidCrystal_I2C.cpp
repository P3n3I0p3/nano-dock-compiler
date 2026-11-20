// LiquidCrystal_I2C für die Bitbrücke IDE (nano-dock-compiler), Apache 2.0. Siehe Header.
#include "LiquidCrystal_I2C.h"
#include <Wire.h>

// Belegung des PCF8574 auf den üblichen I2C-Adaptern
#define PIN_RS 0x01
#define PIN_EN 0x04
#define PIN_BL 0x08          // Hintergrundlicht; D4..D7 liegen auf P4..P7

// Befehle des HD44780
#define LCD_CLEARDISPLAY   0x01
#define LCD_RETURNHOME     0x02
#define LCD_ENTRYMODESET   0x04
#define LCD_DISPLAYCONTROL 0x08
#define LCD_CURSORSHIFT    0x10
#define LCD_FUNCTIONSET    0x20
#define LCD_SETCGRAMADDR   0x40
#define LCD_SETDDRAMADDR   0x80

#define LCD_ENTRYLEFT           0x02
#define LCD_ENTRYSHIFTINCREMENT 0x01
#define LCD_DISPLAYON 0x04
#define LCD_CURSORON  0x02
#define LCD_BLINKON   0x01
#define LCD_DISPLAYMOVE 0x08
#define LCD_MOVERIGHT   0x04
#define LCD_2LINE 0x08

LiquidCrystal_I2C::LiquidCrystal_I2C(uint8_t addr, uint8_t cols, uint8_t rows, uint8_t charsize)
  : _addr(addr), _cols(cols), _rows(rows), _charsize(charsize),
    _function(0), _control(0), _mode(0), _backlight(PIN_BL) {}

void LiquidCrystal_I2C::init() {
  Wire.begin();
  begin(_cols, _rows, _charsize);
}

void LiquidCrystal_I2C::begin(uint8_t cols, uint8_t rows, uint8_t charsize) {
  if (cols) _cols = cols;
  if (rows) _rows = rows;
  _function = 0;                                 // 4-Bit-Modus
  if (_rows > 1) _function |= LCD_2LINE;
  if (charsize && _rows == 1) _function |= LCD_5x10DOTS;

  delay(50);                                     // Display braucht nach dem Einschalten > 40 ms
  expanderWrite(_backlight);
  delay(100);

  // Einschaltfolge laut Datenblatt: dreimal 8-Bit-Modus, dann 4-Bit-Modus
  write4bits(0x03 << 4); delayMicroseconds(4500);
  write4bits(0x03 << 4); delayMicroseconds(4500);
  write4bits(0x03 << 4); delayMicroseconds(150);
  write4bits(0x02 << 4);

  command(LCD_FUNCTIONSET | _function);
  _control = LCD_DISPLAYON;
  display();
  clear();
  _mode = LCD_ENTRYLEFT;
  command(LCD_ENTRYMODESET | _mode);
  home();
}

void LiquidCrystal_I2C::clear() { command(LCD_CLEARDISPLAY); delayMicroseconds(2000); }
void LiquidCrystal_I2C::home()  { command(LCD_RETURNHOME);   delayMicroseconds(2000); }

void LiquidCrystal_I2C::setCursor(uint8_t col, uint8_t row) {
  static const uint8_t offsets[] = { 0x00, 0x40, 0x14, 0x54 };   // Zeilenanfänge (20x4: 0, 64, 20, 84)
  if (row >= _rows) row = _rows - 1;
  if (row > 3) row = 3;
  command(LCD_SETDDRAMADDR | (col + offsets[row]));
}

void LiquidCrystal_I2C::noDisplay() { _control &= ~LCD_DISPLAYON; command(LCD_DISPLAYCONTROL | _control); }
void LiquidCrystal_I2C::display()   { _control |=  LCD_DISPLAYON; command(LCD_DISPLAYCONTROL | _control); }
void LiquidCrystal_I2C::noCursor()  { _control &= ~LCD_CURSORON;  command(LCD_DISPLAYCONTROL | _control); }
void LiquidCrystal_I2C::cursor()    { _control |=  LCD_CURSORON;  command(LCD_DISPLAYCONTROL | _control); }
void LiquidCrystal_I2C::noBlink()   { _control &= ~LCD_BLINKON;   command(LCD_DISPLAYCONTROL | _control); }
void LiquidCrystal_I2C::blink()     { _control |=  LCD_BLINKON;   command(LCD_DISPLAYCONTROL | _control); }

void LiquidCrystal_I2C::scrollDisplayLeft()  { command(LCD_CURSORSHIFT | LCD_DISPLAYMOVE); }
void LiquidCrystal_I2C::scrollDisplayRight() { command(LCD_CURSORSHIFT | LCD_DISPLAYMOVE | LCD_MOVERIGHT); }
void LiquidCrystal_I2C::leftToRight()  { _mode |=  LCD_ENTRYLEFT; command(LCD_ENTRYMODESET | _mode); }
void LiquidCrystal_I2C::rightToLeft()  { _mode &= ~LCD_ENTRYLEFT; command(LCD_ENTRYMODESET | _mode); }
void LiquidCrystal_I2C::autoscroll()   { _mode |=  LCD_ENTRYSHIFTINCREMENT; command(LCD_ENTRYMODESET | _mode); }
void LiquidCrystal_I2C::noAutoscroll() { _mode &= ~LCD_ENTRYSHIFTINCREMENT; command(LCD_ENTRYMODESET | _mode); }

void LiquidCrystal_I2C::noBacklight() { _backlight = 0;      expanderWrite(0); }
void LiquidCrystal_I2C::backlight()   { _backlight = PIN_BL; expanderWrite(0); }

void LiquidCrystal_I2C::createChar(uint8_t location, const uint8_t charmap[]) {
  location &= 0x7;                               // 8 eigene Zeichen (0..7)
  command(LCD_SETCGRAMADDR | (location << 3));
  for (uint8_t i = 0; i < 8; i++) write(charmap[i]);
}

void LiquidCrystal_I2C::command(uint8_t value) { send(value, 0); }

size_t LiquidCrystal_I2C::write(uint8_t value) { send(value, PIN_RS); return 1; }

void LiquidCrystal_I2C::send(uint8_t value, uint8_t mode) {
  write4bits((value & 0xF0) | mode);
  write4bits(((value << 4) & 0xF0) | mode);
}

void LiquidCrystal_I2C::write4bits(uint8_t value) {
  expanderWrite(value);
  pulseEnable(value);
}

void LiquidCrystal_I2C::expanderWrite(uint8_t data) {
  Wire.beginTransmission(_addr);
  Wire.write(data | _backlight);
  Wire.endTransmission();
}

void LiquidCrystal_I2C::pulseEnable(uint8_t data) {
  expanderWrite(data | PIN_EN);
  delayMicroseconds(1);
  expanderWrite(data & ~PIN_EN);
  delayMicroseconds(50);
}
