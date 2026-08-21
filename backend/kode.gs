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
  deletePhoto             : deletePhoto,
  // Modul Lembur & FTE
  getKaryawanList         : getKaryawanList,
  getKategoriLemburList   : getKategoriLemburList,
  getLemburKategoriBulanan: getLemburKategoriBulanan,
  getLemburKategoriTrend6Bulan: getLemburKategoriTrend6Bulan,
  getOvertimeTrend6Bulan  : getOvertimeTrend6Bulan,
  saveLembur              : saveLembur,
  getLemburList           : getLemburList,
  deleteLembur            : deleteLembur,
  submitEditLembur        : submitEditLembur,
  approveEditRequest      : approveEditRequest,
  getPendingApprovalCount : getPendingApprovalCount,
  saveAbsensi             : saveAbsensi,
  getAbsensiList          : getAbsensiList,
  deleteAbsensi           : deleteAbsensi,
  getAbsensiFTEData       : getAbsensiFTEData,
  exportSPL               : exportSPL,
  previewSPL              : previewSPL,
  // Multi-workspace (Plant & Departemen)
  loginUser               : loginUser,
  provisionDepartmentSpreadsheet: provisionDepartmentSpreadsheet,
  // Panel Admin — Manajemen User (tambah/reset password/nonaktifkan lewat web)
  getAkunList             : getAkunList,
  adminTambahUser         : adminTambahUser,
  adminResetPassword      : adminResetPassword,
  adminSetAktif           : adminSetAktif,
  adminEditUser           : adminEditUser,
  adminSetFonnteToken     : adminSetFonnteToken,
  adminGetFonnteStatus    : adminGetFonnteStatus,
  adminSetFonnteApproverWa: adminSetFonnteApproverWa,
  // Approval Lembur & Cuti + Tanda Tangan Digital TL
  getPendingApprovals     : getPendingApprovals,
  approveItem             : approveItem,
  editLemburByTL          : editLemburByTL,
  uploadTlSignature       : uploadTlSignature,
  hasTlSignature          : hasTlSignature,
  // Upload Data Harian (Stock / Outbound / Inbound)
  appendStockData         : appendStockData,
  clearStockDataForDate   : clearStockDataForDate,
  getSheetStats           : getSheetStats,
  appendOutboundData      : appendOutboundData,
  appendInboundData       : appendInboundData,
  manualSyncNow           : manualSyncNow
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
    var workspace = params.workspace || '';

    // Body POST (dipakai savePhoto) dikirim sebagai text/plain berisi
    // JSON {action, params} supaya browser tidak mengirim preflight CORS.
    if (e && e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        action = body.action || action;
        args   = body.params || [];
        workspace = body.workspace || workspace;
      } catch (parseErr) {
        // bukan JSON valid -> abaikan, tetap coba pakai query param di bawah
      }
    } else if (params.params) {
      args = JSON.parse(params.params);
    }

    // ---- Resolusi WORKSPACE (Plant + Departemen) -> SPREADSHEET_ID ----
    // Supaya 1 kode.gs ini bisa melayani banyak departemen/plant tanpa
    // perlu di-copy-paste berkali-kali: setiap request membawa parameter
    // "workspace" (mis. "cibitung_fitting_import"), lalu kita timpa
    // variabel global SPREADSHEET_ID SEBELUM fungsi action dipanggil.
    // Aman karena tiap request Web App = 1 eksekusi baru yang terpisah
    // (bukan proses yang dipakai bersama antar request).
    ACTIVE_WORKSPACE = resolveWorkspaceKey(workspace);
    SPREADSHEET_ID = resolveWorkspaceSpreadsheetId(ACTIVE_WORKSPACE);

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

// ================================================================
//  MULTI-WORKSPACE (Plant & Departemen)
// ------------------------------------------------------------
//  Satu Apps Script + satu deployment URL ini melayani BANYAK
//  spreadsheet (1 spreadsheet per departemen per plant), supaya
//  tidak perlu maintenance banyak salinan kode.gs yang terpisah.
//
//  WORKSPACE_MAP memetakan "workspace key" -> Spreadsheet ID.
//  "cibitung_fitting_import" SENGAJA diarahkan ke SPREADSHEET_ID
//  yang sudah berjalan sekarang (data lama tetap di situ, dianggap
//  sebagai departemen Fitting Import).
//
//  Departemen baru (belum di-provision) akan menampilkan pesan
//  error yang jelas, bukan diam-diam salah baca data departemen lain.
//
//  Cara tambah workspace baru:
//   1) Jalankan provisionDepartmentSpreadsheet('Nama Departemen') sekali
//      lewat Apps Script editor (Run) -> catat Spreadsheet ID yang
//      dikembalikan di Logger.
//   2) Tambahkan baris baru di WORKSPACE_MAP di bawah ini.
//   3) Deploy ulang (New version).
// ================================================================
var WORKSPACE_MAP = {
  'cibitung_fitting_import': '1ZlcBhPQJpMFG4-Phwv1VCldIA4VXImzGgltj3ihR33c', // spreadsheet yang sudah berjalan
  'cibitung_fitting_rucika': '1-WSl4W6IoCmX6Du1fqPqswn9xqn960PtpwtmuluLO8Q',
  'cibitung_pipa_rucika'   : '1xJZPYLxZqalNf5qpw9OLW6j57y9Tb__eW0d8TkO0ywc',
  'cibitung_sparepart'     : ''  // isi setelah provisionDepartmentSpreadsheet()
};
var DEFAULT_WORKSPACE = 'cibitung_fitting_import'; // fallback kalau request lama belum kirim param workspace
var ACTIVE_WORKSPACE = DEFAULT_WORKSPACE; // ditimpa tiap request oleh handleApiRequest

function resolveWorkspaceKey(workspace) {
  workspace = String(workspace || '').trim();
  return (workspace && WORKSPACE_MAP.hasOwnProperty(workspace)) ? workspace : DEFAULT_WORKSPACE;
}

function resolveWorkspaceSpreadsheetId(workspaceKey) {
  var id = WORKSPACE_MAP[workspaceKey];
  if (!id) {
    throw new Error('Departemen "' + workspaceKey + '" belum di-provision (Spreadsheet ID kosong). Jalankan provisionDepartmentSpreadsheet() dulu, lalu isi WORKSPACE_MAP.');
  }
  return id;
}

// Bungkus fungsi baca data dengan CacheService supaya panggilan berulang
// (klik Refresh, atau beberapa orang buka dashboard bersamaan) dalam
// jendela CACHE_TTL_SECONDS langsung dijawab dari cache (instan),
// tidak perlu baca ulang spreadsheet tiap kali.
function callWithServerCache(action, args) {
  var cache    = CacheService.getScriptCache();
  var cacheKey = 'api::' + ACTIVE_WORKSPACE + '::' + action + '::' + JSON.stringify(args);

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

// Dipakai kalau getKategoriStock(drawingVal) gagal (kosong / tidak persis
// cocok, mis. item baru yang belum ada di MASTER lookup Drawing). Baca
// kata kunci dari kolom E (Description) sebagai cadangan, supaya item
// tetap masuk kategori yang benar walau kolom Drawing-nya kosong -- tidak
// lagi "hilang" dari rincian walau tetap terhitung di Total.
function getKategoriStockFallback(descE) {
  var desc = normStr(descE);
  if (!desc) return null;
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
  if (!isGreen && !isGrey) isGreen = true; // default GREEN kalau tidak disebutkan
  if (isPipa)    return isGreen ? 'pipaGreen'    : 'pipaGrey';
  if (isFitting) return isGreen ? 'fittingGreen' : 'fittingGrey';
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
    if (!kat) kat = getKategoriStockFallback(row[4]); // fallback: baca Description (kolom E)
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

// ================================================================
//  UPLOAD DATA HARIAN — Stock / Outbound (Kirim) / Inbound (Produksi)
// ------------------------------------------------------------
//  Dipanggil dari upload_data.html. Menambahkan baris baru ke sheet
//  yang bersangkutan (DASHBOARD_STOCK / DASHBOARD_KIRIM /
//  DASHBOARD_PRODUKSI) dengan urutan kolom PERSIS SAMA seperti yang
//  sudah dipakai fungsi-fungsi baca yang sudah ada (getStockData,
//  readTransaksi, dst) -- jadi TIDAK ada rumus baru, cuma menambah
//  baris data mentah yang nanti dibaca oleh rumus yang sudah ada.
//
//  Setelah baris ditambahkan, langsung dipaksa sync ke Supabase saat
//  itu juga (tidak menunggu trigger onEdit / jadwal harian), supaya
//  Monitoring Stock, Kanban, dan Rekap Muatan langsung update begitu
//  upload selesai -- sama seperti pola Control Tower.
// ================================================================

// Ubah berbagai format tanggal umum (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY,
// atau objek Date dari sheet) menjadi objek Date yang valid. Kalau gagal
// di-parse, dikembalikan apa adanya (string) supaya kelihatan jelas di
// sheet ada input yang salah, bukan diam-diam hilang/jadi tanggal keliru.
function _parseTanggalFleksibel(v) {
  if (!v && v !== 0) return '';
  if (v instanceof Date) return v;
  var s = String(v).trim();
  if (!s) return '';
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return new Date(parseInt(m[3],10), parseInt(m[2],10)-1, parseInt(m[1],10));
  var d = new Date(s);
  return isNaN(d.getTime()) ? s : d;
}

// Setelah upload, TIDAK melakukan sync blocking apa pun lagi di sini --
// menu Upload Data Harian tugasnya HANYA menempelkan data ke spreadsheet
// (itu sumber data utama/yang dikelola), secepat mungkin, tanpa menunggu
// proses lain supaya tidak pernah timeout lagi walau uploadnya besar.
//
// Data tetap otomatis "terlihat" ke Supabase lewat 2 mekanisme yang
// SUDAH ADA sebelumnya (tidak perlu ditunggu di sini):
//   1) Trigger onSheetEditSync -- baris baru/rumus yang ditulis tetap
//      terhitung sebagai "edit" ke sheet, jadi trigger itu otomatis
//      jalan sendiri di belakang layar (di luar request upload ini).
//   2) Trigger arsip bulanan (arsipkanBulanLaluOtomatis, jalan tiap
//      tanggal 2) -- backup permanen ke Supabase per bulan, untuk semua
//      departemen, seperti yang diminta sebelumnya.
function _forceSyncCurrentWorkspace(jumlahBaris, kind) {
  // Sengaja dikosongkan -- lihat catatan di atas. Parameter dibiarkan
  // ada supaya pemanggil (appendStockData dkk) tidak perlu diubah lagi.
}

// rows: array of array, HANYA 8 kolom (A-H) -- data mentah:
// [ItemNumber, Site, Unit, Group, Description, Description2, StockPcs, StockTonnase]
// tanggal: string tanggal (YYYY-MM-DD) untuk kolom J (TANGGAL) -- kolom ini
// TERNYATA bukan rumus (nilai manual), jadi ditulis eksplisit di sini,
// beda dengan kolom I (Drawing) dan K dst (Kanban dkk) yang memang rumus
// dan tetap di-copy-turun dari baris di atasnya.
// ================================================================
//  PERBAIKAN SEKALI-JALAN: kolom I (Drawing) / K dst (Kanban dkk) yang
//  kosong akibat percobaan upload sebelumnya (versi kode lama sempat
//  menulis kolom itu sebagai data kosong, menimpa rumus yang seharusnya
//  ada). Fungsi ini mencari SEMUA baris yang kolom I-nya kosong, lalu
//  menyalin rumus dari baris VALID terdekat di atasnya (kolom I dan K
//  dst -- TIDAK menyentuh kolom J/TANGGAL karena itu memang data manual,
//  bukan rumus, jadi tidak ikut diperbaiki di sini).
//
//  CARA PAKAI: buka Apps Script editor -> pilih fungsi
//  "repairMissingDrawingFormulas" di dropdown -> klik Run. Jalankan
//  SEKALI SAJA setelah deploy versi terbaru kode.gs.
// ================================================================
// ================================================================
//  PEMBERSIHAN SEKALI-JALAN -- membersihkan sisa-sisa dari percobaan
//  upload berulang saat proses debug (baris kosong total, dan baris
//  dengan tanggal rusak akibat bug lama di Outbound/Inbound).
//
//  CARA PAKAI: buka Apps Script editor -> pilih salah satu fungsi di
//  bawah dari dropdown -> Run. Semua fungsi ini AMAN (cuma menghapus
//  baris yang benar-benar kosong / tanggalnya jelas tidak masuk akal),
//  tapi tetap disarankan cek log hasilnya (View -> Logs / Executions)
//  setelah Run untuk lihat berapa baris yang kehapus.
// ================================================================

// Hapus baris yang BENAR-BENAR KOSONG (kolom A/Item Number kosong DAN
// tidak ada data berarti di kolom lain) -- sisa dari penghapusan manual
// yang tidak lengkap sebelumnya. Dipakai untuk DASHBOARD_STOCK,
// DASHBOARD_KIRIM, atau DASHBOARD_PRODUKSI.
function cleanupBlankRowsInSheet(sheetName) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 'Sheet ' + sheetName + ' tidak ditemukan.';

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return 'Sheet kosong, tidak ada yang perlu dibersihkan.';

  // Cukup cek kolom A sampai F (data inti) -- kalau semua kosong,
  // anggap baris itu benar-benar kosong walau kolom rumus di kanannya
  // (G dst) mungkin masih menampilkan sisa angka 0.
  var checkCols = Math.min(6, lastCol);
  var data = sheet.getRange(2, 1, lastRow - 1, checkCols).getValues();

  var rowsToDelete = [];
  for (var i = 0; i < data.length; i++) {
    var isBlank = data[i].every(function (v) { return v === '' || v === null || v === undefined; });
    if (isBlank) rowsToDelete.push(2 + i);
  }
  if (!rowsToDelete.length) return 'Tidak ada baris kosong yang perlu dibersihkan di ' + sheetName + '.';

  // Kelompokkan baris berurutan jadi blok, hapus dari bawah ke atas.
  rowsToDelete.sort(function (a, b) { return a - b; });
  var blocks = [];
  var blockStart = rowsToDelete[0], blockLen = 1;
  for (var j = 1; j < rowsToDelete.length; j++) {
    if (rowsToDelete[j] === blockStart + blockLen) { blockLen++; }
    else { blocks.push([blockStart, blockLen]); blockStart = rowsToDelete[j]; blockLen = 1; }
  }
  blocks.push([blockStart, blockLen]);
  for (var k = blocks.length - 1; k >= 0; k--) sheet.deleteRows(blocks[k][0], blocks[k][1]);

  var msg = 'Selesai membersihkan ' + sheetName + ': ' + rowsToDelete.length + ' baris kosong dihapus (' + blocks.length + ' blok).';
  Logger.log(msg);
  return msg;
}

// Hapus baris di DASHBOARD_KIRIM / DASHBOARD_PRODUKSI yang tanggalnya
// RUSAK akibat bug lama (SheetJS baca serial number Excel mentah, jadi
// kolom Effective Date isinya jadi tanggal ngawur seperti "01/01/46235").
// Baris seperti ini dianggap tidak valid dan aman dihapus -- datanya
// perlu diupload ulang pakai file yang sama (sekarang tanggalnya sudah
// dibaca dengan benar).
function cleanupCorruptedDates(sheetName) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 'Sheet ' + sheetName + ' tidak ditemukan.';

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet kosong, tidak ada yang perlu dibersihkan.';

  var colE = sheet.getRange(2, 5, lastRow - 1, 1).getValues(); // Effective Date = kolom E
  var rowsToDelete = [];
  var TAHUN_MIN = 2020, TAHUN_MAX = 2035; // di luar rentang ini dianggap rusak

  for (var i = 0; i < colE.length; i++) {
    var v = colE[i][0];
    if (!v) continue;
    var d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) continue;
    var tahun = d.getFullYear();
    if (tahun < TAHUN_MIN || tahun > TAHUN_MAX) rowsToDelete.push(2 + i);
  }
  if (!rowsToDelete.length) return 'Tidak ada tanggal rusak yang ditemukan di ' + sheetName + '.';

  rowsToDelete.sort(function (a, b) { return a - b; });
  var blocks = [];
  var blockStart = rowsToDelete[0], blockLen = 1;
  for (var j = 1; j < rowsToDelete.length; j++) {
    if (rowsToDelete[j] === blockStart + blockLen) { blockLen++; }
    else { blocks.push([blockStart, blockLen]); blockStart = rowsToDelete[j]; blockLen = 1; }
  }
  blocks.push([blockStart, blockLen]);
  for (var k = blocks.length - 1; k >= 0; k--) sheet.deleteRows(blocks[k][0], blocks[k][1]);

  var msg = 'Selesai membersihkan ' + sheetName + ': ' + rowsToDelete.length + ' baris dengan tanggal rusak dihapus (' + blocks.length + ' blok). Silakan upload ulang data yang sama, sekarang tanggalnya akan terbaca benar.';
  Logger.log(msg);
  return msg;
}

// Jalankan SEMUA pembersihan sekaligus untuk ketiga sheet transaksi.
// Kosongkan SEMUA baris data di sebuah sheet (sisakan baris 1/header).
// Dipakai kalau seluruh isi sheet itu memang hasil testing/percobaan dan
// mau mulai dari nol lagi (mis. DASHBOARD_PRODUKSI yang datanya kacau
// akibat percobaan upload berulang sebelum semua bug tanggal/angka
// diperbaiki). HATI-HATI: ini menghapus SEMUA baris data, tidak bisa
// dibatalkan (undo Google Sheets masih bisa dipakai sesaat setelah Run,
// tapi jangan diandalkan).
function clearAllDataInSheet(sheetName) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return 'Sheet ' + sheetName + ' tidak ditemukan.';

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 'Sheet ' + sheetName + ' sudah kosong (cuma ada header).';

  sheet.deleteRows(2, lastRow - 1);
  var msg = 'Selesai: semua data di ' + sheetName + ' sudah dikosongkan (' + (lastRow - 1) + ' baris dihapus). Header di baris 1 tetap ada, silakan upload ulang data yang bersih.';
  Logger.log(msg);
  return msg;
}

// Wrapper siap-Run khusus untuk mengosongkan DASHBOARD_PRODUKSI (Inbound)
// -- sesuai konfirmasi: semua isi sheet ini boleh dihapus, akan diupload
// ulang dari awal.
// Dipanggil OTOMATIS dari frontend setelah semua batch upload selesai --
// supaya hasil upload langsung bisa diverifikasi (total baris & tanggal
// terakhir yang benar-benar ada di sheet SEKARANG), tanpa perlu buka
// spreadsheet manual atau menebak-nebak lagi.
function getSheetStats(sheetName, tanggalColIdx) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Sheet ' + sheetName + ' tidak ditemukan.' };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, totalBaris: 0, tanggalTerakhir: null };

    var colVals = sheet.getRange(2, tanggalColIdx, lastRow - 1, 1).getValues();
    var maxDate = null;
    var totalBaris = 0;
    for (var i = 0; i < colVals.length; i++) {
      var v = colVals[i][0];
      if (v === '' || v === null || v === undefined) continue;
      totalBaris++;
      var d = (v instanceof Date) ? v : new Date(v);
      if (!isNaN(d.getTime())) {
        if (!maxDate || d.getTime() > maxDate.getTime()) maxDate = d;
      }
    }
    var tz = Session.getScriptTimeZone();
    return {
      success: true,
      totalBaris: totalBaris,
      totalBarisSheet: lastRow - 1,
      tanggalTerakhir: maxDate ? Utilities.formatDate(maxDate, tz, 'dd/MM/yyyy') : null
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Wrapper siap-Run khusus untuk mengosongkan DASHBOARD_KIRIM (Outbound) --
// sama seperti clearDashboardProduksi, dipakai kalau seluruh isi sheet
// ini mau dihapus total dan diupload ulang dari awal.
function clearDashboardKirim() {
  return clearAllDataInSheet(SH_KIRIM);
}

function clearDashboardProduksi() {
  return clearAllDataInSheet(SH_PRODUKSI);
}

function runFullCleanup() {
  var hasil = [];
  hasil.push(cleanupBlankRowsInSheet(SH_STOCK));
  hasil.push(cleanupBlankRowsInSheet(SH_KIRIM));
  hasil.push(cleanupBlankRowsInSheet(SH_PRODUKSI));
  hasil.push(cleanupCorruptedDates(SH_KIRIM));
  hasil.push(cleanupCorruptedDates(SH_PRODUKSI));
  var msg = hasil.join('\n');
  Logger.log(msg);
  return msg;
}

function repairMissingDrawingFormulas() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SH_STOCK);
  if (!sheet) return 'Sheet ' + SH_STOCK + ' tidak ditemukan.';

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastCol < 9 || lastRow < 3) return 'Tidak ada yang perlu diperbaiki (sheet terlalu kecil / kolom I belum ada).';

  var colI = sheet.getRange(2, 9, lastRow - 1, 1).getValues(); // baris 2..lastRow
  var totalFixed = 0;
  var blockCount = 0;
  var i = 0;

  while (i < colI.length) {
    if (colI[i][0] !== '' && colI[i][0] !== null) { i++; continue; }

    var blockStartRow = 2 + i; // baris sheet sebenarnya
    var blockLen = 0;
    while (i < colI.length && (colI[i][0] === '' || colI[i][0] === null)) { blockLen++; i++; }

    var srcRow = blockStartRow - 1;
    if (srcRow < 2) continue; // tidak ada baris acuan valid di atasnya, lewati blok ini

    var srcI  = sheet.getRange(srcRow, 9, 1, 1);
    var destI = sheet.getRange(blockStartRow, 9, blockLen, 1);
    srcI.copyTo(destI, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);

    if (lastCol > 10) {
      var srcRest  = sheet.getRange(srcRow, 11, 1, lastCol - 10);
      var destRest = sheet.getRange(blockStartRow, 11, blockLen, lastCol - 10);
      srcRest.copyTo(destRest, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    }

    totalFixed += blockLen;
    blockCount++;
  }

  var msg = 'Selesai. Diperbaiki ' + totalFixed + ' baris (dalam ' + blockCount + ' blok) -- kolom I (Drawing) dan K dst (Kanban dkk) sudah ditambal rumusnya.';
  Logger.log(msg);
  return msg;
}

// ================================================================
//  Upload Stock = FULL RE-COUNT per tanggal (bukan transaksi harian
//  yang menumpuk). Dipanggil SEKALI dari frontend SEBELUM batch upload
//  dimulai, supaya kalau tanggal yang sama diupload ulang (mis. karena
//  ada revisi data / upload sempat gagal separuh), data lama di tanggal
//  itu dihapus dulu -- tidak numpuk jadi dobel seperti sebelumnya.
// ================================================================
function clearStockDataForDate(tanggal) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_STOCK);
    if (!sheet) return { success: false, error: 'Sheet ' + SH_STOCK + ' tidak ditemukan.' };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, dihapus: 0 };

    var tglTarget = _parseTanggalFleksibel(tanggal);
    if (!(tglTarget instanceof Date) || isNaN(tglTarget.getTime())) {
      return { success: false, error: 'Tanggal tidak valid: ' + tanggal };
    }
    var tz = Session.getScriptTimeZone();
    var tglTargetStr = Utilities.formatDate(tglTarget, tz, 'yyyy-MM-dd');

    var colJ = sheet.getRange(2, 10, lastRow - 1, 1).getValues();
    var rowsToDelete = [];
    for (var i = 0; i < colJ.length; i++) {
      var v = colJ[i][0];
      if (!v) continue;
      var d = (v instanceof Date) ? v : new Date(v);
      if (isNaN(d.getTime())) continue;
      if (Utilities.formatDate(d, tz, 'yyyy-MM-dd') === tglTargetStr) {
        rowsToDelete.push(2 + i);
      }
    }
    if (!rowsToDelete.length) return { success: true, dihapus: 0 };

    // Kelompokkan baris yang berurutan jadi satu blok, supaya hapusnya
    // efisien (tidak 1-per-1 kalau ratusan baris berurutan).
    rowsToDelete.sort(function (a, b) { return a - b; });
    var blocks = [];
    var blockStart = rowsToDelete[0], blockLen = 1;
    for (var j = 1; j < rowsToDelete.length; j++) {
      if (rowsToDelete[j] === blockStart + blockLen) {
        blockLen++;
      } else {
        blocks.push([blockStart, blockLen]);
        blockStart = rowsToDelete[j]; blockLen = 1;
      }
    }
    blocks.push([blockStart, blockLen]);

    // Hapus dari blok PALING BAWAH dulu supaya nomor baris blok di
    // atasnya tidak ikut bergeser.
    for (var k = blocks.length - 1; k >= 0; k--) {
      sheet.deleteRows(blocks[k][0], blocks[k][1]);
    }

    return { success: true, dihapus: rowsToDelete.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Parser angka yang PINTAR: otomatis mendeteksi format ribuan/desimal,
// baik gaya Indonesia/Eropa ("23.989,53") maupun gaya US ("23,989.53"),
// supaya TIDAK ada nilai yang kepotong seperti bug sebelumnya (23.989,53
// salah kebaca jadi cuma 23). Aturannya: pemisah yang muncul PALING
// KANAN (terakhir) dianggap tanda desimal, sisanya dianggap pemisah
// ribuan dan dibuang. Kalau nilainya sudah berupa angka asli (bukan
// teks), dikembalikan apa adanya tanpa diubah sama sekali.
function _parseAngkaFleksibel(v) {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (v === null || v === undefined || v === '') return 0;
  var s = String(v).trim().replace(/[^0-9,.\-]/g, '');
  if (!s) return 0;
  var lastComma = s.lastIndexOf(',');
  var lastDot   = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    // koma = desimal (format ID/EU) -> buang semua titik (ribuan), koma jadi titik
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // titik = desimal (format US) -> buang semua koma (ribuan)
    s = s.replace(/,/g, '');
  }
  // kalau cuma salah satu jenis pemisah dan cuma muncul sekali, biarkan
  // apa adanya (sudah tertangani oleh dua kondisi di atas / memang polos)
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function appendStockData(rows, tanggal) {
  try {
    if (!rows || !rows.length) return { success: false, error: 'Tidak ada baris data untuk diupload.' };
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_STOCK);
    if (!sheet) return { success: false, error: 'Sheet "' + SH_STOCK + '" tidak ditemukan.' };

    var out = rows.map(function (r) {
      return [
        r[0] || '', r[1] || '', r[2] || '', r[3] || '',
        r[4] || '', r[5] || '', _parseAngkaFleksibel(r[6]), _parseAngkaFleksibel(r[7])
      ];
    });

    var startRow = sheet.getLastRow() + 1;
    var lastCol  = sheet.getLastColumn();
    var tglValue = _parseTanggalFleksibel(tanggal) || new Date();

    // 1) Tulis HANYA kolom A-H (8 kolom pertama) -- data mentah dari Excel
    sheet.getRange(startRow, 1, out.length, 8).setValues(out);

    // 2) Kolom I (Drawing) -- ini RUMUS, copy-turun dari baris di atasnya
    if (startRow > 2 && lastCol >= 9) {
      var srcI = sheet.getRange(startRow - 1, 9, 1, 1);
      var destI = sheet.getRange(startRow, 9, out.length, 1);
      srcI.copyTo(destI, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    }

    // 3) Kolom J (TANGGAL) -- ini NILAI MANUAL (bukan rumus), jadi ditulis
    //    langsung sebagai tanggal upload (bukan di-copy dari baris atas).
    if (lastCol >= 10) {
      var tglRows = out.map(function () { return [tglValue]; });
      sheet.getRange(startRow, 10, out.length, 1).setValues(tglRows);
    }

    // 4) Kolom K dst (Kanban, Standar Isi, Konversi Box, dll) -- ini RUMUS
    //    lagi, copy-turun dari baris di atasnya seperti kolom I.
    if (startRow > 2 && lastCol > 10) {
      var srcRest = sheet.getRange(startRow - 1, 11, 1, lastCol - 10);
      var destRest = sheet.getRange(startRow, 11, out.length, lastCol - 10);
      srcRest.copyTo(destRest, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
    }

    // TIDAK ada sync yang ditunggu di sini lagi -- upload cuma menempel
    // data ke spreadsheet (cepat). Update ke Monitoring Stock/Kanban
    // tetap otomatis lewat trigger onEdit yang sudah terpasang di
    // spreadsheet (jalan sendiri di background begitu baris ini masuk).
    // Backup permanen ke Supabase tetap sesuai jadwal arsip bulanan
    // (tanggal 2 tiap bulan) yang sudah terpasang sebelumnya.
    return { success: true, jumlah: out.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// rows: array of array, urutan kolom PERSIS:
// [ItemNumber, DrawingCode, Description, Description2, EffectiveDate, TotalWeight]
function appendOutboundData(rows) {
  return _appendKirimProduksi(rows, SH_KIRIM);
}

// Sama seperti appendOutboundData, tapi target sheetnya DASHBOARD_PRODUKSI
function appendInboundData(rows) {
  return _appendKirimProduksi(rows, SH_PRODUKSI);
}

function _appendKirimProduksi(rows, sheetName) {
  try {
    if (!rows || !rows.length) return { success: false, error: 'Tidak ada baris data untuk diupload.' };
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Sheet "' + sheetName + '" tidak ditemukan.' };

    var out = rows.map(function (r) {
      return [
        r[0] || '', r[1] || '', r[2] || '', r[3] || '',
        _parseTanggalFleksibel(r[4]), _parseAngkaFleksibel(r[5])
      ];
    });

    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, out.length, 6).setValues(out);
    // Sama seperti Stock: tidak ditunggu sync-nya di sini, biar cepat.
    // Trigger onEdit + arsip bulanan otomatis yang menangani sync/backup.
    return { success: true, jumlah: out.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
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

    // ---- CACHE: hindari scan ulang seluruh sheet tiap kali dibuka ----
    // Sheet REKAP MUATAN / REKAP MUATAN FITTING / DASHBOARD_KIRIM dibaca penuh
    // (getDataRange) beberapa kali per request -> berat kalau datanya sudah
    // banyak bulan. Bulan yang sudah lewat datanya tidak berubah lagi, jadi
    // aman di-cache lebih lama. Bulan berjalan di-cache singkat saja supaya
    // input baru tetap kelihatan update dalam beberapa menit.
    var bulanKey = parseInt(params && params.bulan ? params.bulan : (new Date().getMonth() + 1), 10);
    var tahunKey = parseInt(params && params.tahun ? params.tahun : new Date().getFullYear(), 10);
    var cacheKey = 'rekapMuatan_' + tahunKey + '_' + bulanKey;
    var scriptCache = CacheService.getScriptCache();
    if (!(params && params.noCache)) {
      var cachedVal = scriptCache.get(cacheKey);
      if (cachedVal) return JSON.parse(cachedVal);
    }

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

    var resultOut = {
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

    // Simpan ke cache: 3 menit kalau bulan berjalan (masih sering diinput),
    // 6 jam kalau bulan yang sudah lewat (datanya sudah final/tidak berubah).
    try {
      var nowD = new Date();
      var isCurrentMonth = (tahunKey === nowD.getFullYear() && bulanKey === (nowD.getMonth() + 1));
      var ttlSeconds = isCurrentMonth ? 180 : 21600;
      scriptCache.put(cacheKey, JSON.stringify(resultOut), ttlSeconds);
    } catch (cacheErr) { /* kalau gagal cache, tidak masalah, tetap return data */ }

    return resultOut;
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

// Loop semua departemen yang sudah punya Spreadsheet ID di WORKSPACE_MAP,
// sync satu-satu (supaya kalau 1 departemen error, departemen lain tetap
// lanjut). Dipanggil oleh trigger harian jam 00:xx.
// ================================================================
//  SYNC REAL-TIME — begitu ada yang mengetik/ubah data di spreadsheet
//  manapun (Fitting Import, Fitting Rucika, dst), LANGSUNG dorong ulang
//  snapshot ke Supabase saat itu juga -- TIDAK menunggu jadwal harian
//  jam 00:xx lagi. Ini pelengkap syncAllToSupabase() (yang tetap jalan
//  sebagai jaring pengaman harian kalau trigger ini kebetulan gagal).
//
//  CATATAN PENTING soal kecepatan vs beban server:
//  - Tidak ada jeda/throttle waktu buatan -- setiap edit langsung diproses.
//  - TAPI dikasih LockService supaya kalau banyak sel diedit sekaligus
//    (misal paste banyak baris), proses sync yang tumpang tindih tidak
//    saling rebutan/nabrak -- bukan menunda, cuma mencegah 2 proses jalan
//    BERSAMAAN di spreadsheet yang sama (yang justru bisa bikin data di
//    Supabase malah kacau kalau race condition).
//
//  CARA PASANG (jalankan 1x lewat Apps Script editor -> Run):
//    setupEditTriggers()
//  Otomatis terpasang ke SEMUA spreadsheet yang sudah ada di WORKSPACE_MAP.
//  Kalau nanti nambah departemen baru, jalankan ulang fungsi ini.
// ================================================================
function onSheetEditSync(e) {
  try {
    if (!e || !e.source) return;
    var editedId = e.source.getId();
    var workspaceKey = null;
    for (var key in WORKSPACE_MAP) {
      if (WORKSPACE_MAP[key] === editedId) { workspaceKey = key; break; }
    }
    if (!workspaceKey) return; // spreadsheet ini bukan bagian dari WORKSPACE_MAP

    // Cooldown singkat (10 detik) per departemen -- BUKAN buat menunda
    // sengaja, tapi supaya kalau ada beberapa sel diedit/paste beruntun
    // dalam hitungan detik, tidak semuanya memicu hitung-ulang penuh
    // (11 fungsi) secara bersamaan. Tanpa ini, edit beruntun bisa
    // memenuhi kuota eksekusi Apps Script project ini -- dan karena
    // project yang sama juga melayani permintaan LIVE dari website,
    // permintaan website bisa ikut antre/macet ("muter terus").
    //
    // PENTING: kalau edit TERAKHIR dalam 1 rentetan jatuh PAS di dalam
    // jeda cooldown ini dan tidak ada edit susulan, perubahan itu bisa
    // "hilang" (tidak pernah ke-sync) -- makanya ditandai PENDING_SYNC
    // di sini, lalu checkPendingSyncs() (trigger tiap beberapa menit)
    // akan menyusulkan sync-nya supaya tidak ada perubahan yang kelewat.
    var props = PropertiesService.getScriptProperties();
    var propKey    = 'LAST_SYNC_' + workspaceKey;
    var pendingKey = 'PENDING_SYNC_' + workspaceKey;
    var lastSync = Number(props.getProperty(propKey) || 0);
    var now = Date.now();
    if (now - lastSync < 10000) {
      props.setProperty(pendingKey, '1'); // tandai "ada perubahan menunggu disinkronkan"
      return;
    }
    props.setProperty(propKey, String(now));
    props.deleteProperty(pendingKey);

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(3000)) return; // lagi ada proses sync lain jalan -> lewati, biar tidak dobel
    try {
      syncWorkspaceToSupabase(workspaceKey);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    Logger.log('onSheetEditSync gagal: ' + err.message);
  }
}

// Jaring pengaman: kalau ada perubahan yang sempat "kelewat" karena jatuh
// di dalam jeda cooldown onSheetEditSync (ditandai PENDING_SYNC), fungsi
// ini menyusulkan sync-nya. Dipasang sebagai trigger berkala (tiap 5
// menit) lewat setupEditTriggers() di bawah -- jadi paling lama nunggu
// 5 menit, tidak akan ada perubahan yang hilang selamanya.
function checkPendingSyncs() {
  var props = PropertiesService.getScriptProperties();
  Object.keys(WORKSPACE_MAP).forEach(function (workspaceKey) {
    if (!WORKSPACE_MAP[workspaceKey]) return;
    var pendingKey = 'PENDING_SYNC_' + workspaceKey;
    if (props.getProperty(pendingKey) !== '1') return;
    try {
      ACTIVE_WORKSPACE = workspaceKey;
      SPREADSHEET_ID = resolveWorkspaceSpreadsheetId(workspaceKey);
      syncWorkspaceToSupabase(workspaceKey);
      props.setProperty('LAST_SYNC_' + workspaceKey, String(Date.now()));
      props.deleteProperty(pendingKey);
      Logger.log('checkPendingSyncs: menyusulkan sync utk ' + workspaceKey);
    } catch (err) {
      Logger.log('checkPendingSyncs gagal utk ' + workspaceKey + ': ' + err.message);
    }
  });
}

function setupEditTriggers() {
  // Hapus trigger onEdit lama biar tidak dobel kalau fungsi ini dijalankan berkali-kali
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onSheetEditSync') ScriptApp.deleteTrigger(t);
  });

  var jumlah = 0;
  Object.keys(WORKSPACE_MAP).forEach(function (workspaceKey) {
    var id = WORKSPACE_MAP[workspaceKey];
    if (!id) return; // belum di-provision -> lewati
    try {
      var ss = SpreadsheetApp.openById(id);
      ScriptApp.newTrigger('onSheetEditSync').forSpreadsheet(ss).onEdit().create();
      jumlah++;
      Logger.log('Trigger onEdit terpasang untuk: ' + workspaceKey);
    } catch (err) {
      Logger.log('Gagal pasang trigger utk ' + workspaceKey + ': ' + err.message);
    }
  });

  // Trigger berkala (tiap 5 menit) buat jaring pengaman checkPendingSyncs
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkPendingSyncs') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkPendingSyncs').timeBased().everyMinutes(5).create();

  Logger.log('Selesai. ' + jumlah + ' trigger onEdit terpasang + 1 trigger checkPendingSyncs (tiap 5 menit).');
}


// Loop semua departemen yang sudah punya Spreadsheet ID di WORKSPACE_MAP,
// sync satu-satu (supaya kalau 1 departemen error, departemen lain tetap
// lanjut). Dipanggil oleh trigger harian jam 00:xx (jaring pengaman),
// selain sync real-time lewat onSheetEditSync() di atas.
// ================================================================
//  ARSIP PERMANEN BULAN LAMA
//  Beda dari syncAllToSupabase() (yang cuma sync BULAN BERJALAN terus-
//  menerus), fungsi ini secara EKSPLISIT menghitung & menyimpan snapshot
//  untuk bulan-bulan LAMA yang sudah lewat (mis. Januari-Juli), supaya
//  datanya AMAN TERSIMPAN PERMANEN di Supabase -- walau nanti baris-baris
//  itu dihapus dari spreadsheet, dashboard tetap bisa tampilkan datanya
//  (karena tidak akan pernah dihitung ulang dari spreadsheet lagi setelah
//  di-arsipkan, kecuali dijalankan manual lagi).
//
//  CARA PAKAI (jalankan manual 1x lewat Apps Script editor -> Run):
//    arsipkanBulanLamaFittingImport()
// ================================================================
function archiveMonthToSupabase(workspaceKey, bulan, tahun) {
  ACTIVE_WORKSPACE = workspaceKey;
  SPREADSHEET_ID = resolveWorkspaceSpreadsheetId(workspaceKey);
  var bulanStr = String(bulan), tahunStr = String(tahun);
  var ym = tahunStr + '-' + _pad2(bulan);
  var log = [];
  function put(key, payloadFn) {
    key = workspaceKey + '::' + key;
    try {
      var payload = payloadFn();
      if (payload && payload.success === false) { log.push('SKIP ' + key + ' (' + payload.error + ')'); return; }
      _supabaseUpsertSnapshot(key, payload);
      log.push('OK   ' + key);
    } catch (err) {
      log.push('GAGAL ' + key + ': ' + err.message);
    }
  }
  put('stock:bulanan:' + ym,    function () { return getDashboardData('bulanan', { bulan: bulanStr, tahun: tahunStr }); });
  put('outbound:bulanan:' + ym, function () { return getOutboundData({ bulan: bulanStr, tahun: tahunStr }); });
  put('inbound:bulanan:' + ym,  function () { return getInboundData({ bulan: bulanStr, tahun: tahunStr }); });
  put('kanban:bulanan:' + ym,   function () { return getKanbanData('bulanan', { bulan: bulanStr, tahun: tahunStr }); });
  put('rekap:bulanan:' + ym,    function () { return getRekapMuatanData({ mode: 'bulanan', bulan: bulanStr, tahun: tahunStr }); });
  put('residence_time:bulanan:' + ym, function () { return getResidenceTimeData({ mode: 'bulan-custom', date: ym }); });
  Logger.log('=== Arsip ' + workspaceKey + ' ' + ym + ' ===\n' + log.join('\n'));
  return log;
}

// Wrapper siap-Run untuk arsipkan Januari-Juli 2026 di Fitting Import.
// Ganti daftar bulan/tahun di bawah sesuai kebutuhan (mis. departemen lain
// atau rentang bulan lain), lalu Run.
function arsipkanBulanLamaFittingImport() {
  var daftarBulan = [1, 2, 3, 4, 5, 6, 7]; // Januari s.d. Juli
  var tahun = 2026;
  daftarBulan.forEach(function (b) {
    archiveMonthToSupabase('cibitung_fitting_import', b, tahun);
  });
  Logger.log('SELESAI mengarsipkan ' + daftarBulan.length + ' bulan.');
}

// ================================================================
//  ARSIP OTOMATIS BULANAN — SEMUA DEPARTEMEN (sama seperti Control
//  Tower: begitu bulan berganti, data bulan yang baru saja selesai
//  otomatis diarsipkan permanen ke Supabase untuk SEMUA departemen
//  sekaligus -- bukan cuma 1 departemen, dan tidak perlu dijalankan
//  manual lagi tiap bulan. Data tetap terbaca dari Supabase walau
//  baris-barisnya nanti dihapus dari spreadsheet.
//
//  CARA PASANG (jalankan 1x lewat Apps Script editor -> Run):
//    setupMonthlyArchiveTrigger()
//  Setelah itu otomatis jalan sendiri tiap tanggal 2 jam 01:00 pagi,
//  mengarsipkan bulan yang baru saja selesai (mis. tanggal 2 Agustus
//  akan mengarsipkan bulan Juli).
// ================================================================

// Arsipkan SATU bulan/tahun tertentu untuk SEMUA departemen yang sudah
// punya Spreadsheet ID di WORKSPACE_MAP (dept yang belum di-provision,
// spreadsheet ID-nya masih '', otomatis dilewati).
function archiveAllWorkspacesForMonth(bulan, tahun) {
  var allLogs = [];
  Object.keys(WORKSPACE_MAP).forEach(function (workspaceKey) {
    if (!WORKSPACE_MAP[workspaceKey]) return; // belum di-provision -> lewati
    try {
      var log = archiveMonthToSupabase(workspaceKey, bulan, tahun);
      allLogs.push('=== ' + workspaceKey + ' ===\n' + log.join('\n'));
    } catch (err) {
      allLogs.push('=== ' + workspaceKey + ' === GAGAL TOTAL: ' + err.message);
    }
  });
  Logger.log(allLogs.join('\n\n'));
  return allLogs;
}

// Dipanggil otomatis oleh trigger bulanan. Menghitung "bulan lalu" relatif
// terhadap tanggal hari ini, lalu mengarsipkannya untuk semua departemen.
function arsipkanBulanLaluOtomatis() {
  var now = new Date();
  var bulanLalu = now.getMonth(); // getMonth() 0-based -> ini sudah "bulan sebelumnya" dalam angka 1-based
  var tahunLalu = now.getFullYear();
  if (bulanLalu === 0) { bulanLalu = 12; tahunLalu -= 1; } // Januari -> bulan lalu = Desember tahun sebelumnya
  Logger.log('Mengarsipkan otomatis bulan ' + bulanLalu + '/' + tahunLalu + ' untuk semua departemen...');
  return archiveAllWorkspacesForMonth(bulanLalu, tahunLalu);
}

// Jalankan SEKALI SAJA secara manual (pilih fungsi ini di dropdown Apps
// Script editor -> Run) untuk memasang jadwal arsip otomatis bulanan.
function setupMonthlyArchiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'arsipkanBulanLaluOtomatis') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('arsipkanBulanLaluOtomatis')
    .timeBased()
    .onMonthDay(2)   // tanggal 2 tiap bulan (kasih jeda 1 hari dari akhir bulan,
                      // supaya input/koreksi last-minute di H-1 akhir bulan sempat masuk)
    .atHour(1)        // jam 01:xx pagi (zona waktu project Apps Script)
    .create();
  Logger.log('Trigger arsip otomatis bulanan berhasil dipasang (tiap tanggal 2, jam 01:00).');
}


// Loop semua departemen yang sudah punya Spreadsheet ID di WORKSPACE_MAP,
// sync satu-satu (supaya kalau 1 departemen error, departemen lain tetap
// lanjut). Dipanggil oleh trigger harian jam 00:xx (jaring pengaman),
// selain sync real-time lewat onSheetEditSync() di atas.
function syncAllToSupabase() {
  var allLogs = [];
  Object.keys(WORKSPACE_MAP).forEach(function (workspaceKey) {
    if (!WORKSPACE_MAP[workspaceKey]) return; // belum di-provision -> lewati
    try {
      var result = syncWorkspaceToSupabase(workspaceKey);
      allLogs.push('=== ' + workspaceKey + ' ===\n' + result.join('\n'));
    } catch (err) {
      allLogs.push('=== ' + workspaceKey + ' === GAGAL TOTAL: ' + err.message);
    }
  });
  Logger.log(allLogs.join('\n\n'));
  return allLogs;
}

// Dipanggil manual dari tombol "Sync Sekarang" di halaman Upload Data --
// sync LANGSUNG (blocking, ditunggu sampai selesai) dan MENGEMBALIKAN
// rincian per bagian (OK/SKIP/GAGAL) supaya kalau ada yang gagal,
// masalahnya kelihatan jelas -- bukan cuma "tidak update" tanpa sebab.
// kind: 'stock' -> cuma sync Monitoring Stock+Kanban, 'io' -> cuma sync
// Outbound/Inbound+Kanban+Rekap Muatan, selain itu -> sync PENUH (semua).
function manualSyncNow(kind) {
  try {
    var log;
    if (kind === 'stock') log = syncStockOnly(ACTIVE_WORKSPACE);
    else if (kind === 'io') log = syncOutboundInboundOnly(ACTIVE_WORKSPACE);
    else log = syncWorkspaceToSupabase(ACTIVE_WORKSPACE);
    var gagalCount = log.filter(function (l) { return l.indexOf('GAGAL') === 0; }).length;
    return { success: true, log: log, adaGagal: gagalCount > 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  SYNC RINGKAS (scoped) -- dipakai setelah Upload Data Harian, supaya
//  tidak perlu menghitung ulang SEMUA hal seperti syncWorkspaceToSupabase
//  penuh. DASHBOARD_STOCK cuma berkaitan dengan Monitoring Stock, Kanban,
//  dan ringkasan di Control Tower -- TIDAK dengan Outbound/Inbound/Rekap
//  Muatan/Loading Time, jadi bagian-bagian itu dilewati supaya cepat.
// ================================================================
function _syncPutHelper(workspaceKey, log) {
  return function (key, payloadFn) {
    var fullKey = workspaceKey + '::' + key;
    try {
      var payload = payloadFn();
      if (payload && payload.success === false) {
        log.push('SKIP ' + fullKey + ' (hasil gagal: ' + payload.error + ')');
        return;
      }
      _supabaseUpsertSnapshot(fullKey, payload);
      log.push('OK   ' + fullKey);
    } catch (err) {
      log.push('GAGAL ' + fullKey + ': ' + err.message);
    }
  };
}

// Upload STOCK -> cuma pengaruh ke: Monitoring Stock (harian+bulanan+tren)
// dan Kanban (yang menampilkan ringkasan stock). TIDAK menyentuh
// Outbound/Inbound/Rekap Muatan/Loading Time.
function syncStockOnly(workspaceKey) {
  ACTIVE_WORKSPACE = workspaceKey;
  SPREADSHEET_ID = resolveWorkspaceSpreadsheetId(workspaceKey);
  var log = [];
  var put = _syncPutHelper(workspaceKey, log);

  var now = new Date();
  var bulanIni = String(now.getMonth() + 1), tahunIni = String(now.getFullYear());
  var todayStr = now.getFullYear() + '-' + _pad2(now.getMonth() + 1) + '-' + _pad2(now.getDate());

  var months6 = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months6.push({ bulan: String(d.getMonth() + 1), tahun: String(d.getFullYear()) });
  }
  var stockTrendResult = null;
  put('stock_trend:6mo', function () { stockTrendResult = getStockTrendBatch(months6); return stockTrendResult; });
  put('stock:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    if (stockTrendResult && stockTrendResult.success && stockTrendResult.results) {
      return stockTrendResult.results[stockTrendResult.results.length - 1];
    }
    return getDashboardData('bulanan', { bulan: bulanIni, tahun: tahunIni, group: '' });
  });
  put('stock:harian:' + todayStr, function () { return getDashboardData('harian', { dari: todayStr, sampai: todayStr, group: '' }); });
  put('kanban:harian:' + todayStr, function () { return getKanbanData('harian', { dari: todayStr, sampai: todayStr }); });
  put('kanban:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getKanbanData('bulanan', { bulan: bulanIni, tahun: tahunIni }); });

  Logger.log(log.join('\n'));
  return log;
}

// Upload OUTBOUND/INBOUND -> pengaruh ke: Kanban (yang juga menampilkan
// data kirim/produksi) dan Rekap Muatan. TIDAK menyentuh Stock.
function syncOutboundInboundOnly(workspaceKey) {
  ACTIVE_WORKSPACE = workspaceKey;
  SPREADSHEET_ID = resolveWorkspaceSpreadsheetId(workspaceKey);
  var log = [];
  var put = _syncPutHelper(workspaceKey, log);

  var now = new Date();
  var bulanIni = String(now.getMonth() + 1), tahunIni = String(now.getFullYear());
  var todayStr = now.getFullYear() + '-' + _pad2(now.getMonth() + 1) + '-' + _pad2(now.getDate());

  var months6 = [];
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months6.push({ bulan: String(d.getMonth() + 1), tahun: String(d.getFullYear()) });
  }
  var ioTrendResult = null;
  put('io_trend:6mo', function () { ioTrendResult = getIOTrendBatch(months6); return ioTrendResult; });
  put('outbound:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    if (ioTrendResult && ioTrendResult.success && ioTrendResult.results) return ioTrendResult.results[ioTrendResult.results.length - 1].out;
    return getOutboundData({ bulan: bulanIni, tahun: tahunIni });
  });
  put('inbound:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    if (ioTrendResult && ioTrendResult.success && ioTrendResult.results) return ioTrendResult.results[ioTrendResult.results.length - 1].in;
    return getInboundData({ bulan: bulanIni, tahun: tahunIni });
  });
  put('kanban:harian:' + todayStr, function () { return getKanbanData('harian', { dari: todayStr, sampai: todayStr }); });
  put('kanban:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getKanbanData('bulanan', { bulan: bulanIni, tahun: tahunIni }); });
  put('rekap:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getRekapMuatanData({ mode: 'bulanan', bulan: bulanIni, tahun: tahunIni }); });

  Logger.log(log.join('\n'));
  return log;
}

function syncWorkspaceToSupabase(workspaceKey) {
  ACTIVE_WORKSPACE = workspaceKey;
  SPREADSHEET_ID = resolveWorkspaceSpreadsheetId(workspaceKey);

  var log = [];
  function put(key, payloadFn) {
    key = workspaceKey + '::' + key; // pisahkan snapshot per departemen
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

// ================================================================
//  MODUL LEMBUR & FTE (Full Time Equivalent)
// ------------------------------------------------------------
//  SETUP (WAJIB sebelum dipakai, jalankan SEKALI SAJA):
//  Di Apps Script editor, pilih fungsi `setupLemburSheets` dari
//  dropdown -> klik Run. Ini akan membuat 4 sheet baru otomatis:
//    KARYAWAN_LEMBUR  - data master 7 karyawan + jam kerja masing2
//    LEMBUR_LOG       - catatan tiap input lembur
//    ABSENSI_LOG      - catatan Cuti Dokter / Cuti Tahunan / Mangkir
//    HARI_LIBUR       - daftar tanggal merah (isi manual per tahun)
//
//  ATURAN FTE (dari rekap manual OPR_W4 yang sudah dipakai selama ini):
//    FTE Lembur = Total Jam Lembur KARYAWAN INTERNAL / 173
//    Total FTE  = Jumlah Karyawan Internal + FTE Lembur
//    Over Time% = FTE Lembur / Jumlah Karyawan Internal x 100 (target <6%)
//  FTE HANYA dihitung untuk karyawan INTERNAL. OS (Ivan/Doni/Iman)
//  tidak dihitung FTE-nya, cuma direkap jam lemburnya saja.
//
//  Cuti Dokter, Cuti Tahunan, Mangkir, Minggu & tanggal merah TIDAK
//  dihitung sebagai hari kerja wajib (tidak mempengaruhi FTE/lembur).
// ================================================================
var SH_KARYAWAN_LEMBUR = 'KARYAWAN_LEMBUR';
var SH_LEMBUR_LOG      = 'LEMBUR_LOG';
var SH_ABSENSI_LOG     = 'ABSENSI_LOG';
var SH_HARI_LIBUR      = 'HARI_LIBUR';

var FTE_STANDAR_JAM_BULAN = 173; // standar jam kerja/bulan, sama untuk semua kategori

// Kategori karyawan SEKARANG OTOMATIS dari awalan kode/NIK -- bukan lagi
// manual per baris di sheet KARYAWAN_LEMBUR. NIK berawalan "PEG" = OS
// (Outsourcing), selain itu = Internal. Ini supaya akun baru (PEG...)
// yang lupa/belum di-set manual di sheet tetap otomatis kebaca sebagai
// OS, tidak perlu edit sheet satu-satu lagi.
function _kategoriDariNIK(kode) {
  return /^PEG/i.test(String(kode || '').trim()) ? 'OS' : 'Internal';
}

// Data master 6 karyawan (dipakai buat auto-isi sheet KARYAWAN_LEMBUR
// kalau masih kosong). Jam sudah NET (weekday karyawan biasa & Ivan
// 8-1=7, TL 9-1=8, OS Doni/Iman weekday 14:00-22:00 -1j=7 & Minggu 6-1=5).
var KARYAWAN_SEED = [
  // [kode, nama, kategori, jabatan, jamWeekday, jamSabtu, jamMinggu]
  ['2106619',     'SANDY TYAS LEO SAPUTRA', 'Internal', 'Team Leader', 8, 0, 0],
  ['2155807',     'SULISTYO',               'Internal', 'Staff',       7, 6, 0],
  ['2168311',     'WANG SUTRISNO',          'Internal', 'Staff',       7, 6, 0],
  ['2165310',     'SAEPUL GANNI',           'Internal', 'Staff',       7, 6, 0],
  ['PEG21101254', 'Doni Mulya Y',           'OS',       'Staff',       7, 0, 5],
  ['PEG21101272', 'Ivan Reynata',           'OS',       'Staff',       7, 6, 0],
  ['PEG25112073', 'Iman Abdul Rahman',      'OS',       'Staff',       7, 0, 5]
];

function setupLemburSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var msgs = [];

  var shK = ss.getSheetByName(SH_KARYAWAN_LEMBUR);
  if (!shK) {
    shK = ss.insertSheet(SH_KARYAWAN_LEMBUR);
    shK.getRange(1, 1, 1, 8).setValues([['Kode', 'Nama', 'Kategori', 'Jabatan', 'JamWeekday', 'JamSabtu', 'JamMinggu', 'Aktif']]);
    shK.getRange(2, 1, KARYAWAN_SEED.length, 7).setValues(KARYAWAN_SEED);
    shK.getRange(2, 8, KARYAWAN_SEED.length, 1).setValue(true);
    shK.setFrozenRows(1);
    msgs.push('Sheet KARYAWAN_LEMBUR dibuat + diisi 8 baris data master.');
  } else {
    msgs.push('Sheet KARYAWAN_LEMBUR sudah ada, dilewati.');
  }

  var shL = ss.getSheetByName(SH_LEMBUR_LOG);
  if (!shL) {
    shL = ss.insertSheet(SH_LEMBUR_LOG);
    shL.getRange(1, 1, 1, 17).setValues([['Timestamp', 'Tanggal', 'Kode', 'Nama', 'JamMulai', 'JamSelesai', 'TotalJamLembur', 'Keterangan', 'InputOleh', 'Status', 'ApprovedBy', 'Catatan', 'KategoriLembur', 'EditReqStatus', 'EditReqData', 'EditReqBy', 'EditReqNote']]);
    shL.setFrozenRows(1);
    msgs.push('Sheet LEMBUR_LOG dibuat.');
  } else {
    msgs.push('Sheet LEMBUR_LOG sudah ada, dilewati.');
  }

  var shA = ss.getSheetByName(SH_ABSENSI_LOG);
  if (!shA) {
    shA = ss.insertSheet(SH_ABSENSI_LOG);
    shA.getRange(1, 1, 1, 7).setValues([['Timestamp', 'Tanggal', 'Kode', 'Nama', 'Status', 'Keterangan', 'InputOleh']]);
    shA.setFrozenRows(1);
    msgs.push('Sheet ABSENSI_LOG dibuat.');
  } else {
    msgs.push('Sheet ABSENSI_LOG sudah ada, dilewati.');
  }

  var shH = ss.getSheetByName(SH_HARI_LIBUR);
  if (!shH) {
    shH = ss.insertSheet(SH_HARI_LIBUR);
    shH.getRange(1, 1, 1, 2).setValues([['Tanggal', 'Keterangan']]);
    shH.setFrozenRows(1);
    msgs.push('Sheet HARI_LIBUR dibuat (OPSIONAL - tanggal merah nasional sudah otomatis dari kalender Google, sheet ini cuma buat tambahan libur khusus perusahaan kalau perlu).');
  } else {
    msgs.push('Sheet HARI_LIBUR sudah ada, dilewati.');
  }

  Logger.log(msgs.join('\n'));
  return { success: true, message: msgs.join(' | ') };
}

// ================================================================
//  AKUN_LOGIN — sheet berisi akun TL & Karyawan untuk 1 departemen.
//  Setiap spreadsheet departemen punya sheet ini sendiri-sendiri
//  (jadi TL/karyawan departemen A tidak akan pernah tersimpan atau
//  tercampur di spreadsheet departemen B).
//
//  Kolom: NIK | Nama | Role (TL/Karyawan) | PasswordHash | Aktif
//  Password TIDAK disimpan sebagai teks polos -- disimpan sebagai
//  SHA-256 hash lewat setAkunPassword(), supaya tetap aman walau
//  spreadsheet-nya suatu saat ter-share ke orang lain.
// ================================================================
var SH_AKUN_LOGIN = 'AKUN_LOGIN';

function setupAkunLoginSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_AKUN_LOGIN);
  if (sh) return { success: true, message: 'Sheet AKUN_LOGIN sudah ada, dilewati.' };
  sh = ss.insertSheet(SH_AKUN_LOGIN);
  sh.getRange(1, 1, 1, 5).setValues([['NIK', 'Nama', 'Role', 'PasswordHash', 'Aktif']]);
  sh.setFrozenRows(1);
  return { success: true, message: 'Sheet AKUN_LOGIN dibuat. Isi manual atau pakai setAkunPassword() untuk tambah akun.' };
}

function _hashPassword(plain) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(plain), Utilities.Charset.UTF_8);
  return digest.map(function (b) { return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0'); }).join('');
}

// Helper buat dijalankan manual di Apps Script editor (Run) untuk
// menambah/reset password 1 akun. Nama karyawan & role diambil dari
// KARYAWAN_LEMBUR kalau kode-nya sudah ada di situ.
// Contoh pemakaian (isi lalu klik Run):
//   setAkunPasswordHelper('PEG21101254', 'Doni Mulya Y', 'Karyawan', 'rucika123');
//   setAkunPasswordHelper('SANDY01', 'Sandy Tyas Leo Saputra', 'TL', 'tlcibitung');
function setAkunPasswordHelper(nik, nama, role, passwordPlain) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_AKUN_LOGIN);
  if (!sh) { setupAkunLoginSheet(); sh = ss.getSheetByName(SH_AKUN_LOGIN); }
  var data = sh.getDataRange().getValues();
  var hash = _hashPassword(passwordPlain);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nik)) {
      sh.getRange(i + 1, 1, 1, 5).setValues([[nik, nama, role, hash, true]]);
      Logger.log('Akun ' + nik + ' di-update.');
      return;
    }
  }
  sh.appendRow([nik, nama, role, hash, true]);
  Logger.log('Akun ' + nik + ' ditambahkan.');
}

// ================================================================
//  PANEL ADMIN — MANAJEMEN USER (web, tanpa sentuh Apps Script editor)
// ------------------------------------------------------------
//  Dipanggil dari admin_users.html. Hanya boleh dipakai oleh role
//  TL/Admin (dicek juga di frontend lewat WH_SESSION.fullAccess, TAPI
//  divalidasi ULANG di sini/backend supaya tidak bisa dilewati dengan
//  panggil API langsung). actorNik = NIK yang sedang login (pelaku
//  aksi), dipakai untuk validasi otorisasi & jejak audit.
// ================================================================
function _actorIsFullAccess(actorNik) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_AKUN_LOGIN);
  if (!sh) return false;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(actorNik)) {
      var role = String(data[i][2] || '').toUpperCase();
      return role === 'TL' || role.indexOf('ADMIN') !== -1;
    }
  }
  return false;
}

// Daftar SEMUA akun (TANPA password/hash) untuk ditampilkan di tabel
// panel admin. NIK sengaja tidak disensor -- itu identitas publik
// (kartu karyawan), yang dirahasiakan hanya PasswordHash-nya.
function getAkunList(actorNik) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh membuka panel ini.' };
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) return { success: false, error: 'Sheet AKUN_LOGIN belum ada.' };
    var data = sh.getDataRange().getValues();
    var out = [];
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0]) continue;
      out.push({
        rowIndex: i + 1,
        nik: String(r[0]),
        nama: String(r[1] || ''),
        role: String(r[2] || ''),
        aktif: r[4] === true || String(r[4]).toUpperCase() === 'TRUE',
        kategori: /^PEG/i.test(String(r[0])) ? 'OS' : 'Internal',
        adaTandaTangan: !!String(r[5] || '')
      });
    }
    out.sort(function (a, b) { return a.nama < b.nama ? -1 : (a.nama > b.nama ? 1 : 0); });
    return { success: true, data: out };
  } catch (err) { return { success: false, error: err.message }; }
}

// Tambah akun baru. NIK karyawan outsourcing HARUS diawali "PEG" supaya
// otomatis terdeteksi kategori OS (konsisten dengan aturan lama di
// dokumentasi -- selain itu otomatis dianggap Internal).
function adminTambahUser(actorNik, nik, nama, role, passwordAwal) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh menambah user.' };
    nik = String(nik || '').trim().toUpperCase();
    nama = String(nama || '').trim();
    role = String(role || '').trim();
    if (!nik || !nama || !role || !passwordAwal) return { success: false, error: 'NIK, Nama, Role, dan Password awal wajib diisi.' };
    if (String(passwordAwal).length < 6) return { success: false, error: 'Password awal minimal 6 karakter.' };

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) { setupAkunLoginSheet(); sh = ss.getSheetByName(SH_AKUN_LOGIN); }
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === nik) {
        return { success: false, error: 'NIK ' + nik + ' sudah terdaftar. Pakai aksi "Reset Password" kalau mau ganti sandinya.' };
      }
    }
    sh.appendRow([nik, nama, role, _hashPassword(passwordAwal), true]);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Reset/ganti password akun yang sudah ada (dipakai juga untuk kasus
// karyawan lupa sandi).
function adminResetPassword(actorNik, nik, passwordBaru) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh reset password.' };
    if (!passwordBaru || String(passwordBaru).length < 6) return { success: false, error: 'Password baru minimal 6 karakter.' };
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) return { success: false, error: 'Sheet AKUN_LOGIN belum ada.' };
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(nik)) {
        sh.getRange(i + 1, 4).setValue(_hashPassword(passwordBaru));
        return { success: true };
      }
    }
    return { success: false, error: 'NIK ' + nik + ' tidak ditemukan.' };
  } catch (err) { return { success: false, error: err.message }; }
}

// Aktifkan / nonaktifkan akun (login diblokir kalau Aktif=FALSE, tapi
// riwayat data karyawan tsb -- lembur, cuti, dll -- tetap tersimpan
// utuh, sama seperti cara manual lama).
function adminSetAktif(actorNik, nik, aktifBaru) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh menonaktifkan/mengaktifkan user.' };
    if (String(actorNik) === String(nik) && !aktifBaru) {
      return { success: false, error: 'Tidak bisa menonaktifkan akun sendiri yang sedang login.' };
    }
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) return { success: false, error: 'Sheet AKUN_LOGIN belum ada.' };
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(nik)) {
        sh.getRange(i + 1, 5).setValue(!!aktifBaru);
        return { success: true };
      }
    }
    return { success: false, error: 'NIK ' + nik + ' tidak ditemukan.' };
  } catch (err) { return { success: false, error: err.message }; }
}

// Edit Nama/Role (dulu harus edit langsung di sel Spreadsheet -- ini
// versi web-nya, tetap opsional dipakai lewat panel admin).
function adminEditUser(actorNik, nik, namaBaru, roleBaru) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh edit user.' };
    namaBaru = String(namaBaru || '').trim();
    roleBaru = String(roleBaru || '').trim();
    if (!namaBaru || !roleBaru) return { success: false, error: 'Nama dan Role wajib diisi.' };
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) return { success: false, error: 'Sheet AKUN_LOGIN belum ada.' };
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(nik)) {
        sh.getRange(i + 1, 2, 1, 2).setValues([[namaBaru, roleBaru]]);
        return { success: true };
      }
    }
    return { success: false, error: 'NIK ' + nik + ' tidak ditemukan.' };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  TOKEN FONNTE (WhatsApp) -- diisi lewat panel admin, TIDAK perlu
//  buka Apps Script editor / Script Properties manual lagi.
// ------------------------------------------------------------
//  - Token per-karyawan (device WA pengirim notif): disimpan di
//    Script Property "FONNTE_TOKEN_<NIK>".
//  - Nomor approver per-departemen/plant (boleh beda2 per departemen):
//    disimpan di "FONNTE_APPROVER_WA_<WORKSPACE_KEY>". Kalau kosong,
//    otomatis fallback ke "FONNTE_APPROVER_WA" (satu nomor utk semua
//    plant) -- lihat sendWaNotifLembur()/reminder di atas.
//  Satu Script Properties store ini DIPAKAI BERSAMA oleh semua plant
//  (satu deployment Apps Script), jadi aman diisi dari plant mana pun,
//  tidak akan tabrakan selama NIK unik per karyawan.
// ================================================================
function adminSetFonnteToken(actorNik, nik, token) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh mengatur token WA.' };
    nik = String(nik || '').trim().toUpperCase();
    token = String(token || '').trim();
    if (!nik) return { success: false, error: 'NIK wajib diisi.' };
    var props = PropertiesService.getScriptProperties();
    if (!token) { props.deleteProperty('FONNTE_TOKEN_' + nik); return { success: true, cleared: true }; }
    props.setProperty('FONNTE_TOKEN_' + nik, token);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Status token per NIK -- TIDAK mengembalikan token aslinya (sekali
// disimpan, cukup lihat status "sudah/belum diisi" saja, sama seperti
// prinsip password yang di-hash: tidak perlu ditampilkan ulang).
function adminGetFonnteStatus(actorNik) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak.' };
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties();
    var tokenNiks = {};
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('FONNTE_TOKEN_') === 0) tokenNiks[k.substring('FONNTE_TOKEN_'.length)] = true;
    });
    return {
      success: true,
      tokenNiks: tokenNiks,
      approverWaWorkspace: props.getProperty('FONNTE_APPROVER_WA_' + ACTIVE_WORKSPACE) ? 'diisi' : '',
      approverWaUmum: props.getProperty('FONNTE_APPROVER_WA') ? 'diisi' : '',
      workspace: ACTIVE_WORKSPACE
    };
  } catch (err) { return { success: false, error: err.message }; }
}

// Nomor approver WA khusus workspace aktif saat ini (dept/plant yg
// sedang login). Kosongkan (isi string kosong) utk hapus & fallback
// ke nomor umum FONNTE_APPROVER_WA.
function adminSetFonnteApproverWa(actorNik, nomorWa) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh mengatur nomor approver WA.' };
    nomorWa = String(nomorWa || '').trim();
    var props = PropertiesService.getScriptProperties();
    var key = 'FONNTE_APPROVER_WA_' + ACTIVE_WORKSPACE;
    if (!nomorWa) { props.deleteProperty(key); return { success: true, cleared: true }; }
    props.setProperty(key, nomorWa);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  SEEDER AKUN — daftarkan BANYAK akun sekaligus dalam 1x Run, supaya
//  tidak perlu bolak-balik edit 1 baris setAkunPasswordHelper().
//
//  CARA PAKAI: edit daftar di bawah (tambah/ubah baris sesuai
//  kebutuhan), lalu di Apps Script editor pilih fungsi
//  "seedAkunCibitungFittingImport" di dropdown -> klik Run.
//  Aman dijalankan berkali-kali (akun yang sudah ada akan di-UPDATE,
//  bukan dobel).
// ================================================================
// ================================================================
//  SEEDER AKUN (generik) — daftarkan/update banyak akun sekaligus
//  LANGSUNG ke spreadsheet milik 1 workspace tertentu, TIDAK bergantung
//  pada variabel global SPREADSHEET_ID (supaya tidak salah sasaran
//  departemen kalau dijalankan manual dari Apps Script editor).
// ================================================================
function seedAkunUntukWorkspace(workspaceKey, daftarAkun) {
  var targetId = resolveWorkspaceSpreadsheetId(workspaceKey); // error jelas kalau belum di-provision
  var ss = SpreadsheetApp.openById(targetId);
  var sh = ss.getSheetByName(SH_AKUN_LOGIN);
  if (!sh) {
    sh = ss.insertSheet(SH_AKUN_LOGIN);
    sh.getRange(1, 1, 1, 5).setValues([['NIK', 'Nama', 'Role', 'PasswordHash', 'Aktif']]);
    sh.setFrozenRows(1);
  }
  var data = sh.getDataRange().getValues();
  daftarAkun.forEach(function (a) {
    var nik = a[0], nama = a[1], role = a[2], hash = _hashPassword(a[3]);
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(nik)) {
        sh.getRange(i + 1, 1, 1, 5).setValues([[nik, nama, role, hash, true]]);
        found = true;
        break;
      }
    }
    if (!found) { sh.appendRow([nik, nama, role, hash, true]); data.push([nik]); }
  });
  Logger.log(daftarAkun.length + ' akun disimpan ke workspace "' + workspaceKey + '"');
  Logger.log('Spreadsheet: ' + ss.getUrl());
}

// ================================================================
//  SEEDER AKUN — versi TEKS BIASA (tanpa kurung array), jauh lebih
//  aman dari salah ketik dibanding format array-dalam-array.
//  Format per baris: NIK, Nama, Role, Password
//  (boleh ada spasi setelah koma, baris kosong otomatis diabaikan)
// ================================================================
function seedAkunDariTeks(workspaceKey, teksAkun) {
  var baris = String(teksAkun).split('\n');
  var daftarAkun = [];
  baris.forEach(function (b) {
    b = b.trim();
    if (!b) return; // lewati baris kosong
    var kol = b.split(',').map(function (s) { return s.trim(); });
    if (kol.length < 4) {
      throw new Error('Baris tidak lengkap (harus 4 bagian dipisah koma: NIK, Nama, Role, Password): "' + b + '"');
    }
    daftarAkun.push([kol[0], kol[1], kol[2], kol[3]]);
  });
  seedAkunUntukWorkspace(workspaceKey, daftarAkun);
}


function seedAkunCibitungFittingImport() {
  seedAkunDariTeks('cibitung_fitting_import', `
    2106619, Sandy Tyas Leo Saputra, TL, Rucika321
    PEG21101254, Doni Mulya Y, Technician I, Rucika123
    PEG25112073, Iman Abdul Rahman, Technician I, Rucika123
    PEG22111246, Ivan Reynata, Admin Wh Fitting, Rucika321
    2165310, Saepul Ganni, Technician I, Rucika123
    2168311, Wang Sutrisno, Technician I, Rucika321
    2155807, Sulistyo, Technician I, Rucika123
  `);
}

// ---- Wrapper siap-Run (tinggal pilih di dropdown, tidak perlu isi
//      parameter manual) untuk bikin spreadsheet 2 departemen baru ----
function jalankanProvisionFittingRucika() {
  var res = provisionDepartmentSpreadsheet('Fitting Rucika', false);
  Logger.log('=== SELESAI: Fitting Rucika ===');
  Logger.log('Spreadsheet ID: ' + res.spreadsheetId);
  Logger.log('URL: ' + res.url);
  Logger.log('LANGKAH SELANJUTNYA: copy ID di atas ke WORKSPACE_MAP[\'cibitung_fitting_rucika\'], lalu Deploy ulang.');
}
function jalankanProvisionPipaRucika() {
  var res = provisionDepartmentSpreadsheet('Pipa Rucika', false);
  Logger.log('=== SELESAI: Pipa Rucika ===');
  Logger.log('Spreadsheet ID: ' + res.spreadsheetId);
  Logger.log('URL: ' + res.url);
  Logger.log('LANGKAH SELANJUTNYA: copy ID di atas ke WORKSPACE_MAP[\'cibitung_pipa_rucika\'], lalu Deploy ulang.');
}


// ---- Fitting Rucika (Cibitung) -- BARU AKTIF SETELAH:
//   1) provisionDepartmentSpreadsheet('Fitting Rucika', false) sudah dijalankan
//   2) ID hasilnya sudah diisi ke WORKSPACE_MAP['cibitung_fitting_rucika']
//   3) Deploy ulang
function seedAkunCibitungFittingRucika() {
  seedAkunDariTeks('cibitung_fitting_rucika', `
    2139614, Nurmukhayan, TL, Rucika321
    2189312, Suryadi, Technician I, Rucika123
    2188612, Syamsudin, Technician I, Rucika123
    2131202, Dede Sarip Hidayat, Technician I, Rucika123
    PEG24032730, Saepulloh, Admin Fitting, Rucika123
    PEG21111298, Lucky Yulianto, Technician I, Rucika123
    PEG22072699, Deden Maulana, Technician I, Rucika123
    PEG24051679, Abdul Aziz, Technician I, Rucika123
  `);
}

// ---- Pipa Rucika (Cibitung) -- sama syaratnya seperti Fitting Rucika di
//      atas, tapi pakai jalankanProvisionPipaRucika() & WORKSPACE_MAP
//      ['cibitung_pipa_rucika']. GANTI daftar di bawah sesuai karyawan asli.
function seedAkunCibitungPipaRucika() {
  seedAkunDariTeks('cibitung_pipa_rucika', `
    NIK_TL_PIPA, Nama TL Pipa Rucika, TL, gantiPasswordIni
    NIK_KARYAWAN1, Nama Karyawan 1, Technician I, gantiPasswordIni
  `);
}


// ================================================================
//  LOGIN — dipanggil dari login.html
//  plant & dept datang dari pilihan dropdown di form login, dipetakan
//  ke workspace key yang sama dipakai handleApiRequest (lihat
//  WORKSPACE_MAP di atas). Kalau berhasil, browser menyimpan
//  workspace key ini (sessionStorage) dan menyertakannya di SETIAP
//  request berikutnya supaya data yang terbuka fokus ke departemen itu.
// ================================================================
function loginUser(plant, dept, nik, password) {
  try {
    var workspaceKey = String(plant || '').trim() + '_' + String(dept || '').trim();
    if (!WORKSPACE_MAP.hasOwnProperty(workspaceKey)) {
      return { success: false, error: 'Plant/Departemen tidak dikenali.' };
    }
    var targetSpreadsheetId;
    try {
      targetSpreadsheetId = resolveWorkspaceSpreadsheetId(workspaceKey);
    } catch (resolveErr) {
      return { success: false, error: 'Departemen ini belum aktif/di-provision. Hubungi admin.' };
    }

    var ss = SpreadsheetApp.openById(targetSpreadsheetId);
    var sh = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) return { success: false, error: 'Sheet AKUN_LOGIN belum di-setup untuk departemen ini.' };

    var data = sh.getDataRange().getValues();
    var hash = _hashPassword(password);
    var nikInput = String(nik).trim().toUpperCase();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (String(row[0]).trim().toUpperCase() === nikInput && row[4] !== false) {
        if (String(row[3]) === hash) {
          return { success: true, workspace: workspaceKey, nik: row[0], nama: row[1], role: row[2] };
        }
        return { success: false, error: 'NIK atau kata sandi salah.' };
      }
    }
    return { success: false, error: 'NIK tidak ditemukan di departemen ini.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  PROVISIONING — bikin spreadsheet baru untuk 1 departemen baru,
//  menyalin SELURUH struktur (sheet, header, kolom, formatting) dari
//  spreadsheet yang sedang berjalan sekarang, lalu MENGOSONGKAN semua
//  baris data transaksional (header tetap ada) supaya departemen baru
//  mulai dari kondisi bersih -- bukan ikut kebawa data Fitting Import.
//
//  CARA PAKAI (jalankan 1x per departemen baru, lewat Apps Script
//  editor -> pilih fungsi ini di dropdown -> klik Run):
//    provisionDepartmentSpreadsheet('Fitting Rucika', false)
//    provisionDepartmentSpreadsheet('Pipa Rucika', false)
//    provisionDepartmentSpreadsheet('Sparepart', false)
//  Parameter kedua (includeRekapMuatan) HARUS false untuk semua
//  departemen selain Fitting Import, sesuai instruksi: Rekap Muatan
//  cuma ada di Warehouse Fitting Import.
//
//  Setelah selesai, ID spreadsheet baru muncul di Logger (View ->
//  Logs / Executions) -- copy ID itu ke WORKSPACE_MAP di atas.
// ================================================================
function provisionDepartmentSpreadsheet(namaDept, includeRekapMuatan) {
  var sourceId = WORKSPACE_MAP['cibitung_fitting_import'];
  var sourceFile = DriveApp.getFileById(sourceId);
  var newName = 'Warehouse App - Cibitung - ' + namaDept;
  var copyFile = sourceFile.makeCopy(newName);
  var newId = copyFile.getId();
  var ss = SpreadsheetApp.openById(newId);

  // Sheet yang datanya TRANSAKSIONAL -> dikosongkan (header baris 1 tetap)
  var sheetsToClear = [
    SH_STOCK, SH_KIRIM, SH_PRODUKSI, SH_PENGIRIMAN,
    SH_KARYAWAN_LEMBUR, SH_LEMBUR_LOG, SH_ABSENSI_LOG, SH_HARI_LIBUR,
    SH_AKUN_LOGIN, SH_PIC_PHOTOS
  ];
  sheetsToClear.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
    }
  });

  // Rekap Muatan cuma untuk Warehouse Fitting Import -> hapus sheet-nya
  // di departemen lain supaya tidak membingungkan (menu tetap ada di
  // frontend, tapi baiknya nanti disembunyikan juga untuk departemen ini).
  if (!includeRekapMuatan) {
    [SH_REKAP_MUATAN, SH_REKAP_FITTING].forEach(function (name) {
      var sh = ss.getSheetByName(name);
      if (sh) ss.deleteSheet(sh);
    });
  }

  // Pastikan sheet AKUN_LOGIN ada di spreadsheet baru ini (dibuat langsung
  // di objek `ss` milik spreadsheet baru -- TIDAK bergantung pada
  // SPREADSHEET_ID global, supaya tidak salah sasaran ke spreadsheet lain).
  if (!ss.getSheetByName(SH_AKUN_LOGIN)) {
    var shAkun = ss.insertSheet(SH_AKUN_LOGIN);
    shAkun.getRange(1, 1, 1, 5).setValues([['NIK', 'Nama', 'Role', 'PasswordHash', 'Aktif']]);
    shAkun.setFrozenRows(1);
  }
  // Catatan: kalau spreadsheet sumber SUDAH punya AKUN_LOGIN, sheet itu ikut
  // ter-copy otomatis oleh makeCopy() dan sudah dikosongkan lewat loop
  // sheetsToClear di atas -- departemen baru selalu mulai dari nol.

  Logger.log('Spreadsheet baru dibuat untuk departemen "' + namaDept + '"');
  Logger.log('Spreadsheet ID: ' + newId);
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('LANGKAH SELANJUTNYA: copy ID di atas ke WORKSPACE_MAP, lalu deploy ulang.');

  return { success: true, spreadsheetId: newId, url: ss.getUrl() };
}

function getKaryawanList() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_KARYAWAN_LEMBUR);
    if (!sh) return { success: false, error: 'Sheet KARYAWAN_LEMBUR belum ada. Jalankan setupLemburSheets() dulu di Apps Script editor.' };
    var data = sh.getDataRange().getValues();
    var out = [];
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0]) continue;
      out.push({
        kode: String(r[0]), nama: String(r[1]), kategori: _kategoriDariNIK(r[0]), jabatan: String(r[3]),
        jamWeekday: Number(r[4]) || 0, jamSabtu: Number(r[5]) || 0, jamMinggu: Number(r[6]) || 0,
        aktif: r[7] === true || String(r[7]).toUpperCase() === 'TRUE'
      });
    }
    return { success: true, data: out };
  } catch (err) { return { success: false, error: err.message }; }
}

function _timeStrToMinutes(t) {
  if (!t) return null;
  var p = String(t).split(':');
  if (p.length !== 2) return null;
  var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// ================================================================
//  KATEGORI LEMBUR -- klasifikasi jenis aktivitas lembur (dipakai di
//  dropdown Form Lembur dan grafik tren kategori di Monitoring FTE).
// ================================================================
var KATEGORI_LEMBUR_LIST = [
  { kode: 'loading',       label: 'Loading / Muat',            warna: '#10b981' },
  { kode: 'preparation',   label: 'Preparation / Persiapan',   warna: '#3b82f6' },
  { kode: 'putaway',       label: 'Putaway / Penyimpanan',     warna: '#8b5cf6' },
  { kode: 'receiving',     label: 'Receiving / Bongkar',       warna: '#f59e0b' },
  { kode: 'stock',         label: 'Stock / Inventory',         warna: '#06b6d4' },
  { kode: 'checking',      label: 'Checking / Administrasi',   warna: '#ec4899' },
  { kode: 'housekeeping',  label: 'Housekeeping / 5S',         warna: '#84cc16' },
  { kode: 'lain',          label: 'Lain-lain',                 warna: '#6b7280' }
];
function getKategoriLemburList() { return { success: true, data: KATEGORI_LEMBUR_LIST }; }

function saveLembur(data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet LEMBUR_LOG belum ada. Jalankan setupLemburSheets() dulu.' };

    var m1 = _timeStrToMinutes(data.jamMulai);
    var m2 = _timeStrToMinutes(data.jamSelesai);
    if (m1 == null || m2 == null) return { success: false, error: 'Format jam tidak valid (harus HH:MM)' };
    var durMin = m2 - m1;
    if (durMin <= 0) durMin += 24 * 60; // lembur lewat tengah malam
    var durJam = durMin / 60;
    // Sesuai catatan di formulir SPL: lembur di atas 4 jam yang melewati
    // waktu istirahat otomatis kepotong 1 jam.
    if (durJam > 4) durJam -= 1;
    durJam = Math.round(durJam * 100) / 100;

    sh.appendRow([
      new Date(), data.tanggal, data.kode, data.nama || '',
      data.jamMulai, data.jamSelesai, durJam,
      data.keterangan || '', data.inputOleh || '',
      'Pending', '', // Status (kol J) & ApprovedBy/NIK TL (kol K)
      '', // Catatan attestasi TL (kol L) -- diisi approveItem()
      data.kategoriLembur || '', // Kategori Lembur (kol M) -- PINDAH dari L krn tadinya
      // bentrok sama kolom Catatan attestasi (L) di approveItem(). Lihat
      // KATEGORI_LEMBUR_LIST untuk daftar kategorinya.
      '', '', '', '' // EditReqStatus(N), EditReqData(O), EditReqBy(P), EditReqNote(Q)
    ]);

    // ---- Notifikasi WhatsApp ke approver (khusus karyawan INTERNAL) ----
    // Dibungkus try/catch sendiri supaya kalau WA gagal terkirim (token
    // belum diisi, kuota habis, dsb), penyimpanan lembur TETAP dianggap
    // sukses -- approval notif cuma bonus, bukan syarat simpan data.
    var waNotifSent = false;
    var isInternal  = false;
    try {
      var kategori = _kategoriDariNIK(data.kode);
      isInternal = (kategori === 'Internal');
      if (isInternal) {
        waNotifSent = sendWaNotifLembur(data.kode, data.nama || data.kode, data.tanggal, data.jamMulai, data.jamSelesai, durJam, data.keterangan || '-');
      }
    } catch (notifErr) {
      Logger.log('Gagal kirim notif WA lembur: ' + notifErr.message);
    }

    return { success: true, totalJam: durJam, waNotifSent: waNotifSent, isInternal: isInternal };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  Kirim notifikasi WhatsApp (via Fonnte) ke approver ketika ada
//  input lembur karyawan INTERNAL baru, supaya segera di-approve.
//
//  Setiap karyawan Internal punya nomor WA + device Fonnte SENDIRI
//  (bukan nomor pribadi admin), supaya laporan terkirim "atas nama"
//  karyawan yang bersangkutan, bukan numpang nomor orang lain.
//
//  SETUP (sekali saja, di Apps Script editor):
//   Project Settings (ikon gerigi) -> Script Properties -> tambahkan:
//
//     FONNTE_APPROVER_WA   = nomor WA approver (Pak Sandy), format 628xxxxxxxxxx
//                            -- ini TUJUAN, sama untuk semua karyawan
//
//     FONNTE_TOKEN_<KODE>  = token device Fonnte milik nomor WA karyawan
//                            tsb (KODE = kolom "Kode" di sheet KARYAWAN_LEMBUR)
//                            -- ini PENGIRIM, beda-beda per karyawan
//
//   Contoh berdasarkan data karyawan saat ini:
//     FONNTE_TOKEN_2168311  -> token device WA milik WANG SUTRISNO
//     FONNTE_TOKEN_2165310  -> token device WA milik SAEPUL GANNI
//     FONNTE_TOKEN_2155807  -> token device WA milik SULISTYO
//
//   FONNTE_TOKEN (tanpa akhiran kode) bersifat OPSIONAL, dipakai
//   sebagai fallback kalau suatu kode belum punya token sendiri
//   (misalnya karyawan baru yang device WA-nya belum disetup).
//
//  Return: true kalau berhasil terkirim (Fonnte balas status:true),
//  false kalau gagal/dilewati (biar frontend tahu apakah perlu kasih
//  tahu user "notif WA terkirim" atau tidak).
// ================================================================
function sendWaNotifLembur(kode, nama, tanggal, jamMulai, jamSelesai, durJam, keterangan) {
  var props   = PropertiesService.getScriptProperties();
  // Nomor approver: coba versi khusus workspace ini dulu (FONNTE_APPROVER_WA_<WORKSPACE>,
  // supaya tiap plant/departemen bisa punya approver WA berbeda), baru fallback
  // ke FONNTE_APPROVER_WA umum (dipakai kalau semua plant approver-nya sama).
  var target  = props.getProperty('FONNTE_APPROVER_WA_' + ACTIVE_WORKSPACE) || props.getProperty('FONNTE_APPROVER_WA');
  // Token pengirim: coba punya karyawan ybs dulu, baru fallback ke token umum.
  var token   = props.getProperty('FONNTE_TOKEN_' + kode) || props.getProperty('FONNTE_TOKEN');
  if (!token || !target) {
    Logger.log('Token Fonnte untuk kode "'+kode+'" atau FONNTE_APPROVER_WA belum diisi -- notif WA dilewati.');
    return false;
  }

  var pesan =
    '*PENGAJUAN LEMBUR BARU*\n\n' +
    'Nama       : ' + nama + '\n' +
    'NIK        : ' + kode + '\n' +
    'Tanggal    : ' + tanggal + '\n' +
    'Jam        : ' + jamMulai + ' - ' + jamSelesai + ' (' + durJam + ' jam)\n' +
    'Keterangan : ' + keterangan + '\n\n' +
    'Mohon Segera di input di aplikasi Sunfish, terimakasih';

  try {
    var res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post',
      headers: { Authorization: token },
      payload: { target: target, message: pesan, countryCode: '62' },
      muteHttpExceptions: true
    });
    var body = res.getContentText();
    Logger.log('Fonnte response: ' + body);
    var parsed = JSON.parse(body);
    return parsed && parsed.status === true;
  } catch (waErr) {
    Logger.log('Fonnte fetch error: ' + waErr.message);
    return false;
  }
}

function getLemburList(filter) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet LEMBUR_LOG belum ada.' };
    var data = sh.getDataRange().getValues();
    var out = [];
    var bulan = filter && filter.bulan, tahun = filter && filter.tahun;
    var kodeFilter = filter && filter.kode;
    var hariLibur = (bulan && tahun) ? _getHariLiburSet(Number(bulan), Number(tahun)) : {};
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[1]) continue;
      var tgl = new Date(r[1]);
      if (bulan && tahun) {
        if ((tgl.getMonth() + 1) != Number(bulan) || tgl.getFullYear() != Number(tahun)) continue;
      }
      if (kodeFilter && String(r[2]) !== String(kodeFilter)) continue;
      var dk = _fmtYMD(tgl);
      var editReqStatus = String(r[13] || ''); // kolom N
      out.push({
        rowIndex: i + 1, timestamp: r[0] ? new Date(r[0]).toISOString() : '',
        tanggal: dk, kode: String(r[2]), nama: String(r[3]),
        jamMulai: _fmtTime(r[4]), jamSelesai: _fmtTime(r[5]), totalJam: Number(r[6]) || 0,
        keterangan: String(r[7] || ''), inputOleh: String(r[8] || ''),
        approvalStatus: String(r[9] || 'Pending'), approvedBy: String(r[10] || ''),
        kategoriLembur: String(r[12] || ''), // kolom M
        editReqStatus: editReqStatus,
        editReqData: editReqStatus === 'Pending' ? String(r[14] || '') : '', // kolom O (JSON)
        editReqBy: String(r[15] || ''), // kolom P
        isMinggu: tgl.getDay() === 0,
        isHariLibur: !!hariLibur[dk],
        hariLiburLabel: hariLibur[dk] || ''
      });
    }
    out.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
    return { success: true, data: out };
  } catch (err) { return { success: false, error: err.message }; }
}

// Total jam lembur per kategori untuk SATU bulan -- dipanggil berulang
// dari Monitoring FTE (6x, satu per bulan) untuk bikin grafik tren,
// persis pola yang sudah dipakai grafik "Tren Over Time %".
// Versi BATCH dari getLemburKategoriBulanan -- hitung total per kategori
// untuk 6 BULAN SEKALIGUS dalam SATU kali baca sheet (bukan 6x baca
// terpisah kayak sebelumnya). Ini yang bikin Monitoring FTE lambat --
// grafik tren kategori manggil server 6x berurutan padahal bisa 1x saja.
function getLemburKategoriTrend6Bulan(bulanAkhir, tahunAkhir) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet LEMBUR_LOG belum ada.' };
    var data = sh.getDataRange().getValues();

    // Siapkan 6 bucket bulan (bulanAkhir mundur 5 bulan)
    var months = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(Number(tahunAkhir), Number(bulanAkhir) - 1 - i, 1);
      var key = d.getFullYear() + '-' + (d.getMonth() + 1);
      var totals = {};
      KATEGORI_LEMBUR_LIST.forEach(function (k) { totals[k.kode] = 0; });
      months.push({ key: key, bulan: d.getMonth() + 1, tahun: d.getFullYear(), totals: totals });
    }
    var byKey = {};
    months.forEach(function (m) { byKey[m.key] = m; });

    for (var i2 = 1; i2 < data.length; i2++) {
      var r = data[i2];
      if (!r[1]) continue;
      var tgl = new Date(r[1]);
      var key = tgl.getFullYear() + '-' + (tgl.getMonth() + 1);
      var bucket = byKey[key];
      if (!bucket) continue; // di luar 6 bulan yang diminta
      var kat = String(r[12] || '').trim();
      if (!bucket.totals.hasOwnProperty(kat)) kat = 'lain';
      bucket.totals[kat] += Number(r[6]) || 0;
    }

    var results = months.map(function (m) {
      Object.keys(m.totals).forEach(function (k) { m.totals[k] = Math.round(m.totals[k] * 100) / 100; });
      return m.totals;
    });
    return { success: true, results: results };
  } catch (err) { return { success: false, error: err.message }; }
}

function getLemburKategoriBulanan(bulan, tahun) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet LEMBUR_LOG belum ada.' };
    var data = sh.getDataRange().getValues();

    var totals = {};
    KATEGORI_LEMBUR_LIST.forEach(function (k) { totals[k.kode] = 0; });

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[1]) continue;
      var tgl = new Date(r[1]);
      if ((tgl.getMonth() + 1) != Number(bulan) || tgl.getFullYear() != Number(tahun)) continue;
      var kat = String(r[12] || '').trim();
      if (!totals.hasOwnProperty(kat)) kat = 'lain'; // data lama sebelum fitur ini ada / kategori kosong
      totals[kat] += Number(r[6]) || 0;
    }
    Object.keys(totals).forEach(function (k) { totals[k] = Math.round(totals[k] * 100) / 100; });
    return { success: true, totals: totals };
  } catch (err) { return { success: false, error: err.message }; }
}


// Versi ringkas getPendingApprovals -- cuma JUMLAHNYA, dipakai saat TL
// login untuk tahu perlu diarahkan ke Monitoring FTE atau tidak, tanpa
// perlu ambil semua detail datanya.
function getPendingApprovalCount() {
  var res = getPendingApprovals();
  if (!res.success) return { success: false, error: res.error };
  return { success: true, jumlah: res.data.length };
}

function getPendingApprovals() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var out = [];

    var shLem = ss.getSheetByName(SH_LEMBUR_LOG);
    if (shLem) {
      var dl = shLem.getDataRange().getValues();
      for (var i = 1; i < dl.length; i++) {
        var r = dl[i];
        if (!r[1]) continue;
        var st = String(r[9] || 'Pending');
        if (st === 'Pending') {
          out.push({
            tipe: 'lembur', rowIndex: i + 1, tanggal: _fmtYMD(new Date(r[1])),
            kode: String(r[2]), nama: String(r[3]),
            jamMulai: _fmtTime(r[4]), jamSelesai: _fmtTime(r[5]), totalJam: Number(r[6]) || 0,
            keterangan: String(r[7] || '')
          });
        }
        // Pengajuan edit/hapus (kolom N = EditReqStatus) -- terpisah dari
        // status approval catatan lembur itu sendiri (kolom J), supaya
        // catatan yang SUDAH disetujui pun tetap bisa diajukan edit/hapus.
        var editReqSt = String(r[13] || '');
        if (editReqSt === 'Pending') {
          var reqData = {};
          try { reqData = JSON.parse(r[14] || '{}'); } catch (e) {}
          out.push({
            tipe: 'edit_lembur', rowIndex: i + 1, tanggal: _fmtYMD(new Date(r[1])),
            kode: String(r[2]), nama: String(r[3]),
            jamMulaiLama: _fmtTime(r[4]), jamSelesaiLama: _fmtTime(r[5]), totalJamLama: Number(r[6]) || 0,
            keteranganLama: String(r[7] || ''),
            aksi: reqData.action || 'edit',
            jamMulaiBaru: reqData.jamMulai || '', jamSelesaiBaru: reqData.jamSelesai || '',
            totalJamBaru: reqData.totalJam || 0, keteranganBaru: reqData.keterangan || '',
            diajukanOleh: String(r[15] || '')
          });
        }
      }
    }

    var shAbs = ss.getSheetByName(SH_ABSENSI_LOG);
    if (shAbs) {
      var da = shAbs.getDataRange().getValues();
      for (var j = 1; j < da.length; j++) {
        var ra = da[j];
        if (!ra[1]) continue;
        var sta = String(ra[7] || 'Pending');
        if (sta !== 'Pending') continue;
        out.push({
          tipe: 'cuti', rowIndex: j + 1, tanggal: _fmtYMD(new Date(ra[1])),
          kode: String(ra[2]), nama: String(ra[3]), jenis: String(ra[4]),
          keterangan: String(ra[5] || '')
        });
      }
    }

    out.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
    return { success: true, data: out };
  } catch (err) { return { success: false, error: err.message }; }
}

// tipe: 'lembur' | 'cuti'  |  keputusan: 'Disetujui' | 'Ditolak'
function approveItem(tipe, rowIndex, keputusan, approverNik) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetName = tipe === 'cuti' ? SH_ABSENSI_LOG : SH_LEMBUR_LOG;
    var statusCol  = tipe === 'cuti' ? 8 : 10;  // kolom H (cuti) / J (lembur), 1-based
    var catatanCol = tipe === 'cuti' ? 10 : 12; // kolom J (cuti) / L (lembur) -- catatan attestasi
    var sh = ss.getSheetByName(sheetName);
    if (!sh) return { success: false, error: 'Sheet ' + sheetName + ' tidak ditemukan.' };
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, error: 'Baris tidak valid.' };

    var row = sh.getRange(rowIndex, 1, 1, 4).getValues()[0]; // [Timestamp, Tanggal, Kode, Nama]
    var kode = String(row[2] || ''), nama = String(row[3] || '');

    sh.getRange(rowIndex, statusCol, 1, 2).setValues([[keputusan, approverNik || '']]);

    var catatan = '';
    if (keputusan === 'Disetujui') {
      catatan = 'Sudah dipastikan TL sudah menginput cuti/lembur karyawan ' + nama + ' (' + kode + ') di aplikasi Sunfish.';
    }
    sh.getRange(rowIndex, catatanCol).setValue(catatan);

    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  EDIT LEMBUR OLEH TL — dipanggil dari panel approval (fte_dashboard)
//  saat TL mendapati input jam/tanggal lembur karyawan tidak sesuai
//  (mis. beda dengan jam keluar sebenarnya) SEBELUM catatan itu
//  di-Setujui/Tolak. TL langsung menimpa nilainya di LEMBUR_LOG.
//
//  Beda dengan submitEditLembur()/approveEditRequest(): itu alur
//  pengajuan edit oleh KARYAWAN atas catatan yang sudah lama/sudah
//  diproses, dan tetap butuh approval TL secara terpisah. Di sini
//  catatannya masih berstatus Pending sehingga TL berwenang
//  mengoreksi langsung tanpa alur pengajuan tambahan.
// ================================================================
// tanggalBaru: 'YYYY-MM-DD'. jamMulaiBaru/jamSelesaiBaru: 'HH:MM'.
function editLemburByTL(rowIndex, tanggalBaru, jamMulaiBaru, jamSelesaiBaru, keteranganBaru, approverNik) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet ' + SH_LEMBUR_LOG + ' tidak ditemukan.' };
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, error: 'Baris tidak valid / sudah tidak ada.' };

    var statusSekarang = String(sh.getRange(rowIndex, 10).getValue() || 'Pending'); // kolom J
    if (statusSekarang !== 'Pending') {
      return { success: false, error: 'Catatan ini statusnya sudah "' + statusSekarang + '" -- tidak bisa diedit lewat panel approval lagi.' };
    }

    var m1 = _timeStrToMinutes(jamMulaiBaru);
    var m2 = _timeStrToMinutes(jamSelesaiBaru);
    if (m1 == null || m2 == null) return { success: false, error: 'Format jam tidak valid (harus HH:MM).' };
    var durMin = m2 - m1;
    if (durMin <= 0) durMin += 24 * 60; // lembur lewat tengah malam
    var durJam = durMin / 60;
    if (durJam > 4) durJam -= 1; // potongan jam istirahat, konsisten dgn input awal (saveLembur/submitEditLembur)
    durJam = Math.round(durJam * 100) / 100;

    var tglDate = new Date(String(tanggalBaru) + 'T00:00:00');
    if (isNaN(tglDate.getTime())) return { success: false, error: 'Format tanggal tidak valid (harus YYYY-MM-DD).' };

    sh.getRange(rowIndex, 2).setValue(tglDate);                                   // B: Tanggal
    sh.getRange(rowIndex, 5, 1, 3).setValues([[jamMulaiBaru, jamSelesaiBaru, durJam]]); // E,F,G
    if (keteranganBaru != null) sh.getRange(rowIndex, 8).setValue(keteranganBaru); // H: Keterangan

    var catatanLama = String(sh.getRange(rowIndex, 12).getValue() || ''); // L: Catatan
    var jejak = '[Diedit TL (' + (approverNik || '-') + ') sebelum approve -> ' +
      _fmtYMD(tglDate) + ', ' + jamMulaiBaru + '-' + jamSelesaiBaru + ']';
    sh.getRange(rowIndex, 12).setValue((catatanLama ? catatanLama + ' ' : '') + jejak);

    return { success: true, totalJam: durJam };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  REMINDER WA OTOMATIS — Approval Cuti yang belum diproses TL >24 jam.
//  Dijadwalkan jalan 2x sehari (jam 11:00 & 16:00) lewat setupReminderTriggers().
//  Loop semua departemen yang sudah di-provision (WORKSPACE_MAP), sama
//  pola-nya dengan syncAllToSupabase().
// ================================================================
function remindPendingApprovals() {
  Object.keys(WORKSPACE_MAP).forEach(function (workspaceKey) {
    if (!WORKSPACE_MAP[workspaceKey]) return; // belum di-provision -> lewati
    try {
      ACTIVE_WORKSPACE = workspaceKey;
      SPREADSHEET_ID = resolveWorkspaceSpreadsheetId(workspaceKey);
      _remindPendingApprovalsWorkspaceAktif();
    } catch (err) {
      Logger.log('Gagal reminder utk ' + workspaceKey + ': ' + err.message);
    }
  });
}

function _remindPendingApprovalsWorkspaceAktif() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_ABSENSI_LOG);
  if (!sh) return;

  var data = sh.getDataRange().getValues();
  var now = new Date();
  var pendingLama = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[1]) continue;
    var status = String(r[7] || 'Pending');
    if (status !== 'Pending') continue;
    var submittedAt = (r[0] instanceof Date) ? r[0] : new Date(r[0]);
    var jamSejak = (now - submittedAt) / 3600000;
    if (jamSejak >= 24) {
      pendingLama.push({ nama: String(r[3] || ''), kode: String(r[2] || ''), tanggal: _fmtYMD(new Date(r[1])) });
    }
  }
  if (!pendingLama.length) return;

  var props  = PropertiesService.getScriptProperties();
  var token  = props.getProperty('FONNTE_TOKEN');
  var target = props.getProperty('FONNTE_APPROVER_WA_' + ACTIVE_WORKSPACE) || props.getProperty('FONNTE_APPROVER_WA');
  if (!token || !target) {
    Logger.log('FONNTE_TOKEN / FONNTE_APPROVER_WA belum di-set -- reminder dilewati untuk ' + ACTIVE_WORKSPACE);
    return;
  }

  var pesan =
    '*REMINDER APPROVAL CUTI* (' + ACTIVE_WORKSPACE + ')\n\n' +
    pendingLama.length + ' pengajuan cuti sudah lebih dari 24 jam belum diproses:\n' +
    pendingLama.map(function (p) { return '- ' + p.nama + ' (' + p.kode + ') — ' + p.tanggal; }).join('\n') +
    '\n\nMohon segera di-approve/tolak di aplikasi Sunfish.';

  try {
    UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post',
      headers: { Authorization: token },
      payload: { target: target, message: pesan, countryCode: '62' },
      muteHttpExceptions: true
    });
    Logger.log('Reminder terkirim untuk ' + ACTIVE_WORKSPACE + ' (' + pendingLama.length + ' item)');
  } catch (waErr) {
    Logger.log('Gagal kirim reminder WA: ' + waErr.message);
  }
}

// Jalankan SEKALI SAJA lewat Apps Script editor untuk memasang jadwal
// reminder otomatis jam 11:00 & 16:00 setiap hari.
function setupReminderTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'remindPendingApprovals') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('remindPendingApprovals').timeBased().atHour(11).everyDays(1).create();
  ScriptApp.newTrigger('remindPendingApprovals').timeBased().atHour(16).everyDays(1).create();
  Logger.log('Trigger reminder approval cuti terpasang: jam 11:00 & 16:00 setiap hari.');
}

// ================================================================
//  TANDA TANGAN DIGITAL TL — upload sekali, dipakai otomatis di
//  setiap SPL yang di-generate untuk lembur/cuti yang TL itu approve.
//  Disimpan di Drive (mirip pola savePhoto), URL-nya disimpan di
//  sheet AKUN_LOGIN kolom F (index 6).
// ================================================================
function uploadTlSignature(nik, dataUrl) {
  try {
    if (!nik || !dataUrl) return { success: false, error: 'Data tidak lengkap.' };
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) return { success: false, error: 'Sheet AKUN_LOGIN belum ada.' };

    var data = sh.getDataRange().getValues();
    var rowIdx = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(nik)) { rowIdx = i + 1; break; }
    }
    if (rowIdx === -1) return { success: false, error: 'NIK tidak ditemukan di AKUN_LOGIN.' };

    // Hapus file tanda tangan lama kalau ada
    var oldFileId = String(data[rowIdx - 1][5] || '');
    if (oldFileId) { try { DriveApp.getFileById(oldFileId).setTrashed(true); } catch (e) {} }

    var mimeType = 'image/png';
    var base64Data = dataUrl;
    if (dataUrl.indexOf(',') > -1) {
      var parts = dataUrl.split(',');
      base64Data = parts[1];
      if (parts[0].indexOf('jpeg') > -1 || parts[0].indexOf('jpg') > -1) mimeType = 'image/jpeg';
    }
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, 'ttd_' + nik + '.png');
    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Kolom F (6) khusus FileID tanda tangan. Pastikan header-nya ada.
    if (String(sh.getRange(1, 6).getValue()) !== 'TandaTanganFileId') {
      sh.getRange(1, 6).setValue('TandaTanganFileId');
    }
    sh.getRange(rowIdx, 6).setValue(file.getId());

    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

function _getTlSignatureBlob(nik) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_AKUN_LOGIN);
  if (!sh) return null;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(nik)) {
      var fileId = String(data[i][5] || '');
      if (!fileId) return null;
      try { return DriveApp.getFileById(fileId).getBlob(); } catch (e) { return null; }
    }
  }
  return null;
}

function hasTlSignature(nik) {
  return { success: true, hasSignature: !!_getTlSignatureBlob(nik) };
}


// ================================================================
//  EDIT/HAPUS LEMBUR — hanya boleh oleh akun yang membuat (kolom Kode).
//  Kalau catatannya masih BARU (<24 jam sejak diinput): boleh langsung
//  diedit/dihapus tanpa approval. Kalau sudah LEBIH dari 24 jam: tidak
//  langsung diterapkan -- disimpan sebagai PENGAJUAN yang harus di-
//  approve TL dulu (lihat approveEditRequest).
// ================================================================
var BATAS_EDIT_LANGSUNG_MS = 24 * 60 * 60 * 1000; // 24 jam

function _cekKepemilikanLembur(sh, rowIndex, nikRequester) {
  if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { ok: false, error: 'Baris tidak valid / sudah tidak ada.' };
  var row = sh.getRange(rowIndex, 1, 1, 3).getValues()[0]; // Timestamp, Tanggal, Kode
  var pemilikNik = String(row[2] || '').trim();
  if (pemilikNik !== String(nikRequester || '').trim()) {
    return { ok: false, error: 'Anda hanya bisa mengedit/menghapus catatan lembur milik sendiri.' };
  }
  var timestamp = row[0] ? new Date(row[0]) : null;
  var masihBaru = timestamp && ((new Date()).getTime() - timestamp.getTime()) < BATAS_EDIT_LANGSUNG_MS;
  return { ok: true, masihBaru: masihBaru, timestamp: timestamp };
}

function deleteLembur(rowIndex, nikRequester) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet tidak ditemukan' };

    var cek = _cekKepemilikanLembur(sh, rowIndex, nikRequester);
    if (!cek.ok) return { success: false, error: cek.error };

    if (cek.masihBaru) {
      sh.deleteRow(rowIndex);
      return { success: true, applied: true };
    }

    // Sudah lebih dari 24 jam -- ajukan permintaan hapus ke TL, jangan
    // langsung dihapus.
    sh.getRange(rowIndex, 14, 1, 4).setValues([[ // kolom N-Q
      'Pending', JSON.stringify({ action: 'delete' }), nikRequester || '', ''
    ]]);
    return { success: true, applied: false, needsApproval: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// newData: { jamMulai, jamSelesai, keterangan, kategoriLembur }
function submitEditLembur(rowIndex, nikRequester, newData) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet tidak ditemukan' };

    var cek = _cekKepemilikanLembur(sh, rowIndex, nikRequester);
    if (!cek.ok) return { success: false, error: cek.error };

    var m1 = _timeStrToMinutes(newData.jamMulai);
    var m2 = _timeStrToMinutes(newData.jamSelesai);
    if (m1 == null || m2 == null) return { success: false, error: 'Format jam tidak valid (harus HH:MM)' };
    var durMin = m2 - m1;
    if (durMin <= 0) durMin += 24 * 60;
    var durJam = durMin / 60;
    if (durJam > 4) durJam -= 1;
    durJam = Math.round(durJam * 100) / 100;

    if (cek.masihBaru) {
      // Masih baru -> langsung terapkan perubahan, tidak perlu approval.
      sh.getRange(rowIndex, 5, 1, 3).setValues([[newData.jamMulai, newData.jamSelesai, durJam]]); // E,F,G
      sh.getRange(rowIndex, 8).setValue(newData.keterangan || ''); // H
      sh.getRange(rowIndex, 13).setValue(newData.kategoriLembur || ''); // M
      return { success: true, applied: true };
    }

    // Sudah lebih dari 24 jam -- simpan sebagai pengajuan, TL yang approve.
    sh.getRange(rowIndex, 14, 1, 4).setValues([[ // kolom N-Q
      'Pending',
      JSON.stringify({ action: 'edit', jamMulai: newData.jamMulai, jamSelesai: newData.jamSelesai, totalJam: durJam, keterangan: newData.keterangan || '', kategoriLembur: newData.kategoriLembur || '' }),
      nikRequester || '', ''
    ]]);
    return { success: true, applied: false, needsApproval: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Dipanggil TL dari panel approval. keputusan: 'Disetujui' | 'Ditolak'.
function approveEditRequest(rowIndex, keputusan, approverNik, catatan) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet tidak ditemukan' };
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, error: 'Baris tidak valid / sudah tidak ada.' };

    var reqDataRaw = sh.getRange(rowIndex, 15).getValue(); // kolom O
    var reqData = {};
    try { reqData = JSON.parse(reqDataRaw || '{}'); } catch (e) {}

    if (keputusan === 'Disetujui') {
      if (reqData.action === 'delete') {
        sh.deleteRow(rowIndex);
        return { success: true };
      }
      if (reqData.action === 'edit') {
        sh.getRange(rowIndex, 5, 1, 3).setValues([[reqData.jamMulai, reqData.jamSelesai, reqData.totalJam]]); // E,F,G
        sh.getRange(rowIndex, 8).setValue(reqData.keterangan || ''); // H
        sh.getRange(rowIndex, 13).setValue(reqData.kategoriLembur || ''); // M
      }
    }

    // Reset kolom pengajuan (baik disetujui-sudah-diterapkan maupun ditolak)
    sh.getRange(rowIndex, 14, 1, 4).setValues([[keputusan === 'Ditolak' ? 'Ditolak' : '', '', '', catatan || '']]);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

function saveAbsensi(data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_ABSENSI_LOG);
    if (!sh) return { success: false, error: 'Sheet ABSENSI_LOG belum ada. Jalankan setupLemburSheets() dulu.' };
    sh.appendRow([new Date(), data.tanggal, data.kode, data.nama || '', data.status, data.keterangan || '', data.inputOleh || '', 'Pending', '']);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

function getAbsensiList(filter) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_ABSENSI_LOG);
    if (!sh) return { success: false, error: 'Sheet ABSENSI_LOG belum ada.' };
    var data = sh.getDataRange().getValues();
    var out = [];
    var bulan = filter && filter.bulan, tahun = filter && filter.tahun;
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[1]) continue;
      var tgl = new Date(r[1]);
      if (bulan && tahun) {
        if ((tgl.getMonth() + 1) != Number(bulan) || tgl.getFullYear() != Number(tahun)) continue;
      }
      out.push({ rowIndex: i + 1, tanggal: _fmtYMD(tgl), kode: String(r[2]), nama: String(r[3]), status: String(r[4]), keterangan: String(r[5] || ''), approvalStatus: String(r[7] || 'Pending'), approvedBy: String(r[8] || '') });
    }
    return { success: true, data: out };
  } catch (err) { return { success: false, error: err.message }; }
}

function deleteAbsensi(rowIndex) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_ABSENSI_LOG);
    if (!sh) return { success: false, error: 'Sheet tidak ditemukan' };
    sh.deleteRow(rowIndex);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Tanggal merah diambil OTOMATIS dari kalender resmi Google "Hari Libur
// Nasional Indonesia" (dikelola Google, selalu update tiap tahun tanpa
// perlu isi manual). Sheet HARI_LIBUR tetap ada sebagai tambahan OPSIONAL
// kalau mau menandai libur khusus perusahaan (cuti bersama internal, dst)
// yang tidak ada di kalender nasional.
var KALENDER_LIBUR_ID = 'id.indonesian#holiday@group.v.calendar.google.com';

function _getHariLiburSet(bulan, tahun) {
  var out = {};

  // 1) Otomatis dari kalender nasional Indonesia
  try {
    var cal = CalendarApp.getCalendarById(KALENDER_LIBUR_ID);
    if (cal) {
      var awal  = new Date(tahun, bulan - 1, 1);
      var akhir = new Date(tahun, bulan, 1); // awal bulan berikutnya (exclusive)
      var events = cal.getEvents(awal, akhir);
      events.forEach(function (ev) {
        var dk = _fmtYMD(ev.getStartTime());
        out[dk] = ev.getTitle() || 'Libur Nasional';
      });
    }
  } catch (e) {
    // Kalender publik tidak bisa diakses (jarang terjadi) -> lanjut,
    // minimal Minggu tetap dianggap libur di logic lain.
  }

  // 2) Tambahan manual (opsional) dari sheet HARI_LIBUR, kalau ada isinya
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_HARI_LIBUR);
    if (sh) {
      var data = sh.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var r = data[i];
        if (!r[0]) continue;
        var d = new Date(r[0]);
        if (isNaN(d.getTime())) continue;
        if ((d.getMonth() + 1) !== bulan || d.getFullYear() !== tahun) continue;
        out[_fmtYMD(d)] = r[1] || 'Libur (tambahan manual)';
      }
    }
  } catch (e) { /* sheet belum ada -> lewati, tidak masalah */ }

  return out;
}

// ---- FUNGSI UTAMA: rekap FTE (internal) + rekap lembur OS sebulan ----
// Versi BATCH untuk grafik "Tren Over Time % — 6 Bulan Terakhir" -- baca
// karyawan/lembur/absensi CUMA SEKALI (bukan 6x seperti sebelumnya),
// lalu hitung overtime% tiap bulan dari data yang sudah di-memori.
function getOvertimeTrend6Bulan(bulanAkhir, tahunAkhir) {
  try {
    var karyawanRes = getKaryawanList();
    if (!karyawanRes.success) return karyawanRes;
    var karyawanInternal = karyawanRes.data.filter(function (k) { return k.aktif && k.kategori === 'Internal'; });
    var jumlahKaryawan = karyawanInternal.length;

    var lemburRes = getLemburList({}); // semua data, sekali baca
    var semuaLembur = lemburRes.success ? lemburRes.data : [];

    var months = [];
    for (var i = 5; i >= 0; i--) {
      var d = new Date(Number(tahunAkhir), Number(bulanAkhir) - 1 - i, 1);
      months.push({ bulan: d.getMonth() + 1, tahun: d.getFullYear() });
    }

    var kodeInternal = {};
    karyawanInternal.forEach(function (k) { kodeInternal[k.kode] = 1; });

    var results = months.map(function (m) {
      var totalLemburInternal = semuaLembur
        .filter(function (l) {
          var t = new Date(l.tanggal);
          return kodeInternal[l.kode] && (t.getMonth() + 1) === m.bulan && t.getFullYear() === m.tahun;
        })
        .reduce(function (a, l) { return a + l.totalJam; }, 0);

      var fteLemburTotal = jumlahKaryawan > 0 ? (totalLemburInternal / FTE_STANDAR_JAM_BULAN) : 0;
      var overtimePct = jumlahKaryawan > 0 ? Math.round((fteLemburTotal / jumlahKaryawan) * 10000) / 100 : 0;
      return overtimePct;
    });

    return { success: true, results: results };
  } catch (err) { return { success: false, error: err.message }; }
}

function getAbsensiFTEData(bulan, tahun) {
  try {
    bulan = Number(bulan); tahun = Number(tahun);

    var karyawanRes = getKaryawanList();
    if (!karyawanRes.success) return karyawanRes;
    var karyawan = karyawanRes.data.filter(function (k) { return k.aktif; });

    var lemburRes = getLemburList({ bulan: bulan, tahun: tahun });
    var lembur = lemburRes.success ? lemburRes.data : [];

    var absensiRes = getAbsensiList({ bulan: bulan, tahun: tahun });
    var absensi = absensiRes.success ? absensiRes.data : [];

    var hariLibur = _getHariLiburSet(bulan, tahun);
    var hariLiburBulanIni = Object.keys(hariLibur).map(function (dk) {
      return { tanggal: dk, keterangan: hariLibur[dk] };
    }).sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });

    var perOrang = karyawan.map(function (k) {
      var totalLembur = lembur.filter(function (l) { return l.kode === k.kode; })
        .reduce(function (a, l) { return a + l.totalJam; }, 0);
      totalLembur = Math.round(totalLembur * 100) / 100;

      var absensiOrang = absensi.filter(function (a) { return a.kode === k.kode; });
      var cutiDokter  = absensiOrang.filter(function (a) { return a.status === 'CutiDokter'; }).length;
      var cutiTahunan = absensiOrang.filter(function (a) { return a.status === 'CutiTahunan'; }).length;
      var mangkir     = absensiOrang.filter(function (a) { return a.status === 'Mangkir'; }).length;

      var isInternal = k.kategori === 'Internal';
      return {
        kode: k.kode, nama: k.nama, kategori: k.kategori, jabatan: k.jabatan,
        totalJamLembur: totalLembur,
        cutiDokter: cutiDokter, cutiTahunan: cutiTahunan, mangkir: mangkir,
        fteLembur:   isInternal ? Math.round((totalLembur / FTE_STANDAR_JAM_BULAN) * 10000) / 10000 : null,
        // OT% dihitung untuk SEMUA kategori (Internal & OS) -- persentase jam
        // lembur terhadap standar jam kerja 1 bulan penuh (FTE_STANDAR_JAM_BULAN).
        overtimePct: Math.round((totalLembur / FTE_STANDAR_JAM_BULAN) * 10000) / 100
      };
    });

    var internalList = perOrang.filter(function (p) { return p.kategori === 'Internal'; });
    var jumlahKaryawan = internalList.length;
    var totalJamLemburInternal = Math.round(internalList.reduce(function (a, p) { return a + p.totalJamLembur; }, 0) * 100) / 100;
    var fteLemburTotal = jumlahKaryawan > 0 ? Math.round((totalJamLemburInternal / FTE_STANDAR_JAM_BULAN) * 10000) / 10000 : 0;
    var totalFTE = Math.round((jumlahKaryawan + fteLemburTotal) * 10000) / 10000;
    var overtimePctTotal = jumlahKaryawan > 0 ? Math.round((fteLemburTotal / jumlahKaryawan) * 10000) / 100 : 0;

    var osList = perOrang.filter(function (p) { return p.kategori === 'OS'; });
    var totalJamLemburOS = Math.round(osList.reduce(function (a, p) { return a + p.totalJamLembur; }, 0) * 100) / 100;

    // ------------------------------------------------------------
    //  PRODUKTIVITAS (Kg/FTE & Ton/FTE) — rumus PERSIS sama seperti
    //  sheet "OPR" (kolom Q/R/S baris 14-15) & sheet "PRODUKTIFITY":
    //   1. Jumlah Kiriman + Penerimaan (Kg) = (Total Pengiriman
    //      Pipa+Fitting bulan ini + Total Penerimaan Pipa+Fitting
    //      bulan ini) / 2   -- persis pola kolom F di PRODUKTIFITY
    //      (=((Penerimaan)+(Pengiriman))/2), dijumlahkan sebulan penuh.
    //   2. Produktivitas (Kg/FTE) = Jumlah Kiriman+Penerimaan / Total FTE
    //   3. Produktivitas (Ton/FTE) = Produktivitas (Kg/FTE) / 1000
    //      -- ini metrik INTI (headline) Monitoring FTE.
    //  Sumber data: DASHBOARD_KIRIM (outbound) & DASHBOARD_PRODUKSI
    //  (inbound), sudah gabungan Pipa + Fitting (field .total dari
    //  readTransaksi), pada rentang tanggal bulan yang sama dgn lembur.
    // ------------------------------------------------------------
    var ssProd     = SpreadsheetApp.openById(SPREADSHEET_ID);
    var rangeProd  = buildIODateRange({ bulan: bulan, tahun: tahun });
    var totalKirim = readTransaksi(ssProd, SH_KIRIM, rangeProd).total;       // Pengiriman Pipa+Fitting
    var totalTerima= readTransaksi(ssProd, SH_PRODUKSI, rangeProd).total;   // Penerimaan Pipa+Fitting

    var jumlahKirimTerima = Math.round(((totalKirim + totalTerima) / 2) * 100) / 100;
    var produktivitasKgFTE  = totalFTE > 0 ? Math.round((jumlahKirimTerima / totalFTE) * 100) / 100 : 0;
    var produktivitasTonFTE = Math.round((produktivitasKgFTE / 1000) * 100) / 100;

    return {
      success: true,
      bulan: bulan, tahun: tahun,
      target: { overtimePctMax: 6 },
      internal: {
        jumlahKaryawan: jumlahKaryawan,
        totalJamLembur: totalJamLemburInternal,
        fteLembur: fteLemburTotal,
        totalFTE: totalFTE,
        overtimePct: overtimePctTotal,
        tercapai: overtimePctTotal <= 6,
        totalPengiriman: Math.round(totalKirim * 100) / 100,
        totalPenerimaan: Math.round(totalTerima * 100) / 100,
        jumlahKirimTerima: jumlahKirimTerima,
        produktivitasKgFTE: produktivitasKgFTE,
        produktivitasTonFTE: produktivitasTonFTE,
        perOrang: internalList
      },
      os: {
        jumlahOS: osList.length,
        totalJamLembur: totalJamLemburOS,
        perOrang: osList
      },
      hariLiburBulanIni: hariLiburBulanIni
    };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  EXPORT FORMULIR SPL (Surat Perintah Lembur) — khusus karyawan OS
// ------------------------------------------------------------
//  Membuat dokumen Word (.docx) berisi rekap lembur 1 karyawan OS
//  untuk 1 bulan, mengikuti field-field yang sama dengan formulir
//  "FORMULIR OVER TIME PT SWAKARYA INSAN MANDIRI" (SPL_SIM.docx):
//  Tanggal, Nama, SIMID, Waktu Awal/Akhir, Total Jam Lembur,
//  Keterangan, kolom Paraf (Karyawan/Leader/Sect Head/Dept Head),
//  serta catatan aturan lembur & area tanda tangan Disetujui/
//  Mengetahui — supaya tinggal diprint dan ditandatangani manual.
//
//  Dokumen dibuat sementara di Google Drive (folder Apps Script),
//  langsung dikonversi ke .docx (base64) untuk diunduh browser,
//  lalu file sementaranya dihapus (masuk trash Drive).
// ================================================================
// ================================================================
//  EXPORT FORMULIR SPL (Surat Perintah Lembur) — khusus karyawan OS
// ------------------------------------------------------------
//  Memakai TEMPLATE ASLI (SPL_SIM.docx yang sudah diupload ke Google
//  Drive & disisipi penanda {{...}}) supaya hasil export FORMATNYA
//  IDENTIK dengan file asli (logo, tabel, semua) — bukan dibuat ulang
//  dari nol. Apps Script cuma menyalin template itu lalu mengganti
//  penanda dengan data sungguhan (find-and-replace), lalu konversi
//  hasilnya ke .docx.
//
//  SETUP (WAJIB sebelum dipakai):
//  1. Download file template (SPL_SIM_template.docx) yang saya
//     siapkan, lalu upload ke Google Drive kamu.
//  2. Klik kanan file itu di Drive -> "Buka dengan" -> "Google Dokumen"
//     (supaya otomatis punya versi Google Docs, dibutuhkan untuk
//     find-and-replace lewat Apps Script).
//  3. Buka Google Doc hasil konversi itu, lihat URL-nya:
//       https://docs.google.com/document/d/XXXXXXXXXXXXX/edit
//     bagian XXXXXXXXXXXXX itu File ID-nya.
//  4. Di Apps Script: Project Settings -> Script Properties ->
//     tambahkan properti SPL_TEMPLATE_DOC_ID = (File ID dari langkah 3)
// ================================================================
// ================================================================
//  Job & Bagian per karyawan OS untuk formulir SPL.
//  Default dipakai kalau kode karyawan tidak ada di peta ini.
// ================================================================
var SPL_JOB_BAGIAN_MAP = {
  'PEG21101254': { job: 'Warehouse Technician I', bagian: 'Warehouse Fitting Import' }, // Doni Mulya Y
  'PEG25112073': { job: 'Warehouse Technician I', bagian: 'Warehouse Fitting Import' }, // Iman Abdul Rahman
  'PEG22111246': { job: 'Admin WH Fitting',       bagian: 'Warehouse Fitting Import' }  // Ivan Reynata
};
var SPL_JOB_BAGIAN_DEFAULT = { job: 'Staff Warehouse (OS)', bagian: 'Outsourcing - PT Swakarya Insan Mandiri' };

// ================================================================
//  Helper bersama: bikin salinan template SPL yang sudah terisi data
//  lembur karyawan (dipakai oleh exportSPL & previewSPL supaya tidak
//  duplikat logic). Return { tmpDocId, k, bulanNama, totalJamLembur,
//  jumlahEntri }. HARUS di-cleanup (setTrashed) oleh pemanggil setelah
//  selesai export/convert.
// ================================================================
function _buildSPLDocument(kode, bulan, tahun) {
  var props = PropertiesService.getScriptProperties();
  var templateDocId = props.getProperty('SPL_TEMPLATE_DOC_ID');
  if (!templateDocId) throw new Error('SPL_TEMPLATE_DOC_ID belum di-set di Script Properties.');

  var karyawanRes = getKaryawanList();
  if (!karyawanRes.success) throw new Error(karyawanRes.error);
  var k = karyawanRes.data.find(function (x) { return x.kode === kode; });
  if (!k) throw new Error('Karyawan dengan kode ' + kode + ' tidak ditemukan');

  bulan = Number(bulan); tahun = Number(tahun);
  var bulanNamaArr = ['', 'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  var bulanNama = bulanNamaArr[bulan];

  var lemburRes = getLemburList({ kode: kode, bulan: bulan, tahun: tahun });
  var lemburList = lemburRes.success ? lemburRes.data : [];
  lemburList.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
  var totalJamLembur = Math.round(lemburList.reduce(function (a, l) { return a + l.totalJam; }, 0) * 100) / 100;

  var jb = SPL_JOB_BAGIAN_MAP[k.kode] || SPL_JOB_BAGIAN_DEFAULT;

  // Salin template (bukan edit file aslinya), lalu isi datanya di salinan itu
  var copyFile = DriveApp.getFileById(templateDocId).makeCopy('TMP_SPL_' + k.nama.replace(/\s+/g, '_') + '_' + bulanNama + tahun);
  var tmpDocId = copyFile.getId();

  // Kadang Google belum selesai "menyiapkan" file hasil makeCopy() saat
  // langsung dibuka lewat DocumentApp.openById() -> muncul error race
  // condition "Dokumen ini tidak dapat diakses, coba lagi nanti". Jadi
  // kasih jeda singkat + retry beberapa kali sebelum benar-benar menyerah.
  var doc = null;
  var lastOpenErr = null;
  for (var attempt = 0; attempt < 4 && !doc; attempt++) {
    if (attempt > 0) Utilities.sleep(1000 * attempt); // 1s, 2s, 3s
    try {
      doc = DocumentApp.openById(tmpDocId);
    } catch (openErr) {
      lastOpenErr = openErr;
    }
  }
  if (!doc) throw new Error('Gagal membuka salinan dokumen setelah beberapa percobaan: ' + (lastOpenErr ? lastOpenErr.message : ''));

  var body = doc.getBody();

  body.replaceText('\\{\\{JOB\\}\\}', jb.job);
  body.replaceText('\\{\\{BAGIAN\\}\\}', jb.bagian);
  body.replaceText('\\{\\{PERIODE\\}\\}', tahun + '/' + bulanNama);

  var MAX_ROWS = 8; // sesuai jumlah baris data di template
  for (var i = 0; i < MAX_ROWS; i++) {
    var n = i + 1;
    var vTgl = '', vNama = '', vSimid = '', vAwal = '', vAkhir = '', vTotal = '', vKet = '';
    if (i < lemburList.length) {
      var l = lemburList[i];
      var p = l.tanggal.split('-');
      vTgl = p[2] + '/' + p[1] + '/' + p[0];
      vNama = k.nama; vSimid = k.kode;
      vAwal = l.jamMulai; vAkhir = l.jamSelesai;
      // PENTING: SPL (Surat Perintah Lembur) menampilkan DURASI MENTAH
      // (jam selesai - jam mulai), TANPA potongan 1 jam istirahat -- beda
      // dengan l.totalJam yang dipakai di rekap FTE (sudah otomatis
      // terpotong 1 jam kalau durasi > 4 jam). Jadi lembur 6 jam tetap
      // tertulis "6" di form SPL, meski di rekap FTE tercatat "5".
      var rawMin = _timeStrToMinutes(l.jamSelesai) - _timeStrToMinutes(l.jamMulai);
      if (rawMin < 0) rawMin += 24 * 60; // jaga-jaga kalau lembur lewat tengah malam
      var rawJam = Math.round((rawMin / 60) * 100) / 100;
      vTotal = String(rawJam); vKet = l.keterangan || '';
    }
    body.replaceText('\\{\\{TGL' + n + '\\}\\}', vTgl);
    body.replaceText('\\{\\{NAMA' + n + '\\}\\}', vNama);
    body.replaceText('\\{\\{SIMID' + n + '\\}\\}', vSimid);
    body.replaceText('\\{\\{AWAL' + n + '\\}\\}', vAwal);
    body.replaceText('\\{\\{AKHIR' + n + '\\}\\}', vAkhir);
    body.replaceText('\\{\\{TOTAL' + n + '\\}\\}', vTotal);
    body.replaceText('\\{\\{KET' + n + '\\}\\}', vKet);
  }

  // ---- Tanda tangan digital TL ----
  // Kalau ada entri lembur bulan ini yang sudah Disetujui, ambil tanda
  // tangan TL yang meng-approve (sudah di-upload sekali lewat
  // uploadTlSignature) dan tempel ke placeholder {{TTD_TL}} di template
  // (letakkan placeholder itu di sel kolom "Disetujui" pada template Doc).
  var approvedEntry = lemburList.find(function (l) { return l.approvalStatus === 'Disetujui' && l.approvedBy; });
  var sigBlob = approvedEntry ? _getTlSignatureBlob(approvedEntry.approvedBy) : null;
  if (sigBlob) {
    var foundTtd = body.findText('\\{\\{TTD_TL\\}\\}');
    if (foundTtd) {
      var elTtd = foundTtd.getElement();
      elTtd.asText().setText('');
      try {
        elTtd.getParent().asParagraph().insertInlineImage(0, sigBlob).setWidth(90).setHeight(40);
      } catch (imgErr) {
        // posisi placeholder bukan paragraph biasa (mis. langsung di table
        // cell tanpa paragraph pembungkus) -- lewati gambar, tidak fatal.
      }
    }
  } else {
    body.replaceText('\\{\\{TTD_TL\\}\\}', '');
  }

  doc.saveAndClose();
  Utilities.sleep(500); // jaga-jaga race condition serupa sebelum export

  return { tmpDocId: tmpDocId, k: k, bulanNama: bulanNama, totalJamLembur: totalJamLembur, jumlahEntri: lemburList.length };
}

// Konversi Google Doc -> Blob format tertentu lewat Drive API v3 export
// (DriveApp.getAs() tidak didukung utk konversi native Google Docs).
function _exportDocAs(tmpDocId, mimeType) {
  var exportUrl = 'https://www.googleapis.com/drive/v3/files/' + tmpDocId + '/export?mimeType=' + encodeURIComponent(mimeType);
  var resp = UrlFetchApp.fetch(exportUrl, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) {
    throw new Error('Gagal export (HTTP ' + resp.getResponseCode() + '): ' + resp.getContentText());
  }
  return resp.getBlob();
}

function exportSPL(kode, bulan, tahun) {
  var tmpDocId = null;
  try {
    var built = _buildSPLDocument(kode, bulan, tahun);
    tmpDocId = built.tmpDocId;

    var docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    var docxBlob = _exportDocAs(tmpDocId, docxMime);
    var base64 = Utilities.base64Encode(docxBlob.getBytes());
    var filename = 'SPL_' + built.k.nama.replace(/\s+/g, '_') + '_' + built.bulanNama + tahun + '.docx';

    DriveApp.getFileById(tmpDocId).setTrashed(true); // bersihkan salinan sementara

    return { success: true, filename: filename, base64: base64, totalJamLembur: built.totalJamLembur, jumlahEntri: built.jumlahEntri };
  } catch (err) {
    if (tmpDocId) { try { DriveApp.getFileById(tmpDocId).setTrashed(true); } catch (e2) {} }
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Preview & Print SPL — bikin PDF (bukan docx), supaya bisa dibuka
//  langsung di tab baru browser dan pakai tombol Print bawaan browser
//  (PDF native didukung <iframe>/tab, sedangkan docx tidak bisa
//  di-preview langsung di browser tanpa app tambahan).
// ================================================================
function previewSPL(kode, bulan, tahun) {
  var tmpDocId = null;
  try {
    var built = _buildSPLDocument(kode, bulan, tahun);
    tmpDocId = built.tmpDocId;

    var pdfBlob = _exportDocAs(tmpDocId, 'application/pdf');
    var base64 = Utilities.base64Encode(pdfBlob.getBytes());
    var filename = 'SPL_' + built.k.nama.replace(/\s+/g, '_') + '_' + built.bulanNama + tahun + '.pdf';

    DriveApp.getFileById(tmpDocId).setTrashed(true); // bersihkan salinan sementara

    return { success: true, filename: filename, base64: base64, totalJamLembur: built.totalJamLembur, jumlahEntri: built.jumlahEntri };
  } catch (err) {
    if (tmpDocId) { try { DriveApp.getFileById(tmpDocId).setTrashed(true); } catch (e2) {} }
    return { success: false, error: err.message };
  }
}
