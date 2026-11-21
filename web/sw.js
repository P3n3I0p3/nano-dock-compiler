// Offline-Modus: speichert die ganze IDE (Seite, Compiler, Arduino-Dateien, Bilder) im Browser.
// Nach dem ersten Laden funktioniert die IDE ohne Internet und ohne Server.
// VERSION und FILES trägt web/package.sh beim Zusammenstellen ein. Neue Version = neuer Speicher,
// der alte wird gelöscht.
const VERSION = "__VERSION__";
const FILES = __FILES__;
const PREFIX = "nanodock-ide-";
const CACHE = PREFIX + VERSION;

self.addEventListener("install", (event) => {
  // Jede Datei wird mit ?v=<Version> geholt und ohne den Zusatz gespeichert. Die neue Adresse
  // umgeht alle Zwischenspeicher: den des Browsers und das CDN von GitHub Pages. Das CDN liefert
  // nach einer Veröffentlichung sonst bis zu 10 Minuten lang alte Dateien neben neuen aus, und im
  // Speicher landete eine gemischte Version (z. B. neue Seite mit alten Arduino-Dateien ohne
  // Bibliotheken). Schlägt eine Datei fehl, wird nichts gespeichert und die alte Version bleibt.
  event.waitUntil((async () => {
    const files = await Promise.all(FILES.map(async (f) => {
      const url = new URL(f, self.location.href);
      url.searchParams.set("v", VERSION);
      const res = await fetch(url, { cache: "reload" });
      if (!res.ok) throw new Error(`${f}: ${res.status}`);
      return [f, res];
    }));
    const c = await caches.open(CACHE);
    await Promise.all(files.map(([f, res]) => c.put(new Request(new URL(f, self.location.href)), res)));
    await self.skipWaiting();
  })().catch(async (err) => { await caches.delete(CACHE); throw err; }));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const old = (await caches.keys()).filter((k) => k.startsWith(PREFIX) && k !== CACHE);
    await Promise.all(old.map((k) => caches.delete(k)));
    await self.clients.claim();
    for (const client of await self.clients.matchAll({ includeUncontrolled: true })) {
      client.postMessage({ type: "offline-ready", version: VERSION, update: old.length > 0 });
    }
  })());
});

// Erst aus dem Speicher, sonst aus dem Netz. ?ide=… spielt für die Dateien keine Rolle.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE)
      .then((c) => c.match(req, { ignoreSearch: true }))
      .then((hit) => hit || fetch(req))
  );
});
