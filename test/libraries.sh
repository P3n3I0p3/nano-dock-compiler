#!/usr/bin/env bash
# Stellt die Arduino-Bibliotheken für die IDE in test/work/libraries/<Name>/ zusammen.
# test.sh übersetzt sie danach mit dem WebAssembly-Compiler zu lib<Name>.a, package.sh legt
# Header und Archiv in den Sysroot. Jeder Ordner ist zugleich ein Include-Pfad.
#   Wire, SPI, EEPROM, SoftwareSerial  aus dem Arduino-Core 1.8.8 (LGPL 2.1), test/work/core
#   alle aus libraries.txt              feste Versionen von GitHub
#   LiquidCrystal_I2C                   eigene Umsetzung in libraries/ (Apache 2.0)
#   test/libraries.sh [Arbeitsordner]   (Standard: test/work, Arduino-Core in <Arbeitsordner>/core)
set -euo pipefail
cd "$(dirname "$0")"
W=${1:-work}
L=$W/libraries
rm -rf $L $W/libsrc && mkdir -p $L $W/libsrc

# Arduino-Core: Inhalt von src/ (Wire mit Unterordner utility/)
for n in Wire SPI EEPROM SoftwareSerial; do
  cp -r $W/core/libraries/$n/src $L/$n
done

# Bibliotheken aus libraries.txt. Neues Format (library.properties und src/): Inhalt von src/.
# Altes Format: Quelltext und Header im Hauptordner, dazu utility/. Beispiele, Tests und
# Werkzeuge bleiben draußen.
grep -v '^\s*#' libraries.txt | while read -r name repo tag; do
  [ -n "$name" ] || continue
  src=$W/libsrc/$name
  git -c advice.detachedHead=false clone -q --depth 1 --branch "$tag" "https://github.com/$repo.git" $src
  mkdir -p $L/$name
  if [ -d $src/src ]; then
    cp -r $src/src/. $L/$name/
  else
    find $src -maxdepth 1 -type f \( -name '*.h' -o -name '*.hpp' -o -name '*.c' -o -name '*.cpp' \) -exec cp {} $L/$name/ \;
    for sub in utility util; do [ -d $src/$sub ] && cp -r $src/$sub $L/$name/; done
  fi
  [ -d $src/Fonts ] && cp -r $src/Fonts $L/$name/Fonts        # Adafruit GFX: Schriften für setFont()
  lic=$(find $src -maxdepth 1 -type f -iname 'licen[cs]e*' | head -1)
  { echo "$name $tag, https://github.com/$repo"; [ -n "$lic" ] && cat "$lic" || echo "(Lizenz siehe Repository)"; } > $L/$name/LICENSE.txt
done

# U8g2: das Menü-Modul MUI lässt sich mit clang nicht übersetzen (section-Attribut an Typen)
rm -f $L/U8g2/clib/mui*.c

# eigene Bibliotheken
cp -r ../libraries/* $L/

ls $L
