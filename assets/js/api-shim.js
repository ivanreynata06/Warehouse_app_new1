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

  // Workspace = kombinasi Plant + Departemen yang dipilih user saat login
  // (lihat login.html). Disimpan di sessionStorage supaya bertahan selama
  // 1 sesi browser, dan disertakan di SETIAP request backend + cache key
  // supaya data antar departemen tidak pernah tercampur/ketuker.
  function getWorkspace() {
    try {
      return sessionStorage.getItem('wh_workspace') || 'cibitung_fitting_import';
    } catch (e) {
      return 'cibitung_fitting_import';
    }
  }
  global.getWorkspace = getWorkspace;

  function cacheKey(fn, args) {
    return 'apicache::' + getWorkspace() + '::' + fn + '::' + JSON.stringify(args || []);
  }

  // Whitelist fungsi yang AMAN di-cache -- data dashboard read-only yang
  // boleh sedikit basi (beberapa menit) demi kecepatan tampilan.
  // SEMUA fungsi lain (approval, save, login, upload, delete, dst) TIDAK
  // BOLEH di-cache sama sekali -- harus selalu fresh dari server, karena
  // hasilnya action-sensitive / berubah cepat / bisa menyesatkan kalau basi
  // (contoh nyata: getPendingApprovals menampilkan "0 menunggu" basi
  // padahal sudah ada pengajuan baru masuk).
  var CACHEABLE_FRONTEND = {
    getKaryawanList: 1, getGroupList: 1, getDashboardData: 1,
    getOutboundData: 1, getInboundData: 1, getKanbanData: 1,
    getRekapMuatanData: 1, getPhotos: 1, getStockTrendBatch: 1,
    getIOTrendBatch: 1, getAbsensiFTEData: 1, getLemburList: 1,
    getAbsensiList: 1, getLoadingTimeAnalytics: 1
  };

  // getResidenceTimeData dipakai di 2 tempat dengan kebutuhan berbeda:
  //  - Control Tower manggil dengan mode 'bulan' (rekap bulanan) -- AMAN
  //    di-cache, ada snapshot Supabase-nya (lihat supabase-cache.js).
  //  - Halaman Loading Time (residance_time.html) manggil dengan mode lain
  //    (harian/real-time) untuk pantau proses muat yang sedang berjalan --
  //    TIDAK BOLEH di-cache, harus selalu fresh.
  // Makanya keputusan cache-nya dicek per-parameter, bukan cuma nama fungsi.
  function isCacheableCall(fnName, args) {
    if (CACHEABLE_FRONTEND[fnName]) return true;
    if (fnName === 'getResidenceTimeData' && args && args[0] === 'bulan') return true;
    return false;
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

  // Batas waktu tunggu ke Apps Script. Dikasih lebih panjang dari Supabase
  // (25 detik, wajar karena kadang perlu hitung banyak baris sheet), tapi
  // tetap ada batasnya -- supaya kalau macet/quota Apps Script kepenuhan,
  // user dapat pesan error yang jelas alih-alih layar "muter" selamanya.
  function fetchWithTimeout(url, opts, ms) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, ms) : null;
    opts = opts || {};
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(url, opts).finally(function(){ if (timer) clearTimeout(timer); });
  }

  // Fungsi yang bisa membawa payload BESAR (ratusan/ribuan baris upload,
  // atau base64 foto) -- kalau dikirim lewat GET (jadi query string di
  // URL), gampang melebihi batas panjang URL browser (~8000 karakter)
  // dan request langsung gagal total ("Failed to fetch") sebelum sempat
  // sampai ke server. Fungsi-fungsi ini SELALU dikirim lewat POST body.
  var LARGE_PAYLOAD_FUNCTIONS = { savePhoto: 1, appendStockData: 1, appendOutboundData: 1, appendInboundData: 1, manualSyncNow: 1, clearStockDataForDate: 1, uploadTlSignature: 1 };

  function callBackend(fnName, args) {
    var payload = { action: fnName, params: args || [], workspace: getWorkspace() };

    // Content-Type "text/plain" sengaja dipakai supaya browser menganggap
    // ini "simple request" dan TIDAK mengirim preflight OPTIONS (Apps
    // Script Web App tidak bisa menjawab preflight CORS).
    if (LARGE_PAYLOAD_FUNCTIONS[fnName]) {
      // manualSyncNow menghitung ulang SEMUA dashboard (tren 6 bulan,
      // kanban, rekap, dll) dalam 1 eksekusi -- bisa jauh lebih lama dari
      // upload biasa, apalagi kalau sheet-nya sudah besar. Karena ini
      // aksi yang SENGAJA ditunggu manual oleh pengguna (klik tombol
      // "Sync Sekarang"), kasih waktu jauh lebih panjang (4.5 menit,
      // masih di bawah batas eksekusi Apps Script 6 menit).
      // Upload (appendStockData dkk) sekarang HANYA menulis ke
      // spreadsheet (tanpa menunggu sync apa pun), jadi cukup cepat --
      // timeout wajar saja. manualSyncNow beda: itu menghitung ulang
      // dashboard, jadi tetap dikasih waktu panjang.
      var LONG_TIMEOUT_FUNCTIONS = { manualSyncNow: 1, clearStockDataForDate: 1 };
      var timeoutMs = LONG_TIMEOUT_FUNCTIONS[fnName] ? 270000 : 60000;
      return fetchWithTimeout(BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }, timeoutMs).then(function (r) { return r.json(); });
    }

    var sep = BASE_URL.indexOf('?') === -1 ? '?' : '&';
    var url = BASE_URL + sep +
      'action=' + encodeURIComponent(fnName) +
      '&params=' + encodeURIComponent(JSON.stringify(args || [])) +
      '&workspace=' + encodeURIComponent(getWorkspace());

    return fetchWithTimeout(url, { method: 'GET' }, 45000).then(function (r) { return r.json(); });
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

          // Fungsi/parameter di luar whitelist (approval, save, login,
          // upload, dll, atau getResidenceTimeData mode real-time) --
          // SELALU fresh, tidak pernah baca/tulis cache sama sekali.
          if (!isCacheableCall(prop, args)) {
            callBackend(prop, args)
              .then(function (data) { if (successCb) successCb(data); })
              .catch(function (err) { if (failureCb) failureCb(err); });
            return proxy;
          }

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
          if (sbKey) sbKey = getWorkspace() + '::' + sbKey; // pisahkan snapshot per departemen
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
