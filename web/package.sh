#!/usr/bin/env bash
# Baut den fertigen IDE-Ordner (ide/) für einen beliebigen Webserver:
#   index.html, *.js, llvm.wasm.gz (Compiler), sysroot.tar.gz (Arduino-Dateien), LIZENZEN.txt,
#   bit/ (Maskottchen, Logo, Animationen), Manifeste und sw.js für den Offline-Modus
# Läuft in GitHub Actions nach test/test.sh und nutzt dessen Zwischenergebnisse:
# die Bibliotheken ohne Debug-Infos, den mit dem WebAssembly-Compiler übersetzten Arduino-Core
# und die übersetzten Arduino-Bibliotheken (test/work/libraries, siehe test/libraries.sh).
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
cp -r test/compat $S/compat              # avr/pgmspace.h mit 32-Bit-Lesebefehlen für clang
# Bibliotheken: Header (mit Unterordnern wie Fonts/ und utility/) und das übersetzte lib<Name>.a
for d in $W/libraries/*/; do
  n=$(basename "$d")
  mkdir -p "$S/libraries/$n"
  (cd "$d" && find . \( -name '*.h' -o -name '*.hpp' -o -name "lib$n.a" \) -exec cp --parents {} "$S/libraries/$n/" \;)
done

tar --format=ustar -C $S -cf - . | gzip -9 > $OUT/sysroot.tar.gz
gzip -9 -c dist/llvm.wasm > $OUT/llvm.wasm.gz
cp web/index.html web/nanodock-compiler.js web/compiler-worker.js web/compiler-core.js web/wasi.js web/inflate.js $OUT/
cp -r web/bit $OUT/bit
cp web/manifest-*.webmanifest $OUT/
# Beispiel-Menü: Workshop-Sketches (Reihenfolge aus reihenfolge.txt) und je ein Beispiel pro Bibliothek
python3 - "$OUT/beispiele.json" <<'PY'
import json, os, re, sys
def titel(code, fallback):
    m = re.search(r"^// =+\n// (.+)$", code, re.M)          # zweite Zeile im Kopf der Workshop-Sketches
    return m.group(1).strip() if m else fallback
gruppen = []
order = [l.strip() for l in open("test/workshop/reihenfolge.txt") if l.strip()]
gruppen.append({"name": "Workshop Ampel", "sketches": [
    {"name": titel(open(f"test/workshop/{n}.ino").read(), n), "file": n, "code": open(f"test/workshop/{n}.ino").read()}
    for n in order]})
libs = sorted(f[:-4] for f in os.listdir("test/bibliotheken") if f.endswith(".ino"))
gruppen.append({"name": "Bibliotheken", "sketches": [
    {"name": n.replace("_", " "), "file": n, "code": open(f"test/bibliotheken/{n}.ino").read()} for n in libs]})
json.dump(gruppen, open(sys.argv[1], "w"), ensure_ascii=False)
PY

{
  echo "Lizenzen der Bestandteile dieser IDE"
  echo "===================================="
  echo
  echo "IDE-Seite und Skripte: Apache 2.0 (nano-dock-compiler)"
  echo "llvm.wasm (clang, lld, llvm-Werkzeuge): Apache 2.0 with LLVM Exceptions, https://llvm.org"
  echo "Arduino-Core (Header und libcore.a, Version 1.8.8): LGPL 2.1,"
  echo "  Quelltext: https://github.com/arduino/ArduinoCore-avr/tree/1.8.8"
  echo "libgcc: GPL 3 mit GCC Runtime Library Exception (erlaubt die Nutzung in eigenen Programmen)"
  echo "Wire, SPI, EEPROM, SoftwareSerial (Arduino-Core 1.8.8): LGPL 2.1, Quelltext wie oben"
  echo "LiquidCrystal_I2C: eigene Umsetzung, Apache 2.0 (nano-dock-compiler)"
  for n in Adafruit_GFX Adafruit_BusIO Adafruit_SSD1306; do
    echo; echo "$n (https://github.com/adafruit):"; cat $W/libraries/$n/LICENSE.txt
  done
  echo
  echo "avr-libc:"
  cat /usr/share/doc/avr-libc/copyright 2>/dev/null || echo "  BSD-Lizenz, https://github.com/avrdudes/avr-libc"
} > $OUT/LIZENZEN.txt

rm -rf $S

# Offline-Modus: sw.js bekommt die Version (Git-Commit) und die Liste aller Dateien der IDE
VERSION=$(git rev-parse --short=10 HEAD 2>/dev/null || date +%Y%m%d%H%M%S)
FILES=$(cd $OUT && find . -type f ! -name LIZENZEN.txt | sed 's#^\./##' | sort | awk 'BEGIN { printf "[\"./\"" } { printf ", \"%s\"", $0 } END { printf "]" }')
VERSION="$VERSION" FILES="$FILES" perl -pe 's/__VERSION__/$ENV{VERSION}/; s/__FILES__/$ENV{FILES}/' web/sw.js > $OUT/sw.js
ls -la $OUT
