/*!
 * api-shim.js
 * -----------------------------------------------------------------
 * Membuat ulang API "google.script.run" (yang normalnya cuma ada saat
 * halaman dibuka lewat script.google.com) supaya bisa dipakai dari
 * halaman statis di GitHub Pages, tanpa mengubah kode
 * google.script.run.withSuccessHandler(...)... yang sudah ada di
 * index.html / kanban.html / wh_control_tower.html / rekap_muatan.html.
 *
 * Cara kerja:
 *  - Setiap pemanggilan google.script.run.namaFungsi(arg1, arg2, ...)
 *    diteruskan sebagai request ke Apps Script Web App
 *    (window.APPS_SCRIPT_URL) dengan format:
 *        GET  ?action=namaFungsi&params=[arg1,arg2,...]
 *    Apps Script sekarang HANYA jadi backend JSON (lihat kode.gs).
 *
 *  - Hasil tiap pemanggilan disimpan di sessionStorage (cache) supaya
 *    saat pindah menu / reload halaman, data lama langsung tampil
 *    (terasa cepat), sambil tetap mengambil data terbaru di
 *    belakang layar (stale-while-revalidate). Kalau cache masih
 *    "segar" (< APPS_CACHE_TTL_MS), tidak ada request ulang ke server.
 *
 *  - Tombol "Refresh" di tiap halaman sudah ditambah
 *    clearApiCache() supaya benar-benar ambil data baru, bukan cache.
 * -----------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var BASE_URL = global.APPS_SCRIPT_URL || '';
  var TTL = typeof global.APPS_CACHE_TTL_MS === 'number' ? global.APPS_CACHE_TTL_MS : 180000;

  if (!BASE_URL || BASE_URL.indexOf('PASTE_URL') !== -1) {
    console.warn('[api-shim] APPS_SCRIPT_URL belum diisi di assets/js/config.js — panggilan ke backend akan gagal.');
  }

  function cacheKey(fn, args) {
    return 'apicache::' + fn + '::' + JSON.stringify(args || []);
  }

  function readCache(key) {
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw); // { t: timestamp, v: value }
    } catch (e) {
      return null;
    }
  }

  function writeCache(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }));
    } catch (e) {
      // sessionStorage penuh/diblok browser -> abaikan, tetap jalan tanpa cache
    }
  }

  function callBackend(fnName, args) {
    var payload = { action: fnName, params: args || [] };

    // savePhoto membawa base64 gambar yang bisa besar -> pakai POST.
    // Content-Type "text/plain" sengaja dipakai supaya browser
    // menganggap ini "simple request" dan TIDAK mengirim preflight
    // OPTIONS (Apps Script Web App tidak bisa menjawab preflight CORS).
    if (fnName === 'savePhoto') {
      return fetch(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); });
    }

    var sep = BASE_URL.indexOf('?') === -1 ? '?' : '&';
    var url = BASE_URL + sep +
      'action=' + encodeURIComponent(fnName) +
      '&params=' + encodeURIComponent(JSON.stringify(args || []));

    return fetch(url, { method: 'GET' }).then(function (r) { return r.json(); });
  }

  function makeRunner() {
    var successCb = null;
    var failureCb = null;
    var proxy;

    proxy = new Proxy({}, {
      get: function (target, prop) {
        if (prop === 'withSuccessHandler') {
          return function (cb) { successCb = cb; return proxy; };
        }
        if (prop === 'withFailureHandler') {
          return function (cb) { failureCb = cb; return proxy; };
        }
        if (prop === 'withUserObject') {
          // tidak dipakai di project ini, no-op supaya chain tidak error
          return function () { return proxy; };
        }
        if (typeof prop !== 'string') return undefined;

        // Dianggap sebagai nama fungsi backend, mis. getKanbanData(...)
        return function () {
          var args = Array.prototype.slice.call(arguments);
          var key = cacheKey(prop, args);
          var cached = readCache(key);
          var isFresh = cached && (Date.now() - cached.t < TTL);

          if (cached && successCb) {
            try { successCb(cached.v); } catch (e) { console.error(e); }
          }

          if (isFresh) return proxy; // cache masih segar, tidak perlu fetch lagi

          function fallbackToAppsScript() {
            callBackend(prop, args)
              .then(function (data) {
                writeCache(key, data);
                if (successCb) successCb(data);
              })
              .catch(function (err) {
                if (failureCb) failureCb(err);
                else console.error('[api-shim] ' + prop + ' gagal:', err);
              });
          }

          // Coba Supabase dulu (kalau tersedia & ada snapshot yang cocok)
          // — jauh lebih cepat daripada Apps Script. Kalau tidak
          // ketemu/gagal, otomatis fallback ke Apps Script seperti biasa
          // (tidak ada fitur yang hilang, cuma yang jarang dipakai lebih
          // lambat sedikit).
          var sb = global.__supabaseSnapshot;
          var sbKey = sb ? sb.buildKey(prop, args) : null;
          if (sbKey) {
            sb.fetchSnapshot(sbKey).then(function (payload) {
              // PENTING: kalau snapshot yang tersimpan di Supabase ternyata
              // hasil GAGAL (mis. sync harian sempat error saat menghitung),
              // jangan dipakai — payload {success:false} tetap "truthy" tapi
              // tidak punya data sungguhan. Perlakukan sama seperti snapshot
              // tidak ditemukan -> fallback ke Apps Script.
              if (payload && payload.success !== false) {
                writeCache(key, payload);
                if (successCb) successCb(payload);
              } else {
                fallbackToAppsScript();
              }
            });
          } else {
            fallbackToAppsScript();
          }

          return proxy;
        };
      }
    });

    return proxy;
  }

  global.google = global.google || {};
  global.google.script = global.google.script || {};

  // PENTING: "run" didefinisikan sebagai GETTER, bukan objek statis.
  // Setiap kali kode menulis "google.script.run", getter ini dipanggil
  // dan membuat runner (successCb/failureCb) BARU yang terisolasi.
  // Ini meniru perilaku asli Apps Script, dan memperbaiki bug di mana
  // beberapa pemanggilan paralel (mis. wh_control_tower.html yang
  // memanggil 5 fungsi backend sekaligus) saling menimpa
  // successHandler satu sama lain kalau runner-nya dipakai bersama.
  Object.defineProperty(global.google.script, 'run', {
    get: function () { return makeRunner(); },
    configurable: true
  });

  // Dipanggil dari tombol Refresh supaya ambil data baru, bukan cache
  global.clearApiCache = function () {
    try {
      Object.keys(sessionStorage)
        .filter(function (k) { return k.indexOf('apicache::') === 0; })
        .forEach(function (k) { sessionStorage.removeItem(k); });
    } catch (e) { /* ignore */ }
  };
})(window);
