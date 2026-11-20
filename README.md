# nano-dock-compiler

Baut **clang und lld (LLVM) mit AVR-Unterstützung als WebAssembly**. Damit kann eine Webseite
Arduino-Code für den Arduino Nano (ATmega328P) **direkt im Browser kompilieren**, auf iPad,
Android-Tablet oder PC, ohne Compiler-Server.

Gedacht für das iPad Nano Dock, ein Lehrmittel für den Informatikunterricht:
Code im Browser schreiben, im Browser kompilieren, auf das Dock speichern, das Dock flasht den Nano.

## Warum ein eigener Bau

[YoWASP/clang](https://github.com/YoWASP/clang) stellt LLVM schon als WebAssembly bereit, aber ohne
das AVR-Ziel. Dieses Repo übernimmt dessen Bauweise und baut **nur das, was die IDE braucht**:
AVR als einziges Ziel, dazu clang, ld.lld, llvm-objcopy, llvm-size, llvm-nm und llvm-ar in einem
Programm (`llvm.wasm`). Das hält die Datei klein.

## Browser-IDE

Im Ordner [`web/`](web/README.md) liegt die IDE, die diesen Compiler im Browser nutzt
(Standard: die Bitbrücke IDE mit dem Maskottchen Bit; mit `?ide=penelope` die Penelope IDE, mit `?ide=ada` die Ada Lovelace IDE). GitHub Actions baut daraus den fertigen
Ordner `ide/`, der auf jedem einfachen Webserver läuft.

**Zum Testen** liegt die IDE nach jedem grünen Lauf auf GitHub Pages:
<https://p3n3i0p3.github.io/nano-dock-compiler/> (Bitbrücke IDE; Penelope IDE: `?ide=penelope` anhängen, Ada Lovelace IDE: `?ide=ada`).

## Ablauf

Alles läuft in **GitHub Actions** auf abgeschotteten Rechnern, nichts auf einem eigenen Computer:

1. **build:** LLVM 22.1 (mit dem WASI-Patch von YoWASP) mit [wasi-sdk](https://github.com/WebAssembly/wasi-sdk) nach WebAssembly
   übersetzen (dauert einige Stunden). Ergebnis: `llvm.wasm` und `clang-include.tar`.
2. **test:** `test/libraries.sh` holt die Arduino-Bibliotheken in festen Versionen ([Liste](test/libraries.txt)).
   Mit [wasmtime](https://wasmtime.dev) werden drei Sketches komplett mit dem
   WebAssembly-Compiler übersetzt: der Arduino-Core (1.8.8), Blink ohne Core, Blink mit Core und
   ein Sketch mit `Serial`, `millis` und `float`. Dazu werden alle Bibliotheken übersetzt. Geprüft wird, dass eine HEX-Datei entsteht,
   die Startroutinen enthalten sind und die Pin-Tabellen im Flash liegen. Die Dauer jedes
   Schritts steht in der Zusammenfassung des Laufs.
3. **IDE:** `web/package.sh` stellt den Ordner `ide/` zusammen (Compiler, Arduino-Dateien, Seite),
   `web/test-node.mjs` prüft ihn unter Node.js mit demselben Code wie im Browser.
4. **release** (bei Tags `v*`): `llvm.wasm` und `nano-dock-ide.zip` als Download.
5. **pages** (bei `main`): die fertige IDE als Testseite auf GitHub Pages.

## Anpassungen an LLVM für WebAssembly

Zusätzlich zum WASI-Patch von YoWASP ändert `build.sh` drei Kleinigkeiten im Quelltext:

- `PrintStackTraceOnErrorSignal` als leere Funktion: Ohne Signale gibt es keine Absturz-Ausgabe,
  clang ruft die Funktion aber auf.
- `setPermissions` gibt unter WASI sofort Erfolg zurück: Dateirechte gibt es dort nicht, und
  `llvm-objcopy` würde sonst nach dem Schreiben mit „Function not implemented“ abbrechen.
- `SafelyCloseFileDescriptor` meldet nur noch echte Fehler: Der WASI-Patch gab nach `close()` immer
  den letzten `errno`-Wert zurück, wodurch clang bei manchen Dateien mit „IO failure on output
  stream“ abbrach.

Hinweise für die IDE (im Test genauso gelöst):

- clang braucht einen Ordner `/tmp` für Zwischendateien.
- WebAssembly kann keine weiteren Prozesse starten. C und C++ übersetzt clang trotzdem in einem
  Durchgang, Assembler-Dateien (`.S`) aber in zwei Schritten: erst `clang -E -x assembler-with-cpp`,
  dann `clang -cc1as -triple avr -target-cpu atmega328p -filetype obj`. Im Arduino-Core betrifft
  das nur `wiring_pulse.S`, der ohnehin vorab übersetzt mitgeliefert wird.

Damit spätere Läufe schneller sind, speichert GitHub Actions die übersetzten Dateien mit `ccache`.

## Einstellungen für AVR

Die nötigen Compiler-Optionen stammen aus einem Machbarkeitstest mit clang am Mac:

- `-D__ATTR_PROGMEM__=__attribute__((section(".progmem.data")))`: clang kennt das GCC-Attribut
  `progmem` nicht.
- `-D__HAS_DELAY_CYCLES=0`: `__builtin_avr_delay_cycles` gibt es nur in GCC.
- Linken mit eigenem Linkerskript (`test/avr5_lld.ld`) und
  `-u __do_copy_data -u __do_clear_bss -u __do_global_ctors`.
- Bibliotheken von avr-libc und libgcc ohne Debug-Infos (`llvm-objcopy --strip-debug`).

## Lizenzen

| Teil | Lizenz |
|---|---|
| dieses Repo (Bauskript, Test) | Apache 2.0, siehe `LICENSE` und `NOTICE` |
| LLVM in `llvm.wasm` | Apache 2.0 with LLVM Exceptions |
| avr-libc (nur im Test, nicht im Ergebnis) | BSD |
| Arduino-Core (nur im Test, nicht im Ergebnis) | LGPL 2.1 |
| libgcc (nur im Test, nicht im Ergebnis) | GPL mit Laufzeit-Ausnahme |

Programme, die mit dem Compiler erzeugt werden, unterliegen keiner dieser Lizenzen.
