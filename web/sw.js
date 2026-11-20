// Offline-Modus: speichert die ganze IDE (Seite, Compiler, Arduino-Dateien, Bilder) im Browser.
// Nach dem ersten Laden funktioniert die IDE ohne Internet und ohne Server.
// VERSION und FILES trägt web/package.sh beim Zusammenstellen ein. Neue Version = neuer Speicher,
// der alte wird gelöscht.
const VERSION = "__VERSION__";
const FILES = __FILES__;
const PREFIX = "nanodock-ide-";
const CACHE = PREFIX + VERSION;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
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
