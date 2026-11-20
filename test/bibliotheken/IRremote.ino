#include <IRremote.hpp>
void setup() { Serial.begin(9600); IrReceiver.begin(2); }
void loop() {
  if (IrReceiver.decode()) { Serial.println(IrReceiver.decodedIRData.command, HEX); IrReceiver.resume(); }
}
