/*!
 * sw.js — Service Worker
 * -----------------------------------------------------------------
 * Strategi: NETWORK-FIRST, fallback ke cache.
 * Selalu coba ambil versi TERBARU dari GitHub Pages dulu; cache
 * cuma dipakai kalau network gagal/offline. Ini sengaja BUKAN
 * cache-first, karena cache-first pernah bikin dashboard nyangkut
 * di versi lama terus-menerus (baru ke-refresh kalau DevTools
 * dibuka, yang memaksa Chrome cek update SW lebih agresif).
 *
 * PENTING: request ke Apps Script (script.google.com /
 * googleusercontent.com) sengaja TIDAK di-cache di sini — data
 * dashboard sudah punya cache-nya sendiri (lihat api-shim.js) yang
 * bisa diatur freshness-nya lewat config.js.
 *
 * Naikkan angka CACHE_NAME (v2 -> v3, dst) tiap kali kamu update
 * file-file di repo ini, supaya cache lama otomatis dibersihkan.
 * -----------------------------------------------------------------
 */
const CACHE_NAME = 'wh-dashboard-cache-v3';

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

  // Cuma tangani http/https. Skip scheme lain (chrome-extension://, dll)
  // karena Cache API browser tidak mendukungnya dan akan error kalau dipaksa.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Jangan campur tangani request ke Apps Script (data dashboard).
  if (url.hostname.indexOf('script.google') !== -1 ||
      url.hostname.indexOf('googleusercontent') !== -1) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req)) // offline / network gagal -> baru pakai cache
  );
});
