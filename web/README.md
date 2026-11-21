# Browser-IDE

Die Bitbrücke IDE (Standard; Penelope IDE mit `?ide=penelope`, Ada Lovelace IDE mit `?ide=ada`), auch offline nutzbar, mit eingebautem Compiler: Der Sketch wird
**komplett im Browser** übersetzt, mit `llvm.wasm` aus diesem Repo. Kein Compiler-Server, kein
Jetson, kein Internet nach dem ersten Laden.

## Dateien

| Datei | Aufgabe |
|---|---|
| `index.html` | Oberfläche, aus `nano-dock/server/index.html` übernommen; nur das Kompilieren ist ersetzt |
| `nanodock-compiler.js` | Schnittstelle für die Seite: `compile(code)` gibt `{ ok, hex, log }` zurück, wie der Compiler-Server |
| `compiler-worker.js` | Web Worker: lädt Compiler und Arduino-Dateien einmal, kompiliert dann im Hintergrund |
| `compiler-core.js` | die eigentlichen Schritte: Sketch → C++, clang, ld.lld, llvm-objcopy, llvm-size |
| `inflate.js` | entpackt gzip in JavaScript, nur für Browser ohne `DecompressionStream` (Safari vor 16.4, z. B. iPad mini 4) |
| `wasi.js` | kleine WASI-Laufzeit mit Dateisystem im Arbeitsspeicher, damit llvm.wasm im Browser läuft |
| `test-node.mjs` | Test unter Node.js in GitHub Actions |
| `package.sh` | baut den fertigen Ordner `ide/` |
| `sw.js` | Offline-Modus: speichert die IDE im Browser (Version und Dateiliste trägt `package.sh` ein) |
| `manifest-*.webmanifest` | App-Angaben für den Home-Bildschirm, je eine für Penelope, Ada und Bitbrücke |
| `bit/` | Maskottchen Bit: Posen, Logo, App-Symbole, Wortmarke, Animationen (`bit/video/`) |

## Fertiger Ordner `ide/`

Entsteht in GitHub Actions (Download „nano-dock-ide“ beim Lauf, bei Tags `v*` als Release):

| Datei | Inhalt |
|---|---|
| `index.html`, `*.js` | IDE und Compiler-Anbindung |
| `llvm.wasm.gz` | der Compiler (clang, ld.lld, llvm-objcopy, llvm-size) |
| `sysroot.tar.gz` | avr-libc, libgcc, clang-Header, Arduino-Core-Header, vorab übersetzter Core (`libcore.a`), Linkerskript, Bibliotheken (`libraries/<Name>/`: Header und `lib<Name>.a`), `compat/avr/pgmspace.h` |
| `beispiele.json` | Beispiel-Menü: Workshop Ampel (`test/workshop`) und je ein Beispiel pro Bibliothek (`test/bibliotheken`) |
| `bit/`, `sw.js`, `manifest-*.webmanifest` | Bitbrücke-Bilder und -Animationen, Offline-Modus |
| `LIZENZEN.txt` | Lizenzen der Bestandteile |

Der Ordner läuft auf **jedem einfachen Webserver** (Jetson, Raspberry Pi, Webhosting, später ESP32
mit SD-Karte). Die Dateien werden gepackt ausgeliefert und im Browser entpackt
(`DecompressionStream`, ab Safari 16.4 und Chrome 80; ältere Browser nehmen `inflate.js`).

Zum Ausprobieren am Rechner:

```bash
cd ide && python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

## Bildschirmgrößen

Die blaue Leiste bleibt immer einzeilig. Je schmaler der Bildschirm, desto mehr fällt weg:

| Breite | Leiste |
|---|---|
| über 1180 px | alles, mit Untertitel „Vom Tablet zum Mikrocontroller“ |
| bis 1180 px (iPad quer, 1024 px) | ohne Untertitel |
| bis 900 px | Knöpfe nur mit Symbol, ohne Beschriftung |
| bis 820 px (iPad mini hochkant, 768 px) | nur das Logo, ohne den Namen daneben |
| bis 480 px (Handy) | ohne die Anzeige „Arduino Nano“, Beispiel-Menü über die ganze Breite |

## Ablauf beim Kompilieren

1. **Sketch → C++:** vorne `#include <Arduino.h>`, vor der ersten Funktion Prototypen aller
   Funktionen (wie die Arduino-IDE), `#line`, damit Fehlermeldungen die richtige Zeile nennen.
2. **clang** übersetzt `sketch.cpp` zu `sketch.o`. Jeder Ordner unter `/libraries` ist ein Include-Pfad,
   `#include <Servo.h>` usw. funktioniert also ohne Einstellung.
3. **ld.lld** linkt mit allen Bibliotheken, dem vorab übersetzten Arduino-Core, avr-libc und libgcc.
   Aus den Bibliotheken kommt nur in den Sketch, was er wirklich benutzt.
4. **llvm-objcopy** erzeugt `SKETCH.HEX`, **llvm-size** prüft Flash (max. 30 720 Bytes) und RAM.
5. Die IDE speichert die HEX-Datei aufs Dock (iPad: Teilen → „In Dateien sichern“ → NANO DOCK).

Jeder Schritt startet eine neue Instanz von `llvm.wasm` (wie ein Programmaufruf); das Dateisystem
im Arbeitsspeicher bleibt dazwischen erhalten.

## Test

`test-node.mjs` führt in GitHub Actions genau diesen JavaScript-Code unter Node.js aus und prüft:

- Die Test-Sketches ergeben **Byte für Byte dieselbe HEX-Datei** wie mit wasmtime (`test/test.sh`).
- Funktionen lassen sich vor ihrer Definition benutzen (automatische Prototypen).
- Alle Beispiele der IDE, die Workshop-Sketches (`test/workshop`) und je ein Sketch pro Bibliothek
  (`test/bibliotheken`) lassen sich fehlerfrei übersetzen und linken.
- Ein Fehler im Sketch wird mit der richtigen Zeilennummer gemeldet.

## Noch offen

- Android: direkt per USB aufs Dock (WebUSB-Weg aus `nano-dock-android`)
- Messung auf älteren Schul-iPads (3 GB RAM) und Android-Tablets; getestet sind bisher iPad Pro 12,9" (6. Gen.), iPad Pro (3. Gen.), iPad Air (4. Gen.) und iPad (A16), alle kompilieren Blink in etwa 1 s

## Bibliotheken

Eingebaut und mit `#include` sofort nutzbar (Versionen in [`test/libraries.txt`](../test/libraries.txt),
geholt von [`test/libraries.sh`](../test/libraries.sh), in GitHub Actions mit dem WebAssembly-Compiler übersetzt):

| Bereich | Bibliotheken |
|---|---|
| Arduino | Wire, SPI, EEPROM, SoftwareSerial, Servo, Stepper, SD, LiquidCrystal |
| Displays | LiquidCrystal_I2C (Textdisplay 16x2/20x4 mit I2C-Adapter), Adafruit_GFX, Adafruit_SSD1306 (OLED 0,96"), U8g2 |
| Sensoren | DHT (DHT11/DHT22), OneWire + DallasTemperature (DS18B20), Adafruit_BME280, Adafruit_BMP280, Adafruit_MPU6050, Adafruit_Sensor, RTClib (DS3231/DS1307), MFRC522 (RFID RC522), IRremote |
| LEDs, Motoren | Adafruit_NeoPixel (WS2812B), AccelStepper |
| Eingabe, Daten | Bounce2, Keypad, ArduinoJson |

- **LiquidCrystal_I2C** ist eine eigene Umsetzung (`libraries/LiquidCrystal_I2C`, Apache 2.0) mit
  derselben Schnittstelle wie die verbreitete Bibliothek (`lcd.init()`, `backlight()`, `setCursor()`,
  `print()`, `createChar()` …). Die bekannte Fassung hat keine eindeutige Lizenz.
- **Nicht dabei: FastLED.** Ihr Inline-Assembler lässt sich mit clang für AVR nicht übersetzen. Für
  LED-Streifen und -Ringe Adafruit_NeoPixel nehmen.
- **U8g2** ohne das Menü-Modul MUI (lässt sich mit clang nicht übersetzen).
- **`compat/avr/pgmspace.h`** ersetzt `pgm_read_dword` und `pgm_read_float` durch zwei 16-Bit-Lesebefehle,
  weil clang den Inline-Assembler von avr-libc dafür nicht übersetzen kann (betrifft z. B. ArduinoJson, IRremote).
- **Neue Bibliothek:** Zeile in `test/libraries.txt` ergänzen und ein kurzes Beispiel nach
  `test/bibliotheken/` legen; es erscheint dann auch im Beispiel-Menü und wird bei jedem Lauf geprüft.

Hinweis zum Speicher: Displays mit Grafik brauchen zur Laufzeit zusätzlich RAM, das die Größenangabe
nicht zeigt (SSD1306 128x64: 1024 Bytes für das Bild, U8g2 mit `_F_` ebenso; `_1_` braucht nur 128 Bytes).

## Bitbrücke IDE und Maskottchen Bit

Ohne Zusatz in der Adresse (oder mit `?ide=bitbruecke`) erscheint die IDE in den Farben der Setkarte: **Tiefblau `#1E3A8A`** und
**Signal-Orange `#F97316`** (keine weiteren Markenfarben). Standardlogo ist Bit, der Tablet und
Mikrocontroller hält: `bit/logo.jpg` ist die Originaldatei, unverändert, oben rechts groß auf weißer Fläche (App-Symbole `bit/icon-*.png` daraus).

- **Startbild:** Beim Öffnen winkt Bit (`bit/video/bit_oeffnen.mp4`) über der Wortmarke
  (`bit/wortmarke.jpg`), in einer Schleife, solange der Compiler lädt. Danach winkt er die Runde
  zu Ende, dann schließt das Startbild; Antippen schließt sofort. Der Ladetext zeigt einen
  gemeinsamen Fortschritt beider Downloads und wechselt höchstens alle 1,5 s.
- **Animationen als Popup in der Mitte**, Antippen schließt, sonst schließt es am Ende von selbst:
  - `bit/video/bit_kompiliert.mp4` („erfolgreich kompiliert“) nach erfolgreichem Überprüfen (✓)
  - `bit/video/bit_erfolg.mp4` („Upload successful“) nach dem Speichern aufs Dock
  - `bit/video/bit_fehler.mp4` wenn der Sketch Fehler hat
  - `bit/video/bit_bibliothek.mp4` („Tut mir leid, die Bibliothek … wird noch nicht unterstützt“), wenn der Sketch eine
    Bibliothek einbindet, die nicht eingebaut ist (`fatal error: '….h' file not found`); hochkant gedreht, deshalb als
    Quadrat zugeschnitten (`crop=1080:1700:0:150,pad=1700:1700:310:0:white,scale=720:720`)
- **Bit unten rechts** in der Ausgabe (auf weißer Karte, damit er sich vom Blau abhebt) zeigt den Zustand als Standbild, beim Schlafen als Video in einer Schleife:

| Zustand | Bild | Wann |
|---|---|---|
| winken | `bit/bit_winken.png` | IDE bereit, nach erfolgreichem Überprüfen (✓) |
| denken | `bit/bit_denken.png` | Kompilieren läuft (wiegt sich) |
| halten | `bit/bit_halten.png` | Hochladen, Dialog „Auf Dock speichern“ |
| jubeln | `bit/bit_jubeln.png` | auf das Dock gespeichert (springt; das Bild zeigt „Upload successful“, deshalb nicht schon nach dem Überprüfen) |
| fehler | `bit/bit_fehler.png` | Fehler im Sketch (wackelt) |
| schlafen | `bit/video/bit_schlafen.mp4` (Standbild `bit/bit_schlafen.png`, falls das Video nicht startet) | zwei Minuten ohne Aktion |

Die Bilder und Videos entstehen aus dem Ordner `design/` im Projektordner (Videos ohne Ton,
960 px breit, H.264, damit sie in Safari und Chrome laufen):

```bash
ffmpeg -i design/animationen/original/bit_erfolg.mov -an -vf "scale=960:-2,format=yuv420p" \
  -c:v libx264 -profile:v main -crf 27 -preset slow -movflags +faststart web/bit/video/bit_erfolg.mp4
```

Das Schlaf-Video ist auf Bit zugeschnitten (420 × 360 px) und der helle Hintergrund auf Weiß gezogen:

```bash
ffmpeg -i design/animationen/original/bit_schlafen.mp4 -an \
  -vf "crop=1260:1080:450:0,scale=420:360,colorlevels=rimax=0.93:gimax=0.93:bimax=0.93" \
  -c:v libx264 -crf 26 -preset slow -pix_fmt yuv420p -movflags +faststart web/bit/video/bit_schlafen.mp4
```

Weitere Animationen: Video nach `bit/video/` legen und in `index.html` mit
`showBitVideo("<name>", "Text darunter")` aufrufen; Standbilder lassen sich über `BIT_ANIM`
durch Animationen ersetzen, Videos für die Ecke über `BIT_VIDEO`. Penelope IDE und Ada Lovelace IDE zeigen Bit nicht.

## Offline-Modus

`sw.js` (Service Worker) speichert beim ersten Öffnen die ganze IDE im Browser: Seite, Skripte,
Compiler, Arduino-Dateien, Bilder und Videos (zusammen etwa 23 MB). Danach startet und
kompiliert die IDE **ohne Internet**. In der Ausgabe erscheint dann „Offline bereit“.

- Geht nur über **HTTPS** (GitHub Pages, IONOS) oder auf `localhost`.
- Auf dem iPad: Safari → Teilen → **Zum Home-Bildschirm**. Die IDE öffnet sich dann ohne
  Adressleiste wie eine App, mit Bit als Symbol (`manifest-*.webmanifest`, je IDE eines).
- **Updates:** `web/package.sh` trägt den Git-Commit als Version und die Liste aller Dateien in
  `sw.js` ein. Nach einer neuen Version lädt der Browser sie im Hintergrund („Neue Version der
  IDE gespeichert“) und nutzt sie ab dem nächsten Öffnen; der alte Speicher wird gelöscht.
- Getestet: Server abgeschaltet, Seite neu geladen, kompiliert – funktioniert.
