// sw.js — minimal service worker.
// Sert deux buts : (1) satisfaire la condition technique de Chrome pour proposer
// l'installation de l'app (il faut un fetch handler), (2) garder une copie de
// la page pour un accès hors-ligne basique.
const CACHE_NAME = "mutuni-shell-v1";
const SHELL_URL = "./";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(SHELL_URL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;               // ne touche jamais POST/PUT/etc. (ex : /transcribe)
  if (!req.url.startsWith(self.location.origin)) return; // jamais le cross-origin (polices, CDN...)
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match(SHELL_URL)))
  );
});
