// Prüft den Browser-Compiler unter Node.js (in GitHub Actions):
// derselbe Code wie im Browser (wasi.js, compiler-core.js), dieselben Dateien wie in der IDE.
//   node web/test-node.mjs <ide-Ordner> <Sketch-Ordner> <Ordner mit HEX-Dateien aus test.sh>
// Die HEX-Dateien müssen Byte für Byte gleich sein wie die aus dem wasmtime-Test.
import { readFileSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
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

// 2. Funktion vor ihrer Definition benutzen (braucht die automatischen Prototypen)
let r = await compiler.compile(`void setup() { pinMode(13, OUTPUT); }
void loop() { blinken(3); }
void blinken(int n) { while (n--) { digitalWrite(13, HIGH); delay(100); digitalWrite(13, LOW); delay(100); } }
`);
check("Prototypen", r.ok, r.ok ? "Funktion vor der Definition benutzbar" : r.log);

// 3. Fehler im Sketch: Meldung mit der richtigen Zeile, wie die IDE sie zum Springen braucht
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

const out = ["### Browser-Compiler (Node.js)", "", "| Prüfung | Ergebnis |", "|---|---|", ...report, ""].join("\n");
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, out + "\n");
process.exit(fail ? 1 : 0);
