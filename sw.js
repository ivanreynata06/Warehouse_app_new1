/*!
 * sw.js — Service Worker
 * -----------------------------------------------------------------
 * Meng-cache file statis (HTML, JS shell) situs ini di browser
 * (Cache Storage) memakai strategi "network falling back to cache":
 * coba ambil versi terbaru dari GitHub Pages, tapi kalau lambat/offline,
 * langsung pakai versi cache supaya halaman tetap terbuka cepat.
 *
 * PENTING: request ke Apps Script (script.google.com /
 * googleusercontent.com) sengaja TIDAK di-cache di sini — data
 * dashboard sudah punya cache-nya sendiri (lihat api-shim.js) yang
 * bisa diatur freshness-nya lewat config.js.
 *
 * Naikkan angka CACHE_NAME (v1 -> v2, dst) tiap kali kamu update
 * file-file di repo ini, supaya browser pengguna ambil versi baru.
 * -----------------------------------------------------------------
 */
const CACHE_NAME = 'wh-dashboard-cache-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './kanban.html',
  './rekap_muatan.html',
  './wh_control_tower.html',
  './residance_time.html',
  './assets/js/config.js',
  './assets/js/api-shim.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // jangan sampai gagal install cuma karena 1 file hilang
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Jangan campur tangani request ke Apps Script (data dashboard).
  if (url.hostname.indexOf('script.google') !== -1 ||
      url.hostname.indexOf('googleusercontent') !== -1) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      // Kalau ada di cache, tampilkan langsung (cepat) sambil update di
      // belakang layar; kalau tidak ada, tunggu network.
      return cached || network;
    })
  );
});
