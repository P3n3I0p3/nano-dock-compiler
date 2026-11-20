// Schnittstelle für die IDE-Seite: kompiliert im Browser statt auf dem Compiler-Server.
//   const compiler = new NanoDockCompiler();
//   const { ok, hex, log } = await compiler.compile(code, (text) => …Fortschritt…);
// Beim ersten Aufruf werden llvm.wasm und der Sysroot geladen (danach aus dem Browser-Speicher).
export class NanoDockCompiler {
  constructor(base = import.meta.url) {
    this.worker = new Worker(new URL("compiler-worker.js", base), { type: "module" });
    this.waiting = new Map();
    this.nextId = 1;
    this.onProgress = () => {};
    this.worker.onmessage = ({ data }) => {
      if (data.type === "progress") return this.onProgress(data.text);
      const done = this.waiting.get(data.id);
      this.waiting.delete(data.id);
      if (done) done(data.result || true);
    };
    this.worker.onerror = (e) => {
      for (const done of this.waiting.values()) done({ ok: false, hex: null, log: "Fehler im Compiler: " + (e.message || "Worker abgestürzt") });
      this.waiting.clear();
    };
  }

  send(message, onProgress) {
    if (onProgress) this.onProgress = onProgress;
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.worker.postMessage({ ...message, id });
    });
  }

  // Compiler schon im Hintergrund laden, z. B. direkt beim Öffnen der Seite
  load(onProgress) { return this.send({ type: "load" }, onProgress); }

  compile(code, onProgress) { return this.send({ type: "compile", code }, onProgress); }
}
