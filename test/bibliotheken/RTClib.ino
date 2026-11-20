#include <RTClib.h>
RTC_DS3231 rtc;
void setup() { Serial.begin(9600); if (!rtc.begin()) Serial.println("Keine Uhr"); }
void loop() {
  DateTime jetzt = rtc.now();
  Serial.print(jetzt.hour()); Serial.print(':'); Serial.println(jetzt.minute());
  delay(1000);
}
