#!/usr/bin/env bash
# Baut den fertigen IDE-Ordner (ide/) für einen beliebigen Webserver:
#   index.html, *.js, llvm.wasm.gz (Compiler), sysroot.tar.gz (Arduino-Dateien), LIZENZEN.txt
# Läuft in GitHub Actions nach test/test.sh und nutzt dessen Zwischenergebnisse:
# die Bibliotheken ohne Debug-Infos und den mit dem WebAssembly-Compiler übersetzten Arduino-Core.
set -euo pipefail
cd "$(dirname "$0")/.."
W=test/work
OUT=ide
S=$(mktemp -d)        # Inhalt des Sysroots
rm -rf $OUT && mkdir -p $OUT

# avr-libc: Header und Bibliotheken (ohne Debug-Infos), libgcc
mkdir -p $S/avr/lib
cp -r /usr/lib/avr/include $S/avr/include
cp $W/libs/* $S/avr/lib/
# Header, die clang selbst mitbringt
mkdir -p $S/clang && tar -C $S/clang -xf dist/clang-include.tar
# Arduino-Core: nur die Header und der vorab übersetzte Core (libcore.a)
mkdir -p $S/core/cores/arduino $S/core/variants
cp $W/core/cores/arduino/*.h $S/core/cores/arduino/
cp -r $W/core/variants/eightanaloginputs $W/core/variants/standard $S/core/variants/
cp $W/out/libcore.a $S/core/libcore.a
cp test/avr5_lld.ld $S/avr5_lld.ld

tar --format=ustar -C $S -cf - . | gzip -9 > $OUT/sysroot.tar.gz
gzip -9 -c dist/llvm.wasm > $OUT/llvm.wasm.gz
cp web/index.html web/nanodock-compiler.js web/compiler-worker.js web/compiler-core.js web/wasi.js $OUT/

{
  echo "Lizenzen der Bestandteile dieser IDE"
  echo "===================================="
  echo
  echo "IDE-Seite und Skripte: Apache 2.0 (nano-dock-compiler)"
  echo "llvm.wasm (clang, lld, llvm-Werkzeuge): Apache 2.0 with LLVM Exceptions, https://llvm.org"
  echo "Arduino-Core (Header und libcore.a, Version 1.8.8): LGPL 2.1,"
  echo "  Quelltext: https://github.com/arduino/ArduinoCore-avr/tree/1.8.8"
  echo "libgcc: GPL 3 mit GCC Runtime Library Exception (erlaubt die Nutzung in eigenen Programmen)"
  echo
  echo "avr-libc:"
  cat /usr/share/doc/avr-libc/copyright 2>/dev/null || echo "  BSD-Lizenz, https://github.com/avrdudes/avr-libc"
} > $OUT/LIZENZEN.txt

rm -rf $S
ls -la $OUT
