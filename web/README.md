# Browser-IDE

Die Penelope IDE (bzw. Ada Lovelace IDE mit `?ide=ada`, Bitbrücke IDE mit `?ide=bitbruecke`), auch offline nutzbar, mit eingebautem Compiler: Der Sketch wird
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
| `sw.js` | Offline-Modus: speichert die IDE im Browser (Version und Dateiliste trägt `package.sh` ein) |
| `manifest-*.webmanifest` | App-Angaben für den Home-Bildschirm, je eine für Penelope, Ada und Bitbrücke |
| `bit/` | Maskottchen Bit: Posen, Logo, App-Symbole, Wortmarke, Animationen (`bit/video/`) |

## Fertiger Ordner `ide/`

Entsteht in GitHub Actions (Download „nano-dock-ide“ beim Lauf, bei Tags `v*` als Release):

| Datei | Inhalt |
|---|---|
| `index.html`, `*.js` | IDE und Compiler-Anbindung |
| `llvm.wasm.gz` | der Compiler (clang, ld.lld, llvm-objcopy, llvm-size) |
| `sysroot.tar.gz` | avr-libc, libgcc, clang-Header, Arduino-Core-Header, vorab übersetzter Core (`libcore.a`), Linkerskript |
| `bit/`, `sw.js`, `manifest-*.webmanifest` | Bitbrücke-Bilder und -Animationen, Offline-Modus |
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

- Android: direkt per USB aufs Dock (WebUSB-Weg aus `nano-dock-android`)
- Bibliotheken (Servo, Display, NeoPixel) im Sysroot
- Messung auf älteren Schul-iPads (3 GB RAM) und Android-Tablets; getestet sind bisher iPad Pro 12,9" (6. Gen.), iPad Pro (3. Gen.) und iPad Air (4. Gen.), alle kompilieren Blink in etwa 1 s

## Bitbrücke IDE und Maskottchen Bit

Mit `?ide=bitbruecke` erscheint die IDE in den Farben der Setkarte: **Tiefblau `#1E3A8A`** und
**Signal-Orange `#F97316`** (keine weiteren Markenfarben). Standardlogo ist Bit, der Tablet und
Mikrocontroller hält: `bit/logo.jpg` ist die Originaldatei, unverändert, oben rechts groß auf weißer Fläche (App-Symbole `bit/icon-*.png` daraus).

- **Startbild:** Beim Öffnen winkt Bit (`bit/video/bit_oeffnen.mp4`) über der Wortmarke
  (`bit/wortmarke.jpg`). Es schließt, wenn die Animation zu Ende und der Compiler geladen ist;
  Antippen schließt sofort.
- **Animationen als Popup in der Mitte**, Antippen schließt, sonst schließt es am Ende von selbst:
  - `bit/video/bit_kompiliert.mp4` („erfolgreich kompiliert“) nach erfolgreichem Überprüfen (✓)
  - `bit/video/bit_erfolg.mp4` („Upload successful“) nach dem Speichern aufs Dock
  - `bit/video/bit_fehler.mp4` wenn der Sketch Fehler hat
- **Bit unten rechts** in der Ausgabe (auf weißer Karte, damit er sich vom Blau abhebt) zeigt den Zustand als Standbild:

| Zustand | Bild | Wann |
|---|---|---|
| winken | `bit/bit_winken.png` | IDE bereit |
| denken | `bit/bit_denken.png` | Kompilieren läuft (wiegt sich) |
| halten | `bit/bit_halten.png` | Hochladen, Dialog „Auf Dock speichern“ |
| jubeln | `bit/bit_jubeln.png` | Kompiliert bzw. auf das Dock gespeichert (springt) |
| fehler | `bit/bit_fehler.png` | Fehler im Sketch (wackelt) |
| schlafen | `bit/bit_schlafen.png` | zwei Minuten ohne Aktion |

Die Bilder und Videos entstehen aus dem Ordner `design/` im Projektordner (Videos ohne Ton,
960 px breit, H.264, damit sie in Safari und Chrome laufen):

```bash
ffmpeg -i design/animationen/original/bit_erfolg.mov -an -vf "scale=960:-2,format=yuv420p" \
  -c:v libx264 -profile:v main -crf 27 -preset slow -movflags +faststart web/bit/video/bit_erfolg.mp4
```

Weitere Animationen: Video nach `bit/video/` legen und in `index.html` mit
`showBitVideo("<name>", "Text darunter")` aufrufen; Standbilder lassen sich über `BIT_ANIM`
durch Animationen ersetzen. Penelope IDE und Ada Lovelace IDE zeigen Bit nicht.

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
