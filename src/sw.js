// Offline cache for the browser-installed (PWA) version. The desktop and Android apps don't use this.
// Bump VERSION whenever you deploy changed files so installed copies pick them up.
const VERSION = 'benchmark-0.9.6';
const FILES = [
  './', './index.html', './app.css', './app.js', './manifest.webmanifest', './vendor/three.min.js', './vendor/pdf.min.js', './vendor/pdf.worker.min.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png',
  './fonts/barlow-condensed-latin-500-normal.woff2', './fonts/barlow-condensed-latin-600-normal.woff2',
  './fonts/ibm-plex-mono-latin-400-normal.woff2', './fonts/ibm-plex-mono-latin-500-normal.woff2',
  './fonts/ibm-plex-sans-latin-400-normal.woff2', './fonts/ibm-plex-sans-latin-500-normal.woff2',
  './fonts/ibm-plex-sans-latin-600-normal.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache first, then network; same-origin GET requests only.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  })));
});
