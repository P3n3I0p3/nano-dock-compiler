// Prüft den Browser-Compiler unter Node.js (in GitHub Actions):
// derselbe Code wie im Browser (wasi.js, compiler-core.js), dieselben Dateien wie in der IDE.
//   node web/test-node.mjs <ide-Ordner> <Sketch-Ordner> <Ordner mit HEX-Dateien aus test.sh>
// Die HEX-Dateien müssen Byte für Byte gleich sein wie die aus dem wasmtime-Test.
// Außerdem müssen alle Beispiele der IDE, die Workshop-Sketches (test/workshop) und je ein Sketch
// pro Bibliothek (test/bibliotheken) fehlerfrei übersetzt werden.
import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Compiler, gunzip } from "./compiler-core.js";

const [ideDir, sketchDir, hexDir] = process.argv.slice(2);
const report = [];
let fail = false;
const check = (name, ok, detail) => {
  report.push(`| ${name} | ${ok ? "✅" : "❌"} ${detail} |`);
  if (!ok) fail = true;
};

let t = Date.now();
const wasm = await gunzip(readFileSync(join(ideDir, "llvm.wasm.gz")));
const sysroot = await gunzip(readFileSync(join(ideDir, "sysroot.tar.gz")));
const module = await WebAssembly.compile(wasm);
const compiler = new Compiler(module, sysroot);
check("Laden", true, `${compiler.files} Dateien im Sysroot, ${Date.now() - t} ms`);

// 1. Die Test-Sketches: gleiche HEX-Datei wie mit wasmtime
for (const name of readdirSync(sketchDir)) {
  const ino = readdirSync(join(sketchDir, name)).find((f) => f.endsWith(".ino"));
  if (!ino) continue;
  const r = await compiler.compile(readFileSync(join(sketchDir, name, ino), "utf8"));
  if (!r.ok) { check(name, false, "Fehler:<br>" + r.log.replace(/\n/g, "<br>")); console.log(r.log); continue; }
  const same = r.hex === readFileSync(join(hexDir, name + ".hex"), "utf8");
  check(name, same, `${r.flash} Bytes Flash, ${r.ram} Bytes RAM, ${r.ms} ms, ${same ? "HEX identisch mit wasmtime" : "HEX weicht ab"}`);
}

// 2. Beispiele der IDE (aus index.html), Workshop- und Bibliotheks-Sketches: fehlerfrei übersetzen
const here = dirname(fileURLToPath(import.meta.url));
const sketches = [];
const html = readFileSync(join(here, "index.html"), "utf8");
const block = html.slice(html.indexOf("const EXAMPLES = {"));
for (const m of block.slice(0, block.indexOf("\n};")).matchAll(/^  "([^"]+)": `([\s\S]*?)`,?$/gm)) {
  sketches.push(["Beispiel: " + m[1], m[2].replace(/\$\{IDE_NAME\}/g, "Bitbruecke IDE")]);
}
for (const [dir, label] of [["workshop", "Workshop"], ["bibliotheken", "Bibliothek"]]) {
  const path = join(here, "..", "test", dir);
  for (const f of readdirSync(path).filter((f) => f.endsWith(".ino")).sort()) {
    sketches.push([`${label}: ${f}`, readFileSync(join(path, f), "utf8")]);
  }
}
for (const [name, code] of sketches) {
  const r = await compiler.compile(code);
  if (!r.ok) console.log(name + "\n" + r.log);
  check(name, r.ok, r.ok ? `${r.flash} Bytes Flash, ${r.ram} Bytes RAM, ${r.ms} ms` : "Fehler:<br>" + r.log.replace(/\n/g, "<br>"));
}

// 3. Funktion vor ihrer Definition benutzen (braucht die automatischen Prototypen)
let r = await compiler.compile(`void setup() { pinMode(13, OUTPUT); }
void loop() { blinken(3); }
void blinken(int n) { while (n--) { digitalWrite(13, HIGH); delay(100); digitalWrite(13, LOW); delay(100); } }
`);
check("Prototypen", r.ok, r.ok ? "Funktion vor der Definition benutzbar" : r.log);

// 4. Fehler im Sketch: Meldung mit der richtigen Zeile, wie die IDE sie zum Springen braucht
r = await compiler.compile(`void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH)
  delay(500);
}
`);
const line = r.log.match(/sketch\.ino:(\d+):\d+:\s*error/);
check("Fehlermeldung", !r.ok && line && +line[1] === 6, line ? `Fehler in Zeile ${line[1]} erkannt` : "keine Zeile gefunden: " + r.log);
console.log(r.log);

// 5. Nicht eingebaute Bibliothek: die IDE erkennt sie an "fatal error: '….h' file not found"
r = await compiler.compile(`#include <GibtEsNicht.h>
void setup() {}
void loop() {}
`);
const lib = r.log.match(/fatal error: '([^']+)' file not found/);
check("Fehlende Bibliothek", !r.ok && lib && lib[1] === "GibtEsNicht.h", lib ? `erkannt: ${lib[1]}` : "nicht erkannt: " + r.log);

const out = ["### Browser-Compiler (Node.js)", "", "| Prüfung | Ergebnis |", "|---|---|", ...report, ""].join("\n");
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + "\n");
process.exit(fail ? 1 : 0);
