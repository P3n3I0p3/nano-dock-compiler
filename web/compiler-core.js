// Kompiliert einen Arduino-Sketch für den Arduino Nano (ATmega328P) vollständig mit llvm.wasm.
// Gleiche Schritte und Optionen wie test/test.sh, nur mit der WASI-Laufzeit aus wasi.js.
// Läuft im Web Worker (compiler-worker.js) und unter Node.js (test-node.mjs).

import { WASI, makeDir, writeFile, readFile, mkdirp, lookup } from "./wasi.js";

// Speicher des Arduino Nano (ATmega328P mit Bootloader)
export const FLASH_MAX = 30720;
export const RAM_MAX = 2048;

const FLAGS = [
  "--target=avr", "-mmcu=atmega328p", "-Os", "-ffunction-sections", "-fdata-sections",
  "-DF_CPU=16000000L", "-DARDUINO=10819", "-DARDUINO_AVR_NANO", "-DARDUINO_ARCH_AVR",
  "-resource-dir", "/clang", "-isystem", "/compat", "-isystem", "/avr/include",   // compat: pgmspace.h für clang
  "-I/core/cores/arduino", "-I/core/variants/eightanaloginputs",
  "-Wno-unknown-attributes", "-D__HAS_DELAY_CYCLES=0",
  // UINT8_MAX & Co. auch in C++ (avr-gcc setzt das selbst, manche Bibliotheken brauchen es)
  "-D__STDC_LIMIT_MACROS", "-D__STDC_CONSTANT_MACROS",
  '-D__ATTR_PROGMEM__=__attribute__((section(".progmem.data")))',
  "-fno-color-diagnostics", "-fmessage-length=0",
];
const CXX = ["-std=gnu++11", "-fno-exceptions", "-fno-rtti", "-fno-threadsafe-statics"];

// --- tar-Archiv (ustar) mit dem Sysroot einlesen ---
// Inhalt: avr/ (avr-libc und libgcc), clang/include, core/ (Arduino-Header und libcore.a), avr5_lld.ld,
// libraries/<Name>/ (Header und lib<Name>.a: Wire, SPI, Adafruit SSD1306, LiquidCrystal_I2C …)
export function loadTar(root, buf) {
  const dec = new TextDecoder();
  const field = (off, len) => { const s = dec.decode(buf.subarray(off, off + len)); const i = s.indexOf("\0"); return i < 0 ? s : s.slice(0, i); };
  let off = 0, longName = null, count = 0;
  while (off + 512 <= buf.length) {
    const name0 = field(off, 100);
    if (!name0) break;                                          // zwei leere Blöcke = Ende
    const size = parseInt(field(off + 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(buf[off + 156] || 48);
    const prefix = field(off + 345, 155);
    let name = longName || (prefix ? prefix + "/" + name0 : name0);
    longName = null;
    const data = buf.subarray(off + 512, off + 512 + size);
    if (type === "L") longName = field(off + 512, size);        // GNU: langer Name im nächsten Block
    else if (type === "x") {                                     // pax: path=… überschreibt den Namen
      const m = dec.decode(data).match(/\d+ path=([^\n]*)\n/);
      if (m) longName = m[1];
    } else if (type === "5") mkdirp(root, name);
    else if (type === "0" || type === "\0") { writeFile(root, name, data.slice()); count++; }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return count;
}

export async function gunzip(bytes) {
  // Manche Webserver entpacken .gz-Dateien schon beim Ausliefern; dann ist nichts mehr zu tun
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// --- Sketch (.ino) in C++ verwandeln, wie die Arduino-IDE ---
// Vorne #include <Arduino.h>, und vor der ersten Funktion Prototypen aller Funktionen,
// damit Funktionen auch vor ihrer Definition benutzt werden können.
export function inoToCpp(code) {
  // Kommentare und Zeichenketten ausblenden (Zeilenumbrüche bleiben, damit Positionen stimmen)
  const clean = code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g,
    (m) => m.replace(/[^\n]/g, " "));
  // Klammertiefe an jeder Stelle, um nur Funktionen auf oberster Ebene zu finden
  const depth = new Int32Array(clean.length + 1);
  for (let i = 0, d = 0; i < clean.length; i++) {
    depth[i] = d;
    if (clean[i] === "{") d++;
    else if (clean[i] === "}") d = Math.max(0, d - 1);
  }
  const FN = /(^|[;}\n])([ \t]*)((?:[A-Za-z_][\w:<>]*[\s*&]+)+)([A-Za-z_]\w*)\s*\(([^;{}()]*)\)\s*(?=\{)/g;
  const SKIP = new Set(["if", "else", "for", "while", "switch", "return", "do", "case", "new", "delete"]);
  const protos = [];
  let firstPos = -1, m;
  while ((m = FN.exec(clean))) {
    const start = m.index + m[1].length + m[2].length;
    if (depth[start]) continue;
    const ret = m[3].trim().replace(/\s+/g, " ");
    const name = m[4];
    if (SKIP.has(name) || ret.split(/[\s*&]+/).some((w) => SKIP.has(w)) || /\b(template|operator)\b/.test(ret)) continue;
    const params = m[5].trim().replace(/\s+/g, " ");
    if (params.includes("=")) continue;                          // Standardwerte nicht doppelt angeben
    protos.push(`${ret} ${name}(${params});`);
    if (firstPos < 0) firstPos = start;
  }
  if (firstPos < 0) return `#include <Arduino.h>\n#line 1 "sketch.ino"\n${code}`;
  // Zeilenanfang der ersten Funktion: dort kommen die Prototypen hin
  const lineStart = code.lastIndexOf("\n", firstPos - 1) + 1;
  const lineNo = code.slice(0, lineStart).split("\n").length;
  return `#include <Arduino.h>\n#line 1 "sketch.ino"\n${code.slice(0, lineStart)}` +
         `${protos.join("\n")}\n#line ${lineNo} "sketch.ino"\n${code.slice(lineStart)}`;
}

// --- Compiler ---
export class Compiler {
  // module: kompiliertes llvm.wasm (WebAssembly.Module), sysroot: entpacktes tar (Uint8Array)
  constructor(module, sysroot) {
    this.module = module;
    this.root = makeDir();
    this.files = loadTar(this.root, sysroot);
    mkdirp(this.root, "tmp");
    // Bibliotheken: jeder Ordner ist ein Include-Pfad, das Archiv wird mitgelinkt. Der Linker
    // nimmt aus einem Archiv nur, was der Sketch wirklich braucht.
    const [libs] = lookup(this.root, "libraries");
    this.libInclude = [];
    this.libArchives = [];
    for (const [name, node] of (libs && libs.dir) || []) {
      if (!node.dir) continue;
      this.libInclude.push(`-I/libraries/${name}`);
      if (node.dir.has(`lib${name}.a`)) this.libArchives.push(`/libraries/${name}/lib${name}.a`);
    }
  }

  // Ein Werkzeug aus llvm.wasm ausführen (clang, ld.lld, llvm-objcopy, llvm-size …)
  async run(tool, args) {
    const wasi = new WASI({ root: this.root, args: ["llvm", tool, ...args], env: { TMPDIR: "/tmp", PWD: "/" } });
    const instance = await WebAssembly.instantiate(this.module, wasi.imports(this.module));
    const code = wasi.run(instance);
    const dec = new TextDecoder();
    return { code, stdout: dec.decode(wasi.output(1)), stderr: dec.decode(wasi.output(2)) };
  }

  // Gibt { ok, hex, log, flash, ram, ms } zurück (gleiche Form wie die Antwort des Compiler-Servers)
  async compile(code, onStep = () => {}) {
    const t0 = Date.now();
    const W = "/work";
    this.root.dir.delete("work");
    mkdirp(this.root, "work");
    writeFile(this.root, W + "/sketch.cpp", inoToCpp(code));
    const log = [];
    const step = async (text, tool, args) => {
      onStep(text);
      const r = await this.run(tool, args);
      // Der AVR-Startcode steht am Anfang des Flash, ein Einsprungpunkt _start ist nicht nötig
      const out = (r.stderr + r.stdout).replace(/\/work\//g, "")
        .replace(/^.*cannot find entry symbol _start.*\n?/m, "").trim();
      if (out) log.push(out);
      return r;
    };

    let r = await step("Übersetzen …", "clang", [...FLAGS, ...this.libInclude, ...CXX, "-c", W + "/sketch.cpp", "-o", W + "/sketch.o"]);
    if (r.code) return { ok: false, hex: null, log: log.join("\n"), ms: Date.now() - t0 };

    r = await step("Linken …", "ld.lld", ["--gc-sections", "-T", "/avr5_lld.ld",
      "-u", "__do_copy_data", "-u", "__do_clear_bss", "-u", "__do_global_ctors",
      "/avr/lib/crtatmega328p.o", W + "/sketch.o", ...this.libArchives, "/core/libcore.a",
      "-L/avr/lib", "--start-group", "-lgcc", "-lm", "-lc", "-latmega328p", "--end-group",
      "-o", W + "/sketch.elf"]);
    if (r.code) return { ok: false, hex: null, log: log.join("\n"), ms: Date.now() - t0 };

    r = await step("HEX-Datei erzeugen …", "llvm-objcopy", ["-O", "ihex", "-R", ".eeprom", W + "/sketch.elf", W + "/sketch.hex"]);
    if (r.code) return { ok: false, hex: null, log: log.join("\n"), ms: Date.now() - t0 };

    onStep("Größe prüfen …");
    const size = await this.run("llvm-size", ["-A", W + "/sketch.elf"]);
    const sec = {};
    for (const line of size.stdout.split("\n")) {
      const p = line.trim().split(/\s+/);
      if (p.length >= 2 && /^\d+$/.test(p[1])) sec[p[0]] = +p[1];
    }
    const flash = (sec[".text"] || 0) + (sec[".data"] || 0);
    const ram = (sec[".data"] || 0) + (sec[".bss"] || 0);
    const pct = (a, b) => Math.round((a / b) * 100);
    log.push(`Der Sketch verwendet ${flash} Bytes (${pct(flash, FLASH_MAX)}%) des Programmspeicherplatzes. Das Maximum sind ${FLASH_MAX} Bytes.`);
    log.push(`Globale Variablen verwenden ${ram} Bytes (${pct(ram, RAM_MAX)}%) des dynamischen Speichers, ${RAM_MAX - ram} Bytes bleiben für lokale Variablen. Das Maximum sind ${RAM_MAX} Bytes.`);
    if (flash > FLASH_MAX) {
      log.push("Fehler: Der Sketch ist zu groß für den Arduino Nano.");
      return { ok: false, hex: null, log: log.join("\n"), flash, ram, ms: Date.now() - t0 };
    }
    const hex = new TextDecoder().decode(readFile(this.root, W + "/sketch.hex"));
    return { ok: true, hex, log: log.join("\n"), flash, ram, ms: Date.now() - t0 };
  }
}
