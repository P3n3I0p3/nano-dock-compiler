#!/usr/bin/env bash
# Prüft dist/llvm.wasm: übersetzt die Test-Sketches für den Arduino Nano (ATmega328P)
# vollständig mit dem WebAssembly-Compiler (wasmtime), genau wie später im Browser.
# Erwartet (in GitHub Actions bereitgestellt):
#   wasmtime im PATH, avr-libc unter /usr/lib/avr, libgcc für AVR, Arduino-Core in test/work/core
set -euo pipefail
cd "$(dirname "$0")"
DIST=$(cd ../dist && pwd)
W=work
mkdir -p $W/clang $W/libs $W/out
tar -C $W/clang -xf "$DIST/clang-include.tar"

AVR=/usr/lib/avr                                       # avr-libc (Debian/Ubuntu-Paket)
LIBGCC=$(dirname "$(avr-gcc -mmcu=atmega328p -print-libgcc-file-name)")
CORE=$W/core/cores/arduino
VARIANT=$W/core/variants/eightanaloginputs

# Alles, was der Compiler sieht, liegt in einem virtuellen Dateisystem, wie im Browser:
#   /avr = avr-libc, /clang = clang-Header, /core = Arduino-Core, /w = Arbeitsordner
export WASMTIME_BACKTRACE_DETAILS=1
run() {
  wasmtime run -W max-wasm-stack=4194304 --dir "$AVR::/avr" --dir "$W/clang::/clang" --dir "$W/core::/core" --dir "$(pwd)::/w" \
    "$DIST/llvm.wasm" "$@"
}

FLAGS=(--target=avr -mmcu=atmega328p -Os -ffunction-sections -fdata-sections
       -DF_CPU=16000000L -DARDUINO=10819 -DARDUINO_AVR_NANO -DARDUINO_ARCH_AVR
       -resource-dir /clang -isystem /avr/include -I/core/cores/arduino -I/core/variants/eightanaloginputs
       -Wno-unknown-attributes -D__HAS_DELAY_CYCLES=0
       '-D__ATTR_PROGMEM__=__attribute__((section(".progmem.data")))')
CXX=(-std=gnu++11 -fno-exceptions -fno-rtti -fno-threadsafe-statics)

compile() {   # $1 Quelle (Pfad im virtuellen Dateisystem), $2 Objektdatei
  local lang=()
  case "$1" in *.cpp) lang=("${CXX[@]}");; *.c) lang=(-std=gnu11);; *.S) lang=(-x assembler-with-cpp);; esac
  run clang "${FLAGS[@]}" "${lang[@]}" -c "$1" -o "$2"
}

ms() { python3 -c 'import time; print(int(time.time()*1000))'; }
REPORT=$W/out/bericht.md
{ echo "| Schritt | Dauer |"; echo "|---|---|"; } > $REPORT

# Bibliotheken ohne Debug-Infos (lld kennt deren Relocations nicht) – mit dem Wasm-objcopy
for f in "$LIBGCC/libgcc.a" "$AVR/lib/avr5/libc.a" "$AVR/lib/avr5/libm.a" "$AVR/lib/avr5/libatmega328p.a" "$AVR/lib/avr5/crtatmega328p.o"; do
  cp "$f" $W/libs/
  run llvm-objcopy --strip-debug "/w/$W/libs/$(basename "$f")"
done

# Arduino-Core einmal übersetzen (im Produkt wird er vorab mitgeliefert)
t0=$(ms)
objs=(); failed=()
for src in "$CORE"/*.c "$CORE"/*.cpp "$CORE"/*.S; do
  [ -e "$src" ] || continue
  name=$(basename "$src")
  # bei einem Fehler weitermachen, damit man sieht, welche Dateien betroffen sind
  if compile "/core/cores/arduino/$name" "/w/$W/out/core_$name.o" 2> $W/out/core_$name.err; then
    objs+=("/w/$W/out/core_$name.o")
  else
    failed+=("$name"); echo "FEHLER bei $name:"; head -30 $W/out/core_$name.err
  fi
done
if [ ${#failed[@]} -gt 0 ]; then
  echo "| Arduino-Core: Fehler bei ${failed[*]} | |" >> $REPORT
  cat $REPORT; exit 1
fi
run llvm-ar rcs /w/$W/out/libcore.a "${objs[@]}"
echo "| Arduino-Core (${#objs[@]} Dateien) | $(( $(ms) - t0 )) ms |" >> $REPORT

link() {      # $1 Name, weitere: Objektdateien
  local name=$1; shift
  run ld.lld --gc-sections -T /w/avr5_lld.ld -u __do_copy_data -u __do_clear_bss -u __do_global_ctors \
    /w/$W/libs/crtatmega328p.o "$@" -L/w/$W/libs --start-group -lgcc -lm -lc -latmega328p --end-group \
    -o /w/$W/out/$name.elf
  run llvm-objcopy -O ihex -R .eeprom /w/$W/out/$name.elf /w/$W/out/$name.hex
  run llvm-size -A /w/$W/out/$name.elf > $W/out/$name.size
}

fail=0
for dir in sketches/*/; do
  name=$(basename "$dir")
  t0=$(ms)
  if ls "$dir"*.ino >/dev/null 2>&1; then
    { echo '#include <Arduino.h>'; echo '#line 1 "sketch.ino"'; cat "$dir"*.ino; } > $W/out/$name.cpp
    compile /w/$W/out/$name.cpp /w/$W/out/$name.o
    link "$name" /w/$W/out/$name.o /w/$W/out/libcore.a
  else
    compile "/w/$(ls "$dir"*.c)" /w/$W/out/$name.o
    link "$name" /w/$W/out/$name.o
  fi
  dt=$(( $(ms) - t0 ))
  flash=$(awk '$1==".text"||$1==".data"{s+=$2} END{print s+0}' $W/out/$name.size)
  # Prüfungen wie im Compiler-Test am Mac
  syms=$(run llvm-nm /w/$W/out/$name.elf)
  ok=yes
  [ -s $W/out/$name.hex ] || ok=no
  grep -q " __do_global_ctors$" <<<"$syms" || ok=no
  if [[ $name == *arduino ]]; then
    addr=$(grep " digital_pin_to_port_PGM$" <<<"$syms" | cut -d' ' -f1)
    [[ -n $addr && $((16#$addr)) -lt $((16#800000)) ]] || ok=no      # Tabelle muss im Flash liegen
  fi
  echo "| $name: übersetzen und linken ($flash Bytes, Prüfung: $ok) | $dt ms |" >> $REPORT
  [ $ok = yes ] || fail=1
done

cat $REPORT
exit $fail
