/*!
 * supabase-cache.js
 * -----------------------------------------------------------------
 * Jalur "cepat" untuk dashboard (Stock, Kanban, Rekap Muatan, Control
 * Tower). TIDAK dipakai di halaman Loading Time (residance_time.html)
 * — itu tetap langsung ke Apps Script karena datanya berubah real-time
 * lewat interaksi user (mulai/selesai loading), bukan lewat spreadsheet.
 *
 * Snapshot di Supabase sekarang di-update REAL-TIME: begitu ada
 * perubahan di spreadsheet manapun, trigger onEdit (lihat
 * onSheetEditSync di backend/kode.gs) langsung menghitung ulang &
 * mendorong snapshot terbaru ke Supabase saat itu juga -- bukan cuma
 * menunggu jadwal harian jam 00:xx (syncAllToSupabase tetap jalan
 * sebagai jaring pengaman tambahan). Jadi snapshot untuk periode yang
 * SEDANG BERJALAN (hari ini, bulan ini) juga aman dipakai, tidak perlu
 * dipaksa selalu live lagi.
 *
 * Cara kerja: setiap fungsi (getDashboardData, getKanbanData, dst)
 * + argumennya, dicek dulu apakah cocok dengan salah satu snapshot
 * yang di-precompute (lihat syncWorkspaceToSupabase di backend/kode.gs).
 * Kalau cocok DAN ketemu -> pakai data dari Supabase (jauh lebih cepat,
 * tidak perlu Apps Script hitung ulang). Kalau tidak cocok (mis. user
 * pilih bulan/grup yang jarang dipakai, yang tidak di-precompute) atau
 * Supabase gagal diakses -> otomatis fallback ke Apps Script seperti
 * biasa (lihat api-shim.js). Jadi TIDAK ADA fitur yang hilang, cuma
 * kombinasi yang sering dipakai jadi jauh lebih cepat.
 * -----------------------------------------------------------------
 */
(function (global) {
  'use strict';

  var SB_URL  = global.SUPABASE_URL || '';
  var SB_ANON = global.SUPABASE_ANON_KEY || '';

  function pad2(n) { n = parseInt(n, 10); return n < 10 ? '0' + n : '' + n; }

  // Bangun snapshot_key dari nama fungsi + argumennya. Return null kalau
  // kombinasi ini tidak termasuk yang di-precompute (biar fallback normal).
  //
  // CATATAN (update): dulu di sini ada pengecualian "kalau tanggal/bulan =
  // hari/bulan ini, selalu skip cache" -- karena snapshot cuma dihitung
  // ulang 1x/hari jam 00:xx, jadi gampang basi begitu ada input baru di
  // siang hari. Sekarang backend (kode.gs) sudah pasang trigger onEdit
  // (lihat onSheetEditSync + setupEditTriggers) yang langsung mendorong
  // ulang snapshot ke Supabase SETIAP kali ada perubahan di spreadsheet --
  // jadi snapshot untuk periode yang sedang berjalan pun bisa dipercaya
  // selalu segar, dan TIDAK perlu lagi pengecualian "selalu live" itu.
  function buildKey(fnName, args) {
    try {
      if (fnName === 'getGroupList') return 'group_list';

      if (fnName === 'getDashboardData') {
        var mode = args[0], p = args[1] || {};
        if (p.group) return null; // filter grup spesifik -> tidak di-precompute
        if (mode === 'harian' && p.dari && p.sampai === p.dari) return 'stock:harian:' + p.dari;
        if (mode === 'bulanan' && p.bulan && p.tahun) return 'stock:bulanan:' + p.tahun + '-' + pad2(p.bulan);
        return null;
      }
      if (fnName === 'getOutboundData') {
        var po = args[0] || {};
        if (po.bulan && po.tahun) return 'outbound:bulanan:' + po.tahun + '-' + pad2(po.bulan);
        return null;
      }
      if (fnName === 'getInboundData') {
        var pi = args[0] || {};
        if (pi.bulan && pi.tahun) return 'inbound:bulanan:' + pi.tahun + '-' + pad2(pi.bulan);
        return null;
      }
      if (fnName === 'getKanbanData') {
        var kmode = args[0], kp = args[1] || {};
        if (kmode === 'harian' && kp.dari && kp.sampai === kp.dari) return 'kanban:harian:' + kp.dari;
        if (kmode === 'bulanan' && kp.bulan && kp.tahun) return 'kanban:bulanan:' + kp.tahun + '-' + pad2(kp.bulan);
        return null;
      }
      if (fnName === 'getRekapMuatanData') {
        var rp = args[0] || {};
        if (rp.mode === 'bulanan' && rp.bulan && rp.tahun) return 'rekap:bulanan:' + rp.tahun + '-' + pad2(rp.bulan);
        return null;
      }
      if (fnName === 'getStockTrendBatch') return 'stock_trend:6mo';
      if (fnName === 'getIOTrendBatch') return 'io_trend:6mo';

      // Widget ringkasan "Loading Time Avg" di Control Tower (read-only).
      // CATATAN: file ini SENGAJA tidak dimuat di residance_time.html
      // (halaman Loading Time interaktif), jadi tidak akan pernah
      // mencegat panggilan real-time dari sana.
      if (fnName === 'getResidenceTimeData' && args[0] === 'bulan') {
        var now = new Date();
        return 'residence_time:bulanan:' + now.getFullYear() + '-' + pad2(now.getMonth() + 1);
      }
    } catch (e) { /* abaikan, treat sebagai tidak cocok */ }
    return null;
  }

  // Ambil 1 snapshot dari Supabase. Resolve dengan payload (object) kalau
  // ketemu, atau null kalau tidak ketemu/gagal/Supabase belum di-setting.
  function fetchSnapshot(key) {
    if (!SB_URL || !SB_ANON || SB_URL.indexOf('xxxxx') !== -1) return Promise.resolve(null);
    var url = SB_URL.replace(/\/$/, '') +
      '/rest/v1/dashboard_snapshots?snapshot_key=eq.' + encodeURIComponent(key) +
      '&select=payload&limit=1';

    // PENTING: batasi waktu tunggu ke Supabase. Tanpa ini, kalau Supabase
    // lambat/timeout, halaman bisa "muter" selamanya karena fetch() bawaan
    // browser tidak punya batas waktu sendiri.
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ ctrl.abort(); }, 8000) : null;

    return fetch(url, {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { if (timer) clearTimeout(timer); return r.ok ? r.json() : null; })
      .then(function (rows) { return (rows && rows.length) ? rows[0].payload : null; })
      .catch(function () { if (timer) clearTimeout(timer); return null; }); // gagal/timeout -> anggap "tidak ketemu", biar fallback ke Apps Script
  }

  global.__supabaseSnapshot = { buildKey: buildKey, fetchSnapshot: fetchSnapshot };
})(window);
