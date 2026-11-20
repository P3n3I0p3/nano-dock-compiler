// Web Worker: lädt llvm.wasm und den Sysroot einmal und kompiliert dann auf Anfrage.
// So bleibt die Seite bedienbar, während clang rechnet.
import { Compiler, gunzip } from "./compiler-core.js";

let ready = null;     // ein gemeinsames Laden, auch wenn mehrere Anfragen gleichzeitig kommen

// Beide Downloads (Compiler und Arduino-Dateien) laufen gleichzeitig, gemeldet wird ein gemeinsamer
// Fortschritt. Sonst wechselt der Text ständig zwischen den beiden Dateien hin und her.
const progress = { got: {}, total: {}, last: -1 };
function report() {
  const got = Object.values(progress.got).reduce((a, b) => a + b, 0);
  const total = Object.values(progress.total).reduce((a, b) => a + b, 0);
  const known = Object.keys(progress.total).length === 2 && Object.values(progress.total).every((t) => t > 0);
  const text = known ? `Compiler wird geladen … ${Math.min(100, Math.round((got / total) * 100))} %`
                     : `Compiler wird geladen … ${(got / 1e6).toFixed(0)} MB`;
  if (text !== progress.last) { progress.last = text; postMessage({ type: "progress", text }); }
}

async function fetchBytes(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label} konnte nicht geladen werden (${res.status}).`);
  progress.total[label] = +res.headers.get("Content-Length") || 0;
  progress.got[label] = 0;
  const reader = res.body.getReader();
  const parts = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    progress.got[label] += value.length;
    report();
  }
  return gunzip(await new Blob(parts).arrayBuffer().then((b) => new Uint8Array(b)));
}

function init() {
  if (!ready) ready = load().catch((err) => { ready = null; throw err; });   // bei Fehler später neu versuchen
  return ready;
}

async function load() {
  const [wasm, sysroot] = await Promise.all([
    fetchBytes(new URL("llvm.wasm.gz", import.meta.url), "Compiler"),
    fetchBytes(new URL("sysroot.tar.gz", import.meta.url), "Arduino-Dateien"),
  ]);
  postMessage({ type: "progress", text: "Compiler vorbereiten …" });
  const module = await WebAssembly.compile(wasm);
  return new Compiler(module, sysroot);
}

onmessage = async ({ data }) => {
  try {
    const c = await init();
    if (data.type === "load") return postMessage({ type: "loaded", id: data.id });
    const result = await c.compile(data.code, (text) => postMessage({ type: "progress", text }));
    postMessage({ type: "result", id: data.id, result });
  } catch (err) {
    postMessage({ type: "result", id: data.id, result: { ok: false, hex: null, log: "Fehler im Compiler: " + (err && err.message || err) } });
  }
};
