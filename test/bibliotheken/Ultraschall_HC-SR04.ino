// ohne Bibliothek: pulseIn misst die Laufzeit des Echos
const int trig = 9, echo = 10;
void setup() { Serial.begin(9600); pinMode(trig, OUTPUT); pinMode(echo, INPUT); }
void loop() {
  digitalWrite(trig, LOW); delayMicroseconds(2);
  digitalWrite(trig, HIGH); delayMicroseconds(10); digitalWrite(trig, LOW);
  long dauer = pulseIn(echo, HIGH);
  Serial.print(dauer * 0.034 / 2); Serial.println(" cm");
  delay(200);
}
