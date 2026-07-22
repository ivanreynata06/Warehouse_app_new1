// ============================================================
// 1. WEB APP — BACKEND API SAJA (JSON)
// ------------------------------------------------------------
// Frontend (index.html, kanban.html, rekap_muatan.html,
// wh_control_tower.html) SEKARANG DI-HOSTING TERPISAH di GitHub
// Pages, jadi Apps Script ini TIDAK LAGI mengirim HTML — dia
// cuma menjawab data dalam format JSON lewat doGet/doPost.
//
// Dipanggil dari browser (lihat assets/js/api-shim.js di repo
// GitHub) dengan format:
//   GET  <url_exec>?action=namaFungsi&params=["arg1","arg2"]
//   POST <url_exec>  body: {"action":"savePhoto","params":[...]}
//        (body dikirim sebagai text/plain agar tidak kena
//         preflight CORS yang tidak didukung Apps Script)
//
// Hanya fungsi yang terdaftar di API_FUNCTIONS di bawah yang
// bisa dipanggil dari luar — ini sekaligus jadi whitelist
// keamanan supaya orang tidak bisa memanggil fungsi internal
// sembarangan lewat URL.
// ============================================================
var API_FUNCTIONS = {
  getGroupList          : getGroupList,
  getDashboardData       : getDashboardData,
  getOutboundData         : getOutboundData,
  getInboundData          : getInboundData,
  getKanbanData           : getKanbanData,
  getRekapMuatanData      : getRekapMuatanData,
  getResidenceTimeData    : getResidenceTimeData,
  getPendingRows          : getPendingRows,
  getStockTrendBatch      : getStockTrendBatch,
  getIOTrendBatch         : getIOTrendBatch,
  setWaktuMulai           : setWaktuMulai,
  setWaktuSelesai         : setWaktuSelesai,
  setStatusBatal          : setStatusBatal,
  setIkutFittingRucika    : setIkutFittingRucika,
  setStatusPending        : setStatusPending,
  setStatusTerkirim       : setStatusTerkirim,
  clearStatusPending      : clearStatusPending,
  savePhoto               : savePhoto,
  getPhotos               : getPhotos,
  deletePhoto             : deletePhoto
};

// Fungsi READ (baca data) yang aman di-cache di server selama beberapa
// detik. TIDAK termasuk fungsi yang mengubah data (set*/save*/delete*)
// — itu harus selalu jalan langsung, tidak boleh kena cache.
// CATATAN: getResidenceTimeData & getPendingRows SENGAJA TIDAK di-cache
// (dulu sempat di-cache 15 detik, tapi halaman Loading Time sangat
// interaktif - begitu user melakukan aksi seperti Batal/Terkirim,
// mereka langsung reload data, dan kalau masih kena cache lama hasil
// aksinya tidak langsung kelihatan / "tidak auto generate").
var CACHEABLE_ACTIONS = {
  getGroupList: true, getDashboardData: true, getOutboundData: true,
  getInboundData: true, getKanbanData: true, getRekapMuatanData: true,
  getPhotos: true, getStockTrendBatch: true, getIOTrendBatch: true
};
// TTL per fungsi (detik). Default 90s buat dashboard umum.
var CACHE_TTL_OVERRIDE = {};
var CACHE_TTL_DEFAULT = 90;

function doGet(e) {
  return handleApiRequest(e);
}

function doPost(e) {
  return handleApiRequest(e);
}

function handleApiRequest(e) {
  var result;
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action;
    var args   = [];

    // Body POST (dipakai savePhoto) dikirim sebagai text/plain berisi
    // JSON {action, params} supaya browser tidak mengirim preflight CORS.
    if (e && e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        action = body.action || action;
        args   = body.params || [];
      } catch (parseErr) {
        // bukan JSON valid -> abaikan, tetap coba pakai query param di bawah
      }
    } else if (params.params) {
      args = JSON.parse(params.params);
    }

    if (!action) {
      result = { success: false, error: 'Parameter "action" wajib diisi.' };
    } else if (!API_FUNCTIONS.hasOwnProperty(action)) {
      result = { success: false, error: 'Aksi "' + action + '" tidak dikenali / tidak diizinkan.' };
    } else if (CACHEABLE_ACTIONS[action]) {
      result = callWithServerCache(action, args);
    } else {
      result = API_FUNCTIONS[action].apply(null, args);
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
}

// Bungkus fungsi baca data dengan CacheService supaya panggilan berulang
// (klik Refresh, atau beberapa orang buka dashboard bersamaan) dalam
// jendela CACHE_TTL_SECONDS langsung dijawab dari cache (instan),
// tidak perlu baca ulang spreadsheet tiap kali.
function callWithServerCache(action, args) {
  var cache    = CacheService.getScriptCache();
  var cacheKey = 'api::' + action + '::' + JSON.stringify(args);

  try {
    var cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    // cache error (mis. corrupt) -> abaikan, lanjut ambil data asli di bawah
  }

  var result = API_FUNCTIONS[action].apply(null, args);

  try {
    // CacheService punya batas ukuran per key (~100KB). Kalau data
    // hasilnya lebih besar dari itu, put() akan gagal -> ditangkap di
    // sini supaya tidak bikin seluruh request error, cache-nya cuma
    // dilewati untuk kasus itu (fungsi tetap kembalikan data asli).
    cache.put(cacheKey, JSON.stringify(result), CACHE_TTL_OVERRIDE[action] || CACHE_TTL_DEFAULT);
  } catch (e) {
    // data kegedean buat di-cache -> tidak apa, tetap return data aslinya
  }

  return result;
}

// ============================================================
// 2. OTOMATISASI TANGGAL
// ============================================================
function onEdit(e) {
  var sheet    = e.source.getActiveSheet();
  var shName   = sheet.getName();

  // -- DASHBOARD_STOCK: kolom F diisi ? isi tanggal di kolom J --
  if (shName === "DASHBOARD_STOCK") {
    var range    = e.range;
    var startRow = range.getRow();
    var endRow   = range.getLastRow();
    var startCol = range.getColumn();
    var endCol   = range.getLastColumn();
    if (startCol <= 6 && endCol >= 6 && endRow > 1) {
      if (startRow === 1) startRow = 2;
      var numRows = endRow - startRow + 1;
      var dataF = sheet.getRange(startRow, 6, numRows, 1).getValues();
      var dataJ = sheet.getRange(startRow, 10, numRows, 1).getValues();
      var butuhTanggal = false;
      for (var i = 0; i < numRows; i++) {
        if (dataF[i][0] !== "" && dataJ[i][0] === "") { butuhTanggal = true; break; }
      }
      if (!butuhTanggal) return;
      var targetDate = new Date();
      targetDate.setHours(0, 0, 0, 0);
      var daftarTanggalMerah = [
        "2026-01-01","2026-02-17","2026-02-18","2026-03-19","2026-03-20","2026-03-21",
        "2026-04-03","2026-05-01","2026-05-14","2026-05-27","2026-05-28","2026-06-01",
        "2026-06-16","2026-08-17","2026-08-25","2026-12-25"
      ];
      function apakahTanggalMerah(d) {
        var s = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,'0')+"-"+String(d.getDate()).padStart(2,'0');
        return daftarTanggalMerah.indexOf(s) !== -1;
      }
      while (targetDate.getDay() === 0 || apakahTanggalMerah(targetDate)) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      var outputJ = [];
      for (var i = 0; i < numRows; i++) {
        outputJ.push((dataF[i][0] !== "" && dataJ[i][0] === "") ? [new Date(targetDate)] : [dataJ[i][0]]);
      }
      var tr = sheet.getRange(startRow, 10, numRows, 1);
      tr.setValues(outputJ);
      tr.setNumberFormat('dd/mm/yyyy');
    }
    return;
  }

  // -- PENGIRIMAN: kolom B (Nama Agen) diisi ? isi tanggal hari ini di kolom A --
  if (shName === "PENGIRIMAN") {
    var range    = e.range;
    var startRow = range.getRow();
    var endRow   = range.getLastRow();
    var startCol = range.getColumn();
    var endCol   = range.getLastColumn();
    // Trigger saat kolom B (index 2) ada di range yang diedit
    if (startCol <= 2 && endCol >= 2 && endRow > 1) {
      if (startRow === 1) startRow = 2;
      var numRows = endRow - startRow + 1;
      var dataB = sheet.getRange(startRow, 2, numRows, 1).getValues(); // Nama Agen
      var dataA = sheet.getRange(startRow, 1, numRows, 1).getValues(); // Tanggal
      var todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      var outputA = [];
      for (var i = 0; i < numRows; i++) {
        if (dataB[i][0] !== '' && dataA[i][0] === '') {
          outputA.push([new Date(todayDate)]);
        } else {
          outputA.push([dataA[i][0]]);
        }
      }
      var tRange = sheet.getRange(startRow, 1, numRows, 1);
      tRange.setValues(outputA);
      tRange.setNumberFormat('dd/mm/yyyy');
    }
    return;
  }
}

// ================================================================
// RESIDENCE TIME PENGIRIMAN ? fungsi-fungsi baru
// Sheet PENGIRIMAN kolom:
//   A(1)=Tanggal  B(2)=Nama Agen  C(3)=Rucika  D(4)=Lem/Lonyx
//   E(5)=PPR/Sitech  F(6)=Nopol  G(7)=Jenis Kendaraan
//   H(8)=Waktu Mulai  I(9)=Waktu Selesai
// ================================================================
var SH_PENGIRIMAN      = 'PENGIRIMAN';
var SH_REKAP_MUATAN    = 'REKAP MUATAN';
var SH_REKAP_FITTING   = 'REKAP MUATAN FITTING';

function getResidenceTimeData(filter) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) throw new Error('Sheet PENGIRIMAN tidak ditemukan. Pastikan nama sheet tepat.');

    var data         = sheet.getDataRange().getValues();
    var today        = new Date(); today.setHours(0,0,0,0);
    var firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    var todayRows    = [];
    var monthRows    = [];
    var allRows      = [];
    var customRows   = [];

    // filter bisa string ('hari'/'bulan'/'semua') ATAU object
    // {mode:'tanggal', date:'YYYY-MM-DD'} untuk lihat tanggal tertentu
    // (mis. Kemarin, atau tanggal manapun lewat date-picker).
    var customDateKey = null;
    var customMonthKey = null; // 'YYYY-MM' untuk filter bulan custom
    if (filter && typeof filter === 'object' && filter.date) {
      if (filter.mode === 'bulan-custom') {
        customMonthKey = String(filter.date).trim(); // format YYYY-MM
      } else {
        customDateKey = String(filter.date).trim(); // format YYYY-MM-DD
      }
    }

    // Trend 7 hari
    var trend7Map = {};
    for (var d7 = 6; d7 >= 0; d7--) {
      var dt = new Date(today); dt.setDate(dt.getDate() - d7);
      var key7 = _fmtYMD(dt);
      trend7Map[key7] = { label: _fmtShort(dt), total: 0 };
    }

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Baca SPM dari kolom E (index 4 = kolom ke-5)
      var spm = String(row[4] || '').trim();
      if (!spm) continue;

      var tglRaw = row[0];
      var tgl    = tglRaw ? new Date(tglRaw) : null;
      if (tgl) tgl.setHours(0,0,0,0);

      var statusRaw      = String(row[9] || '').trim(); // kolom J = STATUS (PENDING/BATAL/TERKIRIM/GAGAL)
      var isBatal        = statusRaw.indexOf('BATAL') === 0 || statusRaw.toUpperCase().indexOf('BATAL') === 0;
      var isPendingSheet = statusRaw.indexOf('PENDING')  === 0;
      var isTerkirimSheet= statusRaw.indexOf('TERKIRIM') === 0;
      var isGagalSheet   = statusRaw.indexOf('GAGAL') === 0;

      var rec = {
        rowIndex        : i + 1,
        tanggal         : tgl ? _fmtYMD(tgl) : '',
        agen            : String(row[1] || '').trim(),
        spm             : spm,
        nopol           : String(row[5] || '').trim(),
        jenisKendaraan  : String(row[6] || '').trim(),
        waktuMulai      : _fmtTime(row[7]),
        waktuSelesai    : _fmtTime(row[8]),
        statusRaw       : statusRaw,
        statusBatal     : isBatal ? statusRaw : '',
        statusTerkirim  : (isTerkirimSheet || isGagalSheet) ? statusRaw : '',
        isCancelled     : isBatal,
        isPendingSheet  : isPendingSheet,
        isTerkirimSheet : isTerkirimSheet,
        isTerkirim      : isTerkirimSheet,
        isGagalKirim    : isGagalSheet
      };

      allRows.push(rec);
      if (tgl) {
        var key = _fmtYMD(tgl);
        if (tgl.getTime() === today.getTime()) todayRows.push(rec);
        if (tgl >= firstOfMonth) monthRows.push(rec);
        if (customDateKey && key === customDateKey) customRows.push(rec);
        if (customMonthKey && key.substring(0,7) === customMonthKey) customRows.push(rec);
        if (trend7Map[key] !== undefined) trend7Map[key].total++;
      } else if (isBatal) {
        // Baris BATAL yang kolom TANGGAL-nya belum sempat diisi di sheet
        // tetap dihitung sebagai bagian bulan berjalan, supaya statistik
        // "Batal Kirim" akurat sesuai kolom STATUS (tidak diam-diam
        // hilang cuma karena tanggalnya kosong).
        monthRows.push(rec);
      }
    }

    return {
      success    : true,
      todayRows  : todayRows,
      monthRows  : monthRows,
      allRows    : allRows,
      customRows : customRows,
      customDate : customDateKey,
      trend7     : Object.values(trend7Map)
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Daftar kiriman yang sudah terdaftar di sheet (agen/SPM/nopol
//  sudah diisi PIC) tapi BELUM mulai muat (kolom H/Waktu Mulai kosong).
//  Dipakai untuk mengisi dropdown "Pilih Agen" di modal Mulai Muat,
//  jadi operator tidak perlu mengetik ulang SPM, agen, atau nopol.
// ================================================================
function getPendingRows() {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };

    var data    = sheet.getDataRange().getValues();
    var today   = new Date(); today.setHours(0,0,0,0);
    var pending = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var spm        = String(row[4] || '').trim();   // E = PPR/SITECH (No. SPM)
      var agen       = String(row[1] || '').trim();   // B = Nama Agen
      var nopol      = String(row[5] || '').trim();   // F = Nopol
      var waktuMulai = row[7];                          // H = Waktu Mulai
      var statusBatal= String(row[9] || '').trim();    // J = Status Batal

      if (!spm || !agen) continue;          // baris belum diisi PIC, lewati
      if (waktuMulai) continue;             // sudah mulai muat (atau sudah "Ikut Fitting"), lewati
      if (statusBatal) continue;            // sudah dibatalkan, lewati

      var tglRaw = row[0];
      var tgl    = tglRaw ? new Date(tglRaw) : null;
      if (tgl) tgl.setHours(0,0,0,0);
      if (tgl && tgl.getTime() !== today.getTime()) continue; // hanya hari ini

      pending.push({
        rowIndex : i + 1,
        spm      : spm,
        agen     : agen,
        nopol    : nopol
      });
    }

    return { success: true, rows: pending };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function setWaktuMulai(row, waktu) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    sheet.getRange(row, 8).setValue(waktu);
    // Bersihkan status BATAL/PENDING lama (kolom J) kalau ada — user
    // secara eksplisit klik Mulai, artinya kiriman ini AKTIF lagi,
    // status lama sudah tidak relevan dan harus tidak lagi menutupi.
    _clearStaleCancelStatus(sheet, row);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function setWaktuSelesai(row, waktu) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    sheet.getRange(row, 9).setValue(waktu);
    _clearStaleCancelStatus(sheet, row);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Helper: hapus tulisan BATAL/PENDING lama di kolom J (STATUS) kalau ada.
// Dipanggil dari setWaktuMulai/setWaktuSelesai/setIkutFittingRucika —
// semua aksi yang menandakan kiriman ini sedang AKTIF diproses lagi,
// jadi status batal/pending sebelumnya (kalau ada) sudah tidak berlaku.
function _clearStaleCancelStatus(sheet, row) {
  var cur = String(sheet.getRange(row, 10).getValue() || '').trim().toUpperCase();
  if (cur.indexOf('BATAL') === 0 || cur.indexOf('PENDING') === 0) {
    sheet.getRange(row, 10).setValue('');
  }
}

// ================================================================
//  Simpan pembatalan kiriman secara PERMANEN ke kolom J sheet
//  PENGIRIMAN, supaya status Batal tidak hilang saat dashboard
//  di-refresh (sebelumnya status batal hanya disimpan di memori
//  browser/cancelledList, jadi hilang setiap reload).
//  Kolom K dipakai untuk catatan tambahan (opsional).
// ================================================================
function setStatusBatal(row, reason, notes) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var label = 'BATAL' + (reason ? (' - ' + reason) : '');
    sheet.getRange(row, 10).setValue(label); // J = Status Batal
    if (notes) sheet.getRange(row, 11).setValue(notes); // K = Catatan Batal
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  "Kiriman Ikut Fitting Rucika": dipakai saat fitting Rucika untuk
//  SPM ini ikut numpang muat di kendaraan departemen lain, sehingga
//  checker TIDAK perlu klik tombol START (tidak tahu & tidak perlu
//  tahu durasi muat aslinya) tapi statusnya harus tetap tercatat
//  SELESAI. Kolom H & I diisi marker teks (bukan jam asli) supaya:
//   - status baris tetap terbaca "selesai" (H & I sama-sama terisi)
//   - durasi TIDAK dihitung ke rata-rata muat (teks bukan format jam)
// ================================================================
function setIkutFittingRucika(row) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    sheet.getRange(row, 8).setValue('Ikut Fitting');   // H = Waktu Mulai (marker)
    sheet.getRange(row, 9).setValue('Rucika');          // I = Waktu Selesai (marker)
    _clearStaleCancelStatus(sheet, row);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Simpan status PENDING ke kolom J sheet PENGIRIMAN
//  Dipanggil saat operator menunda kiriman (Tunda/Pending).
//  Format: "PENDING - alasan | catatan | HH:MM DD/M"
// ================================================================
function setStatusPending(row, reason, notes, tujuan) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var now   = new Date();
    var waktu = _pad2(now.getHours()) + ':' + _pad2(now.getMinutes()) +
                ' ' + now.getDate() + '/' + (now.getMonth() + 1);
    var label = 'PENDING';
    if (reason) label += ' - ' + reason;
    if (notes)  label += ' | ' + notes;
    if (tujuan) label += ' | Tujuan: ' + tujuan;
    label += ' | ' + waktu;
    sheet.getRange(row, 10).setValue(label); // J = STATUS
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Hapus/reset status PENDING di kolom J (saat pending dibatalkan
//  atau sudah dikirim ? agar baris bersih kembali)
// ================================================================
function clearStatusPending(row) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var cur   = String(sheet.getRange(row, 10).getValue() || '').trim();
    // Hanya hapus jika isinya PENDING (jangan hapus BATAL atau TERKIRIM)
    if (cur.indexOf('PENDING') === 0) {
      sheet.getRange(row, 10).setValue('');
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Simpan status TERKIRIM / GAGAL kirim ke kolom J sheet PENGIRIMAN.
//  Dipanggil dari residance_time.html setelah checker menandai
//  kiriman sudah sampai tujuan (TERKIRIM) atau gagal dikirim (GAGAL).
//  `label` sudah dirakit lengkap di sisi frontend, mis:
//    "TERKIRIM - 14:30 | catatan opsional"
//    "GAGAL - alasan | catatan opsional"
// ================================================================
function setStatusTerkirim(row, label) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    sheet.getRange(row, 10).setValue(label); // J = STATUS
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function _fmtYMD(d) {
  return d.getFullYear() + '-' + _pad2(d.getMonth()+1) + '-' + _pad2(d.getDate());
}
function _fmtShort(d) {
  var nm = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  return _pad2(d.getDate()) + ' ' + nm[d.getMonth()];
}
function _fmtTime(val) {
  if (!val) return '';
  if (val instanceof Date) return _pad2(val.getHours()) + ':' + _pad2(val.getMinutes());
  var s = String(val).trim();
  if (!s) return '';
  var n = parseFloat(s);
  if (!isNaN(n) && n > 0 && n < 1) {
    var totalMin = Math.round(n * 24 * 60);
    return _pad2(Math.floor(totalMin/60)) + ':' + _pad2(totalMin % 60);
  }
  return s;
}
function _pad2(n) { return n < 10 ? '0'+n : ''+n; }

// ================================================================
//  KONFIGURASI
// ================================================================
var SPREADSHEET_ID = '1ZlcBhPQJpMFG4-Phwv1VCldIA4VXImzGgltj3ihR33c';
var SH_STOCK       = 'DASHBOARD_STOCK';
var SH_KIRIM       = 'DASHBOARD_KIRIM';
var SH_PRODUKSI    = 'DASHBOARD_PRODUKSI';

// Drawing values di kolom I DASHBOARD_STOCK
var DRAW_PIPA_GREEN    = 'PIPA PPR KELEN GREEN';
var DRAW_PIPA_GREY     = 'PIPA PPR KELEN GREY';
var DRAW_FITTING_GREEN = 'FITTING PPR KELEN GREEN';
var DRAW_FITTING_GREY  = 'FITTING PPR KELEN GREY';

// ================================================================
//  INDEKS KOLOM DASHBOARD_STOCK (0-based):
//    A(0)=Item Number | B(1)=Site | C(2)=Unit | D(3)=Group
//    E(4)=Description | F(5)=Description2
//    G(6)=Stock Pcs | H(7)=Stock Tonnase | I(8)=Drawing | J(9)=TANGGAL
//
//  DASHBOARD_KIRIM / DASHBOARD_PRODUKSI:
//    A(0)=Item Number | B(1)=Drawing code | C(2)=Description
//    D(3)=Description2 | E(4)=Effective Date | F(5)=Total Weight
// ================================================================

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ================================================================
//  MAIN ? dipanggil frontend untuk data STOCK + FastMoving
//  (outbound & inbound kini punya fungsi terpisah di bawah)
// ================================================================
function getDashboardData(mode, params) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var range = getDateRange(mode, params);
    var group = (params && params.group) ? String(params.group).trim().toUpperCase() : '';

    var stock = getStockData(ss, range, group);

    // FALLBACK: jika filter harian dan stock kosong, mundur 1 hari per hari (max 7 hari)
    if (mode === 'harian' && params && params.dari && params.dari === params.sampai
        && stock.globalTonase === 0) {
      var tglBase = parseYMD(params.dari);
      for (var fb = 1; fb <= 7; fb++) {
        var tglFb = new Date(tglBase);
        tglFb.setDate(tglFb.getDate() - fb);
        var fbStr = tglFb.getFullYear()+'-'+pad2(tglFb.getMonth()+1)+'-'+pad2(tglFb.getDate());
        var fbRange = {
          dari   : tglFb,
          sampai : new Date(tglFb.getFullYear(), tglFb.getMonth(), tglFb.getDate(), 23,59,59,999),
          label  : fmtD(tglFb) + ' (data terakhir tersedia)'
        };
        var fbStock = getStockData(ss, fbRange, group);
        if (fbStock.globalTonase > 0) {
          stock = fbStock;
          range.label = fbRange.label;
          break;
        }
      }
    }

    var fastMoving = getFastMoving(ss, range, group);

    // Tetap kirim outbound & inbound agar backward-compatible
    var outbound = getKirimData(ss, range);
    var inbound  = getProduksiData(ss, range);

    return {
      success    : true,
      label      : range.label,
      stock      : stock,
      outbound   : outbound,
      inbound    : inbound,
      fastMoving : fastMoving
    };
  } catch (err) {
    return { success: false, error: err.message + '\n' + err.stack };
  }
}

// ================================================================
//  getOutboundData ? dipanggil filter IO Outbound (terpisah)
//  params: { semua:true } | { dari, sampai } | { bulan, tahun } | { tahun }
// ================================================================
function getOutboundData(params) {
  try {
    var ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
    var range      = buildIODateRange(params);
    var data       = readTransaksi(ss, SH_KIRIM, range);
    var fastMoving = getFastMoving(ss, range, '');
    return {
      success    : true,
      outbound   : data,
      total      : data.total,
      pipa       : data.pipa,
      fitting    : data.fitting,
      trend      : data.trend,
      fastMoving : fastMoving
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  getInboundData ? dipanggil filter IO Inbound (terpisah)
//  Default semua data (params.semua = true)
// ================================================================
function getInboundData(params) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var range = buildIODateRange(params);
    var data  = readTransaksi(ss, SH_PRODUKSI, range);

    // Fast Moving ikut filter inbound (range yang sama, dari DASHBOARD_KIRIM)
    var fastMoving = getFastMovingByRange(ss, range);

    return {
      success    : true,
      inbound    : data,
      total      : data.total,
      pipa       : data.pipa,
      fitting    : data.fitting,
      trend      : data.trend,
      fastMoving : fastMoving
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Ambil daftar Group unik dari kolom D DASHBOARD_STOCK
// ================================================================
// ================================================================
//  BATCH untuk grafik tren N bulan (dipanggil dari wh_control_tower.html)
//  ------------------------------------------------------------
//  Sebelumnya frontend memanggil getDashboardData/getOutboundData/
//  getInboundData SATU PER SATU untuk tiap bulan (6 bulan x sampai
//  3 fungsi = belasan panggilan HTTP terpisah ke Apps Script tiap
//  refresh -> ini penyebab utama refresh Control Tower lambat).
//  Fungsi di bawah menggabungkan semuanya jadi SATU panggilan HTTP;
//  logic penghitungannya tetap reuse fungsi asli yang sudah teruji,
//  cuma dieksekusi berturut-turut di server (jauh lebih cepat
//  daripada bolak-balik HTTP per bulan).
// ================================================================
function getStockTrendBatch(monthsList) {
  try {
    var out = [];
    for (var i = 0; i < monthsList.length; i++) {
      out.push(getDashboardData('bulanan', { bulan: monthsList[i].bulan, tahun: monthsList[i].tahun }));
    }
    return { success: true, results: out };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getIOTrendBatch(monthsList) {
  try {
    var out = [];
    for (var i = 0; i < monthsList.length; i++) {
      var m = monthsList[i];
      out.push({
        out: getOutboundData({ bulan: m.bulan, tahun: m.tahun }),
        in : getInboundData({ bulan: m.bulan, tahun: m.tahun })
      });
    }
    return { success: true, results: out };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function getGroupList() {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_STOCK);
    if (!sheet) return { success: true, groups: [] };
    var data   = sheet.getDataRange().getValues();
    var seen   = {};
    var groups = [];
    for (var i = 1; i < data.length; i++) {
      var g = String(data[i][3] || '').trim(); // kolom D = Group
      if (g && !seen[g.toUpperCase()]) {
        seen[g.toUpperCase()] = true;
        groups.push(g);
      }
    }
    groups.sort();
    return { success: true, groups: groups };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  HELPER: date range untuk filter STOCK utama
// ================================================================
function getDateRange(mode, params) {
  var NM = ['','Januari','Februari','Maret','April','Mei','Juni',
             'Juli','Agustus','September','Oktober','November','Desember'];
  var dari, sampai, label;
  if (mode === 'harian') {
    dari   = parseYMD(params.dari);
    sampai = parseYMD(params.sampai);
    sampai.setHours(23,59,59,999);
    label  = (params.dari === params.sampai) ? fmtD(dari) : (fmtD(dari) + ' - ' + fmtD(sampai));
  } else if (mode === 'bulanan') {
    var b = parseInt(params.bulan), t = parseInt(params.tahun);
    dari   = new Date(t, b-1, 1);
    sampai = new Date(t, b, 0, 23, 59, 59, 999);
    label  = NM[b] + ' ' + t;
  } else {
    var t = parseInt(params.tahun);
    dari   = new Date(t, 0, 1, 0, 0, 0, 0);
    sampai = new Date(t, 11, 31, 23, 59, 59, 999);
    label  = 'Tahun ' + t;
  }
  return { dari: dari, sampai: sampai, label: label };
}

// ================================================================
//  HELPER: date range untuk filter IO (Outbound / Inbound)
//  Mendukung mode: semua / harian / bulanan / tahunan
// ================================================================
function buildIODateRange(params) {
  var NM = ['','Januari','Februari','Maret','April','Mei','Juni',
             'Juli','Agustus','September','Oktober','November','Desember'];

  // Mode SEMUA ? rentang sangat lebar
  if (!params || params.semua) {
    return {
      dari   : new Date(2000, 0, 1),
      sampai : new Date(2099, 11, 31, 23, 59, 59, 999),
      label  : 'Semua Data'
    };
  }

  // Mode HARIAN
  if (params.dari && params.sampai) {
    var dari   = parseYMD(params.dari);
    var sampai = parseYMD(params.sampai);
    sampai.setHours(23, 59, 59, 999);
    return { dari: dari, sampai: sampai, label: fmtD(dari)+' - '+fmtD(sampai) };
  }

  // Mode BULANAN
  if (params.bulan && params.tahun) {
    var b = parseInt(params.bulan), t = parseInt(params.tahun);
    return {
      dari   : new Date(t, b-1, 1),
      sampai : new Date(t, b, 0, 23, 59, 59, 999),
      label  : NM[b] + ' ' + t
    };
  }

  // Mode TAHUNAN
  if (params.tahun) {
    var t = parseInt(params.tahun);
    return {
      dari   : new Date(t, 0, 1, 0, 0, 0, 0),
      sampai : new Date(t, 11, 31, 23, 59, 59, 999),
      label  : 'Tahun ' + t
    };
  }

  // Fallback: awal bulan ini s/d hari ini
  var now = new Date();
  return {
    dari   : new Date(now.getFullYear(), now.getMonth(), 1),
    sampai : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
    label  : '01/'+pad2(now.getMonth()+1)+'/'+now.getFullYear()+' - '+fmtD(now)
  };
}

// ================================================================
//  HELPERS UMUM
// ================================================================
function parseYMD(str) { var p=str.split('-'); return new Date(+p[0],+p[1]-1,+p[2]); }
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  var d = new Date(v); return isNaN(d) ? null : d;
}
function fmtD(d) { return pad2(d.getDate())+'/'+pad2(d.getMonth()+1)+'/'+d.getFullYear(); }
function pad2(n) { return n < 10 ? '0'+n : ''+n; }
function inRange(tgl, range) { return tgl >= range.dari && tgl <= range.sampai; }
function normStr(v) { return String(v||'').trim().toUpperCase(); }

// ================================================================
//  Kategori berdasarkan Drawing kolom I (DASHBOARD_STOCK)
// ================================================================
function getKategoriStock(drawingVal) {
  var d = normStr(drawingVal);
  if (d === DRAW_PIPA_GREEN.toUpperCase())    return 'pipaGreen';
  if (d === DRAW_PIPA_GREY.toUpperCase())     return 'pipaGrey';
  if (d === DRAW_FITTING_GREEN.toUpperCase()) return 'fittingGreen';
  if (d === DRAW_FITTING_GREY.toUpperCase())  return 'fittingGrey';
  return null;
}

// ================================================================
//  Kategori dari Description kolom C/D (DASHBOARD_KIRIM/PRODUKSI)
// ================================================================
function getKategoriTransaksi(descC, descD) {
  var desc = normStr(descC) + ' ' + normStr(descD);
  var fittingKw = ['ELBOW','REDUC','EQUAL','COUPL','COUP','VALVE','SOCK','UNION',
                   'FEMALE','MALE','TEE','CAP','FITTING','STRAIGHT',
                   'KELEN REDU','KLN REDU','KELEN EQUA','KLN EQUA',
                   'KELEN ELBO','KLN ELBO','KELEN COUP','KLN COUP',
                   'KELEN STRA','KLN STRA','WAY VALVE','RUCIKA KLN'];
  var isFitting = fittingKw.some(function(k){ return desc.indexOf(k) !== -1; });
  var isPipa    = !isFitting && (desc.indexOf('PIPE') !== -1 || desc.indexOf('PIPA') !== -1);
  if (!isPipa && !isFitting) return null;
  var isGreen = desc.indexOf('GREEN') !== -1;
  var isGrey  = desc.indexOf('GREY') !== -1 || desc.indexOf('GRAY') !== -1;
  if (!isGreen && !isGrey) isGreen = true;
  if (isPipa)    return isGreen ? 'pipaGreen'    : 'pipaGrey';
  if (isFitting) return isGreen ? 'fittingGreen' : 'fittingGrey';
  return null;
}
function getKategoriTransaksiV2(drawKode, descC, descD) {
  var fromDesc = getKategoriTransaksi(descC, descD);
  if (fromDesc) return fromDesc;
  var kode = normStr(drawKode);
  if (kode.indexOf('PIPA') !== -1 || kode.indexOf('PIPE') !== -1)
    return kode.indexOf('GREY') !== -1 ? 'pipaGrey' : 'pipaGreen';
  if (kode.indexOf('FITTING') !== -1)
    return kode.indexOf('GREY') !== -1 ? 'fittingGrey' : 'fittingGreen';
  return null;
}

// ================================================================
//  1. STOCK DATA ? DASHBOARD_STOCK
// ================================================================
function getStockData(ss, range, group) {
  var sheet = ss.getSheetByName(SH_STOCK);
  var out = {
    globalTonase : 0,   // total semua item dalam rentang (tanpa filter group)
    groupTonase  : 0,   // total item dalam rentang + filter group (= globalTonase jika group kosong)
    tonase : { pipaGreen:0, pipaGrey:0, fittingGreen:0, fittingGrey:0, total:0 },
    stok   : { pipaGreen:0, pipaGrey:0, fittingGreen:0, fittingGrey:0, total:0 }
  };
  if (!sheet) return out;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row  = data[i];
    var tgl  = toDate(row[9]);
    if (!tgl || !inRange(tgl, range)) continue;

    var tonnaseH = parseFloat(row[7]) || 0;
    out.globalTonase += tonnaseH;  // selalu akumulasi semua (tidak filter group)

    // Filter group jika ada (kolom D)
    if (group) {
      var rowGroup = normStr(row[3]);
      if (rowGroup !== group) continue;
    }

    // Baris ini lolos filter group (atau tidak ada filter)
    out.groupTonase += tonnaseH;

    var kat = getKategoriStock(row[8]);
    if (!kat) continue;

    var pcs = parseFloat(row[6]) || 0;
    out.tonase[kat] += tonnaseH;
    out.stok[kat]   += pcs;
  }

  out.tonase.total = out.tonase.pipaGreen + out.tonase.pipaGrey
                   + out.tonase.fittingGreen + out.tonase.fittingGrey;
  out.stok.total   = out.stok.pipaGreen + out.stok.pipaGrey
                   + out.stok.fittingGreen + out.stok.fittingGrey;
  return out;
}
// ================================================================
//  2. OUTBOUND ? DASHBOARD_KIRIM (wrapper lama, tetap ada)
// ================================================================
function getKirimData(ss, range) {
  return readTransaksi(ss, SH_KIRIM, range);
}

// ================================================================
//  3. INBOUND ? DASHBOARD_PRODUKSI (wrapper lama, tetap ada)
// ================================================================
function getProduksiData(ss, range) {
  return readTransaksi(ss, SH_PRODUKSI, range);
}

function readTransaksi(ss, sheetName, range) {
  var sheet = ss.getSheetByName(sheetName);
  var out = { total:0, pipa:0, fitting:0, pipaGreen:0, pipaGrey:0,
              fittingGreen:0, fittingGrey:0, trend:[] };
  if (!sheet) return out;
  var data     = sheet.getDataRange().getValues();
  var trendMap = {};
  for (var i = 1; i < data.length; i++) {
    var row    = data[i];
    var tgl    = toDate(row[4]);
    if (!tgl || !inRange(tgl, range)) continue;
    var weight = parseFloat(row[5]) || 0;
    var kat    = getKategoriTransaksiV2(row[1], row[2], row[3]);
    if (!kat) continue;
    out.total  += weight;
    out[kat]   += weight;
    if (kat === 'pipaGreen'    || kat === 'pipaGrey')    out.pipa    += weight;
    if (kat === 'fittingGreen' || kat === 'fittingGrey') out.fitting += weight;
    var key = fmtD(tgl);
    if (!trendMap[key]) trendMap[key] = { label:key, pipa:0, fitting:0 };
    if (kat === 'pipaGreen'    || kat === 'pipaGrey')    trendMap[key].pipa    += weight;
    if (kat === 'fittingGreen' || kat === 'fittingGrey') trendMap[key].fitting += weight;
  }
  out.trend = Object.values(trendMap).sort(function(a,b){ return a.label<b.label?-1:1; });
  if (out.trend.length > 6) out.trend = out.trend.slice(-6);
  return out;
}

// ================================================================
//  4. FAST MOVING - DASHBOARD_KIRIM (col A=Item Number, col F=Total Weight, col G=Description)
//  Versi lama - dipanggil dari getDashboardData (ikut filter stock, sebagai fallback)
// ================================================================
function getFastMoving(ss, range, group) {
  return getFastMovingByRange(ss, range);
}

// ================================================================
//  4b. FAST MOVING BY RANGE - dipanggil dari getInboundData
//  Membaca DASHBOARD_KIRIM: col A=Item Number, col G=Description, col F=Total Weight
//  Mengembalikan array gabungan Pipa + Fitting top-5 each, sudah ditandai jenis-nya
// ================================================================
function getFastMovingByRange(ss, range) {
  var sheet = ss.getSheetByName(SH_KIRIM);
  if (!sheet) return [];
  var data    = sheet.getDataRange().getValues();
  var itemMap = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var tgl = toDate(row[4]); // col E = Effective Date
    if (!tgl || !inRange(tgl, range)) continue;
    var kat = getKategoriTransaksiV2(row[1], row[2], row[3]);
    if (!kat) continue;
    var kode = String(row[0] || '').trim();
    // col G = Description lengkap (index 6), fallback ke col D, C, atau kode
    var nama = String(row[6] || '').trim()
             || String(row[3] || '').trim()
             || String(row[2] || '').trim()
             || kode;
    var ton  = Math.abs(parseFloat(row[5]) || 0); // col F = Total Weight
    if (!kode || ton === 0) continue;
    if (!itemMap[kode]) {
      itemMap[kode] = {
        kode  : kode,
        nama  : nama,
        jenis : (kat === 'pipaGreen' || kat === 'pipaGrey') ? 'Pipa' : 'Fitting',
        kat   : kat,
        tonase: 0
      };
    }
    itemMap[kode].tonase += ton;
  }
  var all = Object.values(itemMap).sort(function(a, b) { return b.tonase - a.tonase; });
  // Top 5 Pipa + Top 5 Fitting
  var pipa    = all.filter(function(x){ return x.jenis === 'Pipa';    }).slice(0, 5);
  var fitting = all.filter(function(x){ return x.jenis === 'Fitting'; }).slice(0, 5);
  return pipa.concat(fitting);
}

// ================================================================
//  5. KANBAN DASHBOARD ? DASHBOARD_STOCK
//  Pipa   : Group I053, kapasitas = kolom R (Konversi_rak)       index17, max 204 rak
//           Selisih = kolom R (Konversi_rak) - kolom U (kanban_rak)        index20
//  Fitting: Group Q055, kapasitas = kolom M (KONVERSI BOX FITTING) index12, max 23748 box
//           Selisih = kolom M (KONVERSI BOX FITTING) - kolom K (KANBAN FITTING PPR) index10
//  Status : kolom T (status) index19 -> 'CUKUP' / 'KURANG'
// ================================================================
var GROUP_KANBAN_PIPA    = 'I053';
var GROUP_KANBAN_FITTING = 'Q055';
var MAX_KANBAN_PIPA      = 204;
var MAX_KANBAN_FITTING   = 23748;
var NM_BULAN = ['','Januari','Februari','Maret','April','Mei','Juni',
                'Juli','Agustus','September','Oktober','November','Desember'];

function getKanbanData(mode, params) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var range = getDateRange(mode, params);
    var sheet = ss.getSheetByName(SH_STOCK);
    var out = { success: true, label: range.label, pipa: [], fitting: [], trend: [], trendFitting: [] };
    if (!sheet) return out;

    var data = sheet.getDataRange().getValues();

    // --- Daftar item (mengikuti filter periode yang dipilih user) ---
    for (var i = 1; i < data.length; i++) {
      var row   = data[i];
      var tgl   = toDate(row[9]);                 // J = TANGGAL
      if (!tgl || !inRange(tgl, range)) continue;

      var group  = normStr(row[3]);                // D = Group
      var status = normStr(row[19]) || 'CUKUP';     // T = status

      if (group === GROUP_KANBAN_PIPA) {
        var stokPipa = parseFloat(row[6]) || 0;     // G = Stock Pcs
        if (stokPipa === 0) continue;               // skip item dengan stok 0
        var rak       = parseFloat(row[17]) || 0;   // R = Konversi_rak
        var kanbanRak = parseFloat(row[20]) || 0;    // U = kanban_rak
        out.pipa.push({
          kode        : String(row[0] || '').trim(),
          nama        : String(row[5] || '').trim(), // F = Description
          stok        : stokPipa,
          rakTerpakai : rak,
          selisih     : rak - kanbanRak,
          status      : status
        });

      } else if (group === GROUP_KANBAN_FITTING) {
        var stokFitting = parseFloat(row[6]) || 0;
        if (stokFitting === 0) continue;            // skip item dengan stok 0
        var box           = parseFloat(row[12]) || 0; // M = KONVERSI BOX FITTING
        var kanbanFitting = parseFloat(row[10]) || 0;  // K = KANBAN FITTING PPR
        out.fitting.push({
          kode        : String(row[0] || '').trim(),
          nama        : String(row[5] || '').trim(), // F = Description
          stok        : stokFitting,
          rakTerpakai : box,
          selisih     : box - kanbanFitting,
          status      : status
        });
      }
    }

    // --- Tren penggunaan (perkembangan per periode) ---
    // Diambil dari SELURUH histori kolom TANGGAL (tidak dibatasi filter di atas),
    // dikelompokkan otomatis sesuai mode yang aktif:
    //   harian  -> per hari (6 hari terakhir yang ada datanya)
    //   bulanan -> per bulan (6 bulan terakhir)
    //   tahunan -> per tahun (6 tahun terakhir)
    out.trend        = buildKanbanTrend(data, GROUP_KANBAN_PIPA, 17, mode);    // kolom R
    out.trendFitting = buildKanbanTrend(data, GROUP_KANBAN_FITTING, 12, mode); // kolom M

    return out;
  } catch (err) {
    return { success: false, error: err.message + '\n' + err.stack };
  }
}

// ================================================================
//  HELPER: bangun tren per periode (hari/bulan/tahun) dari seluruh
//  histori sheet DASHBOARD_STOCK untuk 1 group kanban tertentu.
// ================================================================
function buildKanbanTrend(data, groupCode, valueColIndex, mode) {
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var tgl = toDate(row[9]);                 // J = TANGGAL
    if (!tgl) continue;
    if (normStr(row[3]) !== groupCode) continue;

    var val = parseFloat(row[valueColIndex]) || 0;
    var key, label;
    if (mode === 'bulanan') {
      key   = tgl.getFullYear() + '-' + pad2(tgl.getMonth()+1);
      label = NM_BULAN[tgl.getMonth()+1] + ' ' + tgl.getFullYear();
    } else if (mode === 'tahunan') {
      key   = String(tgl.getFullYear());
      label = 'Tahun ' + tgl.getFullYear();
    } else {
      key   = tgl.getFullYear() + '-' + pad2(tgl.getMonth()+1) + '-' + pad2(tgl.getDate());
      label = fmtD(tgl);
    }

    if (!map[key]) map[key] = { label: label, rakTerpakai: 0 };
    map[key].rakTerpakai += val;
  }

  var keys = Object.keys(map).sort();
  if (keys.length > 6) keys = keys.slice(-6);
  return keys.map(function(k){ return map[k]; });
}

// ================================================================
//  DEBUG
// ================================================================
function debugCekData() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var msg = '=== CEK DATA ===\n\n';
  var shStock = ss.getSheetByName(SH_STOCK);
  if (shStock) {
    var data = shStock.getDataRange().getValues();
    msg += 'DASHBOARD_STOCK: ' + (data.length-1) + ' baris\n';
    var groups = {}, draws = {};
    for (var i = 1; i < Math.min(data.length, 101); i++) {
      var g = String(data[i][3] || '').trim(); if (g) groups[g] = (groups[g]||0)+1;
      var d = String(data[i][8] || '').trim(); if (d) draws[d]  = (draws[d] ||0)+1;
    }
    msg += 'GROUP (kolom D): ' + JSON.stringify(groups) + '\n';
    msg += 'DRAWING (kolom I): ' + JSON.stringify(draws) + '\n\n';
  }
  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}

// ================================================================
//  REKAP MUATAN - Monitoring Tonase Persiapan per PIC
// ================================================================
function getRekapMuatanData(params) {
  try {
    var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
    var mode = 'bulanan'; // hanya bulanan

    // ---- Build date range ----
    var range = buildRekapDateRange(params);

    // ---- PIC config ----
    var PIC_LIST    = ['DONI','IMAN','SAEPUL','SULIS','WANG'];
    var HAS_PIPA    = { DONI:true, IMAN:true, SAEPUL:true,  SULIS:true,  WANG:false };
    var HAS_FITTING = { DONI:true, IMAN:true, SAEPUL:false, SULIS:false, WANG:true  };

    // ---- Init data per PIC ----
    var picPipa    = {}; // pipa kg per PIC
    var picFitting = {}; // fitting Box per PIC
    var pipaHarian = {}; // {PIC: {dateKey: kg}}
    var fitHarian  = {}; // {PIC: {dateKey: box}}
    PIC_LIST.forEach(function(p){
      picPipa[p]=0; picFitting[p]=0; pipaHarian[p]={}; fitHarian[p]={};
    });

    // ---- Baca REKAP MUATAN (Pipa): B=Tanggal, C=PIC, D=Total Berat ----
    var shMuat = ss.getSheetByName(SH_REKAP_MUATAN);
    if (shMuat) {
      var dm = shMuat.getDataRange().getValues();
      for (var i=1; i<dm.length; i++) {
        var row=dm[i];
        var tgl=toDate(row[1]);
        var pic=String(row[2]||'').trim().toUpperCase();
        var kg =parseFloat(row[3])||0;
        if (!tgl||!kg) continue;
        if (range&&!inRange(tgl,range)) continue;
        var dk=fmtD(tgl);
        var entries=normalizePIC(pic,kg);
        entries.forEach(function(e){
          var p=e.pic, v=e.kg;
          picPipa[p]=(picPipa[p]||0)+v;
          if(!pipaHarian[p]) pipaHarian[p]={};
          pipaHarian[p][dk]=(pipaHarian[p][dk]||0)+v;
        });
      }
    }

    // ---- Baca REKAP MUATAN FITTING: B=Tanggal, C=PIC, D=Total Box ----
    var shFit = ss.getSheetByName(SH_REKAP_FITTING);
    if (shFit) {
      var df = shFit.getDataRange().getValues();
      for (var j=1; j<df.length; j++) {
        var rowF=df[j];
        var tglF=toDate(rowF[1]);
        var picF=String(rowF[2]||'').trim().toUpperCase();
        var box =parseFloat(rowF[3])||0;
        if (!tglF||!box) continue;
        if (range&&!inRange(tglF,range)) continue;
        var dkF=fmtD(tglF);
        var entriesF=normalizePICFitting(picF,box);
        entriesF.forEach(function(e){
          var p=e.pic, v=e.box;
          picFitting[p]=(picFitting[p]||0)+v;
          if(!fitHarian[p]) fitHarian[p]={};
          fitHarian[p][dkF]=(fitHarian[p][dkF]||0)+v;
        });
      }
    }

    // ---- Tonase Kiriman PIPA dari DASHBOARD_KIRIM ----
    // Gunakan readTransaksi (sama dengan kalkulasi outbound di dashboard stock)
    // sehingga angka sync: kiriman pipa = outbound pipa di dashboard
    var kirimData = readTransaksi(ss, SH_KIRIM, range);
    var totalKiriman = kirimData.pipa || 0;   // hanya pipa (pipaGreen + pipaGrey)
    var totalKirimanFitting = kirimData.fitting || 0; // fitting untuk referensi Wang

    // Sisa = totalKiriman - totalSaepul - totalSulis
    // Sisa SELALU dibagi 2 ke DONI dan IMAN (input sendiri + sisa), agar total DONI+IMAN = totalKiriman-SS
    var totalSS  = (picPipa['SAEPUL']||0) + (picPipa['SULIS']||0);
    var sisaDS   = Math.max(0, totalKiriman - totalSS); // porsi DONI+IMAN dari total kiriman
    // Distribusi: input masing2 + sisa merata
    var inputDI  = (picPipa['DONI']||0) + (picPipa['IMAN']||0);
    var extraDI  = Math.max(0, sisaDS - inputDI); // tambahan jika sisa > input
    picPipa['DONI'] = (picPipa['DONI']||0) + extraDI/2;
    picPipa['IMAN'] = (picPipa['IMAN']||0) + extraDI/2;

    // ---- Distribusi "sisa" DONI+IMAN ke tren HARIAN ----
    // DONI/IMAN tidak dicatat per baris tanggal seperti SAEPUL/SULIS,
    // jadi tidak tahu porsi "sisa" itu terjadi di tanggal berapa saja.
    // Supaya grafik tren tidak flat 0 untuk mereka (padahal totalnya
    // bulanan sudah benar), porsi itu didistribusikan proporsional
    // mengikuti pola kiriman pipa harian dari DASHBOARD_KIRIM — hari
    // dengan kiriman lebih besar dapat porsi lebih besar juga. Ini
    // TIDAK mengubah total bulanan (picPipa), cuma isi breakdown
    // harian (pipaHarian) untuk keperluan chart.
    if (extraDI > 0) {
      var kirimHarian = {};
      var shKirimHar = ss.getSheetByName(SH_KIRIM);
      if (shKirimHar) {
        var dkH = shKirimHar.getDataRange().getValues();
        for (var h = 1; h < dkH.length; h++) {
          var rowH = dkH[h];
          var tglH = toDate(rowH[4]);
          if (!tglH || !inRange(tglH, range)) continue;
          var katH = getKategoriTransaksiV2(rowH[1], rowH[2], rowH[3]);
          if (katH !== 'pipaGreen' && katH !== 'pipaGrey') continue;
          var wH = parseFloat(rowH[5]) || 0;
          var dkeyH = fmtD(tglH);
          kirimHarian[dkeyH] = (kirimHarian[dkeyH] || 0) + wH;
        }
      }
      var totalKirimHarianSum = Object.keys(kirimHarian).reduce(function(a, k) { return a + kirimHarian[k]; }, 0);
      if (totalKirimHarianSum > 0) {
        Object.keys(kirimHarian).forEach(function(dk) {
          var portion = extraDI * (kirimHarian[dk] / totalKirimHarianSum); // gabungan DONI+IMAN hari itu
          pipaHarian['DONI'][dk] = (pipaHarian['DONI'][dk] || 0) + portion / 2;
          pipaHarian['IMAN'][dk] = (pipaHarian['IMAN'][dk] || 0) + portion / 2;
        });
      }
    }

    // ---- Build trend labels (gabungan semua tanggal) ----
    var allDates={};
    PIC_LIST.forEach(function(p){
      Object.keys(pipaHarian[p]||{}).forEach(function(d){allDates[d]=1;});
      Object.keys(fitHarian[p]||{}).forEach(function(d){allDates[d]=1;});
    });
    var sortedDates=Object.keys(allDates).sort();
    if(sortedDates.length>20) sortedDates=sortedDates.slice(-20);

    // ---- Build output per PIC ----
    var picsOut={};
    PIC_LIST.forEach(function(p){
      picsOut[p]={
        pipa       : picPipa[p]||0,
        fitting    : picFitting[p]||0,
        pipaHarian : sortedDates.map(function(d){ return pipaHarian[p][d]||0; }),
        fittingHarian: sortedDates.map(function(d){ return fitHarian[p][d]||0; })
      };
    });

    var totalPipa    = PIC_LIST.reduce(function(a,p){ return a+(picPipa[p]||0); },0);
    var totalFitting = PIC_LIST.reduce(function(a,p){ return a+(picFitting[p]||0); },0);
    var bNames=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    var bIdx=parseInt(params&&params.bulan?params.bulan:new Date().getMonth()+1,10)-1;
    var periodeLabel=bNames[bIdx]+' '+(params&&params.tahun?params.tahun:new Date().getFullYear());

    return {
      success             : true,
      periodeLabel        : periodeLabel,
      totalPipa           : totalPipa,
      totalFitting        : totalFitting,
      totalKiriman        : totalKiriman,        // pipa saja (sync dgn outbound pipa dashboard)
      totalKirimanFitting : totalKirimanFitting, // fitting saja (untuk referensi)
      totalKirimanAll     : (kirimData.total||0), // semua (pipa+fitting)
      pics                : picsOut,
      trendLabels         : sortedDates
    };
  } catch(err) {
    return { success: false, error: err.message };
  }
}

// Normalisasi PIC untuk PIPA
function normalizePIC(pic, kg) {
  var p = pic.toUpperCase().replace(/\s*[&+,\/]\s*/g,'/').replace(/\s+/g,'');
  if (p==='DONI/IMAN'||p==='IMAN/DONI') return [{pic:'DONI',kg:kg/2},{pic:'IMAN',kg:kg/2}];
  if (p==='SAEPUL/SULIS'||p==='SULIS/SAEPUL') return [{pic:'SAEPUL',kg:kg/2},{pic:'SULIS',kg:kg/2}];
  if (p==='DONI')   return [{pic:'DONI',  kg:kg}];
  if (p==='IMAN')   return [{pic:'IMAN',  kg:kg}];
  if (p==='SAEPUL') return [{pic:'SAEPUL',kg:kg}];
  if (p==='SULIS')  return [{pic:'SULIS', kg:kg}];
  // Default (WANG atau tidak dikenal) ? skip untuk pipa
  return [];
}

// Normalisasi PIC untuk FITTING
function normalizePICFitting(pic, box) {
  var p = pic.toUpperCase().replace(/\s*[&+,\/]\s*/g,'/').replace(/\s+/g,'');
  if (p==='DONI/IMAN'||p==='IMAN/DONI') return [{pic:'DONI',box:box/2},{pic:'IMAN',box:box/2}];
  if (p==='DONI')  return [{pic:'DONI', box:box}];
  if (p==='IMAN')  return [{pic:'IMAN', box:box}];
  if (p==='WANG'||p.indexOf('WANG')!==-1) return [{pic:'WANG',box:box}];
  if (p==='DONI&IMAN'||p==='IMAN&DONI') return [{pic:'DONI',box:box/2},{pic:'IMAN',box:box/2}];
  return [];
}

function buildRekapDateRange(params) {
  if (!params||params.mode==='semua') return null;
  var today=new Date(); today.setHours(0,0,0,0);
  if (params.mode==='bulanan'||params.bulan) {
    var b=parseInt(params.bulan||today.getMonth()+1,10)-1;
    var t=parseInt(params.tahun||today.getFullYear(),10);
    var dari=new Date(t,b,1,0,0,0,0);
    var sampai=new Date(t,b+1,0,23,59,59,999);
    return {dari:dari,sampai:sampai};
  }
  return null;
}

// ================================================================
//  FOTO PIC - Simpan ke Google Drive + URL di Sheet PIC_PHOTOS
//  Sheet PIC_PHOTOS: kolom A=PIC, B=DriveFileId, C=PublicUrl, D=DataUrl(backup)
// ================================================================
var SH_PIC_PHOTOS = 'PIC_PHOTOS';

function _getOrCreatePhotoSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_PIC_PHOTOS);
  if (!sh) {
    sh = ss.insertSheet(SH_PIC_PHOTOS);
    sh.getRange('A1:D1').setValues([['PIC','DriveFileId','PublicUrl','UpdatedAt']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function savePhoto(pic, dataUrl) {
  try {
    pic = String(pic || '').toUpperCase().trim();
    if (!pic || !dataUrl) return { success: false, error: 'Data tidak lengkap' };

    var sh = _getOrCreatePhotoSheet();
    var data = sh.getDataRange().getValues();

    // Cari baris yang sudah ada untuk PIC ini
    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').toUpperCase() === pic) { rowIdx = i + 1; break; }
    }

    // Simpan dataUrl ke Drive sebagai file gambar
    // Hapus file lama jika ada
    var oldFileId = rowIdx > 0 ? String(data[rowIdx-1][1] || '') : '';
    if (oldFileId) {
      try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch(e) {}
    }

    // Decode base64 dan buat file baru di Drive
    var mimeType = 'image/jpeg';
    var base64Data = dataUrl;
    if (dataUrl.indexOf(',') > -1) {
      var parts = dataUrl.split(',');
      var header = parts[0]; // "data:image/jpeg;base64"
      base64Data = parts[1];
      if (header.indexOf('png') > -1) mimeType = 'image/png';
      if (header.indexOf('webp') > -1) mimeType = 'image/webp';
    }

    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, 'foto_' + pic + '.' + (mimeType.split('/')[1]||'jpg'));
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileId = file.getId();

    // URL untuk tampil sebagai gambar (bukan download)
    var publicUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400';

    var timestamp = new Date().toISOString();
    if (rowIdx > 0) {
      sh.getRange(rowIdx, 1, 1, 4).setValues([[pic, fileId, publicUrl, timestamp]]);
    } else {
      sh.appendRow([pic, fileId, publicUrl, timestamp]);
    }

    return { success: true, url: publicUrl, fileId: fileId };
  } catch(err) {
    return { success: false, error: err.message };
  }
}

function getPhotos() {
  try {
    var sh = _getOrCreatePhotoSheet();
    var data = sh.getDataRange().getValues();
    var result = {};
    for (var i = 1; i < data.length; i++) {
      var pic = String(data[i][0] || '').toUpperCase().trim();
      var url = String(data[i][2] || '').trim(); // PublicUrl (Drive thumbnail)
      if (pic && url) result[pic] = url;
    }
    return { success: true, photos: result };
  } catch(err) {
    return { success: false, error: err.message };
  }
}

function deletePhoto(pic) {
  try {
    pic = String(pic || '').toUpperCase().trim();
    var sh = _getOrCreatePhotoSheet();
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').toUpperCase() === pic) {
        var fileId = String(data[i][1] || '');
        if (fileId) { try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {} }
        sh.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: true, message: 'Foto tidak ditemukan' };
  } catch(err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  SINKRONISASI KE SUPABASE (dijalankan 1x/hari lewat trigger)
// ------------------------------------------------------------
//  Menghitung data pakai fungsi yang SUDAH ADA (getDashboardData,
//  getKanbanData, getRekapMuatanData, dst — tidak ditulis ulang,
//  jadi hasilnya dijamin sama persis seperti yang biasa dikirim
//  ke browser), lalu simpan ke tabel `dashboard_snapshots` di
//  Supabase. Dashboard nanti baca dari Supabase dulu (cepat),
//  fallback ke Apps Script kalau snapshot yang dicari belum ada.
//
//  SETUP (WAJIB sebelum dipakai):
//  1. Jalankan supabase/schema.sql di SQL Editor Supabase.
//  2. Di Apps Script: Project Settings -> Script Properties ->
//     tambahkan 2 properti:
//       SUPABASE_URL          = https://xxxxx.supabase.co
//       SUPABASE_SERVICE_KEY  = (service_role key, BUKAN anon key —
//                                 ambil dari Supabase: Settings > API)
//     JANGAN taruh service_role key di kode / GitHub — service_role
//     bisa bypass semua RLS, jadi harus rahasia. Script Properties
//     aman karena tidak pernah ikut ter-commit ke Git.
//  3. Jalankan fungsi `setupDailySyncTrigger()` SEKALI SAJA secara
//     manual dari Apps Script editor (pilih fungsi ini di dropdown
//     lalu klik Run) untuk memasang jadwal harian otomatis.
//  4. (Opsional, buat tes pertama kali) jalankan `syncAllToSupabase()`
//     manual sekali supaya snapshot langsung terisi, tidak perlu
//     nunggu jadwal harian berikutnya.
// ================================================================

function setupDailySyncTrigger() {
  // Hapus trigger lama dengan nama fungsi yang sama (biar tidak dobel)
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncAllToSupabase') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncAllToSupabase')
    .timeBased()
    .everyDays(1)
    .atHour(0) // jam 00:xx (zona waktu project Apps Script)
    .create();
  Logger.log('Trigger harian syncAllToSupabase berhasil dipasang.');
}

function syncAllToSupabase() {
  var log = [];
  function put(key, payloadFn) {
    Logger.log('... menghitung ' + key);
    try {
      var payload = payloadFn();
      if (payload && payload.success === false) {
        log.push('SKIP ' + key + ' (hasil gagal: ' + payload.error + ')');
        Logger.log('SKIP ' + key + ': ' + payload.error);
        return;
      }
      _supabaseUpsertSnapshot(key, payload);
      log.push('OK   ' + key);
      Logger.log('OK   ' + key);
    } catch (err) {
      log.push('GAGAL ' + key + ': ' + err.message);
      Logger.log('GAGAL ' + key + ': ' + err.message);
    }
  }

  var now = new Date();
  var bulanIni = String(now.getMonth() + 1);
  var tahunIni = String(now.getFullYear());
  var todayStr = now.getFullYear() + '-' + _pad2(now.getMonth() + 1) + '-' + _pad2(now.getDate());

  // Daftar umum
  put('group_list', function () { return getGroupList(); });

  // ---- Tren 6 bulan terakhir DULUAN (dipakai juga buat data "bulan ini",
  // supaya tidak dihitung 2x — sebelumnya stock/outbound/inbound bulanan
  // dihitung ULANG padahal bulan ini sudah termasuk di tren 6 bulan.
  // Ini yang bikin sync lama & berisiko kena limit waktu eksekusi. ----
  var months6 = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months6.push({ bulan: String(d.getMonth() + 1), tahun: String(d.getFullYear()) });
  }
  var stockTrendResult = null, ioTrendResult = null;
  put('stock_trend:6mo', function () {
    stockTrendResult = getStockTrendBatch(months6);
    return stockTrendResult;
  });
  put('io_trend:6mo', function () {
    ioTrendResult = getIOTrendBatch(months6);
    return ioTrendResult;
  });

  // Stock dashboard bulanan bulan ini — ambil dari hasil tren 6 bulan
  // (index terakhir = bulan ini), tidak dihitung ulang.
  put('stock:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    if (stockTrendResult && stockTrendResult.success && stockTrendResult.results) {
      return stockTrendResult.results[stockTrendResult.results.length - 1];
    }
    return getDashboardData('bulanan', { bulan: bulanIni, tahun: tahunIni, group: '' }); // fallback kalau tren gagal
  });
  // Stock harian hari ini — TETAP dihitung sendiri (tren cuma bulanan, tidak ada versi harian)
  put('stock:harian:' + todayStr, function () {
    return getDashboardData('harian', { dari: todayStr, sampai: todayStr, group: '' });
  });

  // Outbound/Inbound bulan ini — ambil dari hasil tren 6 bulan juga
  put('outbound:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    if (ioTrendResult && ioTrendResult.success && ioTrendResult.results) {
      return ioTrendResult.results[ioTrendResult.results.length - 1].out;
    }
    return getOutboundData({ bulan: bulanIni, tahun: tahunIni });
  });
  put('inbound:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    if (ioTrendResult && ioTrendResult.success && ioTrendResult.results) {
      return ioTrendResult.results[ioTrendResult.results.length - 1].in;
    }
    return getInboundData({ bulan: bulanIni, tahun: tahunIni });
  });

  // Kanban (harian hari ini + bulanan bulan ini)
  put('kanban:harian:' + todayStr, function () {
    return getKanbanData('harian', { dari: todayStr, sampai: todayStr });
  });
  put('kanban:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    return getKanbanData('bulanan', { bulan: bulanIni, tahun: tahunIni });
  });

  // Rekap Muatan bulan ini
  put('rekap:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    return getRekapMuatanData({ mode: 'bulanan', bulan: bulanIni, tahun: tahunIni });
  });

  // Widget ringkasan "Loading Time Avg" di Control Tower (READ-ONLY,
  // bukan halaman Loading Time interaktif yang tetap real-time) — aman
  // di-precompute harian, ini yang sebelumnya bikin loading Control Tower
  // lambat karena selalu fallback ke Apps Script sendirian.
  put('residence_time:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    return getResidenceTimeData('bulan');
  });

  Logger.log(log.join('\n'));
  return log;
}

// Simpan/timpa satu snapshot ke Supabase (upsert berdasarkan snapshot_key)
function _supabaseUpsertSnapshot(key, payload) {
  var props   = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty('SUPABASE_URL');
  var svcKey  = props.getProperty('SUPABASE_SERVICE_KEY');
  if (!baseUrl || !svcKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY belum di-set di Script Properties');
  }

  var url = baseUrl.replace(/\/$/, '') + '/rest/v1/dashboard_snapshots?on_conflict=snapshot_key';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      apikey: svcKey,
      Authorization: 'Bearer ' + svcKey,
      Prefer: 'resolution=merge-duplicates'
    },
    payload: JSON.stringify([{
      snapshot_key: key,
      payload: payload,
      updated_at: new Date().toISOString()
    }]),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Supabase upsert gagal (' + code + '): ' + res.getContentText());
  }
}
