#include <Keypad.h>
char tasten[4][4] = { {'1','2','3','A'}, {'4','5','6','B'}, {'7','8','9','C'}, {'*','0','#','D'} };
byte zeilen[4] = { 9, 8, 7, 6 }, spalten[4] = { 5, 4, 3, 2 };
Keypad keypad = Keypad(makeKeymap(tasten), zeilen, spalten, 4, 4);
void setup() { Serial.begin(9600); }
void loop() { char k = keypad.getKey(); if (k) Serial.println(k); }
