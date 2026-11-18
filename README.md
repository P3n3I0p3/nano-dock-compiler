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

## Ablauf

Alles läuft in **GitHub Actions** auf abgeschotteten Rechnern, nichts auf einem eigenen Computer:

1. **build:** LLVM 23 mit [wasi-sdk](https://github.com/WebAssembly/wasi-sdk) nach WebAssembly
   übersetzen (dauert einige Stunden). Ergebnis: `llvm.wasm` und `clang-include.tar`.
2. **test:** Mit [wasmtime](https://wasmtime.dev) werden drei Sketches komplett mit dem
   WebAssembly-Compiler übersetzt: der Arduino-Core (1.8.8), Blink ohne Core, Blink mit Core und
   ein Sketch mit `Serial`, `millis` und `float`. Geprüft wird, dass eine HEX-Datei entsteht,
   die Startroutinen enthalten sind und die Pin-Tabellen im Flash liegen. Die Dauer jedes
   Schritts steht in der Zusammenfassung des Laufs.
3. **release** (bei Tags `v*`): `llvm.wasm` als Download.

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
