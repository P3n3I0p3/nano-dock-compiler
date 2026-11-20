# Browser-IDE

Die Penelope IDE (bzw. Ada Lovelace IDE mit `?ide=ada`, Bitbrücke IDE mit `?ide=bitbruecke`) mit eingebautem Compiler: Der Sketch wird
**komplett im Browser** übersetzt, mit `llvm.wasm` aus diesem Repo. Kein Compiler-Server, kein
Jetson, kein Internet nach dem ersten Laden.

## Dateien

| Datei | Aufgabe |
|---|---|
| `index.html` | Oberfläche, aus `nano-dock/server/index.html` übernommen; nur das Kompilieren ist ersetzt |
| `nanodock-compiler.js` | Schnittstelle für die Seite: `compile(code)` gibt `{ ok, hex, log }` zurück, wie der Compiler-Server |
| `compiler-worker.js` | Web Worker: lädt Compiler und Arduino-Dateien einmal, kompiliert dann im Hintergrund |
| `compiler-core.js` | die eigentlichen Schritte: Sketch → C++, clang, ld.lld, llvm-objcopy, llvm-size |
| `wasi.js` | kleine WASI-Laufzeit mit Dateisystem im Arbeitsspeicher, damit llvm.wasm im Browser läuft |
| `test-node.mjs` | Test unter Node.js in GitHub Actions |
| `package.sh` | baut den fertigen Ordner `ide/` |

## Fertiger Ordner `ide/`

Entsteht in GitHub Actions (Download „nano-dock-ide“ beim Lauf, bei Tags `v*` als Release):

| Datei | Inhalt |
|---|---|
| `index.html`, `*.js` | IDE und Compiler-Anbindung |
| `llvm.wasm.gz` | der Compiler (clang, ld.lld, llvm-objcopy, llvm-size) |
| `sysroot.tar.gz` | avr-libc, libgcc, clang-Header, Arduino-Core-Header, vorab übersetzter Core (`libcore.a`), Linkerskript |
| `LIZENZEN.txt` | Lizenzen der Bestandteile |

Der Ordner läuft auf **jedem einfachen Webserver** (Jetson, Raspberry Pi, Webhosting, später ESP32
mit SD-Karte). Die Dateien werden gepackt ausgeliefert und im Browser entpackt
(`DecompressionStream`, ab Safari 16.4 und Chrome 80).

Zum Ausprobieren am Rechner:

```bash
cd ide && python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen.

## Ablauf beim Kompilieren

1. **Sketch → C++:** vorne `#include <Arduino.h>`, vor der ersten Funktion Prototypen aller
   Funktionen (wie die Arduino-IDE), `#line`, damit Fehlermeldungen die richtige Zeile nennen.
2. **clang** übersetzt `sketch.cpp` zu `sketch.o`.
3. **ld.lld** linkt mit dem vorab übersetzten Arduino-Core, avr-libc und libgcc.
4. **llvm-objcopy** erzeugt `SKETCH.HEX`, **llvm-size** prüft Flash (max. 30 720 Bytes) und RAM.
5. Die IDE speichert die HEX-Datei aufs Dock (iPad: Teilen → „In Dateien sichern“ → NANO DOCK).

Jeder Schritt startet eine neue Instanz von `llvm.wasm` (wie ein Programmaufruf); das Dateisystem
im Arbeitsspeicher bleibt dazwischen erhalten.

## Test

`test-node.mjs` führt in GitHub Actions genau diesen JavaScript-Code unter Node.js aus und prüft:

- Die Test-Sketches ergeben **Byte für Byte dieselbe HEX-Datei** wie mit wasmtime (`test/test.sh`).
- Funktionen lassen sich vor ihrer Definition benutzen (automatische Prototypen).
- Ein Fehler im Sketch wird mit der richtigen Zeilennummer gemeldet.

## Noch offen

- Offline-Modus (PWA mit Service Worker), damit die IDE ohne Netz startet
- Android: direkt per USB aufs Dock (WebUSB-Weg aus `nano-dock-android`)
- Bibliotheken (Servo, Display, NeoPixel) im Sysroot
- Messung auf echten Schul-iPads: Ladezeit, Kompilierzeit, Speicherbedarf

## Bitbrücke IDE und Maskottchen Bit

Mit `?ide=bitbruecke` erscheint die IDE in Tiefblau (`#1E3A8A`) und Signal-Orange (`#F97316`).
Unten rechts in der Ausgabe zeigt **Bit**, was gerade passiert:

| Zustand | Bild | Wann |
|---|---|---|
| winken | `bit/bit_winken.png` | IDE bereit |
| denken | `bit/bit_denken.png` | Kompilieren läuft (wiegt sich) |
| halten | `bit/bit_halten.png` | Hochladen, Dialog „Auf Dock speichern“ |
| jubeln | `bit/bit_jubeln.png` | Kompiliert bzw. auf das Dock gespeichert (springt) |
| fehler | `bit/bit_fehler.png` | Fehler im Sketch (wackelt) |
| schlafen | `bit/bit_schlafen.png` | zwei Minuten ohne Aktion |

Die Bilder entstehen aus `design/maskottchen/posen/` im Projektordner (240 px hoch).
Die Bewegungen sind vorerst einfache CSS-Animationen. **Echte Animationen** als Datei nach
`bit/anim/` legen und in `index.html` in `BIT_ANIM` eintragen, z. B.
`BIT_ANIM.jubeln = "bit/anim/bit_jubeln.png"` (APNG) – Vorgaben in `design/animationen/README.md`.
Penelope IDE und Ada Lovelace IDE zeigen Bit nicht.
