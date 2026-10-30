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
  diagnosaRekapFitting    : diagnosaRekapFitting,
  getResidenceTimeData    : getResidenceTimeData,
  getLoadingTimeAnalytics : getLoadingTimeAnalytics,
  getPendingRows          : getPendingRows,
  getPendingRowsKemarin   : getPendingRowsKemarin,
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
  getFTETrendTahunan: getFTETrendTahunan,
  auditProduktivitasFTE: auditProduktivitasFTE,
  getSupabaseStorageStats: getSupabaseStorageStats,
  setSupabaseDbLimitMB: setSupabaseDbLimitMB,
  getOvertimeTrend6Bulan  : getOvertimeTrend6Bulan,
  saveLembur              : saveLembur,
  getLemburList           : getLemburList,
  deleteLembur            : deleteLembur,
  submitEditLembur        : submitEditLembur,
  approveEditRequest      : approveEditRequest,
  getNotifikasiSaya       : getNotifikasiSaya,
  tandaiNotifikasiDibaca  : tandaiNotifikasiDibaca,
  bersihkanPengajuanDitolakLama: bersihkanPengajuanDitolakLama,
  getPendingApprovalCount : getPendingApprovalCount,
  saveAbsensi             : saveAbsensi,
  getAbsensiList          : getAbsensiList,
  deleteAbsensi           : deleteAbsensi,
  getAbsensiFTEData       : getAbsensiFTEData,
  diagnosaLemburKaryawan  : diagnosaLemburKaryawan,
  syncLemburFTE           : syncLemburFTE,
  exportSPL               : exportSPL,
  previewSPL              : previewSPL,
  // Multi-workspace (Plant & Departemen)
  loginUser               : loginUser,
  getAvailablePlantsForLogin: getAvailablePlantsForLogin,
  provisionDepartmentSpreadsheet: provisionDepartmentSpreadsheet,
  // Panel Admin — Manajemen User (tambah/reset password/nonaktifkan lewat web)
  getAkunList             : getAkunList,
  adminTambahUser         : adminTambahUser,
  adminResetPassword      : adminResetPassword,
  adminSetAktif           : adminSetAktif,
  adminEditUser           : adminEditUser,
  adminHapusUser          : adminHapusUser,
  adminSetFonnteToken     : adminSetFonnteToken,
  adminGetFonnteStatus    : adminGetFonnteStatus,
  adminSetFonnteApproverWa: adminSetFonnteApproverWa,
  adminSetFonnteTokenUmum: adminSetFonnteTokenUmum,
  adminGetKaryawanMaster: adminGetKaryawanMaster,
  adminSimpanKaryawan: adminSimpanKaryawan,
  adminImporKaryawanDariAkun: adminImporKaryawanDariAkun,
  adminTesKirimFonnte: adminTesKirimFonnte,
  getKeywordKategoriGabungan: getKeywordKategoriGabungan,
  adminGetKeywordKategoriTambahan: adminGetKeywordKategoriTambahan,
  adminSetKeywordKategoriTambahan: adminSetKeywordKategoriTambahan,
  adminGetTargetProduktivitas: adminGetTargetProduktivitas,
  adminSetTargetProduktivitas: adminSetTargetProduktivitas,
  getWorkspaceListForAdmin: getWorkspaceListForAdmin,
  adminProvisionNewDepartment: adminProvisionNewDepartment,
  adminRepairWorkspaceSheets: adminRepairWorkspaceSheets,
  adminHapusDepartemen    : adminHapusDepartemen,
  adminHapusPlant         : adminHapusPlant,
  adminGetMenuConfig      : adminGetMenuConfig,
  adminSetMenuConfig      : adminSetMenuConfig,
  adminGetCrossWorkspaceTL: adminGetCrossWorkspaceTL,
  adminSetCrossWorkspaceTL: adminSetCrossWorkspaceTL,
  // Approval Lembur & Cuti + Tanda Tangan Digital TL
  getPendingApprovals     : getPendingApprovals,
  approveItem             : approveItem,
  editLemburByTL          : editLemburByTL,
  uploadTlSignature       : uploadTlSignature,
  hasTlSignature          : hasTlSignature,
  // Tanda Tangan SPL Outsourcing: Leader / Section Head / Dept Head (diupload TL/Admin/Super Admin)
  adminGetSplSignatures   : adminGetSplSignatures,
  adminUploadSplSignature : adminUploadSplSignature,
  adminGetSplJobBagian    : adminGetSplJobBagian,
  adminSetSplJobBagian    : adminSetSplJobBagian,
  adminHapusSplSignature  : adminHapusSplSignature,
  adminSetSplTtdCutoff    : adminSetSplTtdCutoff,
  diagnosaSplTtd          : diagnosaSplTtd,
  adminSetSplTtdUkuran    : adminSetSplTtdUkuran,
  // Upload Data Harian (Stock / Outbound / Inbound)
  appendStockData         : appendStockData,
  clearStockDataForDate   : clearStockDataForDate,
  getSheetStats           : getSheetStats,
  appendOutboundData      : appendOutboundData,
  appendInboundData       : appendInboundData,
  manualSyncNow           : manualSyncNow,
  getRentangTanggalUpload : getRentangTanggalUpload,
  hapusDataUploadByTanggal: hapusDataUploadByTanggal,
  cekTanggalSudahUpload   : cekTanggalSudahUpload,
  // TL: hapus lembur langsung + panel Lembur per Karyawan
  hapusLemburByTL         : hapusLemburByTL,
  // Jadwal Pengiriman Fitting -- sync otomatis dari sumber eksternal
  adminSetJadwalPengirimanSumber: adminSetJadwalPengirimanSumber,
  adminGetJadwalPengirimanSumberStatus: adminGetJadwalPengirimanSumberStatus,
  syncJadwalPengirimanHarian: syncJadwalPengirimanHarian,
  hapusDataPengirimanByTanggal: hapusDataPengirimanByTanggal,
  resyncBersihJadwalTanggal: resyncBersihJadwalTanggal,
  // Akurasi Scan Barcode (data dibagi antar PC)
  getSPLPdfCepat          : getSPLPdfCepat,
  simpanAkurasiAlasan     : simpanAkurasiAlasan,
  getAkurasiDataGabungan  : getAkurasiDataGabungan,
  getAkurasiData          : getAkurasiData,
  saveAkurasiData         : saveAkurasiData,
  hapusAkurasiData        : hapusAkurasiData,
  // Akurasi QAD vs WMS (hanya kolom No.Voucher, Item, Nama Item, Qty + tanggal)
  getWmsQadData           : getWmsQadData,
  saveWmsQadData          : saveWmsQadData,
  hapusWmsQadData         : hapusWmsQadData,
  // Kepatuhan PIC WMS (master Laporan Muat + jadwal SPM manual)
  getPicWmsData           : getPicWmsData,
  savePicWmsData          : savePicWmsData,
  hapusPicWmsData         : hapusPicWmsData,
  // Monitoring Susun WMS (master susun + pencocokan kertas juru lokasi)
  getSusunData            : getSusunData,
  saveSusunMaster         : saveSusunMaster,
  saveSusunCek            : saveSusunCek,
  hapusSusunData          : hapusSusunData,
  // Stock Opname
  soGetMaster: soGetMaster, soGetGroupItems: soGetGroupItems, soBuatLembar: soBuatLembar,
  soListLembar: soListLembar, soGetLembarDetail: soGetLembarDetail, soSimpanIsi: soSimpanIsi,
  soSimpanKeterangan: soSimpanKeterangan, soCloseSelisih: soCloseSelisih, soBukaKunci: soBukaKunci, soSelesaiEdit: soSelesaiEdit, soLengkapiLembar: soLengkapiLembar,
  soGetDashboard: soGetDashboard, soGetRekapPIC: soGetRekapPIC, soGetAll: soGetAll, soGetSkuCounts: soGetSkuCounts, soGetRiwayatItems: soGetRiwayatItems, soGetLembarAktif: soGetLembarAktif
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
  getPhotos: true, getStockTrendBatch: true, getIOTrendBatch: true,
  // Monitoring FTE ikut disini karena sejak nambah data Produktivitas
  // (Kg/FTE, Ton/FTE), fungsinya scan penuh sheet DASHBOARD_KIRIM &
  // DASHBOARD_PRODUKSI (bisa 10.000+ baris) SETIAP kali halaman dibuka
  // -- lambat & tidak perlu, karena datanya agregat bulanan yang wajar
  // kalau agak nge-lag beberapa menit (bukan angka real-time per detik).
  getAbsensiFTEData: true,
  getLoadingTimeAnalytics: true
};
// TTL per fungsi (detik). Default 90s buat dashboard umum.
var CACHE_TTL_OVERRIDE = {
  getAbsensiFTEData: 180, // 3 menit -- data bulanan, aman agak lebih lama drpd default
  getLoadingTimeAnalytics: 180
};
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

// Nama tampilan tiap departemen/plant, dipakai di dropdown Panel Admin.
var WORKSPACE_LABELS = {
  'cibitung_fitting_import': 'Cibitung — Warehouse Fitting Import',
  'cibitung_fitting_rucika': 'Cibitung — Fitting Rucika',
  'cibitung_pipa_rucika'   : 'Cibitung — Pipa Rucika',
  'cibitung_sparepart'     : 'Cibitung — Sparepart'
};

// ------------------------------------------------------------
//  Departemen/plant TAMBAHAN yang dibuat lewat Panel Admin (Super Admin
//  > Kelola Departemen Lain > + Tambah Departemen Baru) -- disimpan di
//  Script Properties (bukan hardcode di WORKSPACE_MAP di atas) supaya
//  BISA LANGSUNG DIPAKAI tanpa perlu edit kode + deploy ulang. Digabung
//  otomatis ke WORKSPACE_MAP & WORKSPACE_LABELS di sini, jadi SELURUH
//  kode lain yang baca WORKSPACE_MAP (loginUser, trigger harian, panel
//  admin, dst) otomatis "melihat" departemen baru ini juga, di mana pun
//  dipakainya -- tidak perlu ubah satu-satu.
// ------------------------------------------------------------
// ------------------------------------------------------------
//  Helper baca/simpan WORKSPACE_REGISTRY_EXTRA (Script Properties).
//  Dipakai bersama oleh: merge saat startup, provisioning departemen
//  baru, DAN penghapusan departemen/plant -- supaya format datanya
//  konsisten di satu tempat saja.
// ------------------------------------------------------------
function _getExtraWorkspaceRegistry() {
  try {
    var extraJson = PropertiesService.getScriptProperties().getProperty('WORKSPACE_REGISTRY_EXTRA');
    return extraJson ? JSON.parse(extraJson) : {};
  } catch (e) { return {}; } // JSON korup -- anggap kosong, jangan sampai bikin error
}
function _saveExtraWorkspaceRegistry(extra) {
  PropertiesService.getScriptProperties().setProperty('WORKSPACE_REGISTRY_EXTRA', JSON.stringify(extra || {}));
}

(function _mergeExtraWorkspaces() {
  try {
    var extra = _getExtraWorkspaceRegistry();
    Object.keys(extra).forEach(function (key) {
      WORKSPACE_MAP[key] = extra[key].id;
      WORKSPACE_LABELS[key] = extra[key].label;
    });
  } catch (e) { /* JSON korup -- abaikan, jangan sampai bikin seluruh app error */ }
})();

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

// ================================================================
//  KELOLA MENU PER DEPARTEMEN/PLANT (Super Admin)
// ================================================================
//  Katalog SEMUA menu/halaman yang bisa diatur tampil/tidaknya per
//  departemen/plant lewat Panel Admin. `key` HARUS SAMA PERSIS dgn key
//  di PAGE_MAP (index.html) & fileForKey (assets/js/auth-guard.js) --
//  kalau nambah halaman baru ke aplikasi, ketiga tempat ini WAJIB
//  di-update bareng, supaya menu baru itu bisa dipilih tampil/tidaknya.
// ------------------------------------------------------------
var MENU_CATALOG = [
  { key: 'wh_control_tower', label: 'Dashboard WH Import (Control Tower)', file: 'index.html' },
  { key: 'index',            label: 'Monitoring Stock, Inbound & Outbound', file: 'monitoring_stock.html' },
  { key: 'kanban',           label: 'Monitoring Kanban', file: 'kanban.html' },
  { key: 'fte_dashboard',    label: 'Monitoring FTE', file: 'fte_dashboard.html' },
  { key: 'akurasi_scan',     label: 'Akurasi Scan Barcode', file: 'akurasi_scan.html' },
  { key: 'wms_qad',          label: 'Akurasi QAD vs WMS', file: 'wms_qad.html' },
  { key: 'pic_wms',          label: 'Kepatuhan PIC WMS', file: 'pic_wms.html' },
  { key: 'susun_wms',        label: 'Monitoring Susun WMS', file: 'susun_wms.html' },
  { key: 'rekap',            label: 'Rekap PIC', file: 'rekap_muatan.html' },
  { key: 'residance',        label: 'Loading Time (Jadwal Pengiriman)', file: 'residance_time.html' },
  { key: 'input_lembur',     label: 'Input Lembur & Cuti', file: 'input_lembur.html' },
  { key: 'upload',           label: 'Upload Data Harian', file: 'upload_data.html' },
  { key: 'stock_opname',     label: 'Monitoring Stock Opname', file: 'stock_opname.html' }
];
var MENU_CATALOG_KEYS = MENU_CATALOG.map(function (m) { return m.key; });

// Default kalau Super Admin BELUM mengatur menu departemen ini lewat
// Kelola Menu -- SAMA seperti perilaku lama (sebelum fitur ini ada),
// supaya departemen yang sudah berjalan tidak berubah tiba2:
//  - Warehouse Fitting Import: SEMUA menu.
//  - Departemen/plant lain: 4 menu inti (spt yg sudah berjalan).
function _defaultMenuKeysForWorkspace(workspaceKey) {
  if (workspaceKey === 'cibitung_fitting_import') return MENU_CATALOG_KEYS.slice();
  return ['index', 'fte_dashboard', 'input_lembur', 'upload'];
}

function _getMenuConfigRegistry() {
  try {
    var json = PropertiesService.getScriptProperties().getProperty('MENU_CONFIG_PER_WORKSPACE');
    return json ? JSON.parse(json) : {};
  } catch (e) { return {}; } // JSON korup -- anggap kosong, semua departemen jatuh ke default (aman)
}
function _saveMenuConfigRegistry(reg) {
  PropertiesService.getScriptProperties().setProperty('MENU_CONFIG_PER_WORKSPACE', JSON.stringify(reg || {}));
}

// Dipanggil oleh loginUser() -- daftar key menu yg boleh tampil utk
// departemen ini, dikirim ke sessionStorage lewat login.html supaya
// auth-guard.js bisa baca tanpa panggilan API tambahan di tiap halaman.
function _resolveMenuKeysForWorkspace(workspaceKey) {
  var reg = _getMenuConfigRegistry();
  var keys = reg[workspaceKey];
  if (!keys || !keys.length) return _defaultMenuKeysForWorkspace(workspaceKey);
  return keys.filter(function (k) { return MENU_CATALOG_KEYS.indexOf(k) !== -1; }); // saring key yg sudah tidak valid, jaga2
}

// Super Admin: lihat katalog menu + konfigurasi SEMUA departemen/plant
// sekaligus, utk dirender jadi checkbox per departemen di Panel Admin.
function adminGetMenuConfig(actorNik) {
  if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- cuma Super Admin.' };
  var out = {};
  Object.keys(WORKSPACE_MAP).forEach(function (key) {
    out[key] = _resolveMenuKeysForWorkspace(key);
  });
  return { success: true, catalog: MENU_CATALOG, config: out };
}

// Super Admin: simpan daftar menu utk 1 departemen/plant. menuKeys
// kosong = hapus konfigurasi custom, kembali ke default (SENGAJA --
// mencegah Super Admin tidak sengaja mengunci total 1 departemen
// dgn 0 menu, yg akan bikin department itu tidak punya halaman yg
// bisa dibuka sama sekali).
function adminSetMenuConfig(actorNik, workspaceKey, menuKeys) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- cuma Super Admin.' };
    workspaceKey = String(workspaceKey || '').trim();
    if (!WORKSPACE_MAP.hasOwnProperty(workspaceKey)) return { success: false, error: 'Departemen/plant tidak dikenali.' };
    var keys = (menuKeys || []).map(function (k) { return String(k).trim(); }).filter(function (k) { return MENU_CATALOG_KEYS.indexOf(k) !== -1; });
    var reg = _getMenuConfigRegistry();
    if (!keys.length) { delete reg[workspaceKey]; } else { reg[workspaceKey] = keys; }
    _saveMenuConfigRegistry(reg);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Bungkus fungsi baca data dengan CacheService supaya panggilan berulang
// (klik Refresh, atau beberapa orang buka dashboard bersamaan) dalam
// jendela CACHE_TTL_SECONDS langsung dijawab dari cache (instan),
// tidak perlu baca ulang spreadsheet tiap kali.
//
// PENTING -- cache-busting lewat "versi": kalau ada upload/hapus data
// baru (Stock/Outbound/Inbound), _bumpDataCacheVersion() dipanggil dan
// menaikkan angka versi utk workspace itu. Versi ini ikut jadi bagian
// dari cache key -- begitu versi naik, SEMUA cache lama (utk kombinasi
// filter apa pun: harian/bulanan/tahunan) otomatis "basi"/tidak
// terpakai lagi TANPA perlu tahu/enumerasi persis key mana saja yang
// harus dihapus. Sebelumnya TIDAK ADA mekanisme ini sama sekali -- jadi
// setelah upload/hapus data, dashboard bisa tetap menampilkan angka
// lama sampai TTL (90 detik) habis sendiri, dan karena tiap kombinasi
// filter (mis. "Bulanan Agustus" vs "Harian 01-31 Agustus") punya cache
// key TERPISAH, salah satu bisa kebetulan sudah fresh sementara yang
// lain masih basi -- selisih angka yang membingungkan padahal rentang
// tanggalnya sama persis.
function _getDataCacheVersion() {
  var cache = CacheService.getScriptCache();
  var key = 'dataCacheVer::' + ACTIVE_WORKSPACE;
  var v = cache.get(key);
  return v || '0';
}
function _bumpDataCacheVersion() {
  try {
    var cache = CacheService.getScriptCache();
    var key = 'dataCacheVer::' + ACTIVE_WORKSPACE;
    var v = parseInt(cache.get(key) || '0', 10) + 1;
    cache.put(key, String(v), 21600); // 6 jam -- cukup lama, jarang perlu reset manual
  } catch (e) { /* gagal bump cache version tidak boleh sampai gagalkan proses upload */ }

  // ---- Tandai "ada perubahan menunggu di-sync ke Supabase" ----
  // PENTING: trigger onSheetEditSync() (yang men-sync snapshot Supabase)
  // TERPASANG SEBAGAI onEdit -- dan onEdit di Google Apps Script HANYA
  // menyala untuk edit MANUAL langsung di UI Spreadsheet oleh manusia.
  // Onedit TIDAK PERNAH menyala untuk perubahan yang dibuat SCRIPT itu
  // sendiri (appendRow/setValues dari kode.gs) -- ini keterbatasan resmi
  // Google Apps Script, bukan bug yang bisa diperbaiki di sisi onEdit-nya.
  // Artinya: upload data, input lembur/absensi, dan approval TL (yang
  // SEMUANYA jalan lewat kode, bukan diketik manual di sel) TIDAK PERNAH
  // memicu sync Supabase lewat onSheetEditSync -- snapshot Supabase jadi
  // basi terus sampai trigger harian (syncAllToSupabase, 1x/hari) datang.
  // Makanya di sini kita tandai PENDING_SYNC secara EKSPLISIT setiap kali
  // ada perubahan data lewat kode manapun -- checkPendingSyncs (trigger
  // tiap 5 menit, sudah ada) akan menyusulkan sync-nya, jadi paling lama
  // 5 menit snapshot Supabase sudah ikut ter-update, TANPA bergantung
  // pada onEdit sama sekali.
  try {
    PropertiesService.getScriptProperties().setProperty('PENDING_SYNC_' + ACTIVE_WORKSPACE, '1');
  } catch (e2) { /* jangan sampai gagalkan proses utama */ }
}

function callWithServerCache(action, args) {
  var cache    = CacheService.getScriptCache();
  var cacheKey = 'api::' + ACTIVE_WORKSPACE + '::v' + _getDataCacheVersion() + '::' + action + '::' + JSON.stringify(args);

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

  // -- Sheet-sheet sumber data Monitoring FTE (LEMBUR_LOG, KARYAWAN_LEMBUR,
  //     ABSENSI_LOG, HARI_LIBUR, DASHBOARD_KIRIM, DASHBOARD_PRODUKSI) --
  //     kalau ada yang diedit LANGSUNG di sheet (bukan lewat form di
  //     aplikasi), cache manual di getAbsensiFTEData/getOvertimeTrend6Bulan/
  //     getLemburKategoriTrend6Bulan HARUS langsung basi, jangan nunggu TTL
  //     (3 menit/6 jam) habis sendiri -- terutama utk bulan yang sudah
  //     lewat (cache 6 jam), yang paling sering jadi sumber "kok masih data
  //     lama" begitu ada koreksi manual di spreadsheet.
  var FTE_SOURCE_SHEETS = ['LEMBUR_LOG', 'KARYAWAN_LEMBUR', 'ABSENSI_LOG', 'HARI_LIBUR', 'DASHBOARD_KIRIM', 'DASHBOARD_PRODUKSI'];
  if (FTE_SOURCE_SHEETS.indexOf(shName) !== -1) {
    _bumpDataCacheVersion();
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
    var today        = _hariIniKerja();
    var firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    // Batas ATAS bulan berjalan. Sebelumnya monthRows cuma dibatasi dari
    // bawah (tgl >= awal bulan), jadi jadwal BULAN DEPAN yang sudah masuk
    // sheet (mis. tanggal 2 Okt yang disiapkan di akhir September) ikut
    // terhitung "Total Pengiriman bulan ini" dan tampil sbg "belum
    // selesai".
    var firstOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
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
      var tgl    = _tglPengiriman(tglRaw);

      var statusRaw      = String(row[9] || '').trim(); // kolom J = STATUS (PENDING/BATAL/TERKIRIM/GAGAL)
      var isBatal        = statusRaw.indexOf('BATAL') === 0 || statusRaw.toUpperCase().indexOf('BATAL') === 0;
      var isPendingSheet = statusRaw.indexOf('PENDING')  === 0;
      var isTerkirimSheet= statusRaw.indexOf('TERKIRIM') === 0;
      var isGagalSheet   = statusRaw.indexOf('GAGAL') === 0;
      var keterangan     = String(row[10] || '').trim(); // kolom K = Keterangan (dari sync Jadwal Pengiriman)

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
        isGagalKirim    : isGagalSheet,
        keterangan      : keterangan,
        ikutPipa        : /IKUT\s*PIPA/i.test(keterangan)
      };

      allRows.push(rec);
      if (tgl) {
        var key = _fmtYMD(tgl);
        if (tgl.getTime() === today.getTime()) todayRows.push(rec);
        if (tgl >= firstOfMonth && tgl < firstOfNextMonth) monthRows.push(rec);
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

    // Urutkan kronologis (tanggal lalu nomor baris). Sheet PENGIRIMAN
    // ditambah lewat sync dari BAWAH, jadi baris yang belakangan dibuat
    // utk tanggal lebih awal (mis. sync ulang tab tanggal 2 dijalankan
    // tgl 25) fisiknya duduk di antara baris tanggal 25 -- tampilan
    // tidak boleh ikut berantakan karena urutan fisik itu.
    function _urutTgl(a, b) {
      var ta = a.tanggal || '~', tb = b.tanggal || '~'; // tanpa tanggal -> paling bawah
      if (ta < tb) return -1;
      if (ta > tb) return 1;
      return a.rowIndex - b.rowIndex;
    }
    todayRows.sort(_urutTgl); monthRows.sort(_urutTgl); allRows.sort(_urutTgl); customRows.sort(_urutTgl);

    return {
      success    : true,
      todayRows  : todayRows,
      monthRows  : monthRows,
      allRows    : allRows,
      customRows : customRows,
      customDate : customDateKey,
      trend7     : Object.values(trend7Map),
      // SATU definisi angka "Statistik Bulan Ini" utk Loading Time DAN
      // Control Tower (lihat _ltRingkasan) -- dulu masing-masing hitung
      // sendiri dgn aturan berbeda sehingga angkanya selisih.
      ringkasanBulan: _ltRingkasan(customMonthKey ? customRows : monthRows)
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Sel Tanggal (kolom A) -> Date (jam 00:00) atau null. Menerima Date asli
// maupun teks "25/09/2026" / "2026-09-25" -- new Date("25/09/2026") di
// JS = Invalid Date (dan "2/9/2026" terbaca 9 Februari, format AS), jadi
// baris dgn tanggal teks dulu diam-diam salah bulan / hilang dari semua
// daftar.
function _tglPengiriman(raw) {
  if (!raw) return null;
  var d;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    // Ambil Y-M-D PERSIS seperti yang tampil di sheet (zona waktu spreadsheet),
    // lalu bangun ulang jadi tengah malam di zona script. Kalau zona script &
    // sheet beda (mis. script GMT, sheet WIB), memakai setHours() langsung
    // menggeser tanggal 1 hari mundur -> kiriman HARI INI terbaca "kemarin".
    var ymd = Utilities.formatDate(raw, _tzKerja(), 'yyyy-MM-dd').split('-');
    return new Date(+ymd[0], +ymd[1] - 1, +ymd[2], 0, 0, 0, 0);
  }
  d = _parseTanggalFleksibel(raw);
  if (!(d instanceof Date) || isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// Zona waktu kerja = zona waktu SPREADSHEET (sama dgn yang dilihat user di
// sheet). Fallback Asia/Jakarta kalau gagal dibaca.
var _TZ_KERJA_CACHE = null;
function _tzKerja() {
  if (_TZ_KERJA_CACHE) return _TZ_KERJA_CACHE;
  try { _TZ_KERJA_CACHE = SpreadsheetApp.openById(SPREADSHEET_ID).getSpreadsheetTimeZone() || 'Asia/Jakarta'; }
  catch (e) { _TZ_KERJA_CACHE = 'Asia/Jakarta'; }
  return _TZ_KERJA_CACHE;
}
// "Hari ini" (00:00) menurut zona waktu spreadsheet, bukan zona script.
function _hariIniKerja() {
  var ymd = Utilities.formatDate(new Date(), _tzKerja(), 'yyyy-MM-dd').split('-');
  return new Date(+ymd[0], +ymd[1] - 1, +ymd[2], 0, 0, 0, 0);
}
// Jalankan manual dari editor Apps Script utk melihat zona waktu & nilai tanggal mentah.
function diagZonaWaktuPengiriman() {
  _TZ_KERJA_CACHE = null;
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID), sh = ss.getSheetByName(SH_PENGIRIMAN);
  Logger.log('Zona script: ' + Session.getScriptTimeZone() + ' | Zona spreadsheet: ' + ss.getSpreadsheetTimeZone());
  Logger.log('Sekarang (script): ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') +
             ' | (spreadsheet): ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd HH:mm'));
  var v = sh.getRange(Math.max(2, sh.getLastRow() - 9), 1, Math.min(10, sh.getLastRow() - 1), 5).getValues();
  v.forEach(function (r) {
    Logger.log('A=' + (r[0] instanceof Date ? r[0].toISOString() : JSON.stringify(r[0])) + ' | SPM=' + r[4] +
               ' | dibaca sbg ' + (_tglPengiriman(r[0]) ? _fmtYMD(_tglPengiriman(r[0])) : '-'));
  });
}

// Durasi muat (menit) dari 2 jam "HH:MM". null kalau bukan jam valid
// (mis. marker "Ikut Fitting"/"Rucika") atau selesai <= mulai.
function _ltDurasiMenit(mulai, selesai) {
  var re = /^(\d{1,2}):(\d{2})$/;
  var a = re.exec(String(mulai || '').trim()), b = re.exec(String(selesai || '').trim());
  if (!a || !b) return null;
  var d = (parseInt(b[1], 10) * 60 + parseInt(b[2], 10)) - (parseInt(a[1], 10) * 60 + parseInt(a[2], 10));
  return d > 0 ? d : null;
}

// ================================================================
//  RINGKASAN BULAN -- definisi baku, dipakai Loading Time & Control Tower
//   BATAL   : kolom STATUS "BATAL ..." (prioritas mutlak)
//   SELESAI : Waktu Mulai+Selesai terisi, ATAU "Ikut Fitting Rucika",
//             ATAU status TERKIRIM / GAGAL kirim (sudah lewat tahap muat)
//   PROSES  : sudah Mulai tapi belum Selesai
//   MENUNGGU: belum Mulai
//   Durasi/rata-rata/distribusi cuma dari baris yang punya 2 jam valid
//   (Ikut Fitting tidak punya durasi muat asli).
// ================================================================
function _ltRingkasan(rows) {
  var total = rows.length, selesai = 0, batal = 0, proses = 0, menunggu = 0, durs = [];
  var dist = [0, 0, 0, 0, 0]; // <30 / 30-60 / 60-120 / 120-180 / >=180 menit
  rows.forEach(function (r) {
    if (r.isCancelled) { batal++; return; }
    var selesaiMuat = (r.waktuMulai && r.waktuSelesai) || r.waktuMulai === 'Ikut Fitting' || r.isTerkirim || r.isGagalKirim;
    if (selesaiMuat) {
      selesai++;
      var d = _ltDurasiMenit(r.waktuMulai, r.waktuSelesai);
      if (d !== null) {
        durs.push(d);
        if (d < 30) dist[0]++; else if (d < 60) dist[1]++; else if (d < 120) dist[2]++; else if (d < 180) dist[3]++; else dist[4]++;
      }
    } else if (r.waktuMulai) proses++;
    else menunggu++;
  });
  var avg = durs.length ? Math.round(durs.reduce(function (a, b) { return a + b; }, 0) / durs.length) : 0;
  return { total: total, selesai: selesai, batal: batal, proses: proses, menunggu: menunggu, avgMin: avg, dist: dist };
}

// ================================================================
//  ANALISIS LOADING TIME: anomali durasi muat per jenis kendaraan +
//  potensi lembur dari mobil yang mulai dimuat di atas jam 16:00.
// ------------------------------------------------------------
//  1) ANOMALI DURASI: kelompokkan kiriman yang SUDAH SELESAI (Waktu
//     Mulai & Waktu Selesai keduanya terisi) per Jenis Kendaraan,
//     hitung rata-rata durasi muat per jenis. Kiriman yang durasinya
//     >1,5x rata-rata jenisnya ditandai "lebih lama dari biasanya",
//     dan yang <0,5x rata-rata ditandai "lebih cepat dari biasanya"
//     (potensi salah catat waktu / kasus tidak biasa yang layak dicek).
//     Kendaraan dengan <3 data bulan itu dilewati (belum cukup sampel
//     buat dibilang "rata-rata").
//  2) POTENSI LEMBUR: kiriman yang checker klik "Mulai Muat" di atas
//     jam 16:00 -- makin sore mulai muat, makin besar risiko checker/tim
//     muat pulang telat (lembur) karena prosesnya baru selesai malam.
// ================================================================
function getLoadingTimeAnalytics(bulan, tahun) {
  try {
    bulan = Number(bulan); tahun = Number(tahun);

    var scriptCacheLt = CacheService.getScriptCache();
    var cacheKeyLt = 'loadingTimeAnalytics_v2_' + ACTIVE_WORKSPACE + '_' + tahun + '_' + bulan;
    var cachedLt = scriptCacheLt.get(cacheKeyLt);
    if (cachedLt) return JSON.parse(cachedLt);

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan.' };

    var data = sheet.getDataRange().getValues();
    var rowsBulanIni = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var spm = String(row[4] || '').trim();
      if (!spm) continue;
      var tglRaw = row[0];
      if (!tglRaw) continue;
      var tgl = _tglPengiriman(tglRaw);
      if (!tgl || (tgl.getMonth() + 1) !== bulan || tgl.getFullYear() !== tahun) continue;

      var jenis = String(row[6] || '').trim() || '(Tidak diisi)';
      var mulaiStr = _fmtTime(row[7]);
      var selesaiStr = _fmtTime(row[8]);
      var mulaiMin = _timeStrToMinutes(mulaiStr);
      var selesaiMin = _timeStrToMinutes(selesaiStr);

      rowsBulanIni.push({
        tanggal: _fmtYMD(tgl), agen: String(row[1] || '').trim(), spm: spm,
        nopol: String(row[5] || '').trim(), jenisKendaraan: jenis,
        waktuMulai: mulaiStr, waktuSelesai: selesaiStr,
        mulaiMin: mulaiMin, selesaiMin: selesaiMin
      });
    }

    // ---- 1) ANOMALI DURASI per jenis kendaraan ----
    var durasiPerJenis = {}; // { jenis: [ {rec, durasiMenit} ] }
    rowsBulanIni.forEach(function (r) {
      if (r.mulaiMin == null || r.selesaiMin == null) return; // belum selesai, lewati
      var durasi = r.selesaiMin - r.mulaiMin;
      if (durasi < 0) durasi += 24 * 60; // lewat tengah malam
      if (durasi <= 0) return; // data tidak masuk akal, lewati
      if (!durasiPerJenis[r.jenisKendaraan]) durasiPerJenis[r.jenisKendaraan] = [];
      durasiPerJenis[r.jenisKendaraan].push({ rec: r, durasiMenit: durasi });
    });

    var ringkasanPerJenis = [];
    var anomaliList = [];
    Object.keys(durasiPerJenis).forEach(function (jenis) {
      var list = durasiPerJenis[jenis];
      var rataRata = list.reduce(function (a, x) { return a + x.durasiMenit; }, 0) / list.length;
      ringkasanPerJenis.push({
        jenisKendaraan: jenis,
        jumlahData: list.length,
        rataRataMenit: Math.round(rataRata)
      });
      if (list.length < 3) return; // sampel terlalu sedikit, jangan tandai anomali
      list.forEach(function (x) {
        var rasio = x.durasiMenit / rataRata;
        if (rasio >= 1.5) {
          anomaliList.push({
            tanggal: x.rec.tanggal, agen: x.rec.agen, spm: x.rec.spm, nopol: x.rec.nopol,
            jenisKendaraan: jenis, waktuMulai: x.rec.waktuMulai, waktuSelesai: x.rec.waktuSelesai,
            durasiMenit: x.durasiMenit, rataRataJenisMenit: Math.round(rataRata),
            tipe: 'lebih_lama', keterangan: 'Durasi muat ' + Math.round(rasio * 10) / 10 + 'x lebih lama dari rata-rata ' + jenis + ' (' + Math.round(rataRata) + ' menit)'
          });
        } else if (rasio <= 0.5) {
          anomaliList.push({
            tanggal: x.rec.tanggal, agen: x.rec.agen, spm: x.rec.spm, nopol: x.rec.nopol,
            jenisKendaraan: jenis, waktuMulai: x.rec.waktuMulai, waktuSelesai: x.rec.waktuSelesai,
            durasiMenit: x.durasiMenit, rataRataJenisMenit: Math.round(rataRata),
            tipe: 'lebih_cepat', keterangan: 'Durasi muat jauh lebih cepat dari rata-rata ' + jenis + ' (' + Math.round(rataRata) + ' menit) -- cek kemungkinan salah catat jam'
          });
        }
      });
    });
    anomaliList.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; }); // terbaru dulu

    // ---- 2) POTENSI LEMBUR: mulai muat di atas jam 16:00 ----
    var BATAS_JAM_LEMBUR = 16 * 60; // 16:00
    var potensiLembur = rowsBulanIni
      .filter(function (r) { return r.mulaiMin != null && r.mulaiMin >= BATAS_JAM_LEMBUR; })
      .map(function (r) {
        return {
          tanggal: r.tanggal, agen: r.agen, spm: r.spm, nopol: r.nopol,
          jenisKendaraan: r.jenisKendaraan, waktuMulai: r.waktuMulai, waktuSelesai: r.waktuSelesai,
          selisihMenitDariJam16: r.mulaiMin - BATAS_JAM_LEMBUR
        };
      })
      .sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });

    var hasilLt = {
      success: true,
      bulan: bulan, tahun: tahun,
      totalDataBulanIni: rowsBulanIni.length,
      ringkasanPerJenis: ringkasanPerJenis,
      anomali: anomaliList,
      potensiLembur: potensiLembur,
      jumlahAnomali: anomaliList.length,
      jumlahPotensiLembur: potensiLembur.length
    };

    try {
      var nowLt = new Date();
      var isBulanBerjalanLt = (tahun === nowLt.getFullYear() && bulan === (nowLt.getMonth() + 1));
      scriptCacheLt.put(cacheKeyLt, JSON.stringify(hasilLt), isBulanBerjalanLt ? 180 : 21600);
    } catch (cacheErrLt) { /* gagal cache tidak masalah */ }

    return hasilLt;
  } catch (err) { return { success: false, error: err.message }; }
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
    var today   = _hariIniKerja();
    var pending = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var spm        = String(row[4] || '').trim();   // E = PPR/SITECH (No. SPM)
      var agen       = String(row[1] || '').trim();   // B = Nama Agen
      var nopol      = String(row[5] || '').trim();   // F = Nopol
      var waktuMulai = row[7];                          // H = Waktu Mulai
      var statusBatal= String(row[9] || '').trim();    // J = Status Batal
      var keterangan = String(row[10] || '').trim();   // K = Keterangan (dari sync Jadwal Pengiriman)

      if (!spm || !agen) continue;          // baris belum diisi PIC, lewati
      if (waktuMulai) continue;             // sudah mulai muat (atau sudah "Ikut Fitting"), lewati
      if (statusBatal) continue;            // sudah dibatalkan, lewati

      // Tanggal dibaca dengan _tglPengiriman (aman beda zona waktu script vs sheet, juga teks dd/mm/yyyy).
      // Dulu memakai new Date()+setHours(): tanggal bisa bergeser 1 hari sehingga kiriman kemarin
      // (mis. Mega Bangunan) tampil sebagai kiriman hari ini, dan kiriman hari ini (DC-Kutorejo) hilang
      // dari daftar. Baris tanpa tanggal valid TIDAK dianggap hari ini.
      var tgl = _tglPengiriman(row[0]);
      if (!tgl || tgl.getTime() !== today.getTime()) continue; // hanya hari ini

      pending.push({
        rowIndex : i + 1,
        spm      : spm,
        agen     : agen,
        nopol    : nopol,
        keterangan: keterangan,
        ikutPipa : /IKUT\s*PIPA/i.test(keterangan)
      });
    }

    return { success: true, rows: pending };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Daftar kiriman dari TANGGAL SEBELUM HARI INI yang statusnya masih
//  "menunggu" (sudah didaftar PIC tapi belum di-mulai-muat / belum Ikut
//  Fitting / belum dibatalkan) -- dipakai untuk MENGUNCI tombol "Mulai
//  Muat" hari ini sampai semua sisa kiriman itu diberi keputusan (Ikut
//  Fitting atau Batal). Supaya tidak ada kiriman yang "ketinggalan"/
//  terlupa begitu saja saat hari berganti.
//
//  PERBAIKAN: dulu HANYA mengecek persis "kemarin". Akibatnya hari
//  Senin (kemarin = Minggu, tidak ada kiriman) sisa kiriman hari
//  Sabtu -- atau libur/tanggal merah, atau tanggal mana pun yang
//  terlewat -- TIDAK PERNAH memunculkan kartu notif sama sekali. Sekarang
//  mencakup semua tanggal sebelum hari ini sampai 31 hari ke belakang
//  (nama fungsi dipertahankan supaya frontend lama tetap jalan).
// ================================================================
function getPendingRowsKemarin() {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };

    var data      = sheet.getDataRange().getValues();
    var today     = _hariIniKerja();
    var batasAwal = new Date(today); batasAwal.setDate(batasAwal.getDate() - 31);
    var pending   = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var spm        = String(row[4] || '').trim();   // E = No. SPM
      var agen       = String(row[1] || '').trim();   // B = Nama Agen
      var nopol      = String(row[5] || '').trim();   // F = Nopol
      var jenis      = String(row[6] || '').trim();   // G = Jenis Kendaraan
      var waktuMulai = row[7];                          // H = Waktu Mulai
      var statusJ    = String(row[9] || '').trim();    // J = Status (Batal/Pending/dst)
      var statusUp   = statusJ.toUpperCase();

      if (!spm || !agen) continue;                    // baris belum diisi PIC, lewati
      if (waktuMulai) continue;                        // sudah mulai muat / Ikut Fitting, lewati
      if (statusUp.indexOf('BATAL') === 0 || statusUp.indexOf('TERKIRIM') === 0 || statusUp.indexOf('GAGAL') === 0) continue; // sudah ada keputusan akhir

      var tgl = _tglPengiriman(row[0]);
      if (!tgl) continue;
      if (tgl.getTime() >= today.getTime()) continue;   // hari ini / masa depan bukan "tertinggal"
      if (tgl.getTime() < batasAwal.getTime()) continue; // terlalu lama -> bukan urusan kartu notif harian

      pending.push({
        rowIndex : i + 1,
        tanggal  : _fmtYMD(tgl),
        hariLalu : Math.round((today.getTime() - tgl.getTime()) / 86400000),
        spm      : spm,
        agen     : agen,
        nopol    : nopol,
        jenisKendaraan: jenis,
        statusSaatIni: statusJ || 'Menunggu'
      });
    }
    pending.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : (a.tanggal > b.tanggal ? 1 : a.rowIndex - b.rowIndex); });

    return { success: true, rows: pending };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  PENGAMAN NOMOR BARIS -- frontend menulis ke sheet memakai nomor
//  baris yang diambil saat halaman dimuat. Kalau sesudah itu ada baris
//  yang dihapus/ditambah di atasnya (sync jadwal membersihkan baris
//  basi, PIC menghapus baris manual, dst), nomor itu BERGESER dan
//  Waktu Mulai/Selesai/Status bisa tertulis ke kiriman LAIN -- kiriman
//  yang sebenarnya diklik malah tetap "belum selesai".
//  Maka tiap aksi tulis kini membawa nomor SPM-nya; sebelum menulis,
//  dicek kolom E di baris itu memang SPM yang sama. Kalau bergeser,
//  dicari baris SPM yang sama (terdekat dari nomor lama); kalau tidak
//  ketemu, ditolak dgn pesan jelas -- tidak menimpa data orang lain.
//  Parameter spm opsional: frontend lama yang belum kirim spm tetap
//  jalan seperti sebelumnya.
// ================================================================
function _pastikanBarisSpm(sheet, row, spm) {
  row = Number(row);
  spm = String(spm == null ? '' : spm).trim();
  if (!spm) return { ok: true, row: row };
  var lastRow = sheet.getLastRow();
  if (row >= 2 && row <= lastRow && String(sheet.getRange(row, 5).getValue() || '').trim() === spm) {
    return { ok: true, row: row };
  }
  if (lastRow >= 2) {
    var vals = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
    var best = -1, bestDist = Infinity;
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0] || '').trim() !== spm) continue;
      var d = Math.abs((i + 2) - row);
      if (d < bestDist) { best = i + 2; bestDist = d; }
    }
    if (best > 0) {
      Logger.log('Baris SPM ' + spm + ' bergeser: frontend kirim ' + row + ', sebenarnya ' + best);
      return { ok: true, row: best, digeser: true };
    }
  }
  return { ok: false, error: 'Kiriman SPM ' + spm + ' tidak ditemukan di baris ' + row + ' (isi sheet berubah sejak halaman dimuat). Klik Refresh lalu ulangi.' };
}

function setWaktuMulai(row, waktu, spm) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var pb = _pastikanBarisSpm(sheet, row, spm);
    if (!pb.ok) return { success: false, error: pb.error };
    row = pb.row;
    sheet.getRange(row, 8).setValue(waktu);
    // Bersihkan status BATAL/PENDING lama (kolom J) kalau ada — user
    // secara eksplisit klik Mulai, artinya kiriman ini AKTIF lagi,
    // status lama sudah tidak relevan dan harus tidak lagi menutupi.
    _clearStaleCancelStatus(sheet, row);
    return { success: true, row: row };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function setWaktuSelesai(row, waktu, spm) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var pb = _pastikanBarisSpm(sheet, row, spm);
    if (!pb.ok) return { success: false, error: pb.error };
    row = pb.row;
    sheet.getRange(row, 9).setValue(waktu);
    _clearStaleCancelStatus(sheet, row);
    return { success: true, row: row };
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
function setStatusBatal(row, reason, notes, spm) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var pb = _pastikanBarisSpm(sheet, row, spm);
    if (!pb.ok) return { success: false, error: pb.error };
    row = pb.row;
    var label = 'BATAL' + (reason ? (' - ' + reason) : '');
    sheet.getRange(row, 10).setValue(label); // J = Status Batal
    if (notes) sheet.getRange(row, 11).setValue(notes); // K = Catatan Batal
    return { success: true, row: row };
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
function setIkutFittingRucika(row, spm) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var pb = _pastikanBarisSpm(sheet, row, spm);
    if (!pb.ok) return { success: false, error: pb.error };
    row = pb.row;
    sheet.getRange(row, 8).setValue('Ikut Fitting');   // H = Waktu Mulai (marker)
    sheet.getRange(row, 9).setValue('Rucika');          // I = Waktu Selesai (marker)
    _clearStaleCancelStatus(sheet, row);
    return { success: true, row: row };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Simpan status PENDING ke kolom J sheet PENGIRIMAN
//  Dipanggil saat operator menunda kiriman (Tunda/Pending).
//  Format: "PENDING - alasan | catatan | HH:MM DD/M"
// ================================================================
function setStatusPending(row, reason, notes, tujuan, spm) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var pb = _pastikanBarisSpm(sheet, row, spm);
    if (!pb.ok) return { success: false, error: pb.error };
    row = pb.row;
    var now   = new Date();
    var waktu = _pad2(now.getHours()) + ':' + _pad2(now.getMinutes()) +
                ' ' + now.getDate() + '/' + (now.getMonth() + 1);
    var label = 'PENDING';
    if (reason) label += ' - ' + reason;
    if (notes)  label += ' | ' + notes;
    if (tujuan) label += ' | Tujuan: ' + tujuan;
    label += ' | ' + waktu;
    sheet.getRange(row, 10).setValue(label); // J = STATUS
    return { success: true, row: row };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Hapus/reset status PENDING di kolom J (saat pending dibatalkan
//  atau sudah dikirim ? agar baris bersih kembali)
// ================================================================
function clearStatusPending(row, spm) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var pb = _pastikanBarisSpm(sheet, row, spm);
    if (!pb.ok) return { success: false, error: pb.error };
    row = pb.row;
    var cur   = String(sheet.getRange(row, 10).getValue() || '').trim();
    // Hanya hapus jika isinya PENDING (jangan hapus BATAL atau TERKIRIM)
    if (cur.indexOf('PENDING') === 0) {
      sheet.getRange(row, 10).setValue('');
    }
    return { success: true, row: row };
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
function setStatusTerkirim(row, label, spm) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan' };
    var pb = _pastikanBarisSpm(sheet, row, spm);
    if (!pb.ok) return { success: false, error: pb.error };
    row = pb.row;
    sheet.getRange(row, 10).setValue(label); // J = STATUS
    return { success: true, row: row };
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
      lem        : data.lem,
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
      lem        : data.lem,
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
    if (isRucikaFitting()) return { success: true, groups: GROUP_LABEL_RUCIKA.slice() };
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
//  KATEGORI KHUSUS FITTING RUCIKA (workspace cibitung_fitting_rucika)
//  Kategori: lem | fitting | rutape | container (Container Box Scrap)
//  Aturan (sumber: kolom Drawing, fallback Description):
//    - Drawing mengandung COMM-ART            -> container
//    - Drawing mengandung RUTAPE              -> rutape
//    - Drawing mengandung LEM / GLUE          -> lem
//    - Drawing mengandung FITTING             -> fitting
//    - Drawing KOSONG: Description diawali RUGLUE -> lem,
//      Description mengandung RUTAPE -> rutape, selain itu -> fitting
// ================================================================
var GROUP_LABEL_RUCIKA = ['Stock LEM', 'Stock Fitting']; // Rutape & Container Box (Scrap) sudah digabung ke Stock Fitting
function katDariGroupRucika(g) {
  g = normStr(g);
  if (g.indexOf('LEM') !== -1)       return 'lem';
  return 'fitting';
}
function _mirip_drawing(v) { return /^(FITTING|LEM|GLUE|RUTAPE|COMM-ART)/.test(normStr(v)); }
// Baris DASHBOARD_STOCK (0-based): E=4, F=5, I=8 (Drawing hasil rumus).
// Layout A (upload mentah dari Excel Rucika): E=Drawing, F=Description.
// Layout B (seperti Import): E=Description, I=Drawing.
function getKategoriRucikaStockRow(row) {
  var eDraw = _mirip_drawing(row[4]);
  var drawing = normStr(row[8]) || (eDraw ? row[4] : '');
  var desc = eDraw ? (row[5] || '') : (row[4] || row[5] || ''); // E kosong (Drawing kosong, layout A) -> pakai F
  return getKategoriRucika(drawing, desc);
}
// Gabungkan Description (C) + Description2 (D) tanpa duplikasi; G dipakai bila ada.
function _namaItemLengkap(g, c, d) {
  var G = String(g || '').trim();
  if (G) return G;
  var C = String(c || '').trim(), D = String(d || '').trim();
  if (C && D) {
    var cu = C.toUpperCase(), du = D.toUpperCase();
    if (cu.indexOf(du) !== -1) return C;   // D sudah termuat di C
    if (du.indexOf(cu) !== -1) return D;   // C sudah termuat di D
    return C + ' ' + D;
  }
  return C || D;
}
// Drawing untuk baris DASHBOARD_KIRIM/MASUK: kolom H (index 7, "DRAWING") bila terisi.
// Kolom B di sheet ini umumnya GROUP (mis. Q055/I053), BUKAN drawing, jadi hanya dipakai
// kalau isinya memang terlihat seperti drawing (FITTING/LEM/GLUE/RUTAPE/COMM-ART...).
// Drawing kosong -> klasifikasi jatuh ke aturan deskripsi (awalan RUGLUE = Lem, selain itu Fitting).
function _drawingTransaksiRucika(row) {
  if (normStr(row[7])) return row[7];
  return _mirip_drawing(row[1]) ? row[1] : '';
}
// Jalankan MANUAL di editor Apps Script (pilih fungsi ini -> Run) pada deployment/
// spreadsheet yang ingin dicek. Melaporkan: apakah kolom G (Description lengkap) dan
// H (DRAWING) terisi di DASHBOARD_KIRIM/MASUK, sebaran kategori Rucika, dan contoh nama
// item hasil gabungan C+D. Hanya membaca, tidak mengubah data.
function diagKirimMasukRucika() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  ['DASHBOARD_KIRIM', 'DASHBOARD_MASUK'].forEach(function (nm) {
    var sh = ss.getSheetByName(nm);
    if (!sh) { Logger.log(nm + ': sheet tidak ada'); return; }
    var v = sh.getDataRange().getValues();
    var n = v.length - 1, gIsi = 0, hIsi = 0, bMirip = 0, kat = {}, contoh = [];
    for (var i = 1; i < v.length; i++) {
      var r = v[i];
      if (String(r[6] || '').trim()) gIsi++;
      if (String(r[7] || '').trim()) hIsi++;
      if (_mirip_drawing(r[1])) bMirip++;
      var k = getKategoriRucika(_drawingTransaksiRucika(r), _namaItemLengkap(r[6], r[2], r[3]));
      kat[k] = (kat[k] || 0) + 1;
      if (contoh.length < 5 && i > v.length - 40) contoh.push(r[0] + ' | B=' + r[1] + ' | H=' + r[7] + ' | ' + _namaItemLengkap(r[6], r[2], r[3]) + ' -> ' + k);
    }
    Logger.log(nm + ': ' + n + ' baris | G terisi: ' + gIsi + ' | H (DRAWING) terisi: ' + hIsi +
               ' | B mirip drawing: ' + bMirip + ' | kategori: ' + JSON.stringify(kat));
    contoh.forEach(function (c) { Logger.log('  ' + c); });
  });
}

function isRucikaFitting() { return ACTIVE_WORKSPACE === 'cibitung_fitting_rucika'; }
var KATEGORI_RUCIKA = ['lem', 'fitting', 'rutape', 'container']; // rutape/container tetap ada di respons (selalu 0) supaya frontend lama tidak error
function _adaKataLem(t) { return /(^|[^A-Z])LEM([^A-Z]|$)/.test(t); }
function getKategoriRucika(drawing, desc) {
  var d = normStr(drawing), ds = normStr(desc);
  // Hanya 2 kategori: lem dan fitting. Rutape & Container Box Scrap (COMM-ART)
  // DIGABUNG ke fitting, jadi cukup cek LEM/GLUE; selain itu otomatis fitting.
  if (d) {
    if (_adaKataLem(d) || d.indexOf('GLUE') !== -1) return 'lem';
    return 'fitting';
  }
  if (ds.indexOf('RUGLUE') === 0)  return 'lem';
  return 'fitting'; // drawing kosong / tidak dikenal & bukan RUGLUE -> fitting
}

// ================================================================
//  TARGET PRODUKTIVITAS (Ton/FTE) PER DEPARTEMEN
//
//  Dulu satu angka global (62,3 Ton/FTE) dipakai SEMUA departemen --
//  padahal job-mix beda plant beda (mis. Fitting Rucika byk item
//  sanitary/drainase kecil-kecil spt RDS/Clean Out yg lebih berat per
//  unit dibanding fitting standar Warehouse Import), jadi wajar
//  targetnya beda. Override per departemen disimpan di Script
//  Properties (PRODUKTIVITAS_TARGET_TON_FTE_<workspaceKey>) supaya bisa
//  diubah lewat Panel Admin tanpa perlu deploy ulang; kalau belum
//  pernah diatur, jatuh ke nilai default di bawah.
// ================================================================
var PRODUKTIVITAS_TARGET_DEFAULT = 62.3;
var PRODUKTIVITAS_TARGET_PER_WORKSPACE = {
  // 111.000,00 Kg = 111 Ton/FTE, sesuai permintaan -- sebelumnya
  // ikut default yang sama dgn Warehouse Import (62,3 Ton/FTE).
  'cibitung_fitting_rucika': 111
};

function _targetProduktivitasTonFTE() {
  var props = PropertiesService.getScriptProperties();
  var custom = props.getProperty('PRODUKTIVITAS_TARGET_TON_FTE_' + ACTIVE_WORKSPACE);
  if (custom !== null && custom !== '' && !isNaN(parseFloat(custom))) return parseFloat(custom);
  if (PRODUKTIVITAS_TARGET_PER_WORKSPACE.hasOwnProperty(ACTIVE_WORKSPACE)) return PRODUKTIVITAS_TARGET_PER_WORKSPACE[ACTIVE_WORKSPACE];
  return PRODUKTIVITAS_TARGET_DEFAULT;
}

// Lihat target departemen yang dipilih (utk ditampilkan di Panel Admin).
function adminGetTargetProduktivitas(actorNik, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var props = PropertiesService.getScriptProperties();
    var custom = props.getProperty('PRODUKTIVITAS_TARGET_TON_FTE_' + tgt.workspaceKey);
    var efektif = (custom !== null && custom !== '' && !isNaN(parseFloat(custom))) ? parseFloat(custom)
      : (PRODUKTIVITAS_TARGET_PER_WORKSPACE.hasOwnProperty(tgt.workspaceKey) ? PRODUKTIVITAS_TARGET_PER_WORKSPACE[tgt.workspaceKey] : PRODUKTIVITAS_TARGET_DEFAULT);
    return { success: true, target: efektif, diaturManual: custom !== null && custom !== '', workspace: tgt.workspaceKey };
  } catch (err) { return { success: false, error: err.message }; }
}

// Ubah target departemen yang dipilih. targetTon kosong = kembalikan ke
// bawaan sistem (hapus override).
function adminSetTargetProduktivitas(actorNik, targetTon, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var props = PropertiesService.getScriptProperties();
    var key = 'PRODUKTIVITAS_TARGET_TON_FTE_' + tgt.workspaceKey;
    var nilai = String(targetTon || '').trim();
    if (!nilai) { props.deleteProperty(key); }
    else {
      var n = parseFloat(nilai.replace(',', '.'));
      if (isNaN(n) || n <= 0) return { success: false, error: 'Target harus berupa angka lebih dari 0.' };
      props.setProperty(key, String(n));
    }
    _bumpCacheUntukWorkspace(tgt.workspaceKey); // kartu Produktivitas yang sudah di-cache perlu dihitung ulang
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  KATA KUNCI KATEGORI TAMBAHAN -- item baru (mis. varian drainase/
//  sanitary seperti RDS, Clean Out, P Trap) kadang punya nama yang
//  belum tercakup daftar bawaan di atas, sehingga sempat "hilang" dari
//  rincian kartu Pipa/Fitting walau datanya tetap tersimpan lengkap.
//  Daripada menunggu perubahan kode + deploy ulang tiap kali muncul
//  nama item baru, Super Admin bisa menambah kata kunci sendiri lewat
//  halaman Upload Data -> disimpan di Script Property ini (dipisah
//  koma), digabung otomatis ke daftar bawaan di atas.
// ================================================================
var _kwFittingTambahanCache = null; // cache per-eksekusi, supaya tidak baca Script Property berulang kali per baris saat memproses ribuan baris
function _daftarKeywordFittingTambahan() {
  if (_kwFittingTambahanCache === null) {
    var raw = PropertiesService.getScriptProperties().getProperty('KATEGORI_KEYWORD_TAMBAHAN') || '';
    _kwFittingTambahanCache = raw.split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);
  }
  return _kwFittingTambahanCache;
}

// Daftar gabungan (bawaan + tambahan) -- dipakai frontend Upload Data utk
// menampilkan warning "item tak terkategori" SEBELUM data diupload,
// dengan definisi kata kunci yang identik dgn yang dipakai backend.
function getKeywordKategoriGabungan() {
  try {
    return { success: true, tambahan: _daftarKeywordFittingTambahan() };
  } catch (err) { return { success: false, error: err.message }; }
}

// Lihat kata kunci tambahan saat ini (utk ditampilkan di textarea edit).
function adminGetKeywordKategoriTambahan(actorNik) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- hanya Super Admin (berlaku ke semua departemen).' };
    return { success: true, tambahan: PropertiesService.getScriptProperties().getProperty('KATEGORI_KEYWORD_TAMBAHAN') || '' };
  } catch (err) { return { success: false, error: err.message }; }
}

// Simpan daftar kata kunci tambahan (replace semua, dipisah koma).
// Berlaku GLOBAL ke semua departemen -- item PPR bernama sama biasanya
// dipakai lintas plant, jadi tidak dibuat per-departemen.
function adminSetKeywordKategoriTambahan(actorNik, csv) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- hanya Super Admin (berlaku ke semua departemen).' };
    var bersih = String(csv || '').split(',').map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);
    PropertiesService.getScriptProperties().setProperty('KATEGORI_KEYWORD_TAMBAHAN', bersih.join(','));
    _bumpDataCacheVersion(); // kartu Pipa/Fitting yang sudah di-cache perlu dihitung ulang dgn kata kunci baru
    return { success: true, jumlah: bersih.length };
  } catch (err) { return { success: false, error: err.message }; }
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
                   'FEMALE','MALE','TEE','CAP','FITTING','STRAIGHT','FLANGE',
                   'KELEN REDU','KLN REDU','KELEN EQUA','KLN EQUA',
                   'KELEN ELBO','KLN ELBO','KELEN COUP','KLN COUP',
                   'KELEN STRA','KLN STRA','WAY VALVE','RUCIKA KLN',
                   'RDS','CLEAN OUT','TRAP','INCREASER','DECREASER','BEND','KNEE',
                   'WYE','CROSS','NIPPLE','PLUG','STRAINER','VENT CAP','BUSHING',
                   'ADAPTOR','ADAPTER','SADDLE','DOP','DRAT','KRAN','GATE VALVE',
                   'CHECK VALVE','BALL VALVE','EXPANSION','DOUBLE NIPPLE'].concat(_daftarKeywordFittingTambahan());
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
                   'FEMALE','MALE','TEE','CAP','FITTING','STRAIGHT','FLANGE',
                   'KELEN REDU','KLN REDU','KELEN EQUA','KLN EQUA',
                   'KELEN ELBO','KLN ELBO','KELEN COUP','KLN COUP',
                   'KELEN STRA','KLN STRA','WAY VALVE','RUCIKA KLN',
                   'RDS','CLEAN OUT','TRAP','INCREASER','DECREASER','BEND','KNEE',
                   'WYE','CROSS','NIPPLE','PLUG','STRAINER','VENT CAP','BUSHING',
                   'ADAPTOR','ADAPTER','SADDLE','DOP','DRAT','KRAN','GATE VALVE',
                   'CHECK VALVE','BALL VALVE','EXPANSION','DOUBLE NIPPLE'].concat(_daftarKeywordFittingTambahan());
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
  var rucika = isRucikaFitting();
  if (rucika) KATEGORI_RUCIKA.forEach(function(k){ out.tonase[k] = 0; out.stok[k] = 0; });
  if (!sheet) return out;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var row  = data[i];
    var tgl  = toDate(row[9]);
    if (!tgl || !inRange(tgl, range)) continue;

    var tonnaseH = parseFloat(row[7]) || 0;
    out.globalTonase += tonnaseH;  // selalu akumulasi semua (tidak filter group)

    // Filter group jika ada (kolom D). Di Fitting Rucika "group" = kategori
    // (Stock LEM / Stock Fitting / Rutape / Container Box), bukan kode group.
    if (group) {
      if (rucika) {
        if (getKategoriRucikaStockRow(row) !== katDariGroupRucika(group)) continue;
      } else {
        var rowGroup = normStr(row[3]);
        if (rowGroup !== group) continue;
      }
    }

    // Baris ini lolos filter group (atau tidak ada filter)
    out.groupTonase += tonnaseH;

    var kat;
    if (rucika) {
      kat = getKategoriRucikaStockRow(row); // Drawing (I atau E) -> fallback Description
    } else {
      kat = getKategoriStock(row[8]);
      if (!kat) kat = getKategoriStockFallback(row[4]); // fallback: baca Description (kolom E)
    }
    if (!kat) continue;

    var pcs = parseFloat(row[6]) || 0;
    out.tonase[kat] += tonnaseH;
    out.stok[kat]   += pcs;
  }

  if (rucika) {
    out.tonase.total = out.tonase.lem + out.tonase.fitting + out.tonase.rutape + out.tonase.container;
    out.stok.total   = out.stok.lem   + out.stok.fitting   + out.stok.rutape   + out.stok.container;
    return out;
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

    _bumpDataCacheVersion(); // supaya dashboard tidak nampilin angka lama (lihat callWithServerCache)
    return { success: true, dihapus: rowsToDelete.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Hapus data dalam rentang tanggal tertentu -- versi generik dipakai
//  Stock/Kirim/Produksi sekalian, supaya dari halaman Upload Data user
//  bisa hapus data yang salah/lupa tanpa perlu buka Apps Script editor.
//  colIdx: nomor kolom (1-based) yang berisi tanggal transaksi.
// ================================================================
// Ubah isi sel tanggal (Date asli ATAU teks "dd/MM/yyyy" / "yyyy-MM-dd") jadi Date.
// PENTING: new Date("01/10/2026") dibaca MM/DD oleh JS (=> 10 Jan, bukan 1 Okt), jadi
// sel bertipe teks WAJIB lewat _parseTanggalFleksibel supaya tidak terlewat saat hapus.
function _cellKeTanggal(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var d = _parseTanggalFleksibel(v);
  return (d instanceof Date && !isNaN(d.getTime())) ? d : null;
}

// Nomor baris (1-based) yang tanggalnya jatuh di rentang [dari, sampai].
function _barisDalamRentang(sheet, colIdx, dari, sampai) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var vals = sheet.getRange(2, colIdx, lastRow - 1, 1).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    var d = _cellKeTanggal(vals[i][0]);
    if (d && d >= dari && d <= sampai) out.push(2 + i);
  }
  return out;
}

// Hasil: { success, dihapus, sisaDiSheet, terverifikasi, namaSheet, gagalSpreadsheet?, error? }
// success=false + gagalSpreadsheet=true => data di SPREADSHEET belum (seluruhnya) terhapus.
function _hapusDataByTanggalRange(sheetName, colIdx, dariDDMMYYYY, sampaiDDMMYYYY) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (eLock) {
    return { success: false, gagalSpreadsheet: true, namaSheet: sheetName, dihapus: 0,
      error: 'Server sedang sibuk (proses lain masih menulis ke spreadsheet). Tidak ada baris yang dihapus, coba lagi sebentar lagi.' };
  }
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, gagalSpreadsheet: true, namaSheet: sheetName, dihapus: 0, error: 'Sheet ' + sheetName + ' tidak ditemukan di spreadsheet.' };

    var dari = _parseTanggalFleksibel(dariDDMMYYYY);
    var sampai = _parseTanggalFleksibel(sampaiDDMMYYYY);
    if (!(dari instanceof Date) || isNaN(dari.getTime()) || !(sampai instanceof Date) || isNaN(sampai.getTime())) {
      return { success: false, namaSheet: sheetName, dihapus: 0, error: 'Tanggal dari/sampai tidak valid.' };
    }
    dari = new Date(dari.getTime()); sampai = new Date(sampai.getTime());
    dari.setHours(0, 0, 0, 0);
    sampai.setHours(23, 59, 59, 999);

    var rowsToDelete = _barisDalamRentang(sheet, colIdx, dari, sampai);
    if (!rowsToDelete.length) return { success: true, dihapus: 0, sisaDiSheet: 0, terverifikasi: true, namaSheet: sheetName };

    // Google Sheets menolak menghapus SEMUA baris non-frozen -> sisakan 1 baris kosong.
    try {
      if (sheet.getMaxRows() - rowsToDelete.length <= sheet.getFrozenRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
    } catch (eIns) { /* dilanjutkan; kalau tetap gagal akan tertangkap di bawah */ }

    var blocks = [];
    var blockStart = rowsToDelete[0], blockLen = 1;
    for (var j = 1; j < rowsToDelete.length; j++) {
      if (rowsToDelete[j] === blockStart + blockLen) blockLen++;
      else { blocks.push([blockStart, blockLen]); blockStart = rowsToDelete[j]; blockLen = 1; }
    }
    blocks.push([blockStart, blockLen]);

    var errHapus = null;
    for (var k = blocks.length - 1; k >= 0; k--) {
      try { sheet.deleteRows(blocks[k][0], blocks[k][1]); }
      catch (eDel) { errHapus = eDel.message; break; }
    }
    SpreadsheetApp.flush();

    // VERIFIKASI: baca ulang spreadsheet, hitung baris yang MASIH ada di rentang itu.
    var sisa = _barisDalamRentang(sheet, colIdx, dari, sampai).length;
    var dihapusNyata = rowsToDelete.length - sisa;
    _bumpDataCacheVersion();

    if (errHapus || sisa > 0) {
      return { success: false, gagalSpreadsheet: true, namaSheet: sheetName, dihapus: dihapusNyata, sisaDiSheet: sisa,
        error: 'Penghapusan di spreadsheet (' + sheetName + ') TIDAK tuntas: ' + dihapusNyata + ' baris terhapus, ' + sisa +
               ' baris masih tersisa di rentang ini' + (errHapus ? ' (' + errHapus + ')' : '') + '.' };
    }
    return { success: true, dihapus: rowsToDelete.length, sisaDiSheet: 0, terverifikasi: true, namaSheet: sheetName };
  } catch (err) {
    return { success: false, gagalSpreadsheet: true, namaSheet: sheetName, error: 'Gagal menghapus di spreadsheet: ' + err.message };
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// Dipanggil dari halaman Upload Data (tombol "Hapus Data" per tab) --
// dariDDMMYYYY/sampaiDDMMYYYY format "DD/MM/YYYY".
function hapusDataUploadByTanggal(tab, dariDDMMYYYY, sampaiDDMMYYYY) {
  var MAP = {
    stock:    { sheet: SH_STOCK,    kolom: 10 }, // kolom J
    outbound: { sheet: SH_KIRIM,    kolom: 5  }, // kolom E
    inbound:  { sheet: SH_PRODUKSI, kolom: 5  }  // kolom E
  };
  var cfg = MAP[tab];
  if (!cfg) return { success: false, error: 'Tab tidak dikenali: ' + tab };
  return _hapusDataByTanggalRange(cfg.sheet, cfg.kolom, dariDDMMYYYY, sampaiDDMMYYYY);
}

// Cek apakah tanggal-tanggal yang AKAN diupload sudah ada di sheet (peringatan upload ganda).
// tanggalList: array teks tanggal apa adanya dari file/form. Hasil: { success, ada:[{tanggal:'dd/MM/yyyy', baris:N}] }
function cekTanggalSudahUpload(tab, tanggalList) {
  var MAP = {
    stock:    { sheet: SH_STOCK,    kolom: 10 },
    outbound: { sheet: SH_KIRIM,    kolom: 5  },
    inbound:  { sheet: SH_PRODUKSI, kolom: 5  }
  };
  var cfg = MAP[tab];
  if (!cfg) return { success: false, error: 'Tab tidak dikenali: ' + tab };
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(cfg.sheet);
    if (!sheet) return { success: false, error: 'Sheet ' + cfg.sheet + ' tidak ditemukan.' };
    var tz = Session.getScriptTimeZone();
    var diminta = {};
    (tanggalList || []).forEach(function (t) {
      var d = _cellKeTanggal(t);
      if (d) diminta[Utilities.formatDate(d, tz, 'dd/MM/yyyy')] = true;
    });
    var lastRow = sheet.getLastRow();
    var hitung = {};
    if (lastRow >= 2 && Object.keys(diminta).length) {
      var vals = sheet.getRange(2, cfg.kolom, lastRow - 1, 1).getValues();
      for (var i = 0; i < vals.length; i++) {
        var d2 = _cellKeTanggal(vals[i][0]);
        if (!d2) continue;
        var key = Utilities.formatDate(d2, tz, 'dd/MM/yyyy');
        if (diminta[key]) hitung[key] = (hitung[key] || 0) + 1;
      }
    }
    var ada = Object.keys(hitung).map(function (k) { return { tanggal: k, baris: hitung[k] }; });
    ada.sort(function (x, y) { return x.tanggal.split('/').reverse().join('').localeCompare(y.tanggal.split('/').reverse().join('')); });
    return { success: true, ada: ada };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Ringkasan rentang tanggal data yang sudah ter-upload -- dipakai
// halaman Upload Data supaya user bisa lihat "data sudah sampai
// tanggal berapa" tanpa perlu buka spreadsheet manual.
function getRentangTanggalUpload(tab) {
  var MAP = {
    stock:    { sheet: SH_STOCK,    kolom: 10 },
    outbound: { sheet: SH_KIRIM,    kolom: 5  },
    inbound:  { sheet: SH_PRODUKSI, kolom: 5  }
  };
  var cfg = MAP[tab];
  if (!cfg) return { success: false, error: 'Tab tidak dikenali: ' + tab };
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(cfg.sheet);
    if (!sheet) return { success: false, error: 'Sheet ' + cfg.sheet + ' tidak ditemukan.' };
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, totalBaris: 0, tanggalPertama: null, tanggalTerakhir: null };

    var colVals = sheet.getRange(2, cfg.kolom, lastRow - 1, 1).getValues();
    var minDate = null, maxDate = null, totalBaris = 0;
    for (var i = 0; i < colVals.length; i++) {
      var v = colVals[i][0];
      if (!v) continue;
      var d = _cellKeTanggal(v);
      if (!d) continue;
      totalBaris++;
      if (!minDate || d.getTime() < minDate.getTime()) minDate = d;
      if (!maxDate || d.getTime() > maxDate.getTime()) maxDate = d;
    }
    var tz = Session.getScriptTimeZone();
    return {
      success: true,
      totalBaris: totalBaris,
      tanggalPertama: minDate ? Utilities.formatDate(minDate, tz, 'dd/MM/yyyy') : null,
      tanggalTerakhir: maxDate ? Utilities.formatDate(maxDate, tz, 'dd/MM/yyyy') : null
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}


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

function appendStockData(rows, tanggal, batchKey) {
  return _uploadIdempotent(SH_STOCK, batchKey, function () { return _appendStockDataImpl(rows, tanggal); });
}
function _appendStockDataImpl(rows, tanggal) {
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
    _bumpDataCacheVersion(); // supaya dashboard tidak nampilin angka lama (lihat callWithServerCache)
    return { success: true, jumlah: out.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// rows: array of array, urutan kolom PERSIS:
// [ItemNumber, DrawingCode, Description, Description2, EffectiveDate, TotalWeight]
// ================================================================
//  PERLINDUNGAN UPLOAD GANDA
//  Halaman Upload Data Harian mengulang (retry) batch yang timeout/putus koneksi. Kalau server SUDAH
//  sempat menulis batch itu tapi jawabannya tidak sampai, retry menulis baris yang sama dua kali ->
//  total Kirim/Terima/Stock membengkak (produktivitas ikut "tinggi"). Sekarang tiap batch membawa
//  batchKey unik (uploadId#nomor); batch dgn key yang sudah pernah sukses TIDAK ditulis ulang.
// ================================================================
function _uploadIdempotent(sheetName, batchKey, fn) {
  if (!batchKey) return fn();
  var cache = CacheService.getScriptCache(), key = 'upl_' + ACTIVE_WORKSPACE + '_' + sheetName + '_' + batchKey;
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var hit = cache.get(key);
    if (hit) { var o = JSON.parse(hit); o.diulang = true; return o; }
    var res = fn();
    if (res && res.success) { try { cache.put(key, JSON.stringify(res), 21600); } catch (e) {} }
    return res;
  } finally { lock.releaseLock(); }
}

// Berapa baris upload (item+tanggal+berat) yang SUDAH ada di sheet -- hanya peringatan, tidak ada data yang dibuang.
function _hitungBarisIdentik(sheet, rows) {
  try {
    var last = sheet.getLastRow(); if (last < 2) return 0;
    var tz = Session.getScriptTimeZone();
    var sig = function (item, tgl, berat) {
      var t = tgl instanceof Date ? Utilities.formatDate(tgl, tz, 'yyyy-MM-dd') : String(tgl);
      return String(item).trim().toUpperCase() + '|' + t + '|' + (Math.round(Number(berat) * 10000) / 10000);
    };
    var existing = {}, ex = sheet.getRange(2, 1, last - 1, 6).getValues();
    ex.forEach(function (r) { var k = sig(r[0], r[4], r[5]); existing[k] = (existing[k] || 0) + 1; });
    var n = 0;
    rows.forEach(function (r) { var k = sig(r[0], r[4], r[5]); if (existing[k]) { n++; existing[k]--; } });
    return n;
  } catch (e) { return 0; }
}

function appendOutboundData(rows, batchKey) {
  // KIRIM (Outbound): konvensi sumbernya MINUS = kiriman normal,
  // POSITIF = retur/koreksi -> NEGASIKAN (lihat komentar di
  // _appendKirimProduksi) supaya totalnya benar.
  return _uploadIdempotent(SH_KIRIM, batchKey, function () { return _appendKirimProduksi(rows, SH_KIRIM, true, batchKey); });
}

// Sama seperti appendOutboundData, tapi target sheetnya DASHBOARD_PRODUKSI
function appendInboundData(rows, batchKey) {
  // PRODUKSI (Inbound): konvensi sumbernya KEBALIKAN dari Kirim --
  // MAYORITAS baris sudah POSITIF (produksi/penerimaan normal), cuma
  // sebagian kecil MINUS (koreksi/retur ke supplier) yang MEMANG harus
  // tetap minus supaya mengurangi total dgn benar. Makanya di sini
  // TIDAK dinegasikan sama sekali -- disimpan APA ADANYA sesuai file
  // sumber. (Ini beda dgn Outbound! Jangan disamakan lagi.)
  return _uploadIdempotent(SH_PRODUKSI, batchKey, function () { return _appendKirimProduksi(rows, SH_PRODUKSI, false, batchKey); });
}

function _appendKirimProduksi(rows, sheetName, negasikan, batchKey) {
  try {
    if (!rows || !rows.length) return { success: false, error: 'Tidak ada baris data untuk diupload.' };
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Sheet "' + sheetName + '" tidak ditemukan.' };

    var out = rows.map(function (r) {
      var berat = _parseAngkaFleksibel(r[5]);
      // negasikan=true (Outbound/Kirim): MINUS(kiriman normal)->POSITIF
      //   (nambah total), POSITIF(retur)->MINUS (ngurangin total).
      // negasikan=false (Inbound/Produksi): disimpan APA ADANYA, karena
      //   konvensi sumbernya sudah benar dari sananya (mayoritas positif
      //   = normal, minoritas minus = koreksi yg memang harus mengurangi).
      if (negasikan) berat = -1 * berat;
      return [
        r[0] || '', r[1] || '', r[2] || '', r[3] || '',
        _parseTanggalFleksibel(r[4]), berat
      ];
    });

    // Peringatan data ganda hanya dicek di batch pertama (sebelum ada baris dari upload ini yg masuk)
    var identik = (!batchKey || /#0$/.test(String(batchKey))) ? _hitungBarisIdentik(sheet, out) : 0;
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, out.length, 6).setValues(out);
    // Sama seperti Stock: tidak ditunggu sync-nya di sini, biar cepat.
    // Trigger onEdit + arsip bulanan otomatis yang menangani sync/backup.
    _bumpDataCacheVersion(); // supaya dashboard tidak nampilin angka lama (lihat callWithServerCache)
    return { success: true, jumlah: out.length, identik: identik };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  Perbaiki data Agustus 2026 di SH_KIRIM yang SUDAH KADUNG di-upload
//  pakai logika Math.abs() yang lama (salah) -- 5 baris yang harusnya
//  MENGURANGI total (retur/koreksi) malah ikut kehitung nambah.
//  Item+tanggal+berat di bawah ini persis diambil dari analisa file
//  kirim.xlsx yang kamu upload. Jalankan MANUAL 1x dari Apps Script
//  editor (pilih fungsi ini, klik Run) -- aman dijalankan walau baris
//  ini kebetulan sudah benar (dicek dulu sebelum diubah, tidak akan
//  diubah dua kali / salah timpa baris lain).
// ================================================================
function perbaikiAnomaliRetutKirimAgustus2026() {
  var target = [
    { kode: '10301010020004', tanggalDDMMYYYY: '12/08/2026', berat: 70.89 },
    { kode: '20304103020000', tanggalDDMMYYYY: '12/08/2026', berat: 2.65 },
    { kode: '20304109020000', tanggalDDMMYYYY: '12/08/2026', berat: 1.5 },
    { kode: '20304101020000', tanggalDDMMYYYY: '12/08/2026', berat: 0.33 },
    { kode: '20304106020001', tanggalDDMMYYYY: '12/08/2026', berat: 0.99 }
  ];
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SH_KIRIM);
  if (!sheet) { Logger.log('Sheet ' + SH_KIRIM + ' tidak ditemukan.'); return; }
  var data = sheet.getDataRange().getValues();
  var diperbaiki = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var kode = String(row[0] || '').trim();
    var tglRow = toDate(row[4]);
    var beratSekarang = parseFloat(row[5]);
    if (isNaN(beratSekarang) || !tglRow) continue;
    for (var t = 0; t < target.length; t++) {
      var tgt = target[t];
      if (kode === tgt.kode && fmtD(tglRow) === tgt.tanggalDDMMYYYY &&
          Math.abs(Math.abs(beratSekarang) - tgt.berat) < 0.005) {
        sheet.getRange(i + 1, 6).setValue(-tgt.berat); // paksa jadi NEGATIF (mengurangi total)
        diperbaiki++;
        break;
      }
    }
  }
  _bumpDataCacheVersion();
  Logger.log('Baris anomali retur yang dibalik jadi negatif (mengurangi total): ' + diperbaiki + ' dari ' + target.length + ' yang dicari.');
}

function readTransaksi(ss, sheetName, range) {
  var sheet = ss.getSheetByName(sheetName);
  var out = { total:0, pipa:0, fitting:0, pipaGreen:0, pipaGrey:0,
              fittingGreen:0, fittingGrey:0, lem:0, rutape:0, container:0, trend:[] };
  if (!sheet) return out;
  var data     = sheet.getDataRange().getValues();
  var trendMap = {};
  var rucika   = isRucikaFitting();
  for (var i = 1; i < data.length; i++) {
    var row    = data[i];
    var tgl    = toDate(row[4]);
    if (!tgl || !inRange(tgl, range)) continue;
    var weight = parseFloat(row[5]) || 0;
    if (rucika) {
      // Drawing = kolom H (lihat _drawingTransaksiRucika). Deskripsi = G, atau C+D (C dulu).
      var katR = getKategoriRucika(_drawingTransaksiRucika(row), _namaItemLengkap(row[6], row[2], row[3]));
      out.total += weight;
      out[katR] += weight;
      var keyR = fmtD(tgl);
      if (!trendMap[keyR]) trendMap[keyR] = { label:keyR, lem:0, fitting:0, rutape:0, container:0 };
      trendMap[keyR][katR] += weight;
      continue;
    }
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
  if (rucika) {
    // 'pipa' = non-fitting (= LEM) agar grafik 2-garis lama tetap bisa dipakai
    out.pipa = out.lem;
    Object.keys(trendMap).forEach(function(k){
      var t = trendMap[k]; t.pipa = t.lem;
    });
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
  var rucika = isRucikaFitting();
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var tgl = toDate(row[4]); // col E = Effective Date
    if (!tgl || !inRange(tgl, range)) continue;
    var kat = rucika
      ? getKategoriRucika(_drawingTransaksiRucika(row), _namaItemLengkap(row[6], row[2], row[3]))
      : getKategoriTransaksiV2(row[1], row[2], row[3]);
    if (!kat) continue;
    var kode = String(row[0] || '').trim();
    // Nama lengkap: col G (Description lengkap) kalau terisi; kalau kosong, GABUNGKAN
    // col C (Description) + col D (Description2). Sebelumnya hanya salah satu kolom
    // yang diambil sehingga deskripsi tampak terpotong (mis. "DIA 63mm" tanpa jenisnya).
    var nama = _namaItemLengkap(row[6], row[2], row[3]) || kode;
    var ton  = Math.abs(parseFloat(row[5]) || 0); // col F = Total Weight
    if (!kode || ton === 0) continue;
    if (!itemMap[kode]) {
      itemMap[kode] = {
        kode  : kode,
        nama  : nama,
        jenis : rucika ? ({lem:'Lem', fitting:'Fitting'}[kat] || 'Fitting')
                       : ((kat === 'pipaGreen' || kat === 'pipaGrey') ? 'Pipa' : 'Fitting'),
        kat   : kat,
        tonase: 0
      };
    }
    itemMap[kode].tonase += ton;
    // Item sama bisa muncul di banyak baris; simpan nama yang paling lengkap (terpanjang).
    if (nama && nama.length > String(itemMap[kode].nama || '').length) itemMap[kode].nama = nama;
  }
  var all = Object.values(itemMap).sort(function(a, b) { return b.tonase - a.tonase; });
  if (rucika) { // Top 5 per kategori Rucika
    var hasilR = [];
    ['Lem', 'Fitting'].forEach(function(j) {
      hasilR = hasilR.concat(all.filter(function(x){ return x.jenis === j; }).slice(0, 5));
    });
    return hasilR;
  }
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
      var lastPicMuat = ''; // lihat catatan forward-fill di loop FITTING di bawah -- sama alasannya
      for (var i=1; i<dm.length; i++) {
        var row=dm[i];
        var tgl=toDate(row[1]);
        var kg =parseFloat(row[3])||0;
        if (!tgl||!kg) continue;
        var picRaw=String(row[2]||'').trim().toUpperCase();
        if (picRaw) lastPicMuat = picRaw;
        var pic = picRaw || lastPicMuat;
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

    // ---- Tonase Kiriman PIPA & FITTING dari DASHBOARD_KIRIM ----
    // Gunakan readTransaksi (sama dengan kalkulasi outbound di dashboard stock)
    // sehingga angka sync: kiriman pipa = outbound pipa di dashboard.
    // Dipindah ke SINI (sebelum baca REKAP MUATAN FITTING) karena
    // sekarang totalKirimanFitting dipakai utk hitung "sisa" Fitting.
    var kirimData = readTransaksi(ss, SH_KIRIM, range);
    var totalKiriman = kirimData.pipa || 0;   // hanya pipa (pipaGreen + pipaGrey)
    var totalKirimanFitting = kirimData.fitting || 0; // fitting sungguhan (dasar hitung sisa DONI)

    // ---- Baca REKAP MUATAN FITTING: B=Tanggal, C=PIC, D=Total Tonase (kg) ----
    // CATATAN: sebelumnya kolom D ini diperlakukan sbg "Total Box" (unit
    // pcs/box), sekarang diganti jadi TONASE (kg) -- pemicu/triger cara
    // baca datanya (kolom B/C/D, per tanggal per PIC) TETAP SAMA, cuma
    // satuannya yang berubah dari Box ke Kg.
    var shFit = ss.getSheetByName(SH_REKAP_FITTING);
    if (shFit) {
      var df = shFit.getDataRange().getValues();
      // Forward-fill kolom PIC yang kosong -- kejadian nyata: kolom PIC di
      // sheet sumber pakai CELL MERGE (mis. WANG ditulis 1x di baris
      // pertama, baris2 berikutnya kosong tapi kelihatan "menyatu" secara
      // visual krn merge). Nilai baris kosong itu SUNGGUH kosong secara
      // data (Apps Script baca cell merge: cuma cell kiri-atas yg ada
      // isinya, sisanya string kosong) -- SEBELUMNYA baris kosong itu
      // gagal cocok PIC manapun (normalizePICFitting('', ...) -> [])
      // dan diam2 dilewati, sehingga tonase WANG (atau PIC lain yg
      // sel-nya di-merge) hilang dari total padahal tanggal & tonase-nya
      // ada. Sekarang kolom PIC kosong otomatis mewarisi PIC baris
      // TERAKHIR yang terisi -- SAMA seperti bagaimana orang membaca
      // sheet yang sel-nya digabung.
      var lastPicFit = '';
      for (var j=1; j<df.length; j++) {
        var rowF=df[j];
        var tglF=toDate(rowF[1]);
        var box =parseFloat(rowF[3])||0; // nama var "box" dipertahankan, isinya sekarang kg
        if (!tglF||!box) continue;
        var picFRaw=String(rowF[2]||'').trim().toUpperCase();
        if (picFRaw) lastPicFit = picFRaw;
        var picF = picFRaw || lastPicFit;
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

    // ---- Sisa tonase Fitting -> SEMUA masuk ke DONI ----
    // Beda dari Pipa (sisa dibagi 2 ke DONI+IMAN), utk Fitting SEMUA
    // sisa tonase (total kiriman fitting sungguhan dari DASHBOARD_KIRIM,
    // dikurangi yang sudah tercatat eksplisit dari WANG & IMAN) masuk
    // ke DONI. Kalau DONI juga sudah punya input manual di sheet, sisa
    // ini DITAMBAHKAN ke input manual itu (bukan menggantikannya).
    var totalFitTercatat = (picFitting['WANG']||0) + (picFitting['IMAN']||0);
    var sisaFitting = Math.max(0, totalKirimanFitting - totalFitTercatat - (picFitting['DONI']||0));
    if (sisaFitting > 0) {
      picFitting['DONI'] = (picFitting['DONI']||0) + sisaFitting;
      // Distribusi porsi "sisa" ke tren HARIAN DONI -- proporsional
      // mengikuti pola kiriman fitting harian dari DASHBOARD_KIRIM
      // (sama seperti pola yang dipakai utk sisa Pipa DONI/IMAN di atas),
      // supaya grafik tren tidak flat 0 utk DONI padahal totalnya benar.
      var kirimFitHarian = {};
      var shKirimFitHar = ss.getSheetByName(SH_KIRIM);
      if (shKirimFitHar) {
        var dkFH = shKirimFitHar.getDataRange().getValues();
        for (var hf = 1; hf < dkFH.length; hf++) {
          var rowFH = dkFH[hf];
          var tglFH = toDate(rowFH[4]);
          if (!tglFH || !inRange(tglFH, range)) continue;
          var katFH = getKategoriTransaksiV2(rowFH[1], rowFH[2], rowFH[3]);
          if (katFH !== 'fittingGreen' && katFH !== 'fittingGrey') continue;
          var wFH = parseFloat(rowFH[5]) || 0;
          var dkeyFH = fmtD(tglFH);
          kirimFitHarian[dkeyFH] = (kirimFitHarian[dkeyFH] || 0) + wFH;
        }
      }
      var totalKirimFitHarianSum = Object.keys(kirimFitHarian).reduce(function(a, k) { return a + kirimFitHarian[k]; }, 0);
      if (totalKirimFitHarianSum > 0) {
        if (!fitHarian['DONI']) fitHarian['DONI'] = {};
        Object.keys(kirimFitHarian).forEach(function(dk) {
          var portion = sisaFitting * (kirimFitHarian[dk] / totalKirimFitHarianSum);
          fitHarian['DONI'][dk] = (fitHarian['DONI'][dk] || 0) + portion;
        });
      }
    }

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

// ================================================================
//  DIAGNOSA REKAP MUATAN FITTING -- alat bantu telusur kalau tonase 1
//  PIC (mis. WANG) tidak muncul/kurang di Rekap Muatan. Menampilkan
//  data MENTAH per baris sheet REKAP MUATAN FITTING utk 1 bulan,
//  supaya kelihatan persis kenapa suatu baris tidak ikut terhitung
//  (tanggal kosong/tidak kebaca, tonase kosong, PIC tidak dikenal,
//  atau di luar rentang bulan yg diminta).
// ================================================================
function diagnosaRekapFitting(bulan, tahun) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_REKAP_FITTING);
    if (!sh) return { success: false, error: 'Sheet "' + SH_REKAP_FITTING + '" tidak ditemukan.' };
    var range = buildRekapDateRange({ mode: 'bulanan', bulan: bulan, tahun: tahun });
    var data = sh.getDataRange().getValues();
    var out = [];
    var lastPic = '';
    for (var j = 1; j < data.length; j++) {
      var r = data[j];
      var tgl = toDate(r[1]);
      var picRaw = String(r[2] || '').trim();
      var box = parseFloat(r[3]) || 0;
      if (!tgl && !picRaw && !box) continue; // baris benar2 kosong -- lewati diam2, tidak perlu dilaporkan
      var picRawUp = picRaw.toUpperCase();
      if (picRawUp) lastPic = picRawUp;
      var picDipakai = picRawUp || lastPic;
      var alasanLewat = '';
      if (!tgl) alasanLewat = 'Tanggal kosong/tidak kebaca sbg tanggal';
      else if (!box) alasanLewat = 'Tonase (kolom D) kosong/0';
      else if (range && !inRange(tgl, range)) alasanLewat = 'Di luar bulan yang diminta';
      else {
        var cocok = normalizePICFitting(picDipakai, box);
        if (!cocok.length) alasanLewat = 'PIC "' + picDipakai + '" tidak dikenali sistem';
      }
      out.push({
        baris: j + 1,
        tanggalMentah: String(r[1]),
        tanggalKebaca: tgl ? _fmtYMD(tgl) : '(gagal dibaca)',
        picMentah: picRaw || '(kosong -- mewarisi dari baris di atas)',
        picDipakai: picDipakai,
        tonase: box,
        ikutDihitung: !alasanLewat,
        alasanLewat: alasanLewat
      });
    }
    return { success: true, data: out };
  } catch (err) { return { success: false, error: err.message }; }
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
  try { _supabaseRpc('wh_storage_stats', {}); } catch (e) { /* riwayat ukuran DB: abaikan bila fungsi SQL belum dibuat */ }
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
    else if (kind === 'fte') log = syncFteOnly(ACTIVE_WORKSPACE);
    else log = syncWorkspaceToSupabase(ACTIVE_WORKSPACE);
    var gagalCount = log.filter(function (l) { return l.indexOf('GAGAL') === 0; }).length;
    return { success: true, log: log, adaGagal: gagalCount > 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Sync khusus Monitoring FTE (Produktivitas, tren OT%, tren kategori
// lembur) -- dipakai tombol "Sync Sekarang" di fte_dashboard.html.
// Berbeda dari syncOutboundInboundOnly (yang juga refresh FTE tapi
// cuma sisi Kirim/Produksi-nya) -- ini scoped KHUSUS FTE saja, jadi
// mencakup efek dari Lembur/Absensi/Approval juga, bukan cuma upload
// Outbound/Inbound.
function syncFteOnly(workspaceKey) {
  ACTIVE_WORKSPACE = workspaceKey;
  SPREADSHEET_ID = resolveWorkspaceSpreadsheetId(workspaceKey);
  var log = [];
  var put = _syncPutHelper(workspaceKey, log);

  var now = new Date();
  var bulanIni = String(now.getMonth() + 1), tahunIni = String(now.getFullYear());
  var d2 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  var bulanPrev = String(d2.getMonth() + 1), tahunPrev = String(d2.getFullYear());

  put('fte:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getAbsensiFTEData(bulanIni, tahunIni); });
  put('fte:bulanan:' + tahunPrev + '-' + _pad2(+bulanPrev), function () { return getAbsensiFTEData(bulanPrev, tahunPrev); });
  put('ot_trend6:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getOvertimeTrend6Bulan(bulanIni, tahunIni); });
  put('kat_trend6:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getLemburKategoriTrend6Bulan(bulanIni, tahunIni); });

  Logger.log(log.join('\n'));
  return log;
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
  // Bulan sebelumnya -- sama seperti fix di syncOutboundInboundOnly,
  // supaya "Sync Sekarang" dari tab Stock juga membetulkan bulan yang
  // sudah lewat, bukan cuma bulan berjalan.
  var bulanPrevSt = months6[months6.length - 2].bulan, tahunPrevSt = months6[months6.length - 2].tahun;
  put('stock:bulanan:' + tahunPrevSt + '-' + _pad2(+bulanPrevSt), function () {
    if (stockTrendResult && stockTrendResult.success && stockTrendResult.results) {
      return stockTrendResult.results[stockTrendResult.results.length - 2];
    }
    return getDashboardData('bulanan', { bulan: bulanPrevSt, tahun: tahunPrevSt, group: '' });
  });
  put('stock:harian:' + todayStr, function () { return getDashboardData('harian', { dari: todayStr, sampai: todayStr, group: '' }); });
  put('kanban:harian:' + todayStr, function () { return getKanbanData('harian', { dari: todayStr, sampai: todayStr }); });
  put('kanban:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getKanbanData('bulanan', { bulan: bulanIni, tahun: tahunIni }); });

  // FIX KANBAN: upload stock bisa berisi tanggal selain hari ini (mis. upload
  // susulan 01/10). Sebelumnya hanya snapshot hari ini yang di-refresh, jadi
  // snapshot kanban tanggal upload tetap kosong. Refresh juga snapshot harian
  // & bulanan untuk tanggal-tanggal terbaru yang ada di DASHBOARD_STOCK.
  try {
    _kanbanRecentDates(7).forEach(function (ds) {
      if (ds === todayStr) return;
      var pp = ds.split('-');
      put('kanban:harian:' + ds, function () { return getKanbanData('harian', { dari: ds, sampai: ds }); });
      var ym = pp[0] + '-' + pp[1];
      if (ym !== tahunIni + '-' + _pad2(+bulanIni)) {
        put('kanban:bulanan:' + ym, function () { return getKanbanData('bulanan', { bulan: String(+pp[1]), tahun: pp[0] }); });
      }
    });
  } catch (err) { log.push('GAGAL refresh kanban tanggal terbaru: ' + err.message); }

  Logger.log(log.join('\n'));
  return log;
}

// Ambil maksimal n tanggal (YYYY-MM-DD) terbaru yang ada di kolom J (TANGGAL)
// sheet DASHBOARD_STOCK. Dipakai untuk refresh snapshot kanban setelah upload.
function _kanbanRecentDates(n) {
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH_STOCK);
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getRange(2, 10, sh.getLastRow() - 1, 1).getValues();
  var set = {};
  for (var i = 0; i < vals.length; i++) {
    var d = toDate(vals[i][0]);
    if (!d) continue;
    set[d.getFullYear() + '-' + _pad2(d.getMonth() + 1) + '-' + _pad2(d.getDate())] = 1;
  }
  return Object.keys(set).sort().slice(-n);
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
  var bulanPrevIo = months6[months6.length - 2].bulan, tahunPrevIo = months6[months6.length - 2].tahun;

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
  // ---- Bulan SEBELUMNYA -- sebelumnya cuma di-cover di
  // syncWorkspaceToSupabase() (sync penuh), TIDAK di sini (sync scoped
  // yang dipakai tombol "Sync Sekarang" di Upload Data & Rekap Muatan)
  // -- inilah penyebab bulan yang sudah lewat (mis. Agustus) tetap
  // tidak ter-refresh walau sudah klik Sync Sekarang berkali-kali,
  // padahal bulan berjalan (September) langsung benar.
  put('outbound:bulanan:' + tahunPrevIo + '-' + _pad2(+bulanPrevIo), function () {
    if (ioTrendResult && ioTrendResult.success && ioTrendResult.results) return ioTrendResult.results[ioTrendResult.results.length - 2].out;
    return getOutboundData({ bulan: bulanPrevIo, tahun: tahunPrevIo });
  });
  put('inbound:bulanan:' + tahunPrevIo + '-' + _pad2(+bulanPrevIo), function () {
    if (ioTrendResult && ioTrendResult.success && ioTrendResult.results) return ioTrendResult.results[ioTrendResult.results.length - 2].in;
    return getInboundData({ bulan: bulanPrevIo, tahun: tahunPrevIo });
  });
  put('kanban:harian:' + todayStr, function () { return getKanbanData('harian', { dari: todayStr, sampai: todayStr }); });
  put('kanban:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getKanbanData('bulanan', { bulan: bulanIni, tahun: tahunIni }); });
  put('rekap:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getRekapMuatanData({ mode: 'bulanan', bulan: bulanIni, tahun: tahunIni }); });
  put('rekap:bulanan:' + tahunPrevIo + '-' + _pad2(+bulanPrevIo), function () { return getRekapMuatanData({ mode: 'bulanan', bulan: bulanPrevIo, tahun: tahunPrevIo }); });

  // FTE (Kiriman+Penerimaan, Produktivitas) langsung dipengaruhi upload
  // Outbound/Inbound -- ikut disegarkan di sini juga (bulan ini + bulan
  // sebelumnya), bukan cuma lewat sync penuh.
  put('fte:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () { return getAbsensiFTEData(bulanIni, tahunIni); });
  put('fte:bulanan:' + tahunPrevIo + '-' + _pad2(+bulanPrevIo), function () { return getAbsensiFTEData(bulanPrevIo, tahunPrevIo); });

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

  // ---- BULAN SEBELUMNYA (mis. September edit -> refresh snapshot
  // Agustus juga) -- PENTING: snapshot bulanan Supabase awalnya cuma
  // di-refresh utk "bulan berjalan" (bulanIni di atas). Begitu tanggal
  // sistem berganti ke bulan baru, bulan sebelumnya jadi "beku" -- kalau
  // ada koreksi data manual di spreadsheet utk bulan yang SUDAH lewat
  // (skenario umum: baru sadar ada salah input beberapa hari setelah
  // tutup bulan), snapshot Supabase-nya TIDAK PERNAH ke-update lagi
  // walau onSheetEditSync sudah jalan -- filter "Bulanan" jadi tampilkan
  // angka lama sementara filter "Harian" (yang tidak di-precompute sama
  // sekali, selalu live ke Apps Script) sudah benar -- selisih yang
  // membingungkan persis seperti kasus Tonase Outbound Agustus. Sekarang
  // bulan sebelumnya IKUT di-refresh tiap ada edit apa pun, memakai data
  // yang SAMA dari batch tren 6 bulan (indeks kedua dari belakang) --
  // tidak perlu baca sheet lagi/tambahan biaya eksekusi berarti.
  var prevIdx = months6.length - 2; // -1 = bulan ini, -2 = bulan sebelumnya
  var bulanPrev = months6[prevIdx].bulan, tahunPrev = months6[prevIdx].tahun;
  put('stock:bulanan:' + tahunPrev + '-' + _pad2(+bulanPrev), function () {
    if (stockTrendResult && stockTrendResult.success && stockTrendResult.results) {
      return stockTrendResult.results[prevIdx];
    }
    return getDashboardData('bulanan', { bulan: bulanPrev, tahun: tahunPrev, group: '' });
  });
  put('outbound:bulanan:' + tahunPrev + '-' + _pad2(+bulanPrev), function () {
    if (ioTrendResult && ioTrendResult.success && ioTrendResult.results) {
      return ioTrendResult.results[prevIdx].out;
    }
    return getOutboundData({ bulan: bulanPrev, tahun: tahunPrev });
  });
  put('inbound:bulanan:' + tahunPrev + '-' + _pad2(+bulanPrev), function () {
    if (ioTrendResult && ioTrendResult.success && ioTrendResult.results) {
      return ioTrendResult.results[prevIdx].in;
    }
    return getInboundData({ bulan: bulanPrev, tahun: tahunPrev });
  });

  // Kanban (harian hari ini + bulanan bulan ini)
  put('kanban:harian:' + todayStr, function () {
    return getKanbanData('harian', { dari: todayStr, sampai: todayStr });
  });
  put('kanban:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    return getKanbanData('bulanan', { bulan: bulanIni, tahun: tahunIni });
  });

  // Rekap Muatan bulan ini + bulan sebelumnya -- sama seperti Stock/
  // Outbound/Inbound, tanpa ini snapshot bulan yg sudah lewat (mis.
  // Agustus, setelah masuk September) BEKU PERMANEN walau datanya
  // sudah dikoreksi/diperbaiki di sheet (kasus nyata: total Kirim di
  // Rekap Muatan Agustus masih nunjukin angka lama pakai tanda minus
  // dari SEBELUM fix negasi Kirim/Outbound dipasang).
  put('rekap:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    return getRekapMuatanData({ mode: 'bulanan', bulan: bulanIni, tahun: tahunIni });
  });
  put('rekap:bulanan:' + tahunPrev + '-' + _pad2(+bulanPrev), function () {
    return getRekapMuatanData({ mode: 'bulanan', bulan: bulanPrev, tahun: tahunPrev });
  });

  // ---- Monitoring FTE (kartu Produktivitas + tren 6 bulan) --
  // sebelumnya SELALU dihitung LIVE tiap buka halaman (beberapa
  // pembacaan sheet penuh: KARYAWAN_LEMBUR, LEMBUR_LOG, ABSENSI_LOG,
  // DASHBOARD_KIRIM, DASHBOARD_PRODUKSI, dipanggil sampai 3x sendiri-
  // sendiri utk getAbsensiFTEData + getOvertimeTrend6Bulan +
  // getLemburKategoriTrend6Bulan) -- itu penyebab utama Monitoring FTE
  // kerasa lambat. Sekarang di-precompute di sini juga (bulan ini +
  // bulan sebelumnya, sama seperti Stock/Outbound/Inbound), dan
  // otomatis ke-refresh tiap ada edit apa pun (lewat onSheetEditSync
  // yang sudah ada) -- TIDAK mengganggu update data sama sekali,
  // cuma "menyalin" hasil hitungan yang sama ke Supabase supaya
  // halaman baca dari sana dulu (jauh lebih cepat), baru fallback ke
  // Apps Script kalau snapshotnya belum ada.
  //
  // TIDAK termasuk: getLemburList/getAbsensiList (dipakai Riwayat
  // Lembur & approval TL) -- SENGAJA TETAP LIVE, jangan diprecompute/
  // di-cache, krn harus selalu real-time (lihat catatan di
  // assets/js/api-shim.js).
  put('fte:bulanan:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    return getAbsensiFTEData(bulanIni, tahunIni);
  });
  put('fte:bulanan:' + tahunPrev + '-' + _pad2(+bulanPrev), function () {
    return getAbsensiFTEData(bulanPrev, tahunPrev);
  });
  put('ot_trend6:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    return getOvertimeTrend6Bulan(bulanIni, tahunIni);
  });
  put('kat_trend6:' + tahunIni + '-' + _pad2(+bulanIni), function () {
    return getLemburKategoriTrend6Bulan(bulanIni, tahunIni);
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
  var options = {
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
  };

  // Percobaan ulang otomatis (maks 5x, dinaikkan dari 3x) KHUSUS utk error
  // 5xx (502/503/504) -- ini error di sisi SERVER SUPABASE (biasanya
  // sesaat/transient, spt "Gateway Timeout"), bukan soal data/kode yg
  // salah. Error 4xx (mis. 401 kredensial salah, 400 payload salah) TIDAK
  // diulang -- itu pasti gagal lagi kalau dicoba ulang, jadi langsung
  // dilempar.
  //
  // CATATAN (update): sebelumnya cuma 3x percobaan dgn jeda pendek (1s/2s)
  // -- total waktu tunggu sebelum menyerah cuma ~3 detik, ternyata kadang
  // kurang kalau Supabase lagi lambat beberapa detik lebih lama (contoh
  // kasus nyata: key 'inbound:bulanan' bulan berjalan gagal terus2an
  // dengan 504 walau key lain di sync yang sama sukses). Sekarang jeda
  // pakai exponential backoff (2s, 4s, 8s, 16s) supaya kasus lambat-sesaat
  // yang lebih lama dari itu tetap sempat berhasil sebelum menyerah.
  var MAX_ATTEMPT = 5;
  var lastErr;
  for (var attempt = 1; attempt <= MAX_ATTEMPT; attempt++) {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) return; // sukses
    lastErr = new Error('Supabase upsert gagal (' + code + '): ' + res.getContentText());
    if (code < 500 || attempt === MAX_ATTEMPT) throw lastErr; // 4xx atau sudah percobaan terakhir -> lempar
    Utilities.sleep(2000 * Math.pow(2, attempt - 1)); // jeda 2s, 4s, 8s, 16s sebelum coba lagi
  }
  throw lastErr;
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
// manual per baris di sheet KARYAWAN_LEMBUR. NIK berawalan HURUF = OS
// (Outsourcing), berawalan angka = Internal. Ini supaya akun baru (PEG...)
// yang lupa/belum di-set manual di sheet tetap otomatis kebaca sebagai
// OS, tidak perlu edit sheet satu-satu lagi.
function _kategoriDariNIK(kode) {
  // Aturan: NIK diawali HURUF (PEG..., dst) = OS (Outsourcing);
  // NIK diawali ANGKA = Internal.
  return /^[A-Za-z]/.test(String(kode || '').trim()) ? 'OS' : 'Internal';
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

// ------------------------------------------------------------
//  SUPER ADMIN -- LINTAS DEPARTEMEN/PLANT
// ------------------------------------------------------------
//  Cuma NIK di daftar ini yang boleh mengelola user di departemen LAIN
//  (bukan cuma departemen tempat dia login). Dipakai khusus untuk kasus
//  "buka departemen baru yang belum ada TL-nya sama sekali" -- super
//  admin bisa langsung buatkan akun TL pertama departemen itu dari
//  Panel Admin, TANPA perlu login dulu ke departemen itu (yang memang
//  belum bisa, karena belum ada akun sama sekali di sana).
//  TL biasa (bukan super admin) TETAP cuma bisa kelola departemennya
//  sendiri seperti biasa -- parameter targetWorkspace diabaikan untuk
//  mereka.
// ------------------------------------------------------------
var SUPER_ADMIN_NIK = ['PEG22111246']; // Ivan Reynata

function _isSuperAdmin(actorNik) {
  return SUPER_ADMIN_NIK.indexOf(String(actorNik || '').trim().toUpperCase()) !== -1;
}

// ------------------------------------------------------------
//  TL LINTAS DEPARTEMEN -- APPROVAL LEMBUR/CUTI SAJA
// ------------------------------------------------------------
//  Beda dgn SUPER_ADMIN_NIK di atas (yg bisa kelola USER di departemen
//  lain): ini KHUSUS utk TL yang menjabat di LEBIH DARI 1 departemen/
//  plant sekaligus (mis. Pak Shandy: TL Warehouse Fitting Import
//  SEKALIGUS Fitting Rucika) -- supaya dia bisa APPROVE/TOLAK
//  pengajuan lembur & cuti dari SEMUA departemen yang dia pegang,
//  walau sedang login di akun salah satu departemen saja. TIDAK bisa
//  dipakai utk kelola user/spreadsheet departemen lain (itu tetap
//  butuh Super Admin).
//
//  Diatur lewat Panel Admin (Super Admin > TL Lintas Departemen),
//  disimpan di Script Properties (BUKAN hardcode di sini) supaya bisa
//  diubah langsung tanpa deploy ulang -- lihat
//  adminGetCrossWorkspaceTL()/adminSetCrossWorkspaceTL() di bawah.
//  Format tersimpan: { "NIK": ["workspaceKey1","workspaceKey2", ...] }
// ------------------------------------------------------------
function _getCrossWorkspaceTLMap() {
  try {
    var json = PropertiesService.getScriptProperties().getProperty('CROSS_WORKSPACE_TL');
    return json ? JSON.parse(json) : {};
  } catch (e) { return {}; } // JSON korup -- anggap kosong, jangan sampai bikin approval error
}
function _saveCrossWorkspaceTLMap(map) {
  PropertiesService.getScriptProperties().setProperty('CROSS_WORKSPACE_TL', JSON.stringify(map || {}));
}

// Daftar workspace key yang boleh di-approve lembur/cuti-nya oleh
// actorNik -- SELALU termasuk departemen tempat dia login SEKARANG
// (ACTIVE_WORKSPACE), PLUS departemen tambahan hasil pendaftaran TL
// Lintas Departemen (kalau NIK-nya terdaftar di situ).
function _resolveApprovalWorkspaceKeys(actorNik) {
  var keys = [ACTIVE_WORKSPACE];
  try {
    var map = _getCrossWorkspaceTLMap();
    var extra = map[String(actorNik || '').trim().toUpperCase()] || [];
    extra.forEach(function (k) { if (keys.indexOf(k) === -1 && WORKSPACE_MAP[k]) keys.push(k); });
  } catch (e) { /* jangan sampai bikin approval error -- minimal tetap bisa approve departemen sendiri */ }
  return keys;
}

// Super Admin saja: lihat & atur daftar TL Lintas Departemen.
function adminGetCrossWorkspaceTL(actorNik) {
  if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- cuma Super Admin.' };
  return { success: true, data: _getCrossWorkspaceTLMap() };
}
// workspaceKeys: array of string. Kirim array kosong utk hapus
// pendaftaran NIK ini (kembali ke approval departemen sendiri saja).
function adminSetCrossWorkspaceTL(actorNik, targetNik, workspaceKeys) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- cuma Super Admin.' };
    targetNik = String(targetNik || '').trim().toUpperCase();
    if (!targetNik) return { success: false, error: 'NIK wajib diisi.' };
    var keys = (workspaceKeys || []).map(function (k) { return String(k).trim(); }).filter(Boolean);
    var invalid = keys.filter(function (k) { return !WORKSPACE_MAP[k]; });
    if (invalid.length) return { success: false, error: 'Departemen/plant tidak dikenali: ' + invalid.join(', ') };
    var map = _getCrossWorkspaceTLMap();
    if (!keys.length) { delete map[targetNik]; } else { map[targetNik] = keys; }
    _saveCrossWorkspaceTLMap(map);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Buka Spreadsheet AKUN_LOGIN yang tepat untuk aksi admin ini:
//  - Kalau actor SUPER ADMIN dan targetWorkspace diisi & valid -> buka
//    spreadsheet departemen TUJUAN itu (lintas departemen).
//  - Selain itu (TL biasa, atau super admin tanpa pilih departemen lain)
//    -> tetap pakai departemen tempat dia sendiri sedang login (aman,
//    tidak bisa "nyasar" ke departemen lain tanpa izin eksplisit).
// Return { ss, workspaceKey, error }.
function _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace) {
  if (targetWorkspace && _isSuperAdmin(actorNik)) {
    var targetId = WORKSPACE_MAP[targetWorkspace];
    if (!targetId) return { error: 'Departemen "' + targetWorkspace + '" belum di-provision (belum ada spreadsheet-nya).' };
    try {
      return { ss: SpreadsheetApp.openById(targetId), workspaceKey: targetWorkspace };
    } catch (e) {
      return { error: 'Gagal membuka spreadsheet departemen tujuan: ' + e.message };
    }
  }
  return { ss: SpreadsheetApp.openById(SPREADSHEET_ID), workspaceKey: ACTIVE_WORKSPACE };
}

// Daftar departemen/plant yang boleh dipilih -- HANYA dikembalikan
// untuk super admin (TL biasa tidak perlu/tidak boleh tahu daftar ini
// dari Panel Admin, mereka cuma kelola departemennya sendiri).
// isExtra=true berarti departemen ini dibuat lewat Panel Admin (bukan
// hardcode di kode) -- CUMA yang isExtra=true yang boleh dihapus lewat
// web (adminHapusDepartemen/adminHapusPlant), supaya departemen inti
// yang butuh edit kode (Fitting Import, Fitting Rucika, dst) tidak
// bisa ke-hapus tidak sengaja dari UI.
function getWorkspaceListForAdmin(actorNik) {
  if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Bukan super admin.' };
  var extra = _getExtraWorkspaceRegistry();
  var out = [];
  Object.keys(WORKSPACE_MAP).forEach(function (key) {
    var ex = extra[key];
    out.push({
      key: key,
      label: WORKSPACE_LABELS[key] || key,
      provisioned: !!WORKSPACE_MAP[key],
      isExtra: !!ex,
      plantKey: ex ? ex.plantKey : null,
      plantLabel: ex ? ex.plantLabel : null,
      deptKey: ex ? ex.deptKey : null,
      deptLabel: ex ? ex.deptLabel : null
    });
  });
  return { success: true, data: out, currentWorkspace: ACTIVE_WORKSPACE };
}

// ------------------------------------------------------------
//  TAMBAH DEPARTEMEN/PLANT BARU -- lewat Panel Admin, TANPA perlu buka
//  Apps Script editor / edit WORKSPACE_MAP / deploy ulang.
// ------------------------------------------------------------
//  Sebelumnya alurnya: jalankan provisionDepartmentSpreadsheet() manual
//  di Apps Script editor -> copy Spreadsheet ID hasilnya -> tempel ke
//  WORKSPACE_MAP di kode -> Deploy ulang. Sekarang cukup 1 klik dari web:
//  fungsi ini yang menjalankan provisionDepartmentSpreadsheet() DAN
//  langsung menyimpan hasilnya ke registry (Script Properties) yang
//  otomatis digabung ke WORKSPACE_MAP setiap request (lihat
//  _mergeExtraWorkspaces() di dekat definisi WORKSPACE_MAP) -- jadi
//  departemen baru LANGSUNG bisa dipakai login & dikelola, tanpa deploy.
//  Khusus SUPER ADMIN (lihat SUPER_ADMIN_NIK).
function adminProvisionNewDepartment(actorNik, plantKey, plantLabel, deptKey, deptLabel, includeRekapMuatan) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- cuma Super Admin yang boleh menambah departemen/plant baru.' };
    plantKey = String(plantKey || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    deptKey = String(deptKey || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    plantLabel = String(plantLabel || '').trim();
    deptLabel = String(deptLabel || '').trim();
    if (!plantKey || !deptKey || !plantLabel || !deptLabel) {
      return { success: false, error: 'Nama Plant dan Nama Departemen wajib diisi.' };
    }
    var workspaceKey = plantKey + '_' + deptKey;
    if (WORKSPACE_MAP[workspaceKey]) {
      return { success: false, error: 'Departemen ini sudah ada (key: ' + workspaceKey + '). Pilih nama lain, atau pakai yang sudah ada lewat dropdown.' };
    }

    // Bikin spreadsheet baru (copy struktur dari Fitting Import, sheet
    // transaksional dikosongkan) -- fungsi lama ini tidak diubah sama
    // sekali, cuma dipanggil dari sini.
    var hasil = provisionDepartmentSpreadsheet(plantLabel + ' - ' + deptLabel, !!includeRekapMuatan);
    if (!hasil || !hasil.success) return { success: false, error: 'Gagal membuat spreadsheet baru.' };

    // Simpan ke registry Script Properties supaya langsung aktif tanpa deploy ulang.
    // plantKey/deptKey ASLI (bukan cuma workspaceKey gabungan) ikut disimpan di
    // sini supaya penghapusan per-plant (adminHapusPlant) nanti AMAN & akurat --
    // tidak perlu menebak-nebak dari memecah workspaceKey (yang bisa ambigu
    // kalau plantKey atau deptKey sendiri sudah mengandung underscore).
    var extra = _getExtraWorkspaceRegistry();
    extra[workspaceKey] = {
      id: hasil.spreadsheetId,
      label: plantLabel + ' — ' + deptLabel,
      plantKey: plantKey, plantLabel: plantLabel,
      deptKey: deptKey, deptLabel: deptLabel
    };
    _saveExtraWorkspaceRegistry(extra);

    // Langsung aktifkan juga di memori proses saat ini (supaya kalau actor
    // lanjut Tambah User detik itu juga tanpa reload, sudah kebaca).
    WORKSPACE_MAP[workspaceKey] = hasil.spreadsheetId;
    WORKSPACE_LABELS[workspaceKey] = plantLabel + ' — ' + deptLabel;

    return { success: true, workspaceKey: workspaceKey, spreadsheetUrl: hasil.url };
  } catch (err) { return { success: false, error: err.message }; }
}

// ------------------------------------------------------------
//  Hapus 1 entri dari registry (dipakai bersama oleh adminHapusDepartemen
//  & adminHapusPlant). TIDAK menghapus file spreadsheet-nya dari Drive
//  secara default -- cuma "melepas" departemen itu dari WORKSPACE_MAP
//  supaya tidak lagi bisa dipakai login/upload/dsb (data lama tetap
//  aman tersimpan di file spreadsheet-nya, kalau-kalau ternyata
//  terhapus keliru). Set jugaHapusSpreadsheet=true kalau memang mau
//  file-nya ikut dipindah ke Trash Drive (masih bisa dipulihkan manual
//  dari Trash, BUKAN dihapus permanen).
// ------------------------------------------------------------
function _hapusSatuWorkspace(workspaceKey, extra, jugaHapusSpreadsheet) {
  var entry = extra[workspaceKey];
  var idLama = WORKSPACE_MAP[workspaceKey];
  delete extra[workspaceKey];
  delete WORKSPACE_MAP[workspaceKey];
  delete WORKSPACE_LABELS[workspaceKey];
  var catatan = 'Departemen "' + workspaceKey + '" dilepas dari daftar aktif.';
  if (jugaHapusSpreadsheet && idLama) {
    try {
      DriveApp.getFileById(idLama).setTrashed(true);
      catatan += ' Spreadsheet-nya dipindah ke Trash Drive (masih bisa dipulihkan).';
    } catch (e) {
      catatan += ' TAPI gagal memindah spreadsheet ke Trash: ' + e.message;
    }
  } else {
    catatan += ' Spreadsheet-nya TIDAK dihapus (aman dibuka manual di Drive kalau perlu).';
  }
  return catatan;
}

// ================================================================
//  HAPUS 1 DEPARTEMEN/PLANT (Super Admin) -- lewat Panel Admin.
//  HANYA bisa menghapus departemen yang dibuat lewat Panel Admin
//  (isExtra=true dari getWorkspaceListForAdmin) -- departemen inti yang
//  hardcode di WORKSPACE_MAP (Fitting Import, Fitting Rucika, dst)
//  SENGAJA tidak bisa dihapus lewat sini, karena itu butuh edit kode.
//
//  jugaHapusSpreadsheet (opsional, default false): kalau true, file
//  spreadsheet-nya ikut dipindah ke Trash Drive (bisa dipulihkan),
//  BUKAN dihapus permanen.
// ================================================================
function adminHapusDepartemen(actorNik, workspaceKey, jugaHapusSpreadsheet) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- cuma Super Admin yang boleh menghapus departemen/plant.' };
    workspaceKey = String(workspaceKey || '').trim();
    if (!workspaceKey) return { success: false, error: 'Departemen/plant tidak dipilih.' };
    var extra = _getExtraWorkspaceRegistry();
    if (!extra[workspaceKey]) {
      return { success: false, error: 'Departemen ini bukan hasil "Tambah Departemen/Plant Baru" -- departemen inti tidak bisa dihapus lewat web (perlu edit kode langsung kalau memang perlu).' };
    }
    var catatan = _hapusSatuWorkspace(workspaceKey, extra, !!jugaHapusSpreadsheet);
    _saveExtraWorkspaceRegistry(extra);
    return { success: true, catatan: catatan };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  HAPUS 1 PLANT SEKALIGUS SEMUA DEPARTEMEN DI DALAMNYA (Super Admin).
//  Sama seperti adminHapusDepartemen, tapi menghapus SEMUA workspace
//  extra yang plantKey-nya cocok sekaligus -- dicocokkan lewat field
//  plantKey yang disimpan eksplisit saat provisioning (BUKAN dengan
//  memecah workspaceKey), supaya aman walau nama plant/departemen
//  sama-sama mengandung underscore.
// ================================================================
function adminHapusPlant(actorNik, plantKey, jugaHapusSpreadsheet) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- cuma Super Admin yang boleh menghapus plant.' };
    plantKey = String(plantKey || '').trim();
    if (!plantKey) return { success: false, error: 'Plant tidak dipilih.' };
    var extra = _getExtraWorkspaceRegistry();
    var keysToDelete = Object.keys(extra).filter(function (key) { return extra[key].plantKey === plantKey; });
    if (!keysToDelete.length) {
      return { success: false, error: 'Tidak ada departemen (hasil Tambah Departemen/Plant Baru) yang ditemukan untuk plant ini.' };
    }
    var catatanList = keysToDelete.map(function (key) {
      return key + ': ' + _hapusSatuWorkspace(key, extra, !!jugaHapusSpreadsheet);
    });
    _saveExtraWorkspaceRegistry(extra);
    return { success: true, catatan: catatanList.join('\n') };
  } catch (err) { return { success: false, error: err.message }; }
}

// Daftar SEMUA akun (TANPA password/hash) untuk ditampilkan di tabel
// panel admin. NIK sengaja tidak disensor -- itu identitas publik
// (kartu karyawan), yang dirahasiakan hanya PasswordHash-nya.
function getAkunList(actorNik, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh membuka panel ini.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var ss = tgt.ss;
    var sh = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) return { success: true, data: [], workspaceKey: tgt.workspaceKey, belumAdaAkun: true };
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
        kategori: (/^OS\b/i.test(String(r[2] || '').trim()) ? 'OS' : _kategoriDariNIK(r[0])), // role "OS (Outsourcing)" juga = OS
        adaTandaTangan: !!String(r[5] || '')
      });
    }
    out.sort(function (a, b) { return a.nama < b.nama ? -1 : (a.nama > b.nama ? 1 : 0); });
    return { success: true, data: out, workspaceKey: tgt.workspaceKey };
  } catch (err) { return { success: false, error: err.message }; }
}

// Tambah akun baru. NIK karyawan outsourcing HARUS diawali "PEG" supaya
// otomatis terdeteksi kategori OS (konsisten dengan aturan lama di
// dokumentasi -- selain itu otomatis dianggap Internal).
function adminTambahUser(actorNik, nik, nama, role, passwordAwal, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh menambah user.' };
    nik = String(nik || '').trim().toUpperCase();
    nama = String(nama || '').trim();
    role = String(role || '').trim();
    if (!nik || !nama || !role || !passwordAwal) return { success: false, error: 'NIK, Nama, Role, dan Password awal wajib diisi.' };
    if (String(passwordAwal).length < 6) return { success: false, error: 'Password awal minimal 6 karakter.' };

    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var ss = tgt.ss;
    var sh = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) {
      // Departemen baru yang belum pernah ada akun sama sekali -- buat
      // sheet AKUN_LOGIN-nya di tempat (bukan lewat setupAkunLoginSheet()
      // supaya tidak salah sasaran ke SPREADSHEET_ID punya departemen
      // actor sendiri kalau ini aksi lintas-departemen oleh super admin).
      sh = ss.insertSheet(SH_AKUN_LOGIN);
      sh.getRange(1, 1, 1, 5).setValues([['NIK', 'Nama', 'Role', 'PasswordHash', 'Aktif']]);
      sh.setFrozenRows(1);
    }
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
function adminResetPassword(actorNik, nik, passwordBaru, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh reset password.' };
    if (!passwordBaru || String(passwordBaru).length < 6) return { success: false, error: 'Password baru minimal 6 karakter.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var sh = tgt.ss.getSheetByName(SH_AKUN_LOGIN);
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
function adminSetAktif(actorNik, nik, aktifBaru, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh menonaktifkan/mengaktifkan user.' };
    if (String(actorNik) === String(nik) && !aktifBaru) {
      return { success: false, error: 'Tidak bisa menonaktifkan akun sendiri yang sedang login.' };
    }
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var sh = tgt.ss.getSheetByName(SH_AKUN_LOGIN);
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
function adminEditUser(actorNik, nik, namaBaru, roleBaru, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh edit user.' };
    namaBaru = String(namaBaru || '').trim();
    roleBaru = String(roleBaru || '').trim();
    if (!namaBaru || !roleBaru) return { success: false, error: 'Nama dan Role wajib diisi.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var sh = tgt.ss.getSheetByName(SH_AKUN_LOGIN);
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

// Hapus akun user SEPENUHNYA (bukan cuma nonaktifkan) dari sheet
// AKUN_LOGIN. Dipakai lewat tombol "Hapus User" di Panel Admin.
// Akses: SAMA seperti aksi admin lain (adminTambahUser/adminSetAktif/
// dst) -- role TL ATAU Admin boleh (lihat _actorIsFullAccess), TIDAK
// dibatasi cuma Super Admin. Super Admin tambahan bisa menghapus lintas
// departemen lewat targetWorkspace (lihat _resolveAdminTargetSpreadsheet).
//
// 2 pengaman supaya tidak kejadian departemen jadi tidak punya admin
// sama sekali / actor menghapus akun sendiri yang sedang dipakai login:
//  1) Tidak bisa hapus akun sendiri yang sedang login.
//  2) Tidak bisa hapus akun ini kalau dia satu-satunya akun berrole
//     TL/Admin yang tersisa di departemen itu (departemen akan
//     "terkunci", tidak ada yang bisa kelola user lagi).
function adminHapusUser(actorNik, nik, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh menghapus user.' };
    nik = String(nik || '').trim();
    if (!nik) return { success: false, error: 'NIK wajib diisi.' };
    if (String(actorNik).trim().toUpperCase() === nik.toUpperCase()) {
      return { success: false, error: 'Tidak bisa menghapus akun sendiri yang sedang login.' };
    }
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var sh = tgt.ss.getSheetByName(SH_AKUN_LOGIN);
    if (!sh) return { success: false, error: 'Sheet AKUN_LOGIN belum ada.' };
    var data = sh.getDataRange().getValues();
    var rowIdx = -1, jumlahFullAccessLain = 0;
    for (var i = 1; i < data.length; i++) {
      var rowNik = String(data[i][0]).trim().toUpperCase();
      var role = String(data[i][2] || '').toUpperCase();
      var isFullAccess = (role === 'TL' || role.indexOf('ADMIN') !== -1);
      if (rowNik === nik.toUpperCase()) { rowIdx = i; }
      else if (isFullAccess) { jumlahFullAccessLain++; }
    }
    if (rowIdx === -1) return { success: false, error: 'NIK ' + nik + ' tidak ditemukan.' };
    var roleTarget = String(data[rowIdx][2] || '').toUpperCase();
    var targetFullAccess = (roleTarget === 'TL' || roleTarget.indexOf('ADMIN') !== -1);
    if (targetFullAccess && jumlahFullAccessLain === 0) {
      return { success: false, error: 'Tidak bisa menghapus -- ini satu-satunya akun TL/Admin di departemen ini. Tambahkan/aktifkan akun TL/Admin lain dulu sebelum menghapus akun ini, supaya departemen tidak kehilangan akses kelola user sama sekali.' };
    }
    sh.deleteRow(rowIdx + 1); // +1 krn data[] mulai dari 0 tapi baris sheet mulai dari 1 (header di baris 1)
    return { success: true };
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
function adminGetFonnteStatus(actorNik, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak.' };
    // Kalau Super Admin sedang lihat departemen LAIN (lewat dropdown di
    // Panel Admin), cek status utk departemen itu -- BUKAN departemen
    // tempat dia sendiri login. Sebelumnya bug ini bikin status ikut
    // departemen actor sendiri terus, jadi kelihatan "sudah diisi" padahal
    // yang dicek/diisi departemen lain yg masih kosong.
    var workspaceKey = (targetWorkspace && _isSuperAdmin(actorNik)) ? targetWorkspace : ACTIVE_WORKSPACE;
    var props = PropertiesService.getScriptProperties();
    var all = props.getProperties();
    var tokenNiks = {};
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('FONNTE_TOKEN_') === 0) tokenNiks[k.substring('FONNTE_TOKEN_'.length)] = true;
    });
    return {
      success: true,
      tokenNiks: tokenNiks,
      approverWaWorkspace: props.getProperty('FONNTE_APPROVER_WA_' + workspaceKey) ? 'diisi' : '',
      approverWaUmum: props.getProperty('FONNTE_APPROVER_WA') ? 'diisi' : '',
      tokenUmum: props.getProperty('FONNTE_TOKEN') ? 'diisi' : '',
      lastStatus: props.getProperty('FONNTE_LAST_STATUS') || '',
      workspace: workspaceKey
    };
  } catch (err) { return { success: false, error: err.message }; }
}

// Nomor approver WA khusus SATU departemen/plant (bisa yang lagi login,
// bisa departemen LAIN kalau Super Admin lagi pilih dari dropdown).
// Kosongkan (isi string kosong) utk hapus & fallback ke nomor umum
// FONNTE_APPROVER_WA.
function adminSetFonnteApproverWa(actorNik, nomorWa, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh mengatur nomor approver WA.' };
    nomorWa = String(nomorWa || '').trim();
    var workspaceKey = (targetWorkspace && _isSuperAdmin(actorNik)) ? targetWorkspace : ACTIVE_WORKSPACE;
    var props = PropertiesService.getScriptProperties();
    var key = 'FONNTE_APPROVER_WA_' + workspaceKey;
    if (!nomorWa) { props.deleteProperty(key); return { success: true, cleared: true }; }
    props.setProperty(key, nomorWa);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  HELPER PENGIRIMAN FONNTE -- dipakai lembur, absensi, reminder & tes
// ================================================================
// Nomor WA -> 62xxxxxxxxxx (digit saja). "+62 812-3456", "0812 3456",
// "62812..." semuanya jadi format yang sama.
function _normNomorFonnte(raw) {
  var n = String(raw || '').replace(/[^0-9]/g, '');
  if (!n) return '';
  if (n.indexOf('00') === 0) n = n.substring(2);
  if (n.charAt(0) === '0') n = '62' + n.substring(1);
  return n;
}

// Token pengirim untuk 1 karyawan: token miliknya -> token UMUM (nomor
// dedicated) -> (terakhir) token siapa saja yang sudah tersimpan, supaya
// karyawan yg belum dikasih token tidak membuat notif diam-diam dilewati.
// NIK disimpan HURUF BESAR oleh adminSetFonnteToken, jadi dicari huruf
// besar juga (sebelumnya persis "as-is" -> bisa meleset kalau beda kapital).
function _fonnteCariToken(kode) {
  var props = PropertiesService.getScriptProperties();
  var k = String(kode || '').trim();
  if (k) {
    var t = props.getProperty('FONNTE_TOKEN_' + k.toUpperCase()) || props.getProperty('FONNTE_TOKEN_' + k);
    if (t) return { token: t, sumber: 'token NIK ' + k };
  }
  var umum = props.getProperty('FONNTE_TOKEN');
  if (umum) return { token: umum, sumber: 'token umum' };
  var all = props.getProperties();
  var keys = Object.keys(all);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].indexOf('FONNTE_TOKEN_') === 0 && all[keys[i]]) {
      return { token: all[keys[i]], sumber: 'token ' + keys[i].substring('FONNTE_TOKEN_'.length) + ' (cadangan)' };
    }
  }
  return null;
}

function _fonnteApprover() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty('FONNTE_APPROVER_WA_' + ACTIVE_WORKSPACE) || props.getProperty('FONNTE_APPROVER_WA') || '';
}

function _fonnteSaran(reason) {
  var r = String(reason || '').toLowerCase();
  if (/token/.test(r) && /(invalid|salah|not found|tidak)/.test(r)) return 'Token Fonnte tidak dikenali. Copy ulang token dari fonnte.com → Device → (pilih device) → Token, lalu simpan lagi tanpa spasi.';
  if (/disconnect|not connect|terputus|belum terhubung/.test(r)) return 'Device Fonnte sedang TIDAK terhubung. Buka fonnte.com → Device, lalu Connect / scan QR ulang dgn WhatsApp nomor dedicated.';
  if (/quota|kuota|expired|habis|package|paket|subscription|limit/.test(r)) return 'Paket/kuota Fonnte kemungkinan habis atau kedaluwarsa. Cek masa aktif & kuota di dashboard Fonnte.';
  if (/target|number|nomor/.test(r)) return 'Nomor tujuan (approver) ditolak Fonnte. Pastikan nomor aktif WhatsApp, format 628xxxxxxxxxx, dan BUKAN nomor yang sama dengan nomor pengirim (device).';
  return '';
}

function _fonnteSimpanStatus(r) {
  try {
    PropertiesService.getScriptProperties().setProperty('FONNTE_LAST_STATUS', JSON.stringify({
      waktu: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
      workspace: ACTIVE_WORKSPACE, ok: !!r.ok, sumber: r.sumber || '', ke: r.to || '',
      pesan: r.pesan || '', saran: r.saran || ''
    }));
  } catch (e) { /* cuma pelengkap diagnosa */ }
}

// Kirim 1 pesan lewat Fonnte. Mengembalikan objek {ok, pesan, saran, to, sumber, httpCode}
// -- alasan gagal dari Fonnte (reason) ikut dikembalikan & disimpan, bukan cuma "false".
function _fonnteKirim(kodePengirim, pesan) {
  var hasil = { ok: false };
  var tk = _fonnteCariToken(kodePengirim);
  var targetRaw = _fonnteApprover();
  if (!tk || !targetRaw) {
    var kurang = [];
    if (!tk) kurang.push('Token Fonnte');
    if (!targetRaw) kurang.push('Nomor WA Approver');
    hasil.pesan = 'Belum diisi (departemen "' + ACTIVE_WORKSPACE + '"): ' + kurang.join(' & ') + '.';
    hasil.saran = !tk ? 'Isi token di Panel Admin (Token Fonnte Umum atau tombol Token WA pada user).' : 'Isi Nomor WA Approver di Panel Admin utk departemen ini, atau nomor umum.';
    Logger.log('Notif WA dilewati: ' + hasil.pesan);
    _fonnteSimpanStatus(hasil);
    return hasil;
  }
  var target = _normNomorFonnte(targetRaw);
  hasil.to = target; hasil.sumber = tk.sumber;
  try {
    var res = UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post',
      headers: { Authorization: tk.token },
      payload: { target: target, message: pesan, countryCode: '62' },
      muteHttpExceptions: true
    });
    hasil.httpCode = res.getResponseCode();
    var body = res.getContentText();
    Logger.log('Fonnte response (' + hasil.httpCode + ') ke ' + target + ' [' + tk.sumber + ']: ' + body);
    var parsed = null;
    try { parsed = JSON.parse(body); } catch (e) { /* bukan JSON */ }
    if (parsed && parsed.status === true) {
      hasil.ok = true;
      hasil.pesan = 'Masuk antrean Fonnte' + (parsed.detail ? ' (' + parsed.detail + ')' : '') +
        '. Ini belum jaminan sampai ke HP -- cek status pesannya di dashboard Fonnte.';
    } else {
      hasil.pesan = (parsed && (parsed.reason || parsed.detail)) ? String(parsed.reason || parsed.detail) : ('Respons tidak dikenali (HTTP ' + hasil.httpCode + '): ' + body.substring(0, 200));
      hasil.saran = _fonnteSaran(hasil.pesan);
    }
  } catch (err) {
    hasil.pesan = 'Gagal menghubungi Fonnte: ' + err.message;
  }
  _fonnteSimpanStatus(hasil);
  return hasil;
}

// Token UMUM (nomor dedicated, dipakai semua karyawan & reminder).
// Khusus Super Admin. Kosongkan = hapus.
function adminSetFonnteTokenUmum(actorNik, token) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Token umum hanya boleh diatur Super Admin.' };
    token = String(token || '').replace(/\s+/g, '');
    var props = PropertiesService.getScriptProperties();
    if (!token) { props.deleteProperty('FONNTE_TOKEN'); return { success: true, cleared: true }; }
    props.setProperty('FONNTE_TOKEN', token);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Tes kirim: pesan percobaan ke nomor approver departemen yg dipilih.
// nik (opsional) = uji token milik NIK tsb; kosong = token umum/cadangan.
function adminTesKirimFonnte(actorNik, targetWorkspace, nik) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak.' };
    if (targetWorkspace && _isSuperAdmin(actorNik)) ACTIVE_WORKSPACE = targetWorkspace;
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
    var r = _fonnteKirim(String(nik || '').trim(), '✅ Tes koneksi notifikasi WhatsApp (Fonnte) berhasil.\n\nDikirim: ' + now);
    return { success: true, terkirim: r.ok, detail: r };
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
          return { success: true, workspace: workspaceKey, nik: row[0], nama: row[1], role: row[2], menuKeys: _resolveMenuKeysForWorkspace(workspaceKey) };
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
//  DAFTAR PLANT/DEPARTEMEN YANG BENAR-BENAR SUDAH DI-PROVISION --
//  dipanggil dari login.html SEBELUM login (tanpa NIK/password apa
//  pun), supaya dropdown Plant & Departemen di halaman login SELALU
//  mengikuti apa yang sungguh sudah dibuat Super Admin lewat Kelola
//  User > Tambah Departemen/Plant Baru.
//
//  SEBELUMNYA dropdown Plant & Departemen di login.html itu teks
//  HARDCODE (4 opsi tetap), TIDAK PERNAH baca WORKSPACE_MAP sama
//  sekali -- makanya plant baru yang ditambahkan lewat panel admin
//  (mis. "Lemah Abang") tidak pernah muncul di sana walau sudah benar
//  dibuat di backend, dan malah ada validasi JS yang memblokir login
//  selain Plant Cibitung. Fungsi ini yang jadi jembatannya sekarang.
//
//  TIDAK ADA data sensitif yang dikembalikan (tidak ada spreadsheet
//  ID) -- cuma label & key yang memang bakal terlihat di dropdown.
// ================================================================
function getAvailablePlantsForLogin() {
  function slugify(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  var out = []; // { workspaceKey, plantKey, plantLabel, deptKey, deptLabel }

  // 1) Departemen DASAR (hardcode di WORKSPACE_MAP sejak awal, semua
  //    plant-nya "Cibitung"). deptKey = sisa key setelah prefix
  //    "cibitung_" -- TIDAK direkonstruksi dari label krn label
  //    departemen dasar (mis. "Warehouse Fitting Import") tidak
  //    slug-match ke key aslinya ("fitting_import").
  var BASE_PLANT_KEY = 'cibitung', BASE_PLANT_LABEL = 'Cibitung';
  Object.keys(WORKSPACE_MAP).forEach(function (key) {
    if (key.indexOf(BASE_PLANT_KEY + '_') !== 0) return;
    if (!WORKSPACE_MAP[key]) return; // id kosong = belum di-provision, jangan ditampilkan (sesuai permintaan)
    var deptKey = key.substring((BASE_PLANT_KEY + '_').length);
    var label = WORKSPACE_LABELS[key] || key;
    var deptLabel = label.indexOf(' — ') >= 0 ? label.split(' — ').slice(1).join(' — ') : label;
    out.push({ workspaceKey: key, plantKey: BASE_PLANT_KEY, plantLabel: BASE_PLANT_LABEL, deptKey: deptKey, deptLabel: deptLabel });
  });

  // 2) Plant/departemen TAMBAHAN dari Panel Admin (WORKSPACE_REGISTRY_
  //    EXTRA). plantKey/deptKey direkonstruksi dgn slugify() dari LABEL
  //    (BUKAN dari workspaceKey gabungan -- workspaceKey = plantKey+
  //    '_'+deptKey tidak bisa dipisah balik dgn aman kalau salah
  //    satunya sendiri sudah mengandung "_", mis. "lemah_abang"). Ini
  //    aman krn adminProvisionNewDepartment() MEMANG generate
  //    plantKey/deptKey persis dgn slugify(plantLabel)/slugify(deptLabel)
  //    -- lihat fungsi itu.
  try {
    var extraJson = PropertiesService.getScriptProperties().getProperty('WORKSPACE_REGISTRY_EXTRA');
    var extra = extraJson ? JSON.parse(extraJson) : {};
    Object.keys(extra).forEach(function (key) {
      if (!extra[key] || !extra[key].id) return; // belum sungguh ke-provision -- jangan ditampilkan
      var label = String(extra[key].label || '');
      var parts = label.split(' — ');
      var plantLabel = parts[0] || label;
      var deptLabel = parts.length > 1 ? parts.slice(1).join(' — ') : label;
      out.push({
        workspaceKey: key,
        plantKey: slugify(plantLabel), plantLabel: plantLabel,
        deptKey: slugify(deptLabel), deptLabel: deptLabel
      });
    });
  } catch (e) { /* registry korup -- jangan sampai bikin halaman login gagal total, cukup lewati bagian ekstra ini */ }

  return { success: true, data: out };
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
// ------------------------------------------------------------
//  Pastikan sheet TRANSAKSIONAL INTI (Stock/Kirim/Produksi) + AKUN_LOGIN
//  ada di sebuah spreadsheet, dengan header yang benar. Dipakai di 2
//  tempat: (1) provisionDepartmentSpreadsheet() saat departemen BARU
//  dibuat, dan (2) adminRepairWorkspaceSheets() untuk MEMPERBAIKI
//  departemen LAMA yang mungkin sudah kadung kekurangan sheet ini
//  (mis. dibuat sebelum fix ini ada, atau copy Drive-nya belum 100%
//  materialisasi saat pertama kali di-provision). Tidak pernah
//  menghapus/menimpa data yang sudah ada -- cuma menambah sheet/header
//  yang hilang.
// ------------------------------------------------------------
function _ensureCoreSheets(ss) {
  var HEADER_SETUP = {};
  HEADER_SETUP[SH_STOCK]    = ['Item Number', 'Site', 'Unit', 'Group', 'Description', 'Description2', 'Stock Pcs', 'Stock Tonnase'];
  HEADER_SETUP[SH_KIRIM]    = ['Item Number', 'Drawing Code', 'Description', 'Description2', 'Effective Date', 'Total Weight'];
  HEADER_SETUP[SH_PRODUKSI] = ['Item Number', 'Drawing Code', 'Description', 'Description2', 'Effective Date', 'Total Weight'];
  var report = [];
  Object.keys(HEADER_SETUP).forEach(function (name) {
    var headers = HEADER_SETUP[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      Logger.log('Sheet "' + name + '" tidak ketemu -- dibuat baru dengan header.');
      report.push(name + ': dibuat baru (sheet tidak ada sebelumnya)');
    } else if (sh.getLastRow() < 1) {
      // Sheet-nya ada tapi kosong total (headernya pun ikut hilang) -- isi ulang.
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      report.push(name + ': header diisi ulang (sheet ada tapi kosong total)');
    } else {
      report.push(name + ': sudah ada, tidak diubah');
    }
  });
  if (!ss.getSheetByName(SH_AKUN_LOGIN)) {
    var shAkun = ss.insertSheet(SH_AKUN_LOGIN);
    shAkun.getRange(1, 1, 1, 5).setValues([['NIK', 'Nama', 'Role', 'PasswordHash', 'Aktif']]);
    shAkun.setFrozenRows(1);
    report.push(SH_AKUN_LOGIN + ': dibuat baru (sheet tidak ada sebelumnya)');
  } else {
    report.push(SH_AKUN_LOGIN + ': sudah ada, tidak diubah');
  }
  return report;
}

// ================================================================
//  PERBAIKAN DEPARTEMEN/PLANT LAMA -- untuk kasus departemen yang
//  SUDAH TERLANJUR dibuat sebelum fix _ensureCoreSheets() ada (atau
//  saat proses copy Drive belum 100% selesai saat provisioning),
//  sehingga sheet DASHBOARD_KIRIM/DASHBOARD_PRODUKSI/DASHBOARD_STOCK
//  hilang -> upload Outbound/Inbound/Stock gagal dgn pesan
//  'Sheet "..." tidak ditemukan.'
//
//  Cara pakai: panggil dari Panel Admin (Super Admin) atau langsung
//  dari Apps Script editor:
//    adminRepairWorkspaceSheets(actorNik)               -> perbaiki SEMUA departemen/plant
//    adminRepairWorkspaceSheets(actorNik, 'cibitung_x')  -> perbaiki 1 departemen/plant saja
//
//  AMAN dijalankan berkali-kali (idempotent) -- tidak menghapus atau
//  menimpa data yang sudah ada, cuma menambahkan sheet/header yang
//  hilang.
// ================================================================
function adminRepairWorkspaceSheets(actorNik, workspaceKey) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- cuma Super Admin yang boleh menjalankan perbaikan ini.' };
    var keys = workspaceKey ? [String(workspaceKey)] : Object.keys(WORKSPACE_MAP);
    var hasil = {};
    keys.forEach(function (key) {
      var id = WORKSPACE_MAP[key];
      if (!id) { hasil[key] = { success: false, detail: ['Belum di-provision (Spreadsheet ID kosong) -- dilewati.'] }; return; }
      try {
        var ss = SpreadsheetApp.openById(id);
        var report = _ensureCoreSheets(ss);
        hasil[key] = { success: true, detail: report };
      } catch (e) {
        hasil[key] = { success: false, detail: ['GAGAL buka/perbaiki spreadsheet: ' + e.message] };
      }
    });
    return { success: true, hasil: hasil };
  } catch (err) { return { success: false, error: err.message }; }
}

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

  // JAGA-JAGA: makeCopy() (salin Drive) SEHARUSNYA ikut menyalin semua
  // sheet transaksional di atas (bukan cuma header, tapi struktur sheet-
  // nya sendiri) -- tapi pernah dilaporkan sheet DASHBOARD_KIRIM/
  // DASHBOARD_PRODUKSI/DASHBOARD_STOCK tidak ketemu di spreadsheet
  // departemen baru walau proses "berhasil" (kemungkinan copy Drive
  // untuk file besar belum 100% selesai materialisasi saat kode ini
  // lanjut baca sheet-nya). Sama seperti fallback AKUN_LOGIN di bawah:
  // pastikan sheet inti untuk Upload Data Harian SELALU ada dengan
  // header yang benar, terlepas dari hasil copy-nya.
  _ensureCoreSheets(ss);

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

// ================================================================
//  AUDIT ROLE DI SEMUA DEPARTEMEN/PLANT -- jalankan manual 1x dari
//  Apps Script editor (pilih fungsi ini, klik Run, lihat View > Logs)
//  buat cek cepat: siapa saja yang Role-nya "TL" (dapat akses approval
//  + Upload Data Harian) di TIAP departemen/plant, tanpa perlu buka
//  spreadsheet satu-satu. Kalau ada departemen yang TIDAK ADA satupun
//  akun Role="TL", berarti panel Approval/Lembur-per-Karyawan/Upload
//  Data memang TIDAK AKAN muncul untuk siapapun di departemen itu --
//  itu bukan bug, tapi kolom Role di AKUN_LOGIN departemen itu perlu
//  diisi "TL" (persis, tanpa spasi/kata tambahan) untuk akun yang tepat.
// ================================================================
function auditRoleSemuaWorkspace() {
  Object.keys(WORKSPACE_MAP).forEach(function (wsKey) {
    try {
      var ss = SpreadsheetApp.openById(WORKSPACE_MAP[wsKey]);
      var sh = ss.getSheetByName(SH_AKUN_LOGIN);
      if (!sh) { Logger.log('[' + wsKey + '] sheet AKUN_LOGIN tidak ada.'); return; }
      var data = sh.getDataRange().getValues();
      Logger.log('=== ' + wsKey + ' ===');
      var adaTL = false;
      for (var i = 1; i < data.length; i++) {
        var r = data[i];
        if (!r[0]) continue;
        var role = String(r[2] || '(kosong)');
        var aktif = r[4] === false ? 'NONAKTIF' : 'aktif';
        Logger.log('  ' + r[0] + ' | ' + r[1] + ' | Role="' + role + '" | ' + aktif);
        if (role.trim().toUpperCase() === 'TL') adaTL = true;
      }
      if (!adaTL) Logger.log('  ⚠️ TIDAK ADA akun dengan Role="TL" di departemen ini -- panel Approval/Lembur-per-Karyawan/Upload Data tidak akan muncul untuk siapapun di sini.');
    } catch (e) {
      Logger.log('[' + wsKey + '] gagal dibaca: ' + e.message);
    }
  });
}

// Sinkron otomatis: setiap akun di AKUN_LOGIN dengan Role "Technician I"
// otomatis jadi karyawan (master KARYAWAN_LEMBUR) kalau belum ada. Idempotent,
// aman dipanggil berulang (dibatasi 1x per 10 menit per workspace via cache).
function syncKaryawanDariRoleTechnician(ss) {
  try {
    var cache = CacheService.getScriptCache();
    var ck = 'syncTechKaryawan::' + ACTIVE_WORKSPACE;
    if (cache.get(ck)) return 0;
    var shAkun = ss.getSheetByName(SH_AKUN_LOGIN);
    if (!shAkun) return 0;
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    var ditambah = 0;
    try {
      var sh = _sheetKaryawanMaster(ss);
      var sudah = {};
      var m = sh.getDataRange().getValues();
      for (var i = 1; i < m.length; i++) sudah[String(m[i][0]).trim().toUpperCase()] = true;
      var akun = shAkun.getDataRange().getValues();
      var baru = [];
      for (var j = 1; j < akun.length; j++) {
        var nik = String(akun[j][0] || '').trim().toUpperCase();
        var role = String(akun[j][2] || '').trim().toUpperCase();
        var aktifAkun = akun[j][4] !== false;
        if (!nik || sudah[nik] || !aktifAkun || role !== 'TECHNICIAN I') continue;
        baru.push([nik, String(akun[j][1] || ''), _kategoriDariNIK(nik), 'Staff', 7, 6, 0, true]);
        sudah[nik] = true;
      }
      if (baru.length) sh.getRange(sh.getLastRow() + 1, 1, baru.length, KARYAWAN_HEADER.length).setValues(baru);
      ditambah = baru.length;
    } finally { lock.releaseLock(); }
    cache.put(ck, '1', 600);
    if (ditambah) _bumpDataCacheVersion();
    return ditambah;
  } catch (e) { Logger.log('syncKaryawanDariRoleTechnician gagal: ' + e.message); return 0; }
}

function getKaryawanList() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_KARYAWAN_LEMBUR);
    if (!sh) return { success: false, error: 'Sheet KARYAWAN_LEMBUR belum ada. Jalankan setupLemburSheets() dulu di Apps Script editor.' };
    syncKaryawanDariRoleTechnician(ss);
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

// ================================================================
//  MASTER KARYAWAN (sheet KARYAWAN_LEMBUR) per departemen/plant.
//
//  Sheet ini menentukan SIAPA yang muncul di Monitoring FTE ("Rincian
//  FTE per Karyawan Internal" & "Rekap Lembur Outsourcing"), dropdown
//  Form Lembur/Absensi, dan tombol Print/SPL karyawan OS. Beda dari
//  AKUN_LOGIN (akun untuk masuk ke aplikasi).
//
//  MASALAH SEBELUMNYA: departemen baru dibuat lewat
//  provisionDepartmentSpreadsheet() yang MENYALIN spreadsheet Fitting
//  Import lalu MENGOSONGKAN KARYAWAN_LEMBUR -- dan tidak ada menu di
//  aplikasi untuk mengisinya lagi (adminTambahUser cuma menulis ke
//  AKUN_LOGIN). Akibatnya di semua departemen selain Fitting Import
//  Monitoring FTE selalu "0 orang". Fungsi di bawah ini menutup celah itu.
//
//  Kolom: A Kode | B Nama | C Kategori | D Jabatan | E JamWeekday |
//         F JamSabtu | G JamMinggu | H Aktif
//  (Kategori efektif SELALU dihitung dari NIK: awalan "PEG" = OS.)
// ================================================================
var KARYAWAN_HEADER = ['Kode', 'Nama', 'Kategori', 'Jabatan', 'JamWeekday', 'JamSabtu', 'JamMinggu', 'Aktif'];

function _sheetKaryawanMaster(ss) {
  var sh = ss.getSheetByName(SH_KARYAWAN_LEMBUR);
  if (!sh) {
    sh = ss.insertSheet(SH_KARYAWAN_LEMBUR);
    sh.getRange(1, 1, 1, KARYAWAN_HEADER.length).setValues([KARYAWAN_HEADER]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function _jabatanDariRole(role) {
  return String(role || '').trim().toUpperCase() === 'TL' ? 'Team Leader' : 'Staff';
}

// Cache data dihitung per ACTIVE_WORKSPACE -- kalau Super Admin mengedit
// departemen LAIN, versi cache departemen itu yang harus dinaikkan.
function _bumpCacheUntukWorkspace(workspaceKey) {
  var asal = ACTIVE_WORKSPACE;
  try { ACTIVE_WORKSPACE = workspaceKey; _bumpDataCacheVersion(); }
  finally { ACTIVE_WORKSPACE = asal; }
}

// Daftar master karyawan + daftar AKUN LOGIN yang BELUM masuk master
// (kandidat untuk diimpor), utk departemen yang dipilih.
function adminGetKaryawanMaster(actorNik, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };

    var out = [], sudah = {};
    var sh = tgt.ss.getSheetByName(SH_KARYAWAN_LEMBUR);
    if (sh) {
      var data = sh.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var r = data[i];
        if (!r[0]) continue;
        var kode = String(r[0]).trim();
        sudah[kode.toUpperCase()] = true;
        out.push({
          kode: kode, nama: String(r[1] || ''), kategori: _kategoriDariNIK(kode), jabatan: String(r[3] || ''),
          aktif: r[7] === true || String(r[7]).toUpperCase() === 'TRUE'
        });
      }
    }

    var kandidat = [];
    var shAkun = tgt.ss.getSheetByName(SH_AKUN_LOGIN);
    if (shAkun) {
      var ak = shAkun.getDataRange().getValues();
      for (var j = 1; j < ak.length; j++) {
        var nik = String(ak[j][0] || '').trim();
        if (!nik || sudah[nik.toUpperCase()]) continue;
        kandidat.push({ nik: nik, nama: String(ak[j][1] || ''), role: String(ak[j][2] || ''), kategori: _kategoriDariNIK(nik) });
      }
    }
    return { success: true, data: out, kandidat: kandidat, workspace: tgt.workspaceKey, sheetAda: !!sh };
  } catch (err) { return { success: false, error: err.message }; }
}

// Tambah / ubah SATU karyawan di master (upsert berdasarkan NIK).
function adminSimpanKaryawan(actorNik, kode, nama, jabatan, aktif, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    kode = String(kode || '').trim().toUpperCase();
    nama = String(nama || '').trim();
    jabatan = String(jabatan || '').trim() || 'Staff';
    if (!kode || !nama) return { success: false, error: 'NIK dan Nama wajib diisi.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };

    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var sh = _sheetKaryawanMaster(tgt.ss);
      var data = sh.getDataRange().getValues();
      var kategori = _kategoriDariNIK(kode);
      var barisKetemu = -1;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim().toUpperCase() === kode) { barisKetemu = i + 1; break; }
      }
      var isAktif = (aktif === undefined || aktif === null) ? true : !!aktif;
      if (barisKetemu > 0) {
        sh.getRange(barisKetemu, 2, 1, 3).setValues([[nama, kategori, jabatan]]); // B..D
        sh.getRange(barisKetemu, 8).setValue(isAktif);                            // H
      } else {
        var tl = (jabatan.toUpperCase() === 'TEAM LEADER' || jabatan.toUpperCase() === 'TL');
        sh.appendRow([kode, nama, kategori, jabatan, tl ? 8 : 7, tl ? 0 : 6, 0, isAktif]);
      }
    } finally { lock.releaseLock(); }

    _bumpCacheUntukWorkspace(tgt.workspaceKey);
    return { success: true, diubah: barisKetemu > 0 };
  } catch (err) { return { success: false, error: err.message }; }
}

// Impor BANYAK akun login (daftar NIK) ke master karyawan sekaligus.
// Yang sudah ada di master dilewati -- aman diklik berulang.
function adminImporKaryawanDariAkun(actorNik, daftarNik, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    if (!daftarNik || !daftarNik.length) return { success: false, error: 'Tidak ada NIK yang dipilih.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var shAkun = tgt.ss.getSheetByName(SH_AKUN_LOGIN);
    if (!shAkun) return { success: false, error: 'Sheet AKUN_LOGIN belum ada.' };

    var dipilih = {};
    daftarNik.forEach(function (n) { dipilih[String(n).trim().toUpperCase()] = true; });

    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    var ditambah = 0;
    try {
      var sh = _sheetKaryawanMaster(tgt.ss);
      var sudah = {};
      var m = sh.getDataRange().getValues();
      for (var i = 1; i < m.length; i++) sudah[String(m[i][0]).trim().toUpperCase()] = true;

      var akun = shAkun.getDataRange().getValues();
      var barisBaru = [];
      for (var j = 1; j < akun.length; j++) {
        var nik = String(akun[j][0] || '').trim().toUpperCase();
        if (!nik || !dipilih[nik] || sudah[nik]) continue;
        var jab = _jabatanDariRole(akun[j][2]);
        var tl = (jab === 'Team Leader');
        barisBaru.push([nik, String(akun[j][1] || ''), _kategoriDariNIK(nik), jab, tl ? 8 : 7, tl ? 0 : 6, 0, true]);
        sudah[nik] = true;
      }
      if (barisBaru.length) {
        sh.getRange(sh.getLastRow() + 1, 1, barisBaru.length, KARYAWAN_HEADER.length).setValues(barisBaru);
      }
      ditambah = barisBaru.length;
    } finally { lock.releaseLock(); }

    if (ditambah) _bumpCacheUntukWorkspace(tgt.workspaceKey);
    return { success: true, ditambah: ditambah };
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
// ================================================================
//  AUDIT SETUP WA GATEWAY DI SEMUA DEPARTEMEN/PLANT SEKALIGUS --
//  jalankan manual dari Apps Script editor (pilih fungsi ini, Run,
//  lihat View > Logs). Beda dari adminGetFonnteStatus() yang cuma
//  bisa cek SATU departemen per panggilan (harus ganti dropdown di
//  panel admin satu-satu) -- ini langsung cek SEMUA departemen di
//  WORKSPACE_MAP dalam sekali jalan, supaya ketahuan departemen mana
//  yang approver WA-nya belum diisi, dan karyawan mana yang token
//  WA-nya belum ada (jadi notifikasi Lembur maupun Ketidakhadiran
//  TIDAK akan terkirim utk karyawan itu, walau datanya tetap tersimpan
//  normal -- notif WA cuma bonus, bukan syarat simpan).
// ================================================================
function auditFonnteSemuaWorkspace() {
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  var tokenNiks = {};
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('FONNTE_TOKEN_') === 0) tokenNiks[k.substring('FONNTE_TOKEN_'.length)] = true;
  });
  var approverUmum = props.getProperty('FONNTE_APPROVER_WA') ? 'ADA (fallback umum)' : 'KOSONG';
  Logger.log('FONNTE_APPROVER_WA (fallback umum, dipakai kalau approver per-departemen kosong): ' + approverUmum);
  Logger.log('');

  Object.keys(WORKSPACE_MAP).forEach(function (wsKey) {
    Logger.log('=== ' + wsKey + ' ===');
    var approverWs = props.getProperty('FONNTE_APPROVER_WA_' + wsKey);
    Logger.log('  Nomor approver WA departemen ini: ' + (approverWs ? 'ADA (khusus)' : (approverUmum === 'ADA (fallback umum)' ? 'pakai fallback umum' : '❌ KOSONG -- notif WA tidak akan terkirim sama sekali utk departemen ini!')));

    try {
      var ss = SpreadsheetApp.openById(WORKSPACE_MAP[wsKey]);
      var sh = ss.getSheetByName(SH_KARYAWAN_LEMBUR);
      if (!sh) { Logger.log('  (sheet KARYAWAN_LEMBUR tidak ada)'); return; }
      var data = sh.getDataRange().getValues();
      var adaToken = 0, tanpaToken = [];
      for (var i = 1; i < data.length; i++) {
        var kode = String(data[i][0] || '').trim();
        if (!kode) continue;
        if (tokenNiks[kode]) adaToken++;
        else tanpaToken.push(kode + ' (' + (data[i][1] || '-') + ')');
      }
      Logger.log('  Karyawan dengan token WA: ' + adaToken + ' | TANPA token: ' + tanpaToken.length);
      if (tanpaToken.length) Logger.log('    Belum ada token: ' + tanpaToken.join(', '));
    } catch (e) {
      Logger.log('  Gagal baca sheet KARYAWAN_LEMBUR: ' + e.message);
    }
    Logger.log('');
  });
}

// ================================================================
//  JADWAL PENGIRIMAN FITTING — sinkron otomatis dari spreadsheet
//  sumber eksternal, GANTI cara lama (IMPORTRANGE manual per sel).
//  Spreadsheet sumber ganti tiap bulan (link baru tiap bulan) --
//  makanya link-nya disimpan per-workspace di Script Properties, dan
//  ada fungsi khusus utk TL/Admin update link-nya tiap awal bulan.
//  Di DALAM spreadsheet sumber itu, tiap hari punya SHEET/TAB sendiri
//  yang namanya cuma ANGKA TANGGAL (mis. "8" utk tanggal 8).
// ================================================================

// Ambil ID spreadsheet dari URL Google Sheets biasa
// (https://docs.google.com/spreadsheets/d/<ID>/edit#gid=...) ATAU
// terima langsung kalau yang dikasih memang sudah berupa ID mentah.
function _extractSpreadsheetId(urlOrId) {
  var s = String(urlOrId || '').trim();
  var m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  return s; // asumsikan sudah ID mentah kalau tidak match pola URL
}

// Akses KHUSUS utk 2 fungsi Jadwal Pengiriman ini (Setting Link +
// baca status) -- SENGAJA TERPISAH dari _actorIsFullAccess/aturan
// Upload Data Harian. Saepul Ganni butuh akses ini tapi role/akses
// lainnya TIDAK ikut berubah.
var JADWAL_SYNC_ALLOWED_NIK = ['2165310']; // Saepul Ganni
function _bolehAturJadwalPengiriman(actorNik) {
  return _actorIsFullAccess(actorNik) || JADWAL_SYNC_ALLOWED_NIK.indexOf(String(actorNik || '').trim()) !== -1;
}

// TL/Admin (+ NIK khusus di JADWAL_SYNC_ALLOWED_NIK) panggil ini
// (lewat panel admin) tiap awal bulan begitu spreadsheet Jadwal
// Pengiriman Fitting yang baru dibuat -- cukup paste link-nya, TIDAK
// perlu edit Apps Script/Script Properties manual.
function adminSetJadwalPengirimanSumber(actorNik, urlOrId, targetWorkspace) {
  try {
    if (!_bolehAturJadwalPengiriman(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh mengatur ini.' };
    var workspaceKey = (targetWorkspace && _isSuperAdmin(actorNik)) ? targetWorkspace : ACTIVE_WORKSPACE;
    var props = PropertiesService.getScriptProperties();
    var key = 'JADWAL_PENGIRIMAN_FITTING_ID_' + workspaceKey;
    var raw = String(urlOrId || '').trim();
    if (!raw) { props.deleteProperty(key); return { success: true, cleared: true }; }
    var id = _extractSpreadsheetId(raw);
    // Validasi: coba buka -- kalau link salah/tidak ada akses, ketahuan
    // di sini juga (bukan pas sync harian baru gagal).
    try {
      SpreadsheetApp.openById(id);
    } catch (openErr) {
      return { success: false, error: 'Tidak bisa buka spreadsheet ini -- cek link-nya benar & sudah di-share ke akun Apps Script. (' + openErr.message + ')' };
    }
    props.setProperty(key, id);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

function adminGetJadwalPengirimanSumberStatus(actorNik, targetWorkspace) {
  try {
    if (!_bolehAturJadwalPengiriman(actorNik)) return { success: false, error: 'Akses ditolak.' };
    var workspaceKey = (targetWorkspace && _isSuperAdmin(actorNik)) ? targetWorkspace : ACTIVE_WORKSPACE;
    var id = PropertiesService.getScriptProperties().getProperty('JADWAL_PENGIRIMAN_FITTING_ID_' + workspaceKey);
    return { success: true, terisi: !!id, url: id ? ('https://docs.google.com/spreadsheets/d/' + id + '/edit') : '', workspace: workspaceKey };
  } catch (err) { return { success: false, error: err.message }; }
}

// Cari kolom "PPR/SITECH", "No.Pol", "NAMA" (nama tujuan/customer), dan
// "KETERANGAN" di 6 baris pertama sheet sumber (bukan hardcode kolom,
// biar tahan kalau layout header sedikit bergeser antar bulan). Return
// {colPPR, colNopol, colNama, colKet, headerRow} atau null.
// headerRow = baris PALING BAWAH dari header yang ketemu -- data
// mulai dibaca SETELAH baris ini (dinamis, bukan hardcode row 3).
function _cariKolomJadwalSumber(sheet) {
  var headerRange = sheet.getRange(1, 1, Math.min(6, sheet.getLastRow()), sheet.getLastColumn());
  var vals = headerRange.getValues();
  var colPPR = null, colNopol = null, colNama = null, colKet = null;
  var rowPPR = 0, rowNopol = 0, rowNama = 0, rowKet = 0;
  for (var r = 0; r < vals.length; r++) {
    for (var c = 0; c < vals[r].length; c++) {
      var cell = String(vals[r][c] || '').toUpperCase().trim();
      if (!colPPR && /PPR/.test(cell) && /SITECH/.test(cell)) { colPPR = c + 1; rowPPR = r + 1; }
      if (!colNopol && /NO\.?\s*POL/.test(cell)) { colNopol = c + 1; rowNopol = r + 1; }
      // "NAMA" dicari PERSIS (bukan "mengandung NAMA") & ambil yg PALING
      // KIRI/PERTAMA ketemu, krn kata ini muncul >1x di sheet sumber
      // (kolom nama customer utama, DAN kolom "+ NAMA" tambahan di
      // tengah tabel) -- yg pertama/paling kiri adalah nama customer utama.
      if (!colNama && cell === 'NAMA') { colNama = c + 1; rowNama = r + 1; }
      if (!colKet && cell === 'KETERANGAN') { colKet = c + 1; rowKet = r + 1; }
    }
  }
  if (!colPPR || !colNopol) return null;
  return { colPPR: colPPR, colNopol: colNopol, colNama: colNama, colKet: colKet, headerRow: Math.max(rowPPR, rowNopol, rowNama, rowKet) };
}

// Validasi FORMAT nomor SPM/PPR yang benar-benar valid: nomor SPM asli
// HANYA berisi ANGKA murni, atau diawali prefix huruf "PS" lalu angka
// (mis. "PS26104269") -- boleh gabungan >1 nomor dipisah tanda "+"
// (mis. "26090633 + 26090635" atau "26090898 + PS26104269"). SELAIN itu
// (ada kata/kalimat, mis. teks dari kolom KETERANGAN yg kebetulan
// nyangkut/salah baca kolom, atau nama ekspedisi/customer yg salah
// ketik) HARUS ditolak walau kebetulan ada angka di dalamnya -- ini
// perbaikan dari validasi lama yg cuma cek "ada angka di mana pun"
// (lolos utk kalimat spt "TEE DT 3 QTY 80 BOX DAN LEM URGENT" krn
// kebetulan ada angka "3" dan "80" di dalamnya, padahal itu jelas
// bukan nomor SPM).
function _formatSpmValid(spm) {
  if (!spm) return false;
  var token = spm.split('+');
  for (var i = 0; i < token.length; i++) {
    var t = token[i].trim();
    if (!t) continue; // token kosong (akibat "+" di ujung/spasi ganda) -- lewati, bukan pelanggaran
    if (!/^(PS)?\d+$/i.test(t)) return false; // ada token yg bukan digit-murni / PS+digit -> tolak SELURUH isi cell
  }
  return true;
}

// Baca daftar {spm, nopol, nama, keterangan} dari sheet sumber (tab
// bernama angka tanggal, mis. "8") untuk 1 tanggal tertentu.
function _bacaJadwalPPRDariSumber(tanggal) {
  var id = PropertiesService.getScriptProperties().getProperty('JADWAL_PENGIRIMAN_FITTING_ID_' + ACTIVE_WORKSPACE);
  if (!id) return { success: false, error: 'Link spreadsheet Jadwal Pengiriman Fitting bulan ini belum diisi. Isi dulu di panel admin.' };

  var ssSumber;
  try { ssSumber = SpreadsheetApp.openById(id); }
  catch (e) { return { success: false, error: 'Gagal buka spreadsheet sumber: ' + e.message }; }

  var namaTab = String(tanggal.getDate()); // "8", bukan "08"
  var shSumber = ssSumber.getSheetByName(namaTab) || ssSumber.getSheetByName('0' + namaTab);
  if (!shSumber) return { success: false, error: 'Tab "' + namaTab + '" tidak ditemukan di spreadsheet sumber -- cek apakah jadwal tanggal ini sudah dibuat.' };

  var kolom = _cariKolomJadwalSumber(shSumber);
  if (!kolom) return { success: false, error: 'Kolom "PPR/SITECH" atau "No.Pol" tidak ditemukan di sheet "' + namaTab + '" -- cek header-nya belum berubah.' };

  var baseRow = kolom.headerRow + 1; // baris PERTAMA setelah header (bukan hardcode 3)
  var lastRow = shSumber.getLastRow();
  if (lastRow < baseRow) return { success: true, data: [] };
  var dataPPR = shSumber.getRange(baseRow, kolom.colPPR, lastRow - baseRow + 1, 1).getValues();
  var dataNopol = shSumber.getRange(baseRow, kolom.colNopol, lastRow - baseRow + 1, 1).getValues();
  var dataNama = kolom.colNama ? shSumber.getRange(baseRow, kolom.colNama, lastRow - baseRow + 1, 1).getValues() : null;
  var dataKet = kolom.colKet ? shSumber.getRange(baseRow, kolom.colKet, lastRow - baseRow + 1, 1).getValues() : null;

  var hasil = [];
  var dilewatiFormatSalah = [];
  for (var i = 0; i < dataPPR.length; i++) {
    var spm = String(dataPPR[i][0] || '').trim();
    if (!spm) continue;
    // Jaga-jaga tambahan: kalau isinya PERSIS sama dengan teks header
    // ("PPR / SITECH", "PPR/SITECH", dst -- kemungkinan header terbaca
    // dobel/sheet punya baris header berulang), lewati baris ini.
    var spmUpper = spm.toUpperCase().replace(/\s+/g, '');
    if (/PPR.*SITECH/.test(spmUpper) || /SITECH.*PPR/.test(spmUpper)) continue;
    // Validasi FORMAT: lihat komentar lengkap di _formatSpmValid() di
    // atas. Cuma digit murni / "PS"+digit (boleh gabungan dgn "+") yang
    // lolos -- kalimat/frasa apa pun (walau kebetulan ada angkanya,
    // mis. teks KETERANGAN yg kebetulan/salah nyangkut di kolom ini)
    // ditolak dan dicatat di dilewatiFormatSalah, TIDAK dibuat jadi
    // baris kiriman.
    if (!_formatSpmValid(spm)) { dilewatiFormatSalah.push(spm); continue; }
    var ket = dataKet ? String(dataKet[i][0] || '').trim() : '';
    hasil.push({
      spm: spm,
      nopol: String(dataNopol[i][0] || '').trim(),
      nama: dataNama ? String(dataNama[i][0] || '').trim() : '',
      keterangan: ket,
      ikutPipa: /IKUT\s*PIPA/i.test(ket) // deteksi "IKUT PIPA" di teks keterangan
    });
  }
  return { success: true, data: hasil, dilewatiFormatSalah: dilewatiFormatSalah };
}

// Dipanggil dari tombol "Sync Jadwal Hari Ini" di halaman Loading Time
// -- baca jadwal PPR/SITECH hari ini dari sumber:
//  - SPM yang BELUM ADA barisnya -> buat baris BARU (Agen diisi dari
//    kolom NAMA di sumber, jadi "Tujuan" langsung terisi juga, tidak
//    perlu diisi manual lagi).
//  - SPM yang SUDAH ADA barisnya, tapi Nopol/Agen di PENGIRIMAN masih
//    KOSONG dan sekarang sudah terisi di sumber -> baris yang sudah
//    ada di-UPDATE (bukan cuma dilewati) -- ini menjawab kasus umum:
//    jadwal awalnya dibuat sebelum Nopol/nama customer final, terisi
//    belakangan di sumber, sistem otomatis nyusul begitu di-sync lagi.
function syncJadwalPengirimanHarian(tanggalDDMMYYYY) {
  try {
    var tanggal = tanggalDDMMYYYY ? _parseTanggalFleksibel(tanggalDDMMYYYY) : new Date();
    tanggal.setHours(0, 0, 0, 0);

    var bacaan = _bacaJadwalPPRDariSumber(tanggal);
    if (!bacaan.success) return bacaan;

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SH_PENGIRIMAN);
    if (!sheet) return { success: false, error: 'Sheet PENGIRIMAN tidak ditemukan.' };

    // Petakan SPM -> nomor baris asli, HANYA UTK BARIS DGN TANGGAL YANG
    // SAMA dgn yang sedang di-sync (bukan lintas semua tanggal lagi).
    //
    // PERUBAHAN dari sebelumnya (atas permintaan user): dulu dicocokkan
    // lintas SEMUA tanggal, dgn alasan supaya SPM yg masih "Menunggu"
    // dari tanggal SEBELUMNYA (Nopol blm keisi) ikut disusulkan update-
    // nya. Efek sampingnya: kalau nomor SPM yg sama persis kebetulan
    // muncul lagi di sheet sumber pada tanggal LAIN sbg kiriman yg
    // BERBEDA, sistem salah kira "sudah pernah disinkron" dan TIDAK
    // membuat baris baru utk kiriman itu (row hilang dari sync -- kasus
    // nyata: PT.INDOPRIMA PERMATA SULAWESI / PACIFIC PLASTINDO tgl
    // 12/09 tidak ikut tersinkron).
    //
    // Sekarang dibatasi per-tanggal: SPM yg sama tapi beda tanggal akan
    // SELALU dianggap kiriman baru & dibuatkan baris baru sendiri utk
    // tanggal itu -- tidak akan lagi "tertelan" oleh baris lama. Trade-
    // off yg disengaja: SPM "Menunggu" dari hari sebelumnya TIDAK lagi
    // otomatis disusulkan update-nya oleh sync hari berikutnya (harus
    // di-sync ulang di tanggalnya sendiri kalau sumbernya diedit lagi).
    var lastRow = sheet.getLastRow();
    var spmKeRow = {}; // { spm: rowNumber } -- scope: tanggal yg sama saja
    var tanggalYmd = Utilities.formatDate(tanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var existingFull = []; // dipakai jg utk deteksi baris basi di bawah
    if (lastRow >= 2) {
      existingFull = sheet.getRange(2, 1, lastRow - 1, 10).getValues(); // A-J
      existingFull.forEach(function (r, idx) {
        var rowTanggal = r[0];
        var rowYmd = (rowTanggal instanceof Date)
          ? Utilities.formatDate(rowTanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
        if (rowYmd !== tanggalYmd) return; // beda tanggal -> jangan dicocokkan
        var spmRow = String(r[4] || '').trim();
        if (spmRow) spmKeRow[spmRow] = 2 + idx;
      });
    }

    var barisBaru = [];
    var diupdate = 0;
    var ikutPipaList = []; // {spm, nama} -- utk notifikasi ke PIC/checker
    var spmDiSumberSet = {}; // dipakai jg utk deteksi baris basi di bawah
    bacaan.data.forEach(function (x) {
      spmDiSumberSet[x.spm] = true;
      if (x.ikutPipa) ikutPipaList.push({ spm: x.spm, nama: x.nama || '' });

      var rowNum = spmKeRow[x.spm];
      if (!rowNum) {
        // Belum ada (utk tanggal ini) -> siapkan baris baru. Agen(B)
        // diisi dari nama customer di sumber, jadi kolom "Tujuan" di
        // tampilan langsung terisi tanpa perlu PIC ketik manual lagi.
        // Keterangan disimpan di kolom K (kolom baru, tidak dipakai
        // fungsi lain) sbg referensi -- munculkan di UI kalau perlu.
        barisBaru.push([tanggal, x.nama || '', '', '', x.spm, x.nopol, '', '', '', '', x.keterangan || '']);
        return;
      }
      // Sudah ada (tanggal sama) -- cek apakah Agen(B)/Nopol(F) di sheet
      // masih kosong tapi sekarang sudah terisi di sumber -> susulkan
      // update-nya.
      var currentRow = sheet.getRange(rowNum, 1, 1, 10).getValues()[0]; // A-J
      var currentAgen = String(currentRow[1] || '').trim();
      var currentNopol = String(currentRow[5] || '').trim();
      var belumAdaAktivitas = !currentRow[7] && !currentRow[8] && !String(currentRow[9] || '').trim(); // H/I/J kosong
      var perluUpdate = false;
      if (!currentAgen && x.nama) { sheet.getRange(rowNum, 2).setValue(x.nama); perluUpdate = true; }
      if (!currentNopol && x.nopol) { sheet.getRange(rowNum, 6).setValue(x.nopol); perluUpdate = true; }
      // Sumber jadwal adalah acuan SELAMA belum ada aktivitas muat: kalau tujuan / nopol di sumber DIKOREKSI
      // (mis. L 9197 UT semula Mega Bangunan, aktualnya DC-Kutorejo), baris ikut diperbarui. Dulu hanya
      // mengisi yang kosong, jadi tujuan lama tetap tampil walau sumber sudah benar. Baris yang sudah mulai
      // muat tidak diubah.
      if (belumAdaAktivitas) {
        if (currentAgen && x.nama && currentAgen !== x.nama) { sheet.getRange(rowNum, 2).setValue(x.nama); perluUpdate = true; }
        if (currentNopol && x.nopol && currentNopol !== x.nopol) { sheet.getRange(rowNum, 6).setValue(x.nopol); perluUpdate = true; }
      }
      if (x.keterangan) { sheet.getRange(rowNum, 11).setValue(x.keterangan); } // kolom K, selalu disamakan dgn sumber terbaru
      if (perluUpdate) diupdate++;
    });

    if (barisBaru.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, barisBaru.length, 11).setValues(barisBaru);
    }

    // ------------------------------------------------------------
    //  BERSIHKAN BARIS BASI -- SPM yang SUDAH TIDAK ADA lagi di sumber
    //  (mis. tab sumber sempat berisi sisa data duplikat dari tanggal
    //  lain, lalu dibersihkan/dikoreksi orang yang input jadwal), DAN
    //  belum ada aktivitas operasional apa pun (Waktu Mulai/Selesai/
    //  Status kolom H/I/J masih kosong semua). Ini menggantikan
    //  kebutuhan menjalankan "Hapus & Sync Ulang" manual tiap hari --
    //  sync biasa sekarang otomatis membuang sisa data basi ini sendiri.
    //
    //  SENGAJA TIDAK PERNAH menghapus baris yang Waktu Mulai/Selesai/
    //  Status-nya sudah terisi -- itu artinya tim loading SUDAH mulai
    //  memproses kiriman itu, jadi datanya harus tetap aman walau
    //  SPM-nya belakangan hilang dari sumber (mis. typo dikoreksi).
    // ------------------------------------------------------------
    var barisBasi = [];
    existingFull.forEach(function (r, idx) {
      var rowTanggal = r[0];
      var rowYmd = (rowTanggal instanceof Date)
        ? Utilities.formatDate(rowTanggal, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      if (rowYmd !== tanggalYmd) return;
      var spmRow = String(r[4] || '').trim();
      if (!spmRow || spmDiSumberSet[spmRow]) return; // SPM masih ada di sumber -> bukan basi
      var waktuMulai = r[7], waktuSelesai = r[8], status = String(r[9] || '').trim();
      if (waktuMulai || waktuSelesai || status) return; // sudah ada aktivitas -- JANGAN dihapus otomatis
      barisBasi.push(2 + idx);
    });
    barisBasi.sort(function (a, b) { return b - a; }); // hapus dari baris paling bawah dulu spy index sisanya tdk berantakan
    barisBasi.forEach(function (rowNum) { sheet.deleteRow(rowNum); });

    if (barisBaru.length > 0 || diupdate > 0 || barisBasi.length > 0) _bumpDataCacheVersion();

    return {
      success: true,
      dibuat: barisBaru.length,
      ikutPipa: ikutPipaList,
      diupdate: diupdate,
      dibersihkan: barisBasi.length,
      totalDiSumber: bacaan.data.length,
      dilewati: bacaan.data.length - barisBaru.length - diupdate,
      dilewatiFormatSalah: bacaan.dilewatiFormatSalah || []
    };
  } catch (err) { return { success: false, error: err.message }; }
}

// Hapus SEMUA baris di sheet PENGIRIMAN utk 1 tanggal tertentu (kolom A).
// Dipakai kalau data hasil sync utk tanggal itu ternyata salah/basi
// (mis. tab sumber sempat berisi data duplikat dari tanggal lain sebelum
// dibersihkan) -- lihat resyncBersihJadwalTanggal() di bawah utk alur
// lengkap "hapus lalu sync ulang" dalam 1 aksi.
function hapusDataPengirimanByTanggal(tanggalDDMMYYYY) {
  return _hapusDataByTanggalRange(SH_PENGIRIMAN, 1, tanggalDDMMYYYY, tanggalDDMMYYYY); // kolom A = tanggal
}

// ================================================================
//  HAPUS DATA JADWAL 1 TANGGAL LALU SYNC ULANG BERSIH DARI SUMBER --
//  dipakai kalau sync sebelumnya utk tanggal ini ternyata membawa data
//  yang salah/basi (mis. tab sumber sempat berisi sisa data duplikat
//  dari tanggal lain sebelum dibersihkan oleh yang menyiapkan jadwal).
//
//  PENTING: pastikan dulu tab tanggal ini di spreadsheet SUMBER ("Jadwal
//  Pengiriman Fitting") sudah benar/bersih SEBELUM menjalankan ini --
//  fungsi ini menghapus semua baris tanggal tsb di PENGIRIMAN, lalu
//  langsung menyalin ulang APAPUN yang ada di tab sumber saat ini. Kalau
//  sumbernya belum diperbaiki, hasilnya akan sama basinya seperti
//  sebelum dihapus.
// ================================================================
function resyncBersihJadwalTanggal(tanggalDDMMYYYY) {
  try {
    if (!tanggalDDMMYYYY) return { success: false, error: 'Tanggal wajib diisi (format DD/MM/YYYY).' };
    var hapus = hapusDataPengirimanByTanggal(tanggalDDMMYYYY);
    if (!hapus.success) return hapus;
    var sync = syncJadwalPengirimanHarian(tanggalDDMMYYYY);
    if (!sync.success) return sync; // baris lama sudah kadung terhapus -- error sync perlu ditindaklanjuti manual (jalankan ulang syncJadwalPengirimanHarian setelah sumber diperbaiki)
    return {
      success: true,
      dihapus: hapus.dihapus,
      dibuatUlang: sync.dibuat,
      diupdate: sync.diupdate,
      totalDiSumber: sync.totalDiSumber,
      ikutPipa: sync.ikutPipa,
      dilewatiFormatSalah: sync.dilewatiFormatSalah
    };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  AUTO-SYNC JADWAL PENGIRIMAN PPR/FITTING -- real-time saat ada
//  inputan baru di spreadsheet SUMBER (tidak perlu klik manual "Sync
//  Jadwal Hari Ini" lagi). Dipasang sbg installable trigger onEdit LANGSUNG
//  DI SPREADSHEET SUMBER (file "Jadwal Pengiriman Fitting", beda file
//  dari spreadsheet app ini -- installable trigger BISA dipasang di
//  spreadsheet lain asal skrip ini punya akses edit ke sana).
//
//  Begitu ada input/ubah di salah satu tab tanggal (mis. tab "14"),
//  otomatis syncJadwalPengirimanHarian() dipanggil UNTUK TANGGAL ITU
//  SAJA -- tidak scan / sentuh tab tanggal lain sama sekali.
//
//  CARA PASANG (jalankan manual 1x dari Apps Script editor -> Run):
//    setupJadwalAutoSyncTrigger()
//  Ulangi lagi tiap kali link spreadsheet sumber bulan baru
//  (JADWAL_PENGIRIMAN_FITTING_ID_<workspace>) diganti di panel admin --
//  trigger lama nempel ke FILE lama, tidak otomatis ikut pindah.
// ================================================================
function onJadwalSumberEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheetName = e.range.getSheet().getName();
    // Cuma proses edit di tab tanggal (nama tab murni angka, mis. "14",
    // "05") -- edit di tab lain (rekap/template/dst di file yg sama)
    // diabaikan.
    if (!/^\d{1,2}$/.test(sheetName)) return;

    var workspaceKey = _cariWorkspaceUntukSumberJadwal(e.source.getId());
    if (!workspaceKey) return; // bukan sumber jadwal workspace manapun -- seharusnya tidak terjadi

    // Debounce ringan (8 detik) per kombinasi workspace+tanggal --
    // paste banyak sel sekaligus / edit beruntun bisa memicu beberapa
    // event onEdit terpisah utk tab yang sama dlm waktu singkat. Kalau
    // ada yg "kelewat" krn jatuh di jeda ini, ditandai PENDING supaya
    // disusulkan oleh checkPendingJadwalSync() (jaring pengaman tiap 5
    // menit) -- jadi tidak ada perubahan yang hilang selamanya.
    var debounceKey = 'JADWAL_SYNC_DEBOUNCE_' + workspaceKey + '_' + sheetName;
    var cache = CacheService.getScriptCache();
    if (cache.get(debounceKey)) {
      PropertiesService.getScriptProperties().setProperty('PENDING_JADWAL_SYNC_' + workspaceKey + '_' + sheetName, '1');
      return;
    }
    cache.put(debounceKey, '1', 8);

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(3000)) return; // proses sync lain lagi jalan -> lewati, checkPendingJadwalSync akan menyusulkan
    try {
      _jalankanSyncJadwalUntukTab(workspaceKey, sheetName);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    Logger.log('onJadwalSumberEdit gagal: ' + err.message);
  }
}

// Jalankan syncJadwalPengirimanHarian utk 1 workspace + 1 nama tab
// tanggal (mis. "14").
//
// PERBAIKAN BUG BULAN SALAH: dulu tanggalnya SELALU dihitung dari bulan
// & tahun SEKARANG (new Date(tahunIni, bulanIni, hari)). Padahal di
// akhir bulan orang sudah menyiapkan jadwal awal bulan DEPAN -- mis.
// tgl 25-30 September mengedit tab "2" untuk 2 Oktober. Tab itu lalu
// disinkron sebagai 2 SEPTEMBER: baris kiriman "tanggal 2" muncul di
// antara baris tanggal 25 (ditambahkan dari bawah), statusnya tidak
// pernah selesai karena tanggalnya sudah lewat & tak ada yang memuat.
// Sekarang bulan ditentukan dulu dari NAMA file spreadsheet sumber
// (mis. "... Oktober 2026"), dan kalau namanya tidak memuat bulan,
// lewat aturan jendela tanggal (_tentukanTanggalTabSumber).
function _jalankanSyncJadwalUntukTab(workspaceKey, sheetName) {
  var hari = parseInt(sheetName, 10);
  if (isNaN(hari)) return;
  ACTIVE_WORKSPACE = workspaceKey;
  SPREADSHEET_ID = resolveWorkspaceSpreadsheetId(workspaceKey);
  var tanggal = _tentukanTanggalTabSumber(hari, workspaceKey);
  if (!tanggal) {
    Logger.log('Auto-sync jadwal DILEWATI (' + workspaceKey + ', tab ' + sheetName + '): tanggal tidak bisa ditentukan dgn aman (di luar rentang wajar / tab tidak valid utk bulannya).');
    return { success: false, error: 'Tanggal tab tidak bisa ditentukan dgn aman -- dilewati.' };
  }
  var tglStr = Utilities.formatDate(tanggal, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var hasil = syncJadwalPengirimanHarian(tglStr);
  Logger.log('Auto-sync jadwal (' + workspaceKey + ', tab ' + sheetName + ' -> ' + tglStr + '): ' + JSON.stringify(hasil));
  return hasil;
}

// Cari nama bulan (Indonesia/Inggris, panjang/singkat) & tahun di teks
// (nama file). Kembalikan {bulan:0-11, tahun:number|null} atau null kalau
// tidak ada / ambigu (lebih dari 1 bulan berbeda).
function _bulanTahunDariNama(nama) {
  var t = String(nama || '').toUpperCase();
  if (!t) return null;
  var daftar = [
    ['JANUARI','JANUARY','JAN'], ['FEBRUARI','FEBRUARY','FEB'], ['MARET','MARCH','MAR'],
    ['APRIL','APR'], ['MEI','MAY'], ['JUNI','JUNE','JUN'], ['JULI','JULY','JUL'],
    ['AGUSTUS','AUGUST','AGT','AGS','AUG'], ['SEPTEMBER','SEPT','SEP'],
    ['OKTOBER','OCTOBER','OKT','OCT'], ['NOVEMBER','NOV'], ['DESEMBER','DECEMBER','DES','DEC']
  ];
  var ketemu = [];
  daftar.forEach(function (namaNama, idx) {
    namaNama.forEach(function (nm) {
      if (new RegExp('(^|[^A-Z])' + nm + '([^A-Z]|$)').test(t) && ketemu.indexOf(idx) === -1) ketemu.push(idx);
    });
  });
  if (ketemu.length !== 1) return null;
  var y = /(^|[^0-9])(20\d{2})([^0-9]|$)/.exec(t);
  return { bulan: ketemu[0], tahun: y ? parseInt(y[2], 10) : null };
}

// Tanggal lengkap (Date jam 00:00) utk tab bernomor `hari` di spreadsheet
// sumber workspace ini, atau null kalau tidak bisa ditentukan dgn aman.
function _tentukanTanggalTabSumber(hari, workspaceKey) {
  var now = new Date(); now.setHours(0, 0, 0, 0);
  var sourceId = PropertiesService.getScriptProperties().getProperty('JADWAL_PENGIRIMAN_FITTING_ID_' + workspaceKey);

  function valid(tahun, bulan) { // Date valid (tab "31" tidak ada di bulan 30 hari) atau null
    var d = new Date(tahun, bulan, hari);
    return (d.getMonth() === bulan && d.getDate() === hari) ? d : null;
  }
  function selisihHari(d) { return Math.round((d.getTime() - now.getTime()) / 86400000); }

  var hasil = null;

  // 1) Dari NAMA file sumber (paling bisa dipercaya).
  if (sourceId) {
    try {
      var cache = CacheService.getScriptCache();
      var ck = 'JADWAL_NAMA_FILE_' + sourceId;
      var namaFile = cache.get(ck);
      if (namaFile === null) {
        namaFile = SpreadsheetApp.openById(sourceId).getName();
        cache.put(ck, namaFile, 21600); // 6 jam
      }
      var bt = _bulanTahunDariNama(namaFile);
      if (bt) {
        var tahun = bt.tahun;
        if (tahun === null) { // nama cuma memuat bulan -> pilih tahun yang paling dekat dgn hari ini
          var kandidat = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
            .map(function (y) { return valid(y, bt.bulan); }).filter(Boolean);
          kandidat.sort(function (a, b) { return Math.abs(selisihHari(a)) - Math.abs(selisihHari(b)); });
          hasil = kandidat.length ? kandidat[0] : null;
        } else {
          hasil = valid(tahun, bt.bulan);
        }
        if (!hasil) return null; // nama file menunjuk bulan yang tab-nya tidak valid -> jangan tebak
      }
    } catch (err) { Logger.log('Baca nama file sumber gagal: ' + err.message); }
  }

  // 2) Kalau nama file tidak memuat bulan: jendela tanggal.
  //    Default bulan berjalan; geser ke bulan DEPAN kalau tanggal bulan
  //    depan itu jatuh <=10 hari ke depan (menyiapkan jadwal awal bulan
  //    depan di akhir bulan), geser ke bulan LALU kalau <=10 hari ke
  //    belakang (link belum diganti di awal bulan baru).
  if (!hasil) {
    var cur = valid(now.getFullYear(), now.getMonth());
    var nxt = valid(now.getFullYear(), now.getMonth() + 1);
    var prv = valid(now.getFullYear(), now.getMonth() - 1);
    if (nxt && selisihHari(nxt) >= 0 && selisihHari(nxt) <= 10 && !(cur && Math.abs(selisihHari(cur)) <= 10)) hasil = nxt;
    else if (prv && selisihHari(prv) <= 0 && selisihHari(prv) >= -10 && !(cur && Math.abs(selisihHari(cur)) <= 10)) hasil = prv;
    else hasil = cur || nxt || prv;
  }

  // 3) Pagar akhir: jangan pernah membuat baris utk tanggal yang jauh dari hari ini.
  if (!hasil || Math.abs(selisihHari(hasil)) > 45) return null;
  return hasil;
}

// Cari workspace mana yang properti JADWAL_PENGIRIMAN_FITTING_ID_-nya
// cocok dengan ID spreadsheet sumber yang baru saja di-edit.
function _cariWorkspaceUntukSumberJadwal(sourceId) {
  var props = PropertiesService.getScriptProperties();
  var ditemukan = null;
  Object.keys(WORKSPACE_MAP).forEach(function (workspaceKey) {
    if (ditemukan) return;
    var id = props.getProperty('JADWAL_PENGIRIMAN_FITTING_ID_' + workspaceKey);
    if (id && id === sourceId) ditemukan = workspaceKey;
  });
  return ditemukan;
}

// Jaring pengaman: susulkan sync yang sempat "kelewat" krn jatuh di
// dalam jeda debounce onJadwalSumberEdit(). Dipasang sbg trigger
// berkala (tiap 5 menit) lewat setupJadwalAutoSyncTrigger() di bawah --
// jadi paling lama nunggu 5 menit, tidak akan ada perubahan yg hilang
// selamanya kalau debounce sempat melewatkannya.
function checkPendingJadwalSync() {
  var props = PropertiesService.getScriptProperties();
  var semuaProp = props.getProperties();
  Object.keys(semuaProp).forEach(function (key) {
    if (semuaProp[key] !== '1' || key.indexOf('PENDING_JADWAL_SYNC_') !== 0) return;
    var sisa = key.substring('PENDING_JADWAL_SYNC_'.length); // "<workspaceKey>_<tab>"
    var pemisah = sisa.lastIndexOf('_');
    var workspaceKey = sisa.substring(0, pemisah);
    var sheetName = sisa.substring(pemisah + 1);
    if (!WORKSPACE_MAP.hasOwnProperty(workspaceKey)) { props.deleteProperty(key); return; }
    try {
      _jalankanSyncJadwalUntukTab(workspaceKey, sheetName);
      props.deleteProperty(key);
    } catch (err) {
      Logger.log('checkPendingJadwalSync gagal utk ' + key + ': ' + err.message);
    }
  });
}

function setupJadwalAutoSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === 'onJadwalSumberEdit' || fn === 'checkPendingJadwalSync') ScriptApp.deleteTrigger(t);
  });

  var props = PropertiesService.getScriptProperties();
  var jumlah = 0;
  Object.keys(WORKSPACE_MAP).forEach(function (workspaceKey) {
    var sourceId = props.getProperty('JADWAL_PENGIRIMAN_FITTING_ID_' + workspaceKey);
    if (!sourceId) return; // workspace ini belum diisi link jadwal sumbernya di panel admin
    try {
      var ssSumber = SpreadsheetApp.openById(sourceId);
      ScriptApp.newTrigger('onJadwalSumberEdit').forSpreadsheet(ssSumber).onEdit().create();
      jumlah++;
      Logger.log('Trigger auto-sync jadwal terpasang utk: ' + workspaceKey + ' (' + sourceId + ')');
    } catch (err) {
      Logger.log('Gagal pasang trigger jadwal utk ' + workspaceKey + ': ' + err.message);
    }
  });
  ScriptApp.newTrigger('checkPendingJadwalSync').timeBased().everyMinutes(5).create();

  Logger.log('Selesai. ' + jumlah + ' trigger onEdit jadwal terpasang + 1 trigger checkPendingJadwalSync (tiap 5 menit). ' +
    'PENTING: kalau bulan berganti & link spreadsheet sumber (JADWAL_PENGIRIMAN_FITTING_ID_*) diupdate ke file BARU, jalankan ULANG fungsi ini supaya trigger pindah ke file yang baru (trigger lama tetap nempel ke file lama, tidak otomatis ikut).');
}
//  gara-gara bug baca-header sebelum diperbaiki (kolom SPM isinya
//  literal teks header spt "PPR / SITECH", bukan nomor SPM asli).
//  Jalankan MANUAL 1x dari Apps Script editor kalau perlu. TIDAK
//  menyentuh baris lain (cuma yang kolom SPM-nya cocok pola header).
// ================================================================
function bersihkanBarisSampahPengiriman() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SH_PENGIRIMAN);
  if (!sheet) { Logger.log('Sheet PENGIRIMAN tidak ditemukan.'); return; }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('Sheet kosong.'); return; }
  var data = sheet.getRange(2, 1, lastRow - 1, 6).getValues(); // A-F
  var rowsToDelete = [];
  for (var i = 0; i < data.length; i++) {
    var spmRaw = String(data[i][4] || '').trim();
    var spmNormalized = spmRaw.toUpperCase().replace(/\s+/g, '');
    var isHeaderText = /PPR.*SITECH/.test(spmNormalized) || /SITECH.*PPR/.test(spmNormalized);
    // Pakai validator format SPM yang sama dgn _bacaJadwalPPRDariSumber
    // (lihat komentar lengkap di _formatSpmValid()) -- cuma digit murni
    // / "PS"+digit yg dianggap SPM sah. Ini juga membersihkan baris yg
    // kadung terbuat dari BUG SEBELUMNYA (validasi lama cuma cek "ada
    // angka di mana pun", jadi kalimat spt "TEE DT 3 QTY 80 BOX DAN LEM
    // URGENT" -- teks dari kolom KETERANGAN yg kebetulan/salah nyangkut
    // di kolom PPR/SITECH sumber -- lolos jadi baris kiriman).
    var isBukanFormatSpm = spmRaw && !_formatSpmValid(spmRaw);
    if (isHeaderText || isBukanFormatSpm) rowsToDelete.push(2 + i);
  }
  if (!rowsToDelete.length) { Logger.log('Tidak ada baris sampah ditemukan.'); return; }
  for (var k = rowsToDelete.length - 1; k >= 0; k--) sheet.deleteRow(rowsToDelete[k]);
  _bumpDataCacheVersion();
  Logger.log(rowsToDelete.length + ' baris sampah dihapus (baris: ' + rowsToDelete.join(', ') + ').');
}

function getKategoriLemburList() { return { success: true, data: KATEGORI_LEMBUR_LIST }; }

// ================================================================
//  DIAGNOSTIK -- jalankan manual dari Apps Script editor (pilih fungsi
//  ini di dropdown lalu klik Run) kalau grafik "Tren Kategori Lembur"
//  kelihatan salah (mis. kategori yang sudah diisi "Checking" malah
//  kehitung "Lain-lain"). Fungsi ini TIDAK mengubah data apa pun --
//  cuma nge-print (Logger.log / View > Logs) baris mana saja di
//  LEMBUR_LOG yang kolom M (Kategori Lembur)-nya KOSONG atau isinya
//  tidak cocok dengan kode manapun di KATEGORI_LEMBUR_LIST -- baris
//  itulah yang otomatis dianggap "Lain-lain". Penyebab paling umum:
//  entri lama yang diinput SEBELUM fitur kategori ada (kolom M memang
//  belum pernah diisi), bukan bug di kode.
// ================================================================
function auditKategoriLemburKosong(tahun) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_LEMBUR_LOG);
  if (!sh) { Logger.log('Sheet LEMBUR_LOG tidak ditemukan.'); return; }
  var data = sh.getDataRange().getValues();
  var kodeValid = {};
  KATEGORI_LEMBUR_LIST.forEach(function (k) { kodeValid[k.kode.toLowerCase()] = 1; });

  var bermasalah = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[1]) continue;
    var tgl = new Date(r[1]);
    if (tahun && tgl.getFullYear() != Number(tahun)) continue;
    var katRaw = String(r[12] || '').trim();
    if (!katRaw || !kodeValid[katRaw.toLowerCase()]) {
      bermasalah.push('Baris ' + (i + 1) + ' | Tanggal: ' + _fmtYMD(tgl) + ' | Kode: ' + r[2] + ' | Nama: ' + r[3] + ' | Isi kolom M saat ini: "' + katRaw + '"');
    }
  }
  Logger.log('Total baris LEMBUR_LOG dgn kategori kosong/tidak dikenali' + (tahun ? ' (tahun ' + tahun + ')' : '') + ': ' + bermasalah.length);
  bermasalah.forEach(function (line) { Logger.log(line); });
}

// ================================================================
//  LEMBUR TANPA POTONGAN ISTIRAHAT
//  Aturan umum: lembur lebih dari 4 jam otomatis dipotong 1 jam istirahat. Petugas serah terima
//  berikut dikecualikan (tanpa istirahat): lembur 16.00 sampai 00.00 tercatat 8 jam.
//  Dicocokkan lewat NAMA (tidak peduli huruf besar/kecil). Ubah daftar ini kalau ada tambahan.
// ================================================================
var LEMBUR_TANPA_ISTIRAHAT = [/NGABIDIN/, /SLAMET\s+RIYADI/, /IBNU\s+ABDILLAH/, /\bLINDU\b/];
var _JABATAN_CACHE = null;
function _jabatanMap() {
  if (_JABATAN_CACHE) return _JABATAN_CACHE;
  var m = {};
  try {
    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH_KARYAWAN_LEMBUR);
    if (sh) sh.getDataRange().getValues().slice(1).forEach(function (r) { if (r[0]) m[String(r[0])] = String(r[3] || ''); });
  } catch (e) {}
  return (_JABATAN_CACHE = m);
}
// Dikecualikan dari potongan istirahat: nama di daftar, ATAU jabatan/role karyawan memuat "Serah Terima"
function _tanpaIstirahat(nama, kode) {
  var n = String(nama || '').toUpperCase();
  if (LEMBUR_TANPA_ISTIRAHAT.some(function (re) { return re.test(n); })) return true;
  if (kode) return String(_jabatanMap()[String(kode)] || '').toUpperCase().indexOf('SERAH TERIMA') !== -1;
  return false;
}
// ATURAN POTONGAN ISTIRAHAT
//  - Karyawan INTERNAL (NIK diawali angka): lembur lebih dari 4 jam otomatis dipotong 1 jam istirahat
//    (kecuali petugas serah terima, lihat LEMBUR_TANPA_ISTIRAHAT).
//  - Karyawan OS (NIK diawali huruf, mis. PEG...): TIDAK dipotong di aplikasi. Jam tersimpan = durasi AKTUAL
//    (mis. 07.00-12.00 = 5 jam); potongan istirahat lembur > 4 jam untuk OS dilakukan pihak HRD.
//  Frontend (input_lembur.html) memakai aturan yang sama -- ubah keduanya bersamaan.
var LEMBUR_POTONG_ISTIRAHAT_INTERNAL = true;
function _jamLemburBersih(durMin, nama, kode) {
  var durJam = durMin / 60;
  if (LEMBUR_POTONG_ISTIRAHAT_INTERNAL && durJam > 4 && _kategoriDariNIK(kode) === 'Internal' && !_tanpaIstirahat(nama, kode)) durJam -= 1;
  return Math.round(durJam * 100) / 100;
}

// Jalankan manual dari editor Apps Script utk MERAPIKAN lembur lama milik karyawan OS yang dulu terlanjur dipotong
// 1 jam (jam tersimpan < durasi aktual). Karyawan Internal TIDAK disentuh. apply=false hanya melaporkan di Logger.
// dariTanggal ('YYYY-MM-DD', opsional) membatasi perbaikan hanya utk lembur pada/setelah tanggal itu.
function perbaikiLemburKeAktual(apply, dariTanggal) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID), sh = ss.getSheetByName(SH_LEMBUR_LOG);
  var data = sh.getDataRange().getValues(), n = 0, tz = Session.getScriptTimeZone();
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (_kategoriDariNIK(r[2]) !== 'OS') continue;
    var tgl = toDate(r[1]);
    if (dariTanggal && tgl && Utilities.formatDate(tgl, tz, 'yyyy-MM-dd') < dariTanggal) continue;
    var m1 = _timeStrToMinutes(_fmtTime(r[4])), m2 = _timeStrToMinutes(_fmtTime(r[5]));
    if (m1 == null || m2 == null) continue;
    var durMin = m2 - m1; if (durMin <= 0) durMin += 24 * 60;
    var baru = Math.round(durMin / 60 * 100) / 100, lama = Number(r[6]);
    if (Math.abs(baru - lama) < 0.001) continue;
    n++;
    Logger.log('Baris ' + (i + 1) + ' | ' + r[3] + ' | ' + _fmtTime(r[4]) + '-' + _fmtTime(r[5]) + ' | ' + lama + ' -> ' + baru);
    if (apply) sh.getRange(i + 1, 7).setValue(baru);
  }
  if (apply && n) _bumpDataCacheVersion();
  Logger.log((apply ? 'Diperbaiki: ' : 'Perlu diperbaiki (belum diubah): ') + n + ' baris');
  return n;
}
function _namaDariKodeKaryawan(kode) {
  try {
    var kr = getKaryawanList();
    var k = kr.success ? kr.data.find(function (x) { return x.kode === kode; }) : null;
    return k ? k.nama : '';
  } catch (e) { return ''; }
}

// Jalankan manual dari editor Apps Script untuk MEMPERBAIKI lembur lama milik petugas yang
// dikecualikan (yang dulu terlanjur dipotong 1 jam). apply=false hanya melaporkan di Logger.
function perbaikiLemburTanpaIstirahat(apply) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_LEMBUR_LOG);
  var data = sh.getDataRange().getValues(), n = 0;
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!_tanpaIstirahat(r[3], r[2])) continue;
    var m1 = _timeStrToMinutes(_fmtTime(r[4])), m2 = _timeStrToMinutes(_fmtTime(r[5]));
    if (m1 == null || m2 == null) continue;
    var durMin = m2 - m1; if (durMin <= 0) durMin += 24 * 60;
    var baru = _jamLemburBersih(durMin, r[3], r[2]), lama = Number(r[6]);
    if (Math.abs(baru - lama) < 0.001) continue;
    n++;
    Logger.log('Baris ' + (i + 1) + ' | ' + r[3] + ' | ' + _fmtTime(r[4]) + '-' + _fmtTime(r[5]) + ' | ' + lama + ' -> ' + baru);
    if (apply) sh.getRange(i + 1, 7).setValue(baru);
  }
  Logger.log((apply ? 'Diperbaiki: ' : 'Perlu diperbaiki (belum diubah): ') + n + ' baris');
  return n;
}

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
    // Sesuai catatan di formulir SPL: lembur di atas 4 jam yang melewati
    // waktu istirahat otomatis kepotong 1 jam (kecuali petugas serah terima: tanpa istirahat).
    var durJam = _jamLemburBersih(durMin, data.nama || _namaDariKodeKaryawan(data.kode), data.kode);

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

    _bumpDataCacheVersion(); // data lembur berubah -> cache FTE basi + tandai perlu sync Supabase (lihat komentar di _bumpDataCacheVersion)
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
  var pesan =
    '*PENGAJUAN LEMBUR BARU*\n\n' +
    'Nama       : ' + nama + '\n' +
    'NIK        : ' + kode + '\n' +
    'Tanggal    : ' + tanggal + '\n' +
    'Jam        : ' + jamMulai + ' - ' + jamSelesai + ' (' + durJam + ' jam)\n' +
    'Keterangan : ' + keterangan + '\n\n' +
    'Mohon Segera di input di aplikasi Sunfish, terimakasih';
  // Token: milik karyawan -> umum -> cadangan; nomor approver: khusus
  // departemen -> umum. Alasan gagal dicatat (lihat _fonnteKirim).
  return _fonnteKirim(kode, pesan).ok;
}

// ================================================================
//  HAPUS LEMBUR LANGSUNG OLEH TL -- beda dari alur approveEditRequest
//  (yang cuma menyetujui PENGAJUAN hapus dari karyawan). Ini dipakai
//  TL untuk menghapus catatan lembur SIAPA SAJA langsung dari panel
//  "Lembur per Karyawan", tanpa perlu karyawan mengajukan dulu --
//  mis. kalau ternyata ada input duplikat/salah kode karyawan.
//  kodeCek/tanggalCek: fingerprint pengaman yg sama seperti approval,
//  supaya tidak salah hapus baris kalau daftar di layar sudah basi.
// ================================================================
function hapusLemburByTL(rowIndex, kodeCek, tanggalCek, approverNik) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet ' + SH_LEMBUR_LOG + ' tidak ditemukan.' };
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, error: 'Baris tidak valid / sudah tidak ada.' };

    var row = sh.getRange(rowIndex, 2, 1, 2).getValues()[0]; // [Tanggal, Kode]
    var tglBaris = row[0] ? _fmtYMD(new Date(row[0])) : '';
    var kodeBaris = String(row[1] || '');
    if (kodeCek && tanggalCek && (kodeBaris !== String(kodeCek) || tglBaris !== String(tanggalCek))) {
      return { success: false, error: 'Daftar sudah berubah -- silakan refresh, lalu coba lagi. Tidak ada data yang terhapus.' };
    }

    sh.deleteRow(rowIndex);
    _bumpDataCacheVersion();
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
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
      // Petugas serah terima tanpa istirahat: total jam dihitung ulang dari jam mulai/selesai saat
      // dibaca, jadi lembur lama yang dulu terpotong 1 jam langsung tampil benar (data tersimpan tidak diubah).
      var totalJamBaca = Number(r[6]) || 0;
      if (_tanpaIstirahat(r[3], r[2])) {
        var mm1 = _timeStrToMinutes(_fmtTime(r[4])), mm2 = _timeStrToMinutes(_fmtTime(r[5]));
        if (mm1 != null && mm2 != null) { var dd = mm2 - mm1; if (dd <= 0) dd += 24 * 60; totalJamBaca = _jamLemburBersih(dd, r[3], r[2]); }
      }
      out.push({
        rowIndex: i + 1, timestamp: r[0] ? new Date(r[0]).toISOString() : '',
        tanggal: dk, kode: String(r[2]), nama: String(r[3]),
        jamMulai: _fmtTime(r[4]), jamSelesai: _fmtTime(r[5]), totalJam: totalJamBaca,
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
    // Sama seperti getOvertimeTrend6Bulan -- sebelumnya TIDAK di-cache,
    // baca ulang seluruh LEMBUR_LOG setiap buka Monitoring FTE.
    var scriptCacheKat = CacheService.getScriptCache();
    var cacheKeyKat = 'katTrend6_' + ACTIVE_WORKSPACE + '_v' + _getDataCacheVersion() + '_' + tahunAkhir + '_' + bulanAkhir;
    var cachedKat = scriptCacheKat.get(cacheKeyKat);
    if (cachedKat) return JSON.parse(cachedKat);

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet LEMBUR_LOG belum ada.' };
    var data = sh.getDataRange().getValues();

    // Peta kode kategori TERNORMALISASI (trim + lowercase) -> kode asli,
    // supaya selisih spasi/huruf besar-kecil di kolom M tidak bikin
    // kategori yang sudah benar (mis. "Checking" atau " checking ")
    // salah jatuh ke bucket "Lain-lain".
    var kodeNormMap = {};
    KATEGORI_LEMBUR_LIST.forEach(function (k) { kodeNormMap[k.kode.toLowerCase()] = k.kode; });

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
      var katRaw = String(r[12] || '').trim();
      var kat = kodeNormMap[katRaw.toLowerCase()] || 'lain';
      bucket.totals[kat] += Number(r[6]) || 0;
    }

    var results = months.map(function (m) {
      Object.keys(m.totals).forEach(function (k) { m.totals[k] = Math.round(m.totals[k] * 100) / 100; });
      return m.totals;
    });
    var hasilKat = { success: true, results: results };
    try {
      var nowKat = new Date();
      var isBulanBerjalanKat = (Number(tahunAkhir) === nowKat.getFullYear() && Number(bulanAkhir) === (nowKat.getMonth() + 1));
      scriptCacheKat.put(cacheKeyKat, JSON.stringify(hasilKat), isBulanBerjalanKat ? 180 : 21600);
    } catch (cacheErrKat) { /* gagal cache tidak masalah, tetap return data */ }
    return hasilKat;
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  DIAGNOSA LEMBUR 1 KARYAWAN -- alat bantu telusur kalau total jam
//  lembur beda antara Input Lembur (riwayat), Monitoring FTE, dan Print
//  SPL. Menampilkan SETIAP baris lembur milik 1 kode utk 1 bulan, APA
//  ADANYA dari sheet (bukan hasil hitungan ulang) -- tanggal, jam,
//  totalJam TERSIMPAN (sudah/belum kepotong istirahat), status approval,
//  & kategori. Ketiga tempat itu (Input Lembur riwayat, Monitoring FTE,
//  Print SPL) SAMA-SAMA memanggil getLemburList() yang sama persis --
//  kalau datanya beda, pasti kelihatan di sini row mana yang beda/hilang.
// ================================================================
function diagnosaLemburKaryawan(kode, bulan, tahun) {
  try {
    var res = getLemburList({ kode: kode, bulan: bulan, tahun: tahun });
    if (!res.success) return res;
    var totalSemua = Math.round(res.data.reduce(function (a, l) { return a + l.totalJam; }, 0) * 100) / 100;
    var totalDisetujui = Math.round(res.data.filter(function (l) { return l.approvalStatus === 'Disetujui'; }).reduce(function (a, l) { return a + l.totalJam; }, 0) * 100) / 100;
    var totalPending = Math.round(res.data.filter(function (l) { return l.approvalStatus === 'Pending'; }).reduce(function (a, l) { return a + l.totalJam; }, 0) * 100) / 100;
    return {
      success: true,
      jumlahEntri: res.data.length,
      totalSemua: totalSemua,       // SEMUA entri apapun statusnya -- ini yg dipakai Monitoring FTE & Print SPL (lihat getAbsensiFTEData/_buildSPLDocument, keduanya TIDAK menyaring status)
      totalDisetujui: totalDisetujui,
      totalPending: totalPending,
      data: res.data
    };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  SYNC LEMBURAN -- tarik ulang data lembur TERBARU langsung dari
//  sheet LEMBUR_LOG, lalu hitung ulang Monitoring FTE bulan tsb.
//  Dipanggil tombol "Sync Lembur" di Monitoring FTE. Beda dgn "Sync
//  Sekarang" (cuma mengisi ulang snapshot): fungsi ini
//   1) menaikkan versi cache (semua cache server basi seketika),
//   2) menghitung ulang getAbsensiFTEData dari data mentah,
//   3) menulis hasilnya ke snapshot Supabase (supaya buka halaman
//      berikutnya juga sudah benar), dan
//   4) MENGEMBALIKAN hasil segar itu langsung ke halaman, sehingga
//      tampilan tidak bergantung pada snapshot/cache browser lama.
//  Juga melaporkan baris lembur yang kodenya tidak cocok dgn master
//  karyawan aktif (penyebab klasik "ada di Riwayat tapi 0j di FTE").
// ================================================================
function syncLemburFTE(bulan, tahun) {
  try {
    bulan = Number(bulan); tahun = Number(tahun);
    _bumpDataCacheVersion();
    var res = getAbsensiFTEData(bulan, tahun);
    if (!res || !res.success) return res || { success: false, error: 'Gagal menghitung FTE.' };

    var log = [];
    try {
      var put = _syncPutHelper(ACTIVE_WORKSPACE, log);
      put('fte:bulanan:' + tahun + '-' + _pad2(bulan), function () { return res; });
    } catch (e) { log.push('GAGAL snapshot: ' + e.message); }

    var lr = getLemburList({ bulan: bulan, tahun: tahun });
    var lembur = lr.success ? lr.data : [];
    var kr = getKaryawanList();
    var aktif = {}, semua = {};
    (kr.success ? kr.data : []).forEach(function (k) { semua[k.kode] = k; if (k.aktif) aktif[k.kode] = 1; });
    var tidakCocok = {};
    lembur.forEach(function (l) {
      if (!aktif[l.kode]) {
        var t = tidakCocok[l.kode] || (tidakCocok[l.kode] = { kode: l.kode, nama: l.nama, jumlah: 0, jam: 0, alasan: semua[l.kode] ? 'karyawan NON-AKTIF di master' : 'kode tidak ada di master karyawan' });
        t.jumlah++; t.jam = Math.round((t.jam + l.totalJam) * 100) / 100;
      }
    });
    var totalJam = Math.round(lembur.reduce(function (a, l) { return a + l.totalJam; }, 0) * 100) / 100;
    return {
      success: true, data: res, log: log,
      jumlahLembur: lembur.length, totalJamLembur: totalJam,
      tidakCocok: Object.keys(tidakCocok).map(function (k) { return tidakCocok[k]; })
    };
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
    var kodeNormMap2 = {};
    KATEGORI_LEMBUR_LIST.forEach(function (k) { kodeNormMap2[k.kode.toLowerCase()] = k.kode; });

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[1]) continue;
      var tgl = new Date(r[1]);
      if ((tgl.getMonth() + 1) != Number(bulan) || tgl.getFullYear() != Number(tahun)) continue;
      var katRaw = String(r[12] || '').trim();
      var kat = kodeNormMap2[katRaw.toLowerCase()] || 'lain'; // data lama sebelum fitur ini ada / kategori kosong/tidak dikenal
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

// actorNik: dipakai utk cek apakah dia TL Lintas Departemen (lihat
// _resolveApprovalWorkspaceKeys di atas) -- kalau ya, hasilnya
// digabung dari SEMUA departemen yang dia pegang, masing2 item ditandai
// workspaceKey/workspaceLabel supaya panel approval bisa menampilkan
// dari departemen mana asalnya & mengirimkannya kembali saat approve.
function getPendingApprovals(actorNik) {
  try {
    var workspaceKeys = _resolveApprovalWorkspaceKeys(actorNik);
    var out = [];

    workspaceKeys.forEach(function (wsKey) {
      var wsId = WORKSPACE_MAP[wsKey];
      if (!wsId) return; // departemen belum di-provision -- lewati diam2, jangan sampai gagalkan semua
      var ss;
      try { ss = SpreadsheetApp.openById(wsId); } catch (e) { return; }
      var wsLabel = WORKSPACE_LABELS[wsKey] || wsKey;

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
              keterangan: String(r[7] || ''),
              workspaceKey: wsKey, workspaceLabel: wsLabel
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
              diajukanOleh: String(r[15] || ''),
              workspaceKey: wsKey, workspaceLabel: wsLabel
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
            keterangan: String(ra[5] || ''),
            workspaceKey: wsKey, workspaceLabel: wsLabel
          });
        }
      }
    });

    out.sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
    return { success: true, data: out, lintasDepartemen: workspaceKeys.length > 1 };
  } catch (err) { return { success: false, error: err.message }; }
}

// tipe: 'lembur' | 'cuti'  |  keputusan: 'Disetujui' | 'Ditolak'
// kodeCek/tanggalCek (YYYY-MM-DD): fingerprint dari baris yang DILIHAT
// TL saat klik approve -- WAJIB cocok dgn baris di rowIndex SEKARANG,
// supaya aman kalau ada penghapusan baris lain (dari approveEditRequest
// aksi 'delete') yang bikin rowIndex lama jadi menunjuk baris berbeda.
// Tanpa cek ini, approval bisa "kena" baris yang salah tanpa error --
// itu penyebab bug "approve kadang tidak jalan/salah sasaran".
//
// workspaceKey (opsional): departemen ASAL item ini (dikirim balik oleh
// panel approval, lihat getPendingApprovals). Kalau diisi & BEDA dari
// ACTIVE_WORKSPACE (session TL saat ini), WAJIB approverNik terdaftar
// sbg TL Lintas Departemen utk workspace itu (lihat
// _resolveApprovalWorkspaceKeys) -- kalau tidak, ditolak. Kalau kosong,
// pakai ACTIVE_WORKSPACE spt semula (backward compatible).
function approveItem(tipe, rowIndex, keputusan, approverNik, kodeCek, tanggalCek, workspaceKey) {
  try {
    var wsKey = workspaceKey || ACTIVE_WORKSPACE;
    if (wsKey !== ACTIVE_WORKSPACE && _resolveApprovalWorkspaceKeys(approverNik).indexOf(wsKey) === -1) {
      return { success: false, error: 'Akses ditolak -- akun ini tidak terdaftar sbg TL Lintas Departemen utk departemen "' + (WORKSPACE_LABELS[wsKey] || wsKey) + '".' };
    }
    var wsId = WORKSPACE_MAP[wsKey];
    if (!wsId) return { success: false, error: 'Departemen "' + wsKey + '" belum di-provision.' };
    var ss = SpreadsheetApp.openById(wsId);
    var sheetName = tipe === 'cuti' ? SH_ABSENSI_LOG : SH_LEMBUR_LOG;
    var statusCol  = tipe === 'cuti' ? 8 : 10;  // kolom H (cuti) / J (lembur), 1-based
    var catatanCol = tipe === 'cuti' ? 10 : 12; // kolom J (cuti) / L (lembur) -- catatan attestasi
    var sh = ss.getSheetByName(sheetName);
    if (!sh) return { success: false, error: 'Sheet ' + sheetName + ' tidak ditemukan.' };
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, error: 'Baris tidak valid.' };

    var row = sh.getRange(rowIndex, 1, 1, 8).getValues()[0]; // [Timestamp, Tanggal, Kode, Nama, JamMulai, JamSelesai, TotalJam, Keterangan]
    var kode = String(row[2] || ''), nama = String(row[3] || '');

    if (kodeCek && tanggalCek) {
      var tglBaris = row[1] ? _fmtYMD(new Date(row[1])) : '';
      if (kode !== String(kodeCek) || tglBaris !== String(tanggalCek)) {
        return { success: false, error: 'Daftar approval sudah berubah (ada aksi lain yang menggeser urutan baris) -- silakan refresh panel approval, lalu coba lagi. Tidak ada data yang berubah.' };
      }
    }

    // ---- SEMUA jenis pengajuan yang DITOLAK -- HAPUS TOTAL baris ini
    // (bukan cuma diberi status "Ditolak") supaya TIDAK muncul lagi di
    // Riwayat & TIDAK tersimpan di mana pun. Karyawan diberi kartu
    // notifikasi di akunnya sbg pengganti (lihat _kirimNotifikasiUser +
    // getNotifikasiSaya, dibaca oleh input_lembur.html).
    if (keputusan === 'Ditolak') {
      var tglBarisHapus = row[1] ? _fmtYMD(new Date(row[1])) : '';
      var pesanNotif;
      if (tipe === 'lembur') {
        pesanNotif = 'Pengajuan lembur Anda tanggal ' + tglBarisHapus + ' (' + _fmtTime(row[4]) + '–' + _fmtTime(row[5]) + ') ditolak. Untuk keterangan pastinya bisa ditanyakan kepada Team Leader Anda.';
      } else {
        // ABSENSI_LOG: kolom E (row[4]) = Jenis (Sakit/Cuti Tahunan/dst),
        // BUKAN jam -- beda layout dari LEMBUR_LOG.
        var jenisCuti = row[4] ? String(row[4]) : 'cuti/ketidakhadiran';
        pesanNotif = 'Pengajuan ' + jenisCuti + ' Anda tanggal ' + tglBarisHapus + ' ditolak. Untuk keterangan pastinya bisa ditanyakan kepada Team Leader Anda.';
      }
      _kirimNotifikasiUser(ss, kode, pesanNotif);
      sh.deleteRow(rowIndex);
      _bumpDataCacheVersion();
      return { success: true, dihapus: true };
    }

    sh.getRange(rowIndex, statusCol, 1, 2).setValues([[keputusan, approverNik || '']]);

    var catatan = '';
    if (keputusan === 'Disetujui') {
      catatan = 'Sudah dipastikan TL sudah menginput cuti/lembur karyawan ' + nama + ' (' + kode + ') di aplikasi Sunfish.';
    }
    sh.getRange(rowIndex, catatanCol).setValue(catatan);

    _bumpDataCacheVersion();
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Waktu notifikasi dalam bentuk relatif ringkas ("Baru saja", "23 menit
// lalu", "3 jam lalu", "Kemarin", atau tanggal singkat kalau sudah lama).
function _fmtWaktuNotif(d) {
  var diffMs = new Date().getTime() - d.getTime();
  var menit = Math.floor(diffMs / 60000);
  if (menit < 1) return 'Baru saja';
  if (menit < 60) return menit + ' menit lalu';
  var jam = Math.floor(menit / 60);
  if (jam < 24) return jam + ' jam lalu';
  var hari = Math.floor(jam / 24);
  if (hari === 1) return 'Kemarin';
  if (hari < 7) return hari + ' hari lalu';
  var bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return d.getDate() + ' ' + bln[d.getMonth()];
}

// ------------------------------------------------------------
//  NOTIFIKASI PERSONAL UTK KARYAWAN -- sheet NOTIFIKASI_USER (dibuat
//  otomatis kalau belum ada). Dipakai utk kabari karyawan begitu SALAH
//  SATU dari pengajuan berikut ditolak TL: lembur baru, cuti/ketidak-
//  hadiran baru, atau pengajuan edit/hapus catatan lembur (lihat
//  approveItem & approveEditRequest di atas). Dibaca oleh
//  getNotifikasiSaya() -- ditampilkan sbg kartu notif di
//  input_lembur.html saat karyawan itu login.
// ------------------------------------------------------------
function _kirimNotifikasiUser(ss, nik, pesan) {
  var sh = ss.getSheetByName('NOTIFIKASI_USER');
  if (!sh) {
    sh = ss.insertSheet('NOTIFIKASI_USER');
    sh.getRange(1, 1, 1, 4).setValues([['Timestamp', 'NIK', 'Pesan', 'Dibaca']]);
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), String(nik || '').trim(), String(pesan || ''), false]);
}

// Notifikasi yang BELUM dibaca milik nik ini, di departemen (workspace)
// yang sedang aktif/login. Terbaru duluan.
function getNotifikasiSaya(nik) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName('NOTIFIKASI_USER');
    if (!sh) return { success: true, data: [] };
    var data = sh.getDataRange().getValues();
    var nikUp = String(nik || '').trim().toUpperCase();
    var out = [];
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[1]) continue;
      if (String(r[1]).trim().toUpperCase() === nikUp && r[3] !== true) {
        out.push({ rowIndex: i + 1, pesan: String(r[2] || ''), waktu: r[0] ? _fmtWaktuNotif(new Date(r[0])) : '' });
      }
    }
    out.reverse();
    return { success: true, data: out };
  } catch (err) { return { success: false, error: err.message }; }
}

// Ditandai dibaca (dismiss) setelah karyawan lihat kartunya -- supaya
// tidak muncul berulang tiap buka halaman.
function tandaiNotifikasiDibaca(nik, rowIndexes) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName('NOTIFIKASI_USER');
    if (!sh) return { success: true };
    (rowIndexes || []).forEach(function (ri) {
      if (ri >= 2 && ri <= sh.getLastRow()) sh.getRange(ri, 4).setValue(true);
    });
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  BERSIHKAN BARIS "DITOLAK" LAMA (sekali-jalan) -- utk baris yang
//  sempat ditolak SEBELUM update ini di-deploy (masih pakai logika
//  lama: cuma diberi status "Ditolak", tidak dihapus). Baris spt ini
//  "nyangkut" selamanya krn logika baru cuma berlaku utk aksi Tolak
//  BERIKUTNYA, bukan retroaktif. Fungsi ini menyisir LEMBUR_LOG &
//  ABSENSI_LOG di departemen yang sedang aktif, hapus semua baris
//  berstatus "Ditolak", dan kirim notifikasi susulan ke pemiliknya --
//  supaya konsisten dgn baris yg ditolak lewat logika baru. AMAN
//  dijalankan berkali-kali (kalau sudah bersih, tidak akan ketemu apa2).
// ================================================================
function bersihkanPengajuanDitolakLama(actorNik, workspaceKey) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    var wsKey = workspaceKey || ACTIVE_WORKSPACE;
    if (wsKey !== ACTIVE_WORKSPACE && _resolveApprovalWorkspaceKeys(actorNik).indexOf(wsKey) === -1) {
      return { success: false, error: 'Akses ditolak -- akun ini tidak terdaftar sbg TL Lintas Departemen utk departemen "' + (WORKSPACE_LABELS[wsKey] || wsKey) + '".' };
    }
    var wsId = WORKSPACE_MAP[wsKey];
    if (!wsId) return { success: false, error: 'Departemen "' + wsKey + '" belum di-provision.' };
    var ss = SpreadsheetApp.openById(wsId);
    var hasil = { lembur: 0, cuti: 0 };

    var shLem = ss.getSheetByName(SH_LEMBUR_LOG);
    if (shLem) {
      var dataLem = shLem.getDataRange().getValues();
      for (var i = dataLem.length - 1; i >= 1; i--) { // dari bawah ke atas spy index baris tdk berantakan saat deleteRow
        if (String(dataLem[i][9] || '') === 'Ditolak') { // kolom J (index 9)
          var kodeL = String(dataLem[i][2] || '');
          var tglL = dataLem[i][1] ? _fmtYMD(new Date(dataLem[i][1])) : '';
          var pesanL = 'Pengajuan lembur Anda tanggal ' + tglL + ' (' + _fmtTime(dataLem[i][4]) + '–' + _fmtTime(dataLem[i][5]) + ') ditolak. Untuk keterangan pastinya bisa ditanyakan kepada Team Leader Anda.';
          _kirimNotifikasiUser(ss, kodeL, pesanL);
          shLem.deleteRow(i + 1);
          hasil.lembur++;
        }
      }
    }

    var shAbs = ss.getSheetByName(SH_ABSENSI_LOG);
    if (shAbs) {
      var dataAbs = shAbs.getDataRange().getValues();
      for (var j = dataAbs.length - 1; j >= 1; j--) {
        if (String(dataAbs[j][7] || '') === 'Ditolak') { // kolom H (index 7)
          var kodeA = String(dataAbs[j][2] || '');
          var tglA = dataAbs[j][1] ? _fmtYMD(new Date(dataAbs[j][1])) : '';
          var jenisA = dataAbs[j][4] ? String(dataAbs[j][4]) : 'cuti/ketidakhadiran';
          var pesanA = 'Pengajuan ' + jenisA + ' Anda tanggal ' + tglA + ' ditolak. Untuk keterangan pastinya bisa ditanyakan kepada Team Leader Anda.';
          _kirimNotifikasiUser(ss, kodeA, pesanA);
          shAbs.deleteRow(j + 1);
          hasil.cuti++;
        }
      }
    }

    _bumpDataCacheVersion();
    return { success: true, hasil: hasil };
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
    // potongan jam istirahat, konsisten dgn input awal (saveLembur/submitEditLembur); petugas serah terima tanpa potongan
    var durJam = _jamLemburBersih(durMin, sh.getRange(rowIndex, 4).getValue(), sh.getRange(rowIndex, 3).getValue());

    var tglDate = new Date(String(tanggalBaru) + 'T00:00:00');
    if (isNaN(tglDate.getTime())) return { success: false, error: 'Format tanggal tidak valid (harus YYYY-MM-DD).' };

    sh.getRange(rowIndex, 2).setValue(tglDate);                                   // B: Tanggal
    sh.getRange(rowIndex, 5, 1, 3).setValues([[jamMulaiBaru, jamSelesaiBaru, durJam]]); // E,F,G
    // PENTING: cek "!= null" TIDAK menangkap string kosong '' -- kalau
    // textarea Keterangan di modal TL kebetulan kosong saat disubmit
    // (misal race condition render/prefill, atau device lemot), baris ini
    // akan MENIMPA Keterangan yang sudah diisi user jadi KOSONG TOTAL --
    // inilah kemungkinan besar penyebab keterangan hilang saat print SPL.
    // Sekarang: kalau keteranganBaru KOSONG, JANGAN timpa -- pertahankan
    // apa yang sudah ada. TL yang betul-betul mau mengosongkan Keterangan
    // harus isi tanda seperti "-" secara sengaja, bukan biarkan kosong.
    var ketTrim = String(keteranganBaru == null ? '' : keteranganBaru).trim();
    if (ketTrim) sh.getRange(rowIndex, 8).setValue(ketTrim); // H: Keterangan

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

  var pesan =
    '*REMINDER APPROVAL CUTI* (' + ACTIVE_WORKSPACE + ')\n\n' +
    pendingLama.length + ' pengajuan cuti sudah lebih dari 24 jam belum diproses:\n' +
    pendingLama.map(function (p) { return '- ' + p.nama + ' (' + p.kode + ') — ' + p.tanggal; }).join('\n') +
    '\n\nMohon segera di-approve/tolak di aplikasi Sunfish.';

  // Reminder tidak terkait 1 karyawan -> pakai token umum / cadangan.
  var r = _fonnteKirim('', pesan);
  if (r.ok) Logger.log('Reminder terkirim untuk ' + ACTIVE_WORKSPACE + ' (' + pendingLama.length + ' item)');
  else Logger.log('Gagal kirim reminder WA untuk ' + ACTIVE_WORKSPACE + ': ' + (r.pesan || '') + ' ' + (r.saran || ''));
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
//  TANDA TANGAN SPL OUTSOURCING — LEADER / SECTION HEAD / DEPT HEAD
// ------------------------------------------------------------
//  Diupload SEKALI oleh akun yang boleh kelola user (TL / Admin /
//  Super Admin) lewat Panel Admin. Setelah itu, setiap kali lembur
//  karyawan OS sudah DISETUJUI TL (approvalStatus = 'Disetujui'),
//  tanda tangan ketiga jabatan ini OTOMATIS tertempel di kolom Paraf
//  (Leader / Sect Head / Dept Head) baris lembur tsb di formulir SPL.
//  Lembur yang masih Pending / Ditolak TIDAK diberi tanda tangan.
//
//  Penyimpanan: gambar di Drive (anyone-with-link, pola sama dgn
//  uploadTlSignature), metadata di sheet SPL_TTD_JABATAN pada
//  spreadsheet departemen (jadi tiap departemen/plant punya
//  tanda tangan sendiri):
//    A=Jabatan (LEADER|SECTHEAD|DEPTHEAD)  B=Nama penandatangan
//    C=FileId gambar  D=Diupload oleh (NIK)  E=Waktu upload
// ================================================================
var SH_SPL_TTD = 'SPL_TTD_JABATAN';
var SPL_TTD_JABATAN = {
  LEADER:   { label: 'Leader',       token: 'LEADER' },
  SECTHEAD: { label: 'Section Head', token: 'SECT'   },
  DEPTHEAD: { label: 'Dept Head',    token: 'DEPT'   }
};
var SPL_TTD_MAX_CHARS = 3 * 1024 * 1024; // batas data URL ~3 MB (klien sudah mengecilkan gambar)

function _splTtdSheet(ss, buatKalauBelumAda) {
  var sh = ss.getSheetByName(SH_SPL_TTD);
  if (!sh && buatKalauBelumAda) {
    sh = ss.insertSheet(SH_SPL_TTD);
    sh.getRange('A1:E1').setValues([['Jabatan', 'Nama', 'FileId', 'DiuploadOleh', 'Waktu']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Peta { LEADER: {rowIndex,nama,fileId,oleh,waktu}, ... } dari sebuah spreadsheet
function _splTtdPeta(ss) {
  var out = {}, sh = _splTtdSheet(ss, false);
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r, i) {
    var j = String(r[0] || '').trim().toUpperCase();
    if (SPL_TTD_JABATAN[j] && r[2]) out[j] = { rowIndex: i + 2, nama: String(r[1] || ''), fileId: String(r[2]), oleh: String(r[3] || ''), waktu: r[4] };
  });
  return out;
}

function _splTtdBlobDariId(fileId) {
  try { return DriveApp.getFileById(fileId).getBlob(); } catch (e) { return null; }
}

// ---- Batas SPL LAMA ----
// Lembur yang DIINPUT SEBELUM batas ini dianggap SPL lama: tanda tangan langsung tertempel di semua
// barisnya. Lembur yang diinput SETELAH batas baru bertanda tangan kalau sudah DISETUJUI TL.
// Batas otomatis diisi = saat tanda tangan pertama diupload di departemen itu; bisa diubah di Panel Admin.
function _splTtdCutoffBaca(workspaceKey) {
  var v = PropertiesService.getScriptProperties().getProperty('SPL_TTD_CUTOFF_' + workspaceKey);
  if (!v) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function _splBarisBertandatangan(l, cutoff) {
  if (l.approvalStatus === 'Disetujui') return true;
  if (!cutoff) return false;
  var t = l.timestamp ? new Date(l.timestamp) : null;
  if (!t || isNaN(t.getTime())) return false;
  return t.getTime() < cutoff.getTime();
}
// value: 'yyyy-MM-ddTHH:mm' (WIB). Kosong = matikan penempelan otomatis untuk SPL lama.
function adminSetSplTtdCutoff(actorNik, value, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var iso;
    value = String(value || '').trim();
    if (!value) iso = '1970-01-01T00:00:00Z';
    else {
      var d = new Date(value + ':00+07:00');
      if (isNaN(d.getTime())) return { success: false, error: 'Format tanggal/jam tidak valid.' };
      iso = d.toISOString();
    }
    PropertiesService.getScriptProperties().setProperty('SPL_TTD_CUTOFF_' + tgt.workspaceKey, iso);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Peringatan singkat bila SPL ini seharusnya bertanda tangan tetapi tanda tangan jabatan tertentu
// belum ada di departemen yang sedang aktif (tanda tangan disimpan PER DEPARTEMEN/spreadsheet).
function _splPeringatanTtd(kode, bulan, tahun) {
  try {
    var lr = getLemburList({ kode: kode, bulan: Number(bulan), tahun: Number(tahun) });
    var co = _splTtdCutoffBaca(ACTIVE_WORKSPACE);
    var perlu = (lr.success ? lr.data : []).some(function (l) { return _splBarisBertandatangan(l, co); });
    if (!perlu) return '';
    var ada = _getSplSignatureSet();
    var hilang = Object.keys(SPL_TTD_JABATAN).filter(function (j) { return !ada[j]; }).map(function (j) { return SPL_TTD_JABATAN[j].label; });
    if (!hilang.length) return '';
    return 'Tanda tangan ' + hilang.join(', ') + ' belum diupload untuk departemen ini (' + ACTIVE_WORKSPACE + '), jadi kolom Paraf kosong. Upload di Kelola User > Tanda Tangan Digital SPL pada departemen ini.';
  } catch (e) { return ''; }
}

// Diagnosa lengkap: kenapa paraf muncul / tidak muncul di SPL satu karyawan
function diagnosaSplTtd(kode, bulan, tahun) {
  try {
    bulan = Number(bulan); tahun = Number(tahun);
    var out = { success: true, workspace: ACTIVE_WORKSPACE, spreadsheetId: SPREADSHEET_ID };
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var peta = _splTtdPeta(ss);
    var set = _getSplSignatureSet();
    out.tandaTangan = Object.keys(SPL_TTD_JABATAN).map(function (j) {
      return { jabatan: SPL_TTD_JABATAN[j].label, tercatat: !!peta[j], gambarBisaDibuka: !!set[j], nama: peta[j] ? peta[j].nama : '' };
    });
    var co = _splTtdCutoffBaca(ACTIVE_WORKSPACE);
    out.batasSplLama = co ? Utilities.formatDate(co, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm') : '(belum diatur)';
    var lr = getLemburList({ kode: kode, bulan: bulan, tahun: tahun });
    out.baris = (lr.success ? lr.data : []).map(function (l) {
      return { tanggal: l.tanggal, status: l.approvalStatus, diinput: l.timestamp || '', bertandaTangan: _splBarisBertandatangan(l, co) };
    });
    // departemen lain yang sudah punya tanda tangan (petunjuk kalau salah departemen)
    out.departemenLain = [];
    Object.keys(WORKSPACE_MAP).forEach(function (key) {
      var id = WORKSPACE_MAP[key];
      if (!id || id === SPREADSHEET_ID) return;
      try { var n = Object.keys(_splTtdPeta(SpreadsheetApp.openById(id))).length; if (n) out.departemenLain.push({ workspace: key, jumlahTandaTangan: n }); } catch (e) {}
    });
    var hilang = out.tandaTangan.filter(function (t) { return !t.gambarBisaDibuka; }).map(function (t) { return t.jabatan; });
    var perlu = out.baris.some(function (b) { return b.bertandaTangan; });
    out.kesimpulan = !perlu ? 'Belum ada baris lembur yang memenuhi syarat tanda tangan (belum Disetujui dan bukan SPL lama).'
      : hilang.length ? 'Tanda tangan ' + hilang.join(', ') + ' BELUM ada / gambarnya tidak bisa dibuka di departemen ' + ACTIVE_WORKSPACE + (out.departemenLain.length ? ' (tapi sudah ada di: ' + out.departemenLain.map(function (d) { return d.workspace; }).join(', ') + ' -- tanda tangan tidak dibagi antar departemen, upload di departemen ini).' : '.')
      : 'Tanda tangan lengkap & baris memenuhi syarat. Kalau paraf belum muncul, muat ulang halaman (Ctrl+F5) karena PDF lama masih tersimpan di browser, atau cek penanda {{TTD_LEADERn}} di template.';
    return out;
  } catch (err) { return { success: false, error: err.message }; }
}

// Daftar tanda tangan jabatan + pratinjau gambar (data URL) untuk Panel Admin
function adminGetSplSignatures(actorNik, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var peta = _splTtdPeta(tgt.ss), data = [];
    Object.keys(SPL_TTD_JABATAN).forEach(function (j) {
      var e = peta[j], item = { jabatan: j, label: SPL_TTD_JABATAN[j].label, ada: false, nama: '', preview: '', oleh: '', waktu: '' };
      if (e) {
        var blob = _splTtdBlobDariId(e.fileId);
        if (blob) {
          item.ada = true; item.nama = e.nama; item.oleh = e.oleh;
          item.waktu = e.waktu ? Utilities.formatDate(new Date(e.waktu), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm') : '';
          item.preview = 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
        }
      }
      data.push(item);
    });
    var co = _splTtdCutoffBaca(tgt.workspaceKey);
    var coStr = (co && co.getTime() > 0) ? Utilities.formatDate(co, 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm") : '';
    return { success: true, data: data, workspaceKey: tgt.workspaceKey, cutoff: coStr, ukuran: _splUkuranBaca(tgt.workspaceKey) };
  } catch (err) { return { success: false, error: err.message }; }
}

function adminUploadSplSignature(actorNik, jabatan, nama, dataUrl, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin yang boleh upload tanda tangan.' };
    jabatan = String(jabatan || '').trim().toUpperCase();
    if (!SPL_TTD_JABATAN[jabatan]) return { success: false, error: 'Jabatan tidak valid (pilih Leader / Section Head / Dept Head).' };
    nama = String(nama || '').trim();
    if (!dataUrl || String(dataUrl).indexOf('data:image/') !== 0) return { success: false, error: 'File harus berupa gambar (PNG/JPG).' };
    if (String(dataUrl).length > SPL_TTD_MAX_CHARS) return { success: false, error: 'Ukuran gambar terlalu besar (maks ~2 MB).' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };

    var parts = String(dataUrl).split(',');
    var mime = (parts[0].match(/data:(image\/[a-zA-Z0-9.+-]+)/) || [])[1] || 'image/png';
    var ext = mime.indexOf('jpeg') > -1 ? 'jpg' : 'png';
    var blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), mime, 'ttd_spl_' + jabatan.toLowerCase() + '_' + tgt.workspaceKey + '.' + ext);

    var sh = _splTtdSheet(tgt.ss, true);
    var peta = _splTtdPeta(tgt.ss);
    if (peta[jabatan]) { try { DriveApp.getFileById(peta[jabatan].fileId).setTrashed(true); } catch (e) {} }

    var file = DriveApp.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var propsC = PropertiesService.getScriptProperties();
    if (!propsC.getProperty('SPL_TTD_CUTOFF_' + tgt.workspaceKey)) propsC.setProperty('SPL_TTD_CUTOFF_' + tgt.workspaceKey, new Date().toISOString()); // SPL yang sudah ada saat ini = SPL lama
    var baris = [jabatan, nama, file.getId(), String(actorNik), new Date()];
    if (peta[jabatan]) sh.getRange(peta[jabatan].rowIndex, 1, 1, 5).setValues([baris]);
    else sh.appendRow(baris);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

function adminHapusSplSignature(actorNik, jabatan, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    jabatan = String(jabatan || '').trim().toUpperCase();
    if (!SPL_TTD_JABATAN[jabatan]) return { success: false, error: 'Jabatan tidak valid.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var e = _splTtdPeta(tgt.ss)[jabatan];
    if (!e) return { success: true };
    try { DriveApp.getFileById(e.fileId).setTrashed(true); } catch (x) {}
    _splTtdSheet(tgt.ss, false).deleteRow(e.rowIndex);
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Dipakai saat membangun SPL (departemen/workspace yang sedang aktif):
// { LEADER: {nama, fileId, blob}, SECTHEAD: {...}, DEPTHEAD: {...} } -- jabatan yang belum diupload tidak ada.
function _getSplSignatureSet() {
  var out = {};
  try {
    var peta = _splTtdPeta(SpreadsheetApp.openById(SPREADSHEET_ID));
    Object.keys(peta).forEach(function (j) {
      var b = _splTtdBlobDariId(peta[j].fileId);
      if (b) out[j] = { nama: peta[j].nama, fileId: peta[j].fileId, blob: b };
    });
  } catch (e) {}
  return out;
}
// Hanya FileId (murah, tanpa unduh gambar) -- untuk sidik jari cache PDF SPL
function _splTtdSidik() {
  try {
    var peta = _splTtdPeta(SpreadsheetApp.openById(SPREADSHEET_ID));
    return Object.keys(peta).sort().map(function (j) { return j + ':' + peta[j].fileId; }).join(',');
  } catch (e) { return ''; }
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
    var durJam = _jamLemburBersih(durMin, sh.getRange(rowIndex, 4).getValue(), sh.getRange(rowIndex, 3).getValue());

    // ------------------------------------------------------------
    //  Kalau JAM KERJA (jamMulai/jamSelesai) TIDAK berubah -- cuma
    //  Keterangan/Kategori yang diedit -- TERAPKAN LANGSUNG, tanpa
    //  approval TL, WALAUPUN catatannya sudah lebih dari 24 jam.
    //  Aturan approval TL cuma berlaku kalau JAM KERJA-nya berubah,
    //  karena itu yang mempengaruhi Total Jam Lembur/perhitungan FTE.
    //  Keterangan cuma catatan tambahan, tidak berdampak ke angka.
    // ------------------------------------------------------------
    var jamLama = sh.getRange(rowIndex, 5, 1, 2).getValues()[0]; // E,F: JamMulai, JamSelesai saat ini
    // PENTING: nilai mentah dari sheet bisa berupa Date object atau angka
    // pecahan (format waktu Google Sheets), BUKAN cuma string "13:00" --
    // makanya HARUS dinormalisasi lewat _fmtTime() dulu (sama seperti cara
    // baca jam di getLemburList() dkk) sebelum dibandingkan dengan string
    // "HH:MM" polos yang dikirim dari form. Sebelumnya dibandingkan mentah
    // (String(dateObject) vs "13:00") -- HAMPIR SELALU tidak pernah sama
    // walau user sama sekali tidak mengubah jam, jadi tetap dianggap
    // "jam berubah" dan tetap masuk approval TL walau cuma edit keterangan.
    var jamMulaiLama = _fmtTime(jamLama[0]);
    var jamSelesaiLama = _fmtTime(jamLama[1]);
    var jamTidakBerubah = (jamMulaiLama === String(newData.jamMulai || '').trim())
                        && (jamSelesaiLama === String(newData.jamSelesai || '').trim());

    if (cek.masihBaru || jamTidakBerubah) {
      // Masih baru (<24 jam), ATAU jam kerja tidak berubah -> langsung
      // terapkan perubahan, tidak perlu approval.
      sh.getRange(rowIndex, 5, 1, 3).setValues([[newData.jamMulai, newData.jamSelesai, durJam]]); // E,F,G
      sh.getRange(rowIndex, 8).setValue(newData.keterangan || ''); // H
      sh.getRange(rowIndex, 13).setValue(newData.kategoriLembur || ''); // M
      _bumpDataCacheVersion();
      return { success: true, applied: true };
    }

    // Jam kerja BERUBAH dan catatannya sudah lebih dari 24 jam -- simpan
    // sebagai pengajuan, TL yang approve.
    sh.getRange(rowIndex, 14, 1, 4).setValues([[ // kolom N-Q
      'Pending',
      JSON.stringify({ action: 'edit', jamMulai: newData.jamMulai, jamSelesai: newData.jamSelesai, totalJam: durJam, keterangan: newData.keterangan || '', kategoriLembur: newData.kategoriLembur || '' }),
      nikRequester || '', ''
    ]]);
    return { success: true, applied: false, needsApproval: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Dipanggil TL dari panel approval. keputusan: 'Disetujui' | 'Ditolak'.
// kodeCek/tanggalCek: sama seperti di approveItem() -- fingerprint
// pengaman terhadap rowIndex basi.
// workspaceKey (opsional): sama seperti di approveItem() -- departemen
// ASAL item ini. Kalau beda dari ACTIVE_WORKSPACE, approverNik wajib
// terdaftar sbg TL Lintas Departemen utk workspace tsb.
function approveEditRequest(rowIndex, keputusan, approverNik, catatan, kodeCek, tanggalCek, workspaceKey) {
  try {
    var wsKey = workspaceKey || ACTIVE_WORKSPACE;
    if (wsKey !== ACTIVE_WORKSPACE && _resolveApprovalWorkspaceKeys(approverNik).indexOf(wsKey) === -1) {
      return { success: false, error: 'Akses ditolak -- akun ini tidak terdaftar sbg TL Lintas Departemen utk departemen "' + (WORKSPACE_LABELS[wsKey] || wsKey) + '".' };
    }
    var wsId = WORKSPACE_MAP[wsKey];
    if (!wsId) return { success: false, error: 'Departemen "' + wsKey + '" belum di-provision.' };
    var ss = SpreadsheetApp.openById(wsId);
    var sh = ss.getSheetByName(SH_LEMBUR_LOG);
    if (!sh) return { success: false, error: 'Sheet tidak ditemukan' };
    if (rowIndex < 2 || rowIndex > sh.getLastRow()) return { success: false, error: 'Baris tidak valid / sudah tidak ada.' };

    if (kodeCek && tanggalCek) {
      var rowCek = sh.getRange(rowIndex, 2, 1, 2).getValues()[0]; // [Tanggal, Kode]
      var tglBarisCek = rowCek[0] ? _fmtYMD(new Date(rowCek[0])) : '';
      var kodeBarisCek = String(rowCek[1] || '');
      if (kodeBarisCek !== String(kodeCek) || tglBarisCek !== String(tanggalCek)) {
        return { success: false, error: 'Daftar approval sudah berubah (ada aksi lain yang menggeser urutan baris) -- silakan refresh panel approval, lalu coba lagi. Tidak ada data yang berubah.' };
      }
    }

    var reqDataRaw = sh.getRange(rowIndex, 15).getValue(); // kolom O
    var reqData = {};
    try { reqData = JSON.parse(reqDataRaw || '{}'); } catch (e) {}

    if (keputusan === 'Disetujui') {
      if (reqData.action === 'delete') {
        sh.deleteRow(rowIndex);
        _bumpDataCacheVersion();
        return { success: true };
      }
      if (reqData.action === 'edit') {
        sh.getRange(rowIndex, 5, 1, 3).setValues([[reqData.jamMulai, reqData.jamSelesai, reqData.totalJam]]); // E,F,G
        sh.getRange(rowIndex, 8).setValue(reqData.keterangan || ''); // H
        sh.getRange(rowIndex, 13).setValue(reqData.kategoriLembur || ''); // M
      }
      // Reset kolom pengajuan setelah diterapkan
      sh.getRange(rowIndex, 14, 1, 4).setValues([['', '', '', catatan || '']]);
      _bumpDataCacheVersion();
      return { success: true };
    }

    // ---- DITOLAK -- SAMA seperti pengajuan lembur/cuti baru: kabari
    // karyawan lewat kartu notifikasi, lalu kolom pengajuannya
    // dikosongkan TOTAL (bukan disimpan sbg "Ditolak") -- supaya tidak
    // ada jejak pengajuan yang ditolak tersimpan di mana pun. Catatan
    // lembur ASLINYA (yang mau diedit/dihapus) TETAP UTUH -- yang
    // ditolak cuma PERMINTAAN perubahannya, bukan catatan lemburnya.
    var infoBaris = sh.getRange(rowIndex, 2, 1, 3).getValues()[0]; // [Tanggal, Kode, Nama]
    var tglInfo = infoBaris[0] ? _fmtYMD(new Date(infoBaris[0])) : '';
    var kodeInfo = String(infoBaris[1] || '');
    var aksiLabel = reqData.action === 'delete' ? 'penghapusan' : 'perubahan';
    var pesanNotifEdit = 'Pengajuan ' + aksiLabel + ' catatan lembur Anda tanggal ' + tglInfo + ' ditolak. Untuk keterangan pastinya bisa ditanyakan kepada Team Leader Anda.';
    _kirimNotifikasiUser(ss, kodeInfo, pesanNotifEdit);

    sh.getRange(rowIndex, 14, 1, 4).setValues([['', '', '', '']]);
    _bumpDataCacheVersion();
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

function saveAbsensi(data) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SH_ABSENSI_LOG);
    if (!sh) return { success: false, error: 'Sheet ABSENSI_LOG belum ada. Jalankan setupLemburSheets() dulu.' };
    sh.appendRow([new Date(), data.tanggal, data.kode, data.nama || '', data.status, data.keterangan || '', data.inputOleh || '', 'Pending', '']);

    // ---- Notifikasi WhatsApp ke approver (khusus karyawan INTERNAL) ----
    // Sama seperti saveLembur() -- dibungkus try/catch sendiri supaya
    // kalau WA gagal terkirim, penyimpanan absensi TETAP dianggap sukses.
    var waNotifSent = false;
    var isInternal  = false;
    try {
      var kategori = _kategoriDariNIK(data.kode);
      isInternal = (kategori === 'Internal');
      if (isInternal) {
        waNotifSent = sendWaNotifAbsensi(data.kode, data.nama || data.kode, data.tanggal, data.status, data.keterangan || '-');
      }
    } catch (notifErr) {
      Logger.log('Gagal kirim notif WA absensi: ' + notifErr.message);
    }

    _bumpDataCacheVersion();
    return { success: true, waNotifSent: waNotifSent, isInternal: isInternal };
  } catch (err) { return { success: false, error: err.message }; }
}

// ================================================================
//  Kirim notifikasi WhatsApp (via Fonnte) ke approver ketika ada
//  input ketidakhadiran karyawan INTERNAL baru -- SAMA PERSIS pola dan
//  setup-nya dengan sendWaNotifLembur() (lihat komentar di sana),
//  cuma beda isi pesan.
// ================================================================
function sendWaNotifAbsensi(kode, nama, tanggal, status, keterangan) {
  var statusLabel = { Sakit: 'Sakit', CutiDokter: 'Cuti Dokter', CutiTahunan: 'Cuti Tahunan', Mangkir: 'Mangkir' };
  var label = statusLabel[status] || status;
  var isCuti = (status === 'CutiDokter' || status === 'CutiTahunan');

  var pesan =
    'Dengan nama ' + nama + ', NIK ' + kode + ', hari ini berhalangan ' + label +
    (keterangan && keterangan !== '-' ? ' (' + keterangan + ')' : '') + '.' +
    (isCuti ? '\n\nMohon untuk segera menginput cuti saya pada aplikasi Sunfish.' : '');

  return _fonnteKirim(kode, pesan).ok;
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
    // Sebelumnya fungsi ini TIDAK di-cache sama sekali -- setiap kali
    // Monitoring FTE dibuka, sheet LEMBUR_LOG dibaca PENUH (semua histori,
    // bukan cuma 6 bulan) via getLemburList({}). Ini salah satu penyebab
    // utama loading lama. Sekarang dicache dgn pola sama seperti
    // getAbsensiFTEData: 3 menit kalau bulan akhir = bulan berjalan, 6 jam
    // kalau bulan akhir sudah lewat, dan otomatis basi begitu ada
    // upload/edit data (lihat _getDataCacheVersion()/onEdit).
    var scriptCacheOt = CacheService.getScriptCache();
    var cacheKeyOt = 'otTrend6_' + ACTIVE_WORKSPACE + '_v' + _getDataCacheVersion() + '_' + tahunAkhir + '_' + bulanAkhir;
    var cachedOt = scriptCacheOt.get(cacheKeyOt);
    if (cachedOt) return JSON.parse(cachedOt);

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

    var hasilOt = { success: true, results: results };
    try {
      var nowOt = new Date();
      var isBulanBerjalanOt = (Number(tahunAkhir) === nowOt.getFullYear() && Number(bulanAkhir) === (nowOt.getMonth() + 1));
      scriptCacheOt.put(cacheKeyOt, JSON.stringify(hasilOt), isBulanBerjalanOt ? 180 : 21600);
    } catch (cacheErrOt) { /* gagal cache tidak masalah, tetap return data */ }
    return hasilOt;
  } catch (err) { return { success: false, error: err.message }; }
}

// ---- GRAFIK PERKEMBANGAN FTE PER BULAN (Januari - Desember) ----
// Total kirim/terima per bulan dalam 1 tahun, baca sheet SEKALI (bukan 12x readTransaksi).
// Aturan baris sama persis dengan readTransaksi().
function _fteTransaksiPerBulan(ss, sheetName, tahun) {
  var out = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return out;
  var data = sheet.getDataRange().getValues(), rucika = isRucikaFitting();
  for (var i = 1; i < data.length; i++) {
    var row = data[i], tgl = toDate(row[4]);
    if (!tgl || tgl.getFullYear() !== tahun) continue;
    if (!rucika && !getKategoriTransaksiV2(row[1], row[2], row[3])) continue;
    out[tgl.getMonth()] += parseFloat(row[5]) || 0;
  }
  return out;
}

// Satu panggilan utk grafik tahunan: FTE (karyawan internal + FTE lembur), Over Time %, jam lembur Internal/OS,
// dan produktivitas Ton/FTE tiap bulan. Bulan tanpa data lembur / belum berjalan -> adaData:false (tampil kosong).
// Catatan: jumlah karyawan = karyawan Internal aktif SAAT INI (master tidak menyimpan riwayat jumlah per bulan).
function getFTETrendTahunan(tahun) {
  try {
    var now = new Date();
    tahun = Number(tahun) || now.getFullYear();
    var cache = CacheService.getScriptCache();
    var key = 'fteYear_' + ACTIVE_WORKSPACE + '_v' + _getDataCacheVersion() + '_' + tahun;
    var hit = cache.get(key);
    if (hit) return JSON.parse(hit);

    var kar = getKaryawanList();
    if (!kar.success) return kar;
    var kodeInt = {}, kodeOS = {}, jumlahKaryawan = 0;
    kar.data.forEach(function (k) {
      if (!k.aktif) return;
      if (k.kategori === 'Internal') { kodeInt[k.kode] = 1; jumlahKaryawan++; } else kodeOS[k.kode] = 1;
    });

    var lembur = getLemburList({});
    var jamInt = [], jamOS = [], ada = [];
    for (var m = 0; m < 12; m++) { jamInt.push(0); jamOS.push(0); ada.push(false); }
    (lembur.success ? lembur.data : []).forEach(function (l) {
      var t = new Date(l.tanggal);
      if (isNaN(t.getTime()) || t.getFullYear() !== tahun) return;
      var b = t.getMonth(), jam = Number(l.totalJam) || 0;
      if (kodeInt[l.kode]) { jamInt[b] += jam; ada[b] = true; }
      else if (kodeOS[l.kode]) { jamOS[b] += jam; ada[b] = true; }
    });

    var kirim = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], terima = kirim.slice();
    try {
      var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      kirim = _fteTransaksiPerBulan(ss, SH_KIRIM, tahun);
      terima = _fteTransaksiPerBulan(ss, SH_PRODUKSI, tahun);
    } catch (e) { /* produktivitas dikosongkan, grafik FTE tetap jalan */ }

    var bulan = [];
    for (var i = 1; i <= 12; i++) {
      var future = tahun > now.getFullYear() || (tahun === now.getFullYear() && i > now.getMonth() + 1);
      if (future || !ada[i - 1]) { bulan.push({ bulan: i, adaData: false, berjalan: future }); continue; }
      var fteLembur = jumlahKaryawan > 0 ? jamInt[i - 1] / FTE_STANDAR_JAM_BULAN : 0;
      var totalFTE = jumlahKaryawan + fteLembur;
      var kt = (kirim[i - 1] + terima[i - 1]) / 2;
      var ton = totalFTE > 0 ? kt / totalFTE / 1000 : 0;
      bulan.push({
        bulan: i, adaData: true, berjalan: false,
        jumlahKaryawan: jumlahKaryawan,
        jamLemburInternal: Math.round(jamInt[i - 1] * 100) / 100,
        jamLemburOS: Math.round(jamOS[i - 1] * 100) / 100,
        fteLembur: Math.round(fteLembur * 10000) / 10000,
        totalFTE: Math.round(totalFTE * 10000) / 10000,
        overtimePct: jumlahKaryawan > 0 ? Math.round((fteLembur / jumlahKaryawan) * 10000) / 100 : 0,
        produktivitasTonFTE: kt > 0 ? Math.round(ton * 100) / 100 : null
      });
    }
    var hasil = { success: true, tahun: tahun, jumlahKaryawan: jumlahKaryawan,
      target: { overtimePctMax: 6, produktivitasTonFTE: _targetProduktivitasTonFTE() }, bulan: bulan };
    try { cache.put(key, JSON.stringify(hasil), tahun === now.getFullYear() ? 180 : 21600); } catch (e2) {}
    return hasil;
  } catch (err) { return { success: false, error: err.message }; }
}

function getAbsensiFTEData(bulan, tahun) {
  try {
    bulan = Number(bulan); tahun = Number(tahun);

    // ---- CACHE MANUAL (di dalam ACTIVE_WORKSPACE) -- terpisah dari
    // cache generik di callWithServerCache() (yang cuma 180s flat utk
    // SEMUA bulan). Di sini durasinya disesuaikan: bulan yang SUDAH
    // LEWAT datanya sudah final/tidak berubah lagi -> aman di-cache 6
    // jam (persis pola yang sudah dipakai getRekapMuatanData, supaya
    // Monitoring FTE terasa secepat Rekap Muatan waktu buka bulan lama).
    // Bulan BERJALAN tetap 3 menit saja supaya input hari ini/kemarin
    // tetap kelihatan update.
    // Cache key ikut sertakan _getDataCacheVersion() -- begitu ada
    // upload data (Stock/Outbound/Inbound) ATAU edit manual langsung
    // di salah satu sheet sumber FTE (lihat onEdit -> FTE_SOURCE_SHEETS),
    // versinya naik dan key ini otomatis basi walau TTL belum habis.
    var scriptCacheFte = CacheService.getScriptCache();
    var cacheKeyFte = 'absensiFte_' + ACTIVE_WORKSPACE + '_v' + _getDataCacheVersion() + '_' + tahun + '_' + bulan;
    var cachedFte = scriptCacheFte.get(cacheKeyFte);
    if (cachedFte) return JSON.parse(cachedFte);

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

    // ------------------------------------------------------------
    //  INSIGHT PRODUKTIVITAS -- kenapa naik/turun/melebihi target,
    //  dikaitkan dgn jam lembur & ketidakhadiran (mangkir) bulan ini.
    //  Target 62,3 Ton/FTE adalah BATAS ATAS (bukan batas bawah):
    //  angka di BAWAH/SAMA DENGAN target = Tercapai (beban kerja per
    //  FTE masih wajar). Angka yang MELEBIHI target = Tidak Tercapai
    //  (beban kerja per FTE kelebihan -- biasanya karena FTE efektif
    //  berkurang akibat lembur tinggi & banyak yang tidak hadir).
    // ------------------------------------------------------------
    var PRODUKTIVITAS_TARGET_TON_FTE = _targetProduktivitasTonFTE();
    // Target 62,3 Ton/FTE adalah BATAS BAWAH (bukan batas atas): angka
    // di BAWAH target = belum tercapai (produktivitas per FTE kurang
    // dari yang diharapkan). Angka SAMA DENGAN/DI ATAS target = tercapai.
    var produktivitasTercapai = produktivitasTonFTE >= PRODUKTIVITAS_TARGET_TON_FTE;
    var totalJamLemburSemua = Math.round((totalJamLemburInternal + totalJamLemburOS) * 100) / 100; // dipakai di tempat lain (bukan Internal saja)
    // Mangkir yang dihitung utk insight kartu Produktivitas HARUS cuma
    // karyawan Internal -- kartu ini metrik khusus karyawan, bukan OS.
    var kodeInternalSet = {};
    internalList.forEach(function (p) { kodeInternalSet[p.kode] = 1; });
    var jumlahMangkirTotal = absensi.filter(function (a) { return a.status === 'Mangkir' && kodeInternalSet[a.kode]; }).length;
    var insightProduktivitas =
      'Produktivitas bulan ini ' + (produktivitasTercapai ? 'sudah mencapai/melebihi' : 'masih di bawah') +
      ' target ' + PRODUKTIVITAS_TARGET_TON_FTE + ' Ton/FTE' + (produktivitasTercapai ? ' (baik).' : ' (belum tercapai).') + ' ' +
      'Dihitung dari rata-rata Kirim ' + Math.round(totalKirim / 10) / 100 + ' Ton & Terima ' + Math.round(totalTerima / 10) / 100 + ' Ton, dibagi ' + totalFTE + ' FTE (' + jumlahKaryawan + ' karyawan internal + ' + fteLemburTotal + ' FTE lembur dari ' + totalJamLemburInternal + ' jam). ' +
      (jumlahMangkirTotal > 0
        ? 'Ada ' + jumlahMangkirTotal + ' kali ketidakhadiran tanpa keterangan (mangkir) karyawan internal bulan ini.'
        : 'Tidak ada ketidakhadiran tanpa keterangan (mangkir) karyawan internal bulan ini.');

    var hasilFte = {
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
        jumlahBulanBerjalan: (bulan === (new Date().getMonth() + 1) && tahun === new Date().getFullYear()),
        produktivitasKgFTE: produktivitasKgFTE,
        produktivitasTonFTE: produktivitasTonFTE,
        produktivitasTarget: PRODUKTIVITAS_TARGET_TON_FTE,
        produktivitasTercapai: produktivitasTercapai,
        totalJamLemburSemua: totalJamLemburSemua,
        jumlahMangkir: jumlahMangkirTotal,
        insightProduktivitas: insightProduktivitas,
        perOrang: internalList
      },
      os: {
        jumlahOS: osList.length,
        totalJamLembur: totalJamLemburOS,
        perOrang: osList
      },
      hariLiburBulanIni: hariLiburBulanIni
    };

    // Simpan ke cache manual: 3 menit kalau bulan berjalan (data masih
    // sering berubah), 6 jam kalau bulan yang sudah lewat (final, tidak
    // berubah lagi) -- pola sama persis dgn getRekapMuatanData().
    try {
      var nowFte = new Date();
      var isBulanBerjalan = (tahun === nowFte.getFullYear() && bulan === (nowFte.getMonth() + 1));
      scriptCacheFte.put(cacheKeyFte, JSON.stringify(hasilFte), isBulanBerjalan ? 180 : 21600);
    } catch (cacheErrFte) { /* gagal cache tidak masalah, tetap return data */ }

    return hasilFte;
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
// Template SPL khusus untuk karyawan OS dari perusahaan lain (formulir beda).
// Dicocokkan lewat NAMA (tidak peduli huruf besar/kecil) atau kode PEG. Kalau mau mengganti
// template / job / bagian, ubah di sini. Template Google Dokumen harus bisa dibuka oleh akun
// yang menjalankan Apps Script, dan memakai penanda yang sama ({{JOB}}, {{BAGIAN}},
// {{PERIODE}}, {{TGL1}}..{{KET8}}, {{TTD_TL}}).
var SPL_TEMPLATE_KHUSUS = [
  { nama: /anjar\s+maulan/i, kode: '',
    docId: '1MNXzYfW_CJ9yZ_gfbciwFiiXuVMv_aOQ_W7v6IVwA_c',   // "SPL SMS" - OS PT Sarana Mitra Sempurna
    job: 'Warehouse Technician I', bagian: 'Warehouse Fitting Rucika' }
];
function _splTemplateKhusus(k) {
  for (var i = 0; i < SPL_TEMPLATE_KHUSUS.length; i++) {
    var t = SPL_TEMPLATE_KHUSUS[i];
    if ((t.kode && t.kode === k.kode) || (t.nama && t.nama.test(k.nama || ''))) return t;
  }
  return null;
}
var SPL_JOB_BAGIAN_DEFAULT = { job: 'Staff Warehouse (OS)', bagian: 'Outsourcing - PT Swakarya Insan Mandiri' };

// ================================================================
//  Helper bersama: bikin salinan template SPL yang sudah terisi data
//  lembur karyawan (dipakai oleh exportSPL & previewSPL supaya tidak
//  duplikat logic). Return { tmpDocId, k, bulanNama, totalJamLembur,
//  jumlahEntri }. HARUS di-cleanup (setTrashed) oleh pemanggil setelah
//  selesai export/convert.
// ================================================================
// ---- Job & Bagian SPL yang bisa DIATUR MANUAL lewat Panel Admin (TL/Admin/Super Admin) ----
// Disimpan di Script Properties 'SPL_JB_<workspaceKey>' = JSON { "KODE": {job, bagian} }.
// Prioritas: pengaturan manual > SPL_JOB_BAGIAN_MAP (bawaan kode) > template khusus > default.
function _splJbOverrideBaca(workspaceKey) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('SPL_JB_' + workspaceKey) || '{}') || {}; }
  catch (e) { return {}; }
}
function _splJobBagianFor(k, khusus) {
  var ov = _splJbOverrideBaca(ACTIVE_WORKSPACE)[String(k.kode).toUpperCase()];
  var dasar = SPL_JOB_BAGIAN_MAP[k.kode] || (khusus ? { job: khusus.job, bagian: khusus.bagian } : SPL_JOB_BAGIAN_DEFAULT);
  if (!ov) return dasar;
  return { job: ov.job || dasar.job, bagian: ov.bagian || dasar.bagian };
}

function adminGetSplJobBagian(actorNik, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var ov = _splJbOverrideBaca(tgt.workspaceKey), out = [];
    var sh = tgt.ss.getSheetByName(SH_KARYAWAN_LEMBUR);
    if (sh) {
      sh.getDataRange().getValues().slice(1).forEach(function (r) {
        if (!r[0]) return;
        var kode = String(r[0]).trim();
        if (_kategoriDariNIK(kode) !== 'OS') return;
        var k = { kode: kode, nama: String(r[1] || '') };
        var dasar = SPL_JOB_BAGIAN_MAP[kode] || (function () { var kh = _splTemplateKhusus(k); return kh ? { job: kh.job, bagian: kh.bagian } : SPL_JOB_BAGIAN_DEFAULT; })();
        var o = ov[kode.toUpperCase()];
        out.push({
          kode: kode, nama: k.nama, aktif: r[7] === true || String(r[7]).toUpperCase() === 'TRUE',
          job: o && o.job ? o.job : dasar.job, bagian: o && o.bagian ? o.bagian : dasar.bagian,
          manual: !!o, jobBawaan: dasar.job, bagianBawaan: dasar.bagian
        });
      });
    }
    return { success: true, data: out, workspaceKey: tgt.workspaceKey };
  } catch (err) { return { success: false, error: err.message }; }
}

// job & bagian kosong dua-duanya = hapus pengaturan manual (kembali ke bawaan)
function adminSetSplJobBagian(actorNik, kode, job, bagian, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    kode = String(kode || '').trim().toUpperCase();
    if (!kode) return { success: false, error: 'Kode karyawan wajib diisi.' };
    job = String(job || '').trim().slice(0, 80); bagian = String(bagian || '').trim().slice(0, 80);
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    var lock = LockService.getScriptLock(); lock.waitLock(15000);
    try {
      var ov = _splJbOverrideBaca(tgt.workspaceKey);
      if (!job && !bagian) delete ov[kode]; else ov[kode] = { job: job, bagian: bagian };
      PropertiesService.getScriptProperties().setProperty('SPL_JB_' + tgt.workspaceKey, JSON.stringify(ov));
    } finally { lock.releaseLock(); }
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

// Jumlah baris data di template = penanda {{TGLn}} terbesar (minimal 8, sesuai template standar)
function _splJumlahBaris(teks) {
  var m = String(teks || '').match(/\{\{TGL(\d+)\}\}/g) || [], mx = 0;
  m.forEach(function (x) { var n = Number(x.replace(/\D/g, '')); if (n > mx) mx = n; });
  return mx || 8;
}

// ---- Paraf digital Leader / Sect Head / Dept Head di formulir SPL ----
// Ukuran gambar paraf (poin) -- kolom Paraf di template sempit. Ubah di sini kalau perlu.
// SPL_PARAF_W/H = KOTAK MAKSIMUM (poin); gambar diperbesar sampai mentok salah satu sisi kotak dengan rasio aslinya.
var SPL_PARAF_W = 56, SPL_PARAF_H = 38; // bawaan; bisa diatur per departemen di Panel Admin
var _SPL_UKURAN_CACHE = null;
function _splUkuranBaca(workspaceKey) {
  try {
    var o = JSON.parse(PropertiesService.getScriptProperties().getProperty('SPL_TTD_UKURAN_' + workspaceKey) || 'null');
    if (o && o.w > 0 && o.h > 0) return { w: Math.min(200, Math.max(10, Number(o.w))), h: Math.min(120, Math.max(8, Number(o.h))) };
  } catch (e) {}
  return { w: SPL_PARAF_W, h: SPL_PARAF_H };
}
function _splUkuranAktif() { return _SPL_UKURAN_CACHE || (_SPL_UKURAN_CACHE = _splUkuranBaca(ACTIVE_WORKSPACE)); }
// w, h dalam poin (1 poin = 1/72 inci). Gambar diperbesar sampai mentok salah satu sisi kotak ini.
function adminSetSplTtdUkuran(actorNik, w, h, targetWorkspace) {
  try {
    if (!_actorIsFullAccess(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL/Admin.' };
    w = Number(w); h = Number(h);
    if (!(w >= 10 && w <= 200) || !(h >= 8 && h <= 120)) return { success: false, error: 'Lebar harus 10-200 dan tinggi 8-120 (poin).' };
    var tgt = _resolveAdminTargetSpreadsheet(actorNik, targetWorkspace);
    if (tgt.error) return { success: false, error: tgt.error };
    PropertiesService.getScriptProperties().setProperty('SPL_TTD_UKURAN_' + tgt.workspaceKey, JSON.stringify({ w: w, h: h }));
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}
// Baca lebar/tinggi PNG dari header IHDR (byte 16-23). Bukan PNG -> rasio 2:1 (default lama).
function _splUkuranGambar(blob, maxW, maxH) {
  var w = 2, h = 1;
  try {
    var b = blob.getBytes();
    if (b.length > 24 && b[1] === 80 && b[2] === 78 && b[3] === 71) {
      var u = function (o) { return ((b[o] & 255) * 16777216) + ((b[o + 1] & 255) << 16) + ((b[o + 2] & 255) << 8) + (b[o + 3] & 255); };
      var ww = u(16), hh = u(20);
      if (ww > 0 && hh > 0) { w = ww; h = hh; }
    }
  } catch (e) {}
  var sc = Math.min(maxW / w, maxH / h);
  return { w: Math.max(4, Math.round(w * sc * 10) / 10), h: Math.max(4, Math.round(h * sc * 10) / 10) };
}
// Paraf diberi ruang selebar mungkin: padding sel dikecilkan, spasi paragraf dinolkan
function _splRapatkanSel(par) {
  try {
    var cell = par.getParent();
    if (cell && cell.getType() === DocumentApp.ElementType.TABLE_CELL) {
      cell = cell.asTableCell();
      cell.setPaddingLeft(1).setPaddingRight(1).setPaddingTop(1).setPaddingBottom(1);
    }
    par.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
  } catch (e) {}
}
// Kolom Paraf di baris data template standar (11 kolom): Tanggal, Nama, SIMID, Awal, Akhir, Total,
// Karyawan(6), Leader(7), Sect Head(8), Dept Head(9), Keterangan(10).
var SPL_PARAF_KOLOM = { LEADER: 7, SECTHEAD: 8, DEPTHEAD: 9 };

function _splBarisDariPenanda(target, n) {
  try {
    var f = target.findText('\\{\\{TGL' + n + '\\}\\}');
    if (!f) return null;
    var el = f.getElement();
    while (el && el.getType() !== DocumentApp.ElementType.TABLE_ROW) el = el.getParent();
    return el ? el.asTableRow() : null;
  } catch (e) { return null; }
}

// Taruh gambar ke dalam sebuah sel tabel (rata tengah), menggantikan isi sel.
function _splGambarDiSel(cell, blob) {
  cell.clear();
  var par = cell.getChild(0).asParagraph();
  par.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  _splRapatkanSel(par);
  var uk = _splUkuranAktif(); var z = _splUkuranGambar(blob, uk.w, uk.h);
  par.insertInlineImage(0, blob).setWidth(z.w).setHeight(z.h);
}

// n = nomor baris data. Prioritas: penanda {{TTD_LEADERn}}/{{TTD_SECTn}}/{{TTD_DEPTn}} kalau ada di template;
// kalau tidak ada, pakai posisi kolom standar (baris 11 kolom). sigs = null -> semua penanda dikosongkan.
function _splTempelParafBaris(target, baris, n, sigs) {
  Object.keys(SPL_TTD_JABATAN).forEach(function (j) {
    var pola = '\\{\\{TTD_' + SPL_TTD_JABATAN[j].token + n + '\\}\\}';
    var sig = sigs && sigs[j];
    try {
      var f = target.findText(pola);
      if (f) {
        var elTxt = f.getElement();
        var par = elTxt.getParent().asParagraph(); // ambil induk SEBELUM teks dikosongkan
        elTxt.asText().deleteText(f.getStartOffset(), f.getEndOffsetInclusive());
        if (sig) { par.setAlignment(DocumentApp.HorizontalAlignment.CENTER); _splRapatkanSel(par); var uk2 = _splUkuranAktif(); var z2 = _splUkuranGambar(sig.blob, uk2.w, uk2.h); par.insertInlineImage(0, sig.blob).setWidth(z2.w).setHeight(z2.h); }
        return;
      }
      if (sig && baris && baris.getNumCells() === 11) _splGambarDiSel(baris.getCell(SPL_PARAF_KOLOM[j]), sig.blob);
    } catch (e) { /* tidak fatal: formulir tetap jadi tanpa gambar paraf di sel ini */ }
    try { target.replaceText(pola, ''); } catch (e2) {}
  });
}

function _splTempelParafHalaman(target, sigs, adaDisetujui) {
  Object.keys(SPL_TTD_JABATAN).forEach(function (j) {
    var pola = '\\{\\{TTD_' + SPL_TTD_JABATAN[j].token + '\\}\\}';
    var sig = adaDisetujui && sigs && sigs[j];
    try {
      var f = target.findText(pola);
      if (f && sig) {
        var el = f.getElement();
        var par2 = el.getParent().asParagraph();
        el.asText().deleteText(f.getStartOffset(), f.getEndOffsetInclusive());
        par2.insertInlineImage(0, sig.blob).setWidth(90).setHeight(40);
        return;
      }
    } catch (e) {}
    try { target.replaceText(pola, ''); } catch (e2) {}
  });
}

// Isi SATU halaman formulir. target = Body (halaman 1) atau elemen salinan template (halaman berikutnya).
// pageIdx menentukan lembur mana yang masuk: baris pageIdx*maxRows ... (pageIdx+1)*maxRows-1.
function _splIsiHalaman(target, ctx, pageIdx) {
  target.replaceText('\\{\\{JOB\\}\\}', ctx.jb.job);
  target.replaceText('\\{\\{BAGIAN\\}\\}', ctx.jb.bagian);
  target.replaceText('\\{\\{PERIODE\\}\\}', ctx.tahun + '/' + ctx.bulanNama);
  for (var i = 0; i < ctx.maxRows; i++) {
    var n = i + 1, idx = pageIdx * ctx.maxRows + i;
    var vTgl = '', vNama = '', vSimid = '', vAwal = '', vAkhir = '', vTotal = '', vKet = '';
    // Baris tabel untuk baris ke-n HARUS dicari SEBELUM penanda {{TGLn}} diganti (setelah diganti tak bisa dikenali lagi)
    var barisTabel = (idx < ctx.list.length && ctx.sigs) ? _splBarisDariPenanda(target, n) : null;
    var barisDisetujui = (idx < ctx.list.length) && _splBarisBertandatangan(ctx.list[idx], ctx.cutoff);
    if (idx < ctx.list.length) {
      var l = ctx.list[idx];
      var p = l.tanggal.split('-');
      vTgl = p[2] + '/' + p[1] + '/' + p[0];
      vNama = ctx.k.nama; vSimid = ctx.k.kode;
      vAwal = l.jamMulai; vAkhir = l.jamSelesai;
      // SPL menampilkan DURASI MENTAH (jam selesai - jam mulai), TANPA potongan 1 jam istirahat,
      // beda dengan l.totalJam di rekap FTE. Jadi lembur 6 jam tetap tertulis "6" di form SPL.
      var rawMin = _timeStrToMinutes(l.jamSelesai) - _timeStrToMinutes(l.jamMulai);
      if (rawMin < 0) rawMin += 24 * 60; // lembur lewat tengah malam
      vTotal = String(Math.round((rawMin / 60) * 100) / 100); vKet = l.keterangan || '';
    }
    target.replaceText('\\{\\{TGL' + n + '\\}\\}', vTgl);
    target.replaceText('\\{\\{NAMA' + n + '\\}\\}', vNama);
    target.replaceText('\\{\\{SIMID' + n + '\\}\\}', vSimid);
    target.replaceText('\\{\\{AWAL' + n + '\\}\\}', vAwal);
    target.replaceText('\\{\\{AKHIR' + n + '\\}\\}', vAkhir);
    target.replaceText('\\{\\{TOTAL' + n + '\\}\\}', vTotal);
    // replaceText() memperlakukan argumen kedua sebagai pola dengan backreference $1,$2: "$" di
    // Keterangan harus di-escape jadi "$$" supaya dianggap literal.
    target.replaceText('\\{\\{KET' + n + '\\}\\}', String(vKet).replace(/\$/g, '$$$$'));
    // Paraf digital Leader / Sect Head / Dept Head: hanya untuk lembur yang sudah DISETUJUI TL
    _splTempelParafBaris(target, barisTabel, n, barisDisetujui ? ctx.sigs : null);
  }
  // Penanda opsional di area Disetujui/Mengetahui (kalau template memasangnya): {{TTD_LEADER}}, {{TTD_SECT}}, {{TTD_DEPT}}
  _splTempelParafHalaman(target, ctx.sigs, ctx.adaDisetujui);
  // Tanda tangan digital TL di {{TTD_TL}} (kolom "Disetujui"); dipasang di setiap halaman
  if (ctx.sigBlob) {
    var foundTtd = target.findText('\\{\\{TTD_TL\\}\\}');
    if (foundTtd) {
      var elTtd = foundTtd.getElement();
      elTtd.asText().setText('');
      try {
        elTtd.getParent().asParagraph().insertInlineImage(0, ctx.sigBlob).setWidth(90).setHeight(40);
      } catch (imgErr) {
        // placeholder tidak di dalam paragraf biasa -- lewati gambar, tidak fatal.
      }
    }
  } else {
    target.replaceText('\\{\\{TTD_TL\\}\\}', '');
  }
}

function _buildSPLDocument(kode, bulan, tahun) {
  var props = PropertiesService.getScriptProperties();
  var templateDocId = props.getProperty('SPL_TEMPLATE_DOC_ID');

  var karyawanRes = getKaryawanList();
  if (!karyawanRes.success) throw new Error(karyawanRes.error);
  var k = karyawanRes.data.find(function (x) { return x.kode === kode; });
  if (!k) throw new Error('Karyawan dengan kode ' + kode + ' tidak ditemukan');
  var khusus = _splTemplateKhusus(k);
  if (khusus) templateDocId = khusus.docId;
  if (!templateDocId) throw new Error('SPL_TEMPLATE_DOC_ID belum di-set di Script Properties.');

  bulan = Number(bulan); tahun = Number(tahun);
  var bulanNamaArr = ['', 'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
  var bulanNama = bulanNamaArr[bulan];

  var lemburRes = getLemburList({ kode: kode, bulan: bulan, tahun: tahun });
  var lemburList = lemburRes.success ? lemburRes.data : [];
  lemburList.sort(function (a, b) { return a.tanggal < b.tanggal ? -1 : 1; });
  var totalJamLembur = Math.round(lemburList.reduce(function (a, l) { return a + l.totalJam; }, 0) * 100) / 100;

  var jb = _splJobBagianFor(k, khusus);

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

  // Jumlah baris data per halaman = jumlah penanda {{TGLn}} di template (default 8). Kalau lembur
  // lebih banyak dari itu, halaman formulir DITAMBAH otomatis (salinan formulir yang sama, diisi
  // baris berikutnya) sehingga tidak ada lembur yang terpotong.
  var maxRows = _splJumlahBaris(body.getText());
  var jumlahHalaman = Math.max(1, Math.ceil(lemburList.length / maxRows));

  // Tanda tangan TL (sekali ambil, dipakai di semua halaman)
  var approvedEntry = lemburList.find(function (l) { return l.approvalStatus === 'Disetujui' && l.approvedBy; });
  var sigBlob = approvedEntry ? _getTlSignatureBlob(approvedEntry.approvedBy) : null;
  // Paraf Leader / Sect Head / Dept Head yang diupload admin (dipasang untuk lembur berstatus Disetujui)
  var sigs = _getSplSignatureSet();
  if (!sigBlob && approvedEntry && sigs.LEADER) sigBlob = sigs.LEADER.blob; // cadangan utk kotak "Disetujui" kalau TL approver belum upload TTD sendiri
  var ctx = { jb: jb, k: k, tahun: tahun, bulanNama: bulanNama, list: lemburList, maxRows: maxRows, sigBlob: sigBlob, sigs: sigs, adaDisetujui: !!approvedEntry, cutoff: _splTtdCutoffBaca(ACTIVE_WORKSPACE) };

  // Salinan isi template yang masih polos, bahan untuk halaman ke-2 dan seterusnya
  var polos = [];
  if (jumlahHalaman > 1) for (var ci = 0; ci < body.getNumChildren(); ci++) polos.push(body.getChild(ci).copy());

  _splIsiHalaman(body, ctx, 0);

  for (var pg = 1; pg < jumlahHalaman; pg++) {
    // page break diletakkan DI DALAM paragraf penutup halaman sebelumnya (bukan paragraf baru),
    // supaya tidak muncul halaman kosong di antara dua formulir
    var lastChild = body.getChild(body.getNumChildren() - 1);
    if (lastChild.getType() === DocumentApp.ElementType.PARAGRAPH) lastChild.asParagraph().appendPageBreak();
    else body.appendPageBreak();
    for (var pi = 0; pi < polos.length; pi++) {
      // WAJIB .copy() baru tiap halaman: append*() memakai elemen itu sendiri, jadi elemen yang sudah menempel di dokumen tidak boleh dipakai lagi
      // (halaman ke-3 dst. sebelumnya error "Elemen harus dilepas / Element must be detached" -> print & download SPL gagal utk karyawan berlembur banyak).
      var el = polos[pi].copy(), added = null, T = DocumentApp.ElementType;
      switch (el.getType()) {
        case T.PARAGRAPH: added = body.appendParagraph(el.asParagraph()); break;
        case T.TABLE: added = body.appendTable(el.asTable()); break;
        case T.LIST_ITEM: added = body.appendListItem(el.asListItem()); break;
        case T.HORIZONTAL_RULE: added = body.appendHorizontalRule(); break;
        default: break;
      }
      if (added) _splIsiHalaman(added, ctx, pg);
    }
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


// ================================================================
//  SPL PDF CEPAT (hasil IDENTIK dengan Google Dokumen)
//  Hasil print memakai PDF asli dari template Google Dokumen (logo SIM, tabel, tanda tangan),
//  bukan cetakan buatan ulang. Supaya klik Print langsung muncul, PDF yang sudah jadi disimpan
//  di folder Drive "SPL_CACHE" dengan nama berisi sidik jari data (lembur, job, template, TTD).
//  Selama data tidak berubah, permintaan berikutnya hanya membaca file (~1 detik). Begitu data
//  lembur berubah, sidik jari berubah sehingga PDF dibuat ulang, dan file lama dibuang.
//  Halaman Monitoring FTE meminta PDF semua karyawan OS di latar belakang saat dibuka.
// ================================================================
function _splCacheFolder() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPL_CACHE_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName('SPL_CACHE');
  var f = it.hasNext() ? it.next() : DriveApp.createFolder('SPL_CACHE');
  props.setProperty('SPL_CACHE_FOLDER_ID', f.getId());
  return f;
}
function _splSig(kode, bulan, tahun) {
  var kr = getKaryawanList();
  var k = kr.success ? kr.data.find(function (x) { return x.kode === kode; }) : null;
  if (!k) throw new Error('Karyawan dengan kode ' + kode + ' tidak ditemukan');
  var kh = _splTemplateKhusus(k);
  var tpl = kh ? kh.docId : (PropertiesService.getScriptProperties().getProperty('SPL_TEMPLATE_DOC_ID') || '');
  var jb = _splJobBagianFor(k, kh);
  var lr = getLemburList({ kode: kode, bulan: Number(bulan), tahun: Number(tahun) });
  var rows = (lr.success ? lr.data : []).map(function (l) {
    return [l.tanggal, l.jamMulai, l.jamSelesai, l.keterangan || '', l.approvalStatus || '', l.approvedBy || '', l.timestamp || ''].join('~');
  }).sort().join('|');
  var co = _splTtdCutoffBaca(ACTIVE_WORKSPACE);
  var raw = [tpl, jb.job, jb.bagian, k.nama, rows, _splTtdSidik(), co ? co.getTime() : 0, JSON.stringify(_splUkuranBaca(ACTIVE_WORKSPACE)), 'v7-ukuran'].join('##');
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8);
  return { sig: d.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 12), k: k };
}
function getSPLPdfCepat(kode, bulan, tahun) {
  try {
    bulan = Number(bulan); tahun = Number(tahun);
    var info = _splSig(kode, bulan, tahun);
    var prefix = 'SPL_' + kode + '_' + tahun + ('0' + bulan).slice(-2) + '_';
    var name = prefix + info.sig + '.pdf';
    var folder = _splCacheFolder();
    var hit = folder.getFilesByName(name);
    if (hit.hasNext()) {
      var f = hit.next();
      return { success: true, cached: true, filename: name, base64: Utilities.base64Encode(f.getBlob().getBytes()), peringatan: _splPeringatanTtd(kode, bulan, tahun) };
    }
    var r = previewSPL(kode, bulan, tahun);
    if (!r.success) return r;
    // buang PDF lama untuk karyawan & periode yang sama (data sudah berubah), lalu simpan yang baru
    var old = folder.searchFiles("title contains '" + prefix + "'");
    while (old.hasNext()) { try { old.next().setTrashed(true); } catch (e) {} }
    folder.createFile(Utilities.newBlob(Utilities.base64Decode(r.base64), 'application/pdf', name));
    r.cached = false; r.filename = name; r.peringatan = _splPeringatanTtd(kode, bulan, tahun);
    return r;
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
//  AKURASI SCAN BARCODE -- penyimpanan bersama
//  Sheet AKURASI_DATA: A=kind (voucher|std|bfl|ter), B=part, C=potongan JSON
//  Satu sel maksimal 50.000 karakter, jadi JSON dipotong 40.000 karakter.
//  Dipakai halaman Upload Data Harian (tab Akurasi Scan) untuk menulis dan
//  halaman Monitoring > Akurasi Scan Barcode untuk membaca, sehingga data
//  yang sama tampil di PC / akun mana pun (per workspace).
// ================================================================
var SH_AKURASI = 'AKURASI_DATA';
var AKURASI_KINDS = { voucher: 1, std: 1, bfl: 1, ter: 1, alasan: 1, trx: 1 };
var AKURASI_CHUNK = 40000;

function _getOrCreateAkurasiSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_AKURASI);
  if (!sh) {
    sh = ss.insertSheet(SH_AKURASI);
    sh.getRange('A1:C1').setValues([['kind', 'part', 'json']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

// ---- Akurasi: data GABUNGAN lintas departemen (hanya baca) ----
// Tampilan Akurasi Scan menyatukan Fitting Import dan Fitting Rucika, sedangkan UPLOAD tetap
// dipisah: tiap departemen menyimpan di spreadsheet-nya sendiri (sheet AKURASI_DATA).
var AKURASI_WS = ['cibitung_fitting_import', 'cibitung_fitting_rucika'];
function _akurasiBacaDariSS(ss) {
  var sh = ss.getSheetByName(SH_AKURASI), out = {};
  if (!sh) return out;
  var last = sh.getLastRow();
  if (last < 2) return out;
  var by = {};
  sh.getRange(2, 1, last - 1, 3).getValues().forEach(function (r) {
    var k = String(r[0] || '');
    if (!AKURASI_KINDS[k]) return;
    (by[k] = by[k] || []).push({ part: Number(r[1]) || 0, txt: String(r[2] || '') });
  });
  Object.keys(by).forEach(function (k) {
    by[k].sort(function (a, b) { return a.part - b.part; });
    try { out[k] = JSON.parse(by[k].map(function (x) { return x.txt; }).join('')); } catch (e) { out[k] = null; }
  });
  return out;
}
function getAkurasiDataGabungan() {
  try {
    var out = {};
    AKURASI_WS.forEach(function (ws) {
      var id = resolveWorkspaceSpreadsheetId(ws);
      if (!id) return;
      try { out[ws] = _akurasiBacaDariSS(SpreadsheetApp.openById(id)); } catch (e) { out[ws] = {}; }
    });
    return { success: true, data: out };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  }
}

function getAkurasiData() {
  try {
    var sh = _getOrCreateAkurasiSheet();
    var last = sh.getLastRow();
    var out = {};
    if (last >= 2) {
      var vals = sh.getRange(2, 1, last - 1, 3).getValues();
      var by = {};
      vals.forEach(function (r) {
        var k = String(r[0] || '');
        if (!AKURASI_KINDS[k]) return;
        (by[k] = by[k] || []).push({ part: Number(r[1]) || 0, txt: String(r[2] || '') });
      });
      Object.keys(by).forEach(function (k) {
        by[k].sort(function (a, b) { return a.part - b.part; });
        try { out[k] = JSON.parse(by[k].map(function (x) { return x.txt; }).join('')); }
        catch (e) { out[k] = null; }
      });
    }
    return { success: true, data: out };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  }
}

// kind: voucher|std|bfl|ter ; jsonStr: seluruh dataset terbaru (sudah digabung di browser)
function saveAkurasiData(kind, jsonStr, force) {
  var lock = LockService.getScriptLock();
  try {
    kind = String(kind || '');
    if (!AKURASI_KINDS[kind]) return { success: false, error: 'Jenis data tidak dikenal: ' + kind };
    jsonStr = String(jsonStr || '');
    if (!jsonStr) return { success: false, error: 'Data kosong' };
    JSON.parse(jsonStr); // validasi
    lock.waitLock(25000);
    var sh = _getOrCreateAkurasiSheet();
    // Standar Isi Box bersifat PERMANEN: kalau sudah ada, tidak boleh ditimpa
    // kecuali permintaan membawa force (konfirmasi eksplisit dari halaman upload).
    if (kind === 'std' && !Number(force) && _akurasiAda(sh, kind)) {
      return { success: false, error: 'Standar Isi Box sudah ada dan bersifat permanen.' };
    }
    _akurasiHapusKind(sh, kind);
    var rows = [];
    for (var i = 0, n = 0; i < jsonStr.length; i += AKURASI_CHUNK, n++) {
      rows.push([kind, n, jsonStr.substr(i, AKURASI_CHUNK)]);
    }
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, rows.length, 3).setNumberFormat('@').setValues(rows);
    return { success: true, parts: rows.length, bytes: jsonStr.length };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function hapusAkurasiData(kind) {
  var lock = LockService.getScriptLock();
  try {
    kind = String(kind || '');
    if (!AKURASI_KINDS[kind]) return { success: false, error: 'Jenis data tidak dikenal: ' + kind };
    lock.waitLock(25000);
    _akurasiHapusKind(_getOrCreateAkurasiSheet(), kind);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function _akurasiAda(sh, kind) {
  var last = sh.getLastRow();
  if (last < 2) return false;
  var col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) if (String(col[i][0]) === kind) return true;
  return false;
}

function _akurasiHapusKind(sh, kind) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var col = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = col.length - 1; i >= 0; i--) {   // dari bawah supaya index tidak bergeser
    if (String(col[i][0]) === kind) sh.deleteRow(i + 2);
  }
}


// ================================================================
//  AKURASI SCAN -- ALASAN item yang belum ter-scan
//  Disimpan sebagai kind 'alasan' di sheet AKURASI_DATA: { map: { kunci: {r,t,by,at,iso} } }
//  kunci: in:<voucher> | bfl:<voucher> | out:<spm>|<item>|<qty>|<n> | outspm:<spm>
//  Diubah per entri (bukan menimpa seluruh data) supaya beberapa orang yang mengisi
//  alasan bersamaan tidak saling menimpa. r kosong = hapus alasan.
// ================================================================
function simpanAkurasiAlasan(payloadStr) {
  var lock = LockService.getScriptLock();
  try {
    var p = JSON.parse(String(payloadStr || '{}'));
    var entries = p.entries || [];
    if (!entries.length) return { success: false, error: 'Tidak ada alasan yang dikirim' };
    lock.waitLock(25000);
    // Tampilan menyatukan 2 departemen, jadi alasan ditulis ke spreadsheet departemen PEMILIK
    // datanya (entry.dept). Tanpa dept = departemen akun yang sedang login.
    var groups = {};
    entries.forEach(function (e) {
      var ws = (e.dept && AKURASI_WS.indexOf(e.dept) !== -1) ? e.dept : ACTIVE_WORKSPACE;
      (groups[ws] = groups[ws] || []).push(e);
    });
    var at = '', count = 0;
    Object.keys(groups).forEach(function (ws) {
      var id = (ws === ACTIVE_WORKSPACE) ? SPREADSHEET_ID : resolveWorkspaceSpreadsheetId(ws);
      if (!id) throw new Error('Spreadsheet departemen ' + ws + ' belum tersedia');
      var r = _akurasiUpsertAlasan(SpreadsheetApp.openById(id), groups[ws], p.by);
      at = r.at; count += r.count;
    });
    return { success: true, at: at, count: count };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}
function _akurasiUpsertAlasan(ss, entries, by) {
  var sh = ss.getSheetByName(SH_AKURASI);
  if (!sh) {
    sh = ss.insertSheet(SH_AKURASI);
    sh.getRange('A1:C1').setValues([['kind', 'part', 'json']]);
    sh.setFrozenRows(1);
  }
  var obj = { map: {} };
  var last = sh.getLastRow();
  if (last >= 2) {
    var parts = [];
    sh.getRange(2, 1, last - 1, 3).getValues().forEach(function (r) {
      if (String(r[0]) === 'alasan') parts.push({ part: Number(r[1]) || 0, txt: String(r[2] || '') });
    });
    if (parts.length) {
      parts.sort(function (a, b) { return a.part - b.part; });
      try { obj = JSON.parse(parts.map(function (x) { return x.txt; }).join('')) || { map: {} }; } catch (e) { obj = { map: {} }; }
    }
  }
  obj.map = obj.map || {};
  var now = new Date();
  var at = Utilities.formatDate(now, 'Asia/Jakarta', 'd MMM yyyy, HH:mm');
  var iso = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy-MM-dd');
  entries.forEach(function (e) {
    var k = String(e.key || '');
    if (!k) return;
    if (!e.r) { delete obj.map[k]; return; }
    obj.map[k] = { r: String(e.r).slice(0, 80), t: String(e.t || '').slice(0, 200), by: String(by || '').slice(0, 60), at: at, iso: iso };
  });
  var json = JSON.stringify(obj);
  _akurasiHapusKind(sh, 'alasan');
  var rows = [];
  for (var i = 0, n = 0; i < json.length; i += AKURASI_CHUNK, n++) rows.push(['alasan', n, json.substr(i, AKURASI_CHUNK)]);
  var start = sh.getLastRow() + 1;
  sh.getRange(start, 1, rows.length, 3).setNumberFormat('@').setValues(rows);
  return { at: at, count: Object.keys(obj.map).length };
}


// Diagnosa: jalankan dari editor Apps Script untuk melacak kenapa satu nopol menampilkan tujuan yang salah.
// Mencetak (Logger) semua baris PENGIRIMAN yang memuat nopol / SPM tsb, dan apa yang dibaca dari sumber
// jadwal untuk tanggal-tanggal terkait. Contoh: diagNopolPengiriman('L 9197 UT', ['13/10/2026','14/10/2026'])
// Tombol "Jalankan" di editor Apps Script memanggil fungsi TANPA argumen, jadi pilih fungsi ini di dropdown
// lalu klik Jalankan. Ubah nopol / tanggal di bawah kalau perlu, lalu buka "Log eksekusi".
function diagNopolL9197UT() {
  diagNopolPengiriman('L 9197 UT', ['13/10/2026', '14/10/2026']);
}

function diagNopolPengiriman(nopolAtauSpm, tanggalList) {
  if (nopolAtauSpm == null) { Logger.log('Isi nopol/SPM. Cara paling mudah: jalankan diagNopolL9197UT() atau salin pola fungsi itu.'); return; }
  var q = String(nopolAtauSpm || '').replace(/\s+/g, '').toUpperCase();
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID), sh = ss.getSheetByName(SH_PENGIRIMAN);
  var data = sh.getDataRange().getValues();
  Logger.log('=== Baris di sheet PENGIRIMAN yang memuat "' + nopolAtauSpm + '" ===');
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var hay = (String(r[5] || '') + String(r[4] || '')).replace(/\s+/g, '').toUpperCase();
    if (!q || hay.indexOf(q) === -1) continue;
    var t = _tglPengiriman(r[0]);
    Logger.log('baris ' + (i + 1) + ' | tgl ' + (t ? _fmtYMD(t) : '(kosong)') + ' | agen ' + r[1] + ' | SPM ' + r[4] + ' | nopol ' + r[5] + ' | mulai ' + _fmtTime(r[7]) + ' | selesai ' + _fmtTime(r[8]) + ' | status ' + r[9]);
  }
  (tanggalList || []).forEach(function (tg) {
    try {
      var b = _bacaJadwalPPRDariSumber(_parseTanggalFleksibel(tg));
      Logger.log('=== Sumber jadwal ' + tg + ': ' + (b.success ? b.data.length + ' SPM' : b.error));
      if (b.success) b.data.forEach(function (x) {
        var hay = (String(x.nopol || '') + String(x.spm || '')).replace(/\s+/g, '').toUpperCase();
        if (!q || hay.indexOf(q) !== -1) Logger.log('  SPM ' + x.spm + ' | nama ' + x.nama + ' | nopol ' + x.nopol);
      });
    } catch (e) { Logger.log('gagal baca sumber ' + tg + ': ' + e.message); }
  });
}


// ================================================================
//  STOCK OPNAME (SO) -- Monitoring, Lembar SO per PIC, Pengisian,
//  Selisih + Close, Rekap PIC.
//  Sheet yang dipakai (otomatis dibuat di spreadsheet departemen):
//    SO_MASTER : daftar PIC x Group SO + target durasi
//    SO_LEMBAR : 1 baris per lembar SO (hasil upload QAD)
//    SO_DETAIL : 1 baris per item di lembar (sistem, fisik, selisih)
//  Item yg boleh masuk lembar = item yang ADA di sheet per-group
//  (sheet bernama sama dgn kode group, mis. "I053"). Item lain dibuang.
//  Group dgn Mode MINGGUAN (mis. I053 - Saepul Ganni) target per minggu.
// ================================================================
var SO_MASTER_HDR = ['PIC', 'Group', 'Deskripsi', 'Target Durasi', 'Hari', 'Mode'];
var SO_LEMBAR_HDR = ['ID', 'PIC', 'Group', 'Dibuat', 'Mulai', 'Akhir', 'Dibuat Oleh', 'Jumlah Item'];
var SO_DETAIL_HDR = ['LembarID', 'Item', 'Deskripsi', 'UM', 'Lokasi', 'Sistem', 'Fisik', 'Selisih',
                     'Tgl Isi', 'Diisi Oleh', 'Status Selisih', 'Keterangan', 'Tgl Close', 'Close Oleh', 'Alasan Close', 'Konfirmasi',
                     'Tgl Data', 'Mode'];  // Tgl Data = tanggal qty sistem diambil dari QAD; Mode = '' | 'CARRY' (sisa periode lalu) | 'HOLD' (terkunci sampai CARRY selesai)
var SO_MASTER_SEED = [
  ['SAEPUL GANNI', 'I053', 'PIPA PPR RKG', '1 WEEK (1 MONTH)', 30, 'MINGGUAN'],
  ['DONI/IMAN', 'P010', 'FITTING PE-100', '3 MONTH', 90, 'BULANAN'],
  ['SULISTIYO', 'P053', 'FITTING KINDRACO', '3 MONTH', 90, 'BULANAN'],
  ['SULISTIYO', 'R051', 'GLUE CLEANER', '3 MONTH', 90, 'BULANAN'],
  ['SULISTIYO', 'KELOX DFR', 'KELOX', '1 MONTH', 30, 'BULANAN'],
  ['SULISTIYO', 'S010', 'LUBRICANT', '1 MONTH', 30, 'BULANAN'],
  ['SULISTIYO', 'I070', 'PIPA PPR GREY', '3 MONTH', 90, 'BULANAN'],
  ['SULISTIYO', 'M010', 'RUCIKA SAFE', '1 MONTH', 30, 'BULANAN'],
  ['SULISTIYO', 'X053', 'VALSIR (LEM)', '3 MONTH', 90, 'BULANAN'],
  ['IVAN REYNATA', 'Z073', 'PIPA TRC & JACKING', '3 MONTH', 90, 'BULANAN'],
  ['IVAN REYNATA', 'M000', 'WAVINSAFE IM', '3 MONTH', 90, 'BULANAN'],
  ['IVAN REYNATA', 'Z071', 'ANEKA PRATAMA', '3 MONTH', 90, 'BULANAN'],
  ['IVAN REYNATA', 'Z070', 'PEMBELIAN', '3 MONTH', 90, 'BULANAN'],
  ['IVAN REYNATA', 'Z072', 'FITTING EXOPLASS', '3 MONTH', 90, 'BULANAN'],
  ['IVAN REYNATA', 'L010', 'WAVINLOK', '3 MONTH', 90, 'BULANAN'],
  ['WANG SUTRISNO', 'M050', 'VDL', '3 MONTH', 90, 'BULANAN'],
  ['WANG SUTRISNO', 'M051', 'NINGBO', '3 MONTH', 90, 'BULANAN'],
  ['WANG SUTRISNO', 'N051', 'RUCIKA LITE OSTENDORF', '3 MONTH', 90, 'BULANAN'],
  ['WANG SUTRISNO', 'Q052', 'PILSA', '3 MONTH', 90, 'BULANAN'],
  ['WANG SUTRISNO', 'Q054', 'PILSA GN', '3 MONTH', 90, 'BULANAN'],
  ['WANG SUTRISNO', 'Q050', 'WAVIN EKOPLASTIK', '3 MONTH', 90, 'BULANAN'],
  ['WANG SUTRISNO', 'Q051', 'WAVIN', '3 MONTH', 90, 'BULANAN'],
  ['WANG SUTRISNO', 'AQUACELL', 'PLANT KARAWANG', '3 MONTH', 90, 'BULANAN'],
  ['WANG SUTRISNO', 'Q055', 'FITTING RKG', '1 MONTH', 30, 'BULANAN'],
  ['WANG SUTRISNO', 'H050', 'WELDING MECHINE', '1 MONTH', 30, 'BULANAN'],
  ['DONI & IMAN', 'LG20', 'MAEZAWA', '3 MONTH', 90, 'BULANAN'],
  ['DONI & IMAN', 'T050', 'AQUACELL', '3 MONTH', 90, 'BULANAN'],
  ['DONI & IMAN', 'T051', 'QUICKSTREAM', '3 MONTH', 90, 'BULANAN'],
  ['DONI & IMAN', 'T053', 'BLUCHER', '3 MONTH', 90, 'BULANAN'],
  ['DONI & IMAN', 'Q070', 'FITTING KELEN GREY', '1 MONTH', 30, 'BULANAN'],
  ['DONI & IMAN', 'T054', 'SYFON CBT & DFR', '1 MONTH', 30, 'BULANAN'],
  ['DONI & IMAN', 'Y051', 'KELOX DFR', '1 MONTH', 30, 'BULANAN'],
  ['IVAN REYNATA', 'K053', 'FAUCET POLE', '3 MONTH', 90, 'BULANAN'],
  ['DONI & IMAN', 'KELOX', 'RUCIKA DFR', '1 MONTH', 30, 'BULANAN']
];

// Sheet "FORM SO" (berisi sheet per-group) -- dipakai untuk Fitting Import; departemen lain pakai spreadsheet-nya sendiri.
var SO_SPREADSHEET_ID = '1vb9HGqNU8_wsocBzz8RveOtIzc82K1RUmF-lKXIb7k4';
var _SO_MEM = {}; // memo per-eksekusi (tiap request = eksekusi baru), supaya spreadsheet/sheet tidak dibuka berulang
function _soSS() {
  if (!_SO_MEM.ss) _SO_MEM.ss = SpreadsheetApp.openById(ACTIVE_WORKSPACE === 'cibitung_fitting_import' ? SO_SPREADSHEET_ID : SPREADSHEET_ID);
  return _SO_MEM.ss;
}
function _soSheetByKey(group) {
  if (!_SO_MEM.tabs) { _SO_MEM.tabs = {}; _soSS().getSheets().forEach(function (sh) { var k = _soKey(sh.getName()); if (!_SO_MEM.tabs[k]) _SO_MEM.tabs[k] = sh; }); }
  return _SO_MEM.tabs[_soKey(group)] || null;
}
function _soKey(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function _soSheet(name, hdr, seed) {
  if (_SO_MEM['sh_' + name]) return _SO_MEM['sh_' + name];
  var ss = _soSS();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, hdr.length).setValues([hdr]).setFontWeight('bold').setBackground('#cfe2f3');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, 2000, hdr.length).setNumberFormat('@');
    if (seed && seed.length) sh.getRange(2, 1, seed.length, hdr.length).setValues(seed);
  }
  var hk = 'SOH_' + ACTIVE_WORKSPACE + '_' + name + '_' + hdr.length, hc = CacheService.getScriptCache(), hOk = false;
  try { hOk = !!hc.get(hk); } catch (e) {}
  if (!hOk) {
    if (sh.getMaxColumns() < hdr.length) sh.insertColumnsAfter(sh.getMaxColumns(), hdr.length - sh.getMaxColumns());
    var hv = sh.getRange(1, 1, 1, hdr.length).getValues()[0]; // sheet lama: tambahkan SEMUA kolom baru yang headernya masih kosong
    for (var hi = 0; hi < hdr.length; hi++) {
      if (hv[hi] === '' || hv[hi] == null) {
        sh.getRange(1, hi + 1).setValue(hdr[hi]).setFontWeight('bold').setBackground('#cfe2f3');
        sh.getRange(2, hi + 1, Math.max(1, sh.getMaxRows() - 1), 1).setNumberFormat('@');
      }
    }
    try { hc.put(hk, '1', 21600); } catch (e) {}
  }
  _SO_MEM['sh_' + name] = sh;
  return sh;
}
// Sel tanggal di sheet SO kadang diubah Google Sheets jadi tipe Date (muncul "Mon Oct 19 2026 00:00:00 GMT+0700").
// Selalu normalkan ke 'yyyy-MM-dd' supaya perbandingan tanggal (minggu ini, terlambat, dst) tidak meleset.
function _soTgl(v) {
  var tz = Session.getScriptTimeZone();
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, tz, 'yyyy-MM-dd');
  var s = String(v == null ? '' : v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/GMT|UTC|^[A-Za-z]{3} [A-Za-z]{3} \d/.test(s)) { var d = new Date(s); if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, 'yyyy-MM-dd'); }
  return s;
}
function _soRows(sh, nCols) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, nCols).getValues();
}
function _soToday() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function _soAddDays(iso, n) {
  var p = iso.split('-'); var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function _soDiffDays(a, b) { // b - a (hari)
  var pa = a.split('-'), pb = b.split('-');
  return Math.round((new Date(+pb[0], +pb[1] - 1, +pb[2]) - new Date(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
}
function _soMonday(iso) {
  var p = iso.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
  var dow = (d.getDay() + 6) % 7; // Senin = 0
  return _soAddDays(iso, -dow);
}
function _soNorm(s) { return String(s == null ? '' : s).trim().toUpperCase(); }

// Item yg terdaftar di sheet per-group (sheet bernama kode group).
function _soGroupItemMap(group) {
  var sh = _soSheetByKey(group);
  var map = {};
  if (!sh || sh.getLastRow() < 1) return { found: !!sh, map: map };
  var vals = sh.getDataRange().getValues();
  var col = 0, start = 0;
  for (var r = 0; r < Math.min(vals.length, 6); r++) { // cari header kolom item
    for (var c = 0; c < vals[r].length; c++) {
      if (/^(item|kode|part|material|sku)/i.test(String(vals[r][c]).trim())) { col = c; start = r + 1; r = 99; break; }
    }
  }
  for (var i = start; i < vals.length; i++) {
    var code = _soNorm(vals[i][col]);
    if (code) map[code] = String(vals[i][col + 1] || '').trim();
  }
  return { found: true, map: map };
}

// Jumlah SKU per group. TIDAK dihitung saat dashboard dimuat (lambat: baca puluhan sheet) --
// dashboard hanya membaca cache; frontend memanggil soGetSkuCounts di latar belakang.
function _soCountsCached() {
  try { var v = CacheService.getScriptCache().get('SOCNT_' + ACTIVE_WORKSPACE); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function soGetSkuCounts(force) {
  try {
    if (!force) { var hit = _soCountsCached(); if (hit) return { success: true, counts: hit }; }
    var counts = {};
    soGetMaster().data.forEach(function (m) {
      var key = _soKey(m.group), sh = _soSheetByKey(m.group), n = 0;
      if (sh && sh.getLastRow() > 0) {
        var v = sh.getDataRange().getValues(), col = 0, start = 0;
        outer: for (var r = 0; r < Math.min(v.length, 6); r++) for (var c = 0; c < Math.min(v[r].length, 8); c++) {
          if (/^(item|kode|part|material|sku)/i.test(String(v[r][c]).trim())) { col = c; start = r + 1; break outer; }
        }
        for (var i = start; i < v.length; i++) if (String(v[i][col]).trim()) n++;
      }
      counts[key] = n;
    });
    try { CacheService.getScriptCache().put('SOCNT_' + ACTIVE_WORKSPACE, JSON.stringify(counts), 10800); } catch (e) {}
    return { success: true, counts: counts };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// Sumber master = sheet DASHBOARD di file FORM SO (kolom NAMA PIC / GROUP / DESKRIPSI / TARGET DURASI SO),
// jadi perubahan di sheet itu otomatis ikut. Jika tidak ada -> sheet SO_MASTER (seed).
function _soMasterFromDashboard() {
  var sh = _soSheetByKey('DASHBOARD');
  if (!sh || sh.getLastRow() < 2) return null;
  var v = sh.getDataRange().getValues(), hr = -1, cp = -1, cg = -1, cd = -1, ct = -1;
  for (var r = 0; r < Math.min(v.length, 30) && hr < 0; r++) {
    for (var c = 0; c < v[r].length; c++) if (/^nama\s*pic/i.test(String(v[r][c]).trim())) { hr = r; cp = c; break; }
  }
  if (hr < 0) return null;
  v[hr].forEach(function (h, c) {
    h = String(h).trim();
    if (/^group/i.test(h)) cg = c; else if (/^deskripsi/i.test(h)) cd = c; else if (/^target\s*durasi/i.test(h)) ct = c;
  });
  if (cg < 0) return null;
  var out = [], seen = {};
  for (var i = hr + 1; i < v.length; i++) {
    var pic = String(v[i][cp]).trim(), grp = String(v[i][cg]).trim();
    if (!grp || !pic || seen[_soKey(grp)]) continue;
    seen[_soKey(grp)] = 1;
    var label = ct >= 0 ? String(v[i][ct]).trim().toUpperCase() : '3 MONTH', mm = label.match(/(\d+)\s*(MONTH|BULAN)/);
    out.push({ pic: pic, group: grp, desc: cd >= 0 ? String(v[i][cd]).replace(/[()]/g, '').trim() : '', targetLabel: label,
      hari: mm ? Number(mm[1]) * 30 : 30, mode: /WEEK|MINGGU/.test(label) ? 'MINGGUAN' : 'BULANAN' });
  }
  return out;
}

// Pemetaan akun login -> PIC (jika nama akun tidak mirip nama PIC). Isi sheet SO_AKUN: kolom A = NIK atau Nama akun, B = nama PIC.
function _soAkunMap() {
  return _soRows(_soSheet('SO_AKUN', ['Akun (NIK / Nama)', 'PIC']), 2).filter(function (r) { return r[0] && r[1]; })
    .map(function (r) { return { akun: String(r[0]), pic: String(r[1]) }; });
}

// Group SO WMS (I053 & Q055) dipaksa mode periode 2 mingguan; group lain mengikuti sheet DASHBOARD / SO_MASTER.
function soGetMaster() {
  var r = _soGetMasterRaw();
  if (!r || !r.success) return r;
  return { success: true, sumber: r.sumber, data: r.data.map(function (m) {
    if (!_so2Minggu(m.group)) return m;
    var c = {}; for (var k in m) c[k] = m[k]; c.mode = 'MINGGUAN'; c.targetLabel = '2 WEEK (2x / BULAN)'; c.hari = SO_PERIODE_HARI; return c;
  }) };
}
function _soGetMasterRaw() {
  if (_SO_MEM.master) return _SO_MEM.master;
  try {
    var dm = _soMasterFromDashboard();
    if (dm && dm.length) return (_SO_MEM.master = { success: true, sumber: 'DASHBOARD', data: dm });
    var shM = _soSheet('SO_MASTER', SO_MASTER_HDR, SO_MASTER_SEED);
    var rows = _soRows(shM, 6);
    var have = {}; rows.forEach(function (r) { have[_soKey(r[1])] = 1; });
    var add = SO_MASTER_SEED.filter(function (r) { return !have[_soKey(r[1])]; }); // lengkapi group yg belum ada
    if (add.length) { shM.getRange(rows.length + 2, 1, add.length, 6).setNumberFormat('@').setValues(add); rows = rows.concat(add); }
    return (_SO_MEM.master = { success: true, data: rows.filter(function (r) { return r[1]; }).map(function (r) {
      return { pic: String(r[0]), group: String(r[1]), desc: String(r[2]), targetLabel: String(r[3]), hari: Number(r[4]) || 30, mode: String(r[5] || 'BULANAN').toUpperCase() };
    }) });
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// Daftar kode item di sheet group (preview sebelum buat lembar). Sheet tidak ada -> found:false (tetap boleh lanjut)
function soGetGroupItems(group) {
  try {
    var g = _soGroupItemMap(group);
    return { success: true, found: g.found, items: g.map };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// ID lembar harus unik (mencegah item dua lembar tercampur bila dibuat di detik yang sama)
function _soUniqueId(base, existing) {
  var id = base, n = 2;
  while (existing.indexOf(id) >= 0) id = base + '-' + (n++);
  return id;
}
// Lembar terakhir group itu, dianggap aktif selama periodenya belum lewat (termasuk lembar periode berikutnya yg dibuat otomatis)
function _soLembarAktif(group) {
  var today = _soToday();
  var mine = _soLembarList().filter(function (l) { return _soNorm(l.group) === _soNorm(group); });
  var cur = mine.length ? mine[mine.length - 1] : null;
  return (cur && today <= cur.akhir) ? cur : null;
}
function soGetLembarAktif(group) {
  try {
    var l = _soLembarAktif(group), items = {};
    if (l) _soDetailRows().forEach(function (d) { if (d.lembar === l.id) items[_soNorm(d.item)] = { fisik: d.fisik, sistem: d.sistem }; });
    var sisa = null, info = l ? null : _soCarryoverInfo(group);
    if (info && info.pending.length) sisa = { lembarId: info.lembar.id, mulai: info.lembar.mulai, akhir: info.lembar.akhir, pending: info.pending, done: Object.keys(info.done) };
    // qty terakhir yang tercatat per item (utk keterangan "barang tidak bergerak" saat preview upload)
    var qtyTerakhir = {}, byLm = {};
    _soDetailRows().forEach(function (d) { (byLm[d.lembar] = byLm[d.lembar] || []).push(d); });
    _soLembarList().filter(function (x) { return _soNorm(x.group) === _soNorm(group); }).forEach(function (x) {
      (byLm[x.id] || []).forEach(function (d) { qtyTerakhir[_soNorm(d.item)] = { sistem: d.sistem, tgl: d.tglData || _soTgl(x.dibuat) }; });
    });
    return { success: true, lembar: l, items: items, bolehTambahItem: _soBolehTambahItem(group), carryover: _soCarryover(group), sisaSebelumnya: sisa, qtyTerakhir: qtyTerakhir };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// Satu baris SO_DETAIL (18 kolom). mode: '' | 'CARRY' | 'HOLD'
function _soDetailRow(lid, item, desc, um, lokasi, sistem, tglData, mode) {
  return [lid, String(item).trim(), desc || '', um || '', lokasi || '', Number(sistem) || 0, '', '', '', '', '', '', '', '', '', '', tglData || '', mode || ''];
}
// Tulis 'Tgl Data' (kolom 17) utk baris-baris yang qty-nya baru diperbarui dari QAD
function _soTulisTglData(sd, rows, tgl) {
  if (!rows.length) return;
  rows = rows.slice().sort(function (a, b) { return a - b; });
  var minR = rows[0], maxR = rows[rows.length - 1], rg = sd.getRange(minR, 17, maxR - minR + 1, 1), v = rg.getValues();
  rows.forEach(function (rw) { v[rw - minR][0] = tgl; });
  rg.setNumberFormat('@').setValues(v);
}

// ================================================================
//  SISA PERIODE LALU (khusus I053 & Q055)
//  Bila periode sebelumnya TIDAK selesai, lembar periode berikutnya dibuat dgn:
//    CARRY = item yang belum di-SO di periode lalu -> dikerjakan DULU
//    HOLD  = item yang sudah di-SO di periode lalu  -> TERKUNCI sementara; otomatis terbuka begitu semua CARRY selesai
//  Progres tercatat di periode BERJALAN (lembar baru), periode lalu tetap apa adanya (tidak ikut berubah).
// ================================================================
var SO_GROUP_CARRYOVER = ['I053', 'Q055'];
function _soCarryover(group) { return SO_GROUP_CARRYOVER.some(function (g) { return _soKey(g) === _soKey(group); }); }
function _soCarryoverInfo(group) {
  if (!_soCarryover(group)) return null;
  var mine = _soLembarList().filter(function (l) { return _soNorm(l.group) === _soNorm(group); });
  if (!mine.length) return null;
  var lastL = mine[mine.length - 1], pending = [], done = {};
  _soDetailRows().forEach(function (d) {
    if (d.lembar !== lastL.id) return;
    if (d.fisik === null) pending.push({ item: d.item, desc: d.desc, um: d.um, lokasi: d.lokasi, sistem: d.sistem, tglData: d.tglData });
    else done[_soNorm(d.item)] = 1;
  });
  return { lembar: lastL, pending: pending, done: done };
}
// Buka kunci item HOLD bila semua item CARRY di lembar itu sudah di-SO. Mengembalikan jumlah item yang terbuka.
function _soBukaHold(lid) {
  var sd = _soSheet('SO_DETAIL', SO_DETAIL_HDR), last = sd.getLastRow(); if (last < 2) return 0;
  var v = sd.getRange(2, 1, last - 1, 18).getValues(), pend = 0, hold = [];
  v.forEach(function (r, i) {
    if (String(r[0]) !== lid) return;
    var m = String(r[17]);
    if (m === 'CARRY' && String(r[6]) === '') pend++; else if (m === 'HOLD') hold.push(i + 2);
  });
  if (pend > 0 || !hold.length) return 0;
  hold.forEach(function (rw) { sd.getRange(rw, 18).setValue(''); });
  return hold.length;
}

// Bila SEMUA item lembar sudah di-SO -> otomatis pindah ke periode berikutnya:
// dibuat lembar baru (item yg sama, qty sistem terakhir, fisik kosong). MINGGUAN -> mulai Senin minggu berikutnya;
// BULANAN/3 BULAN -> mulai hari ini sepanjang target durasi. PIC upload ulang utk menyegarkan qty / tambah / kurangi item.
function _soCekSelesaiDanLanjut(id) {
  var sl = _soSheet('SO_LEMBAR', SO_LEMBAR_HDR), sd = _soSheet('SO_DETAIL', SO_DETAIL_HDR);
  var ls = _soRows(sl, 8), cur = null;
  ls.forEach(function (r) { if (String(r[0]) === id) cur = r; });
  if (!cur) return null;
  var lastOfGroup = null;
  ls.forEach(function (r) { if (_soNorm(r[2]) === _soNorm(cur[2])) lastOfGroup = r; });
  if (!lastOfGroup || String(lastOfGroup[0]) !== id) return null; // hanya lembar terakhir group yg melanjutkan
  var last = sd.getLastRow(); if (last < 2) return null;
  var det = sd.getRange(2, 1, last - 1, 18).getValues().filter(function (r) { return String(r[0]) === id; });
  if (!det.length || det.some(function (r) { return String(r[6]) === ''; })) return null;
  var master = soGetMaster().data.filter(function (m) { return _soNorm(m.group) === _soNorm(cur[2]); })[0];
  if (!master) return null;
  var today = _soToday(), mulai, akhir;
  if (master.mode === 'MINGGUAN') {
    mulai = _soAddDays(_soPeriodeMulai(_soTgl(cur[4])), SO_PERIODE_HARI);
    var tm = _soPeriodeMulai(today); if (mulai < tm) mulai = tm;
    akhir = _soAddDays(mulai, SO_PERIODE_HARI - 1);
  } else {
    // Periode berikutnya dimulai SETELAH durasi periode ini berakhir (bukan hari ini), supaya progres periode
    // yang sudah selesai tetap tampil selama durasinya (mis. 3 bulan) dan tidak tertimpa lembar kosong.
    mulai = _soAddDays(_soTgl(cur[5]), 1); if (mulai < today) mulai = today;
    akhir = _soAddDays(mulai, master.hari);
  }
  var nid = _soUniqueId('SO-' + _soNorm(cur[2]).replace(/\s+/g, '') + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss'), ls.map(function (r) { return String(r[0]); }));
  sl.appendRow([nid, String(cur[1]), String(cur[2]), today, mulai, akhir, 'AUTO', det.length]);
  var rows = det.map(function (r) { return _soDetailRow(nid, r[1], r[2], r[3], r[4], r[5], _soTgl(r[16]), ''); }); // qty & tgl data diwarisi; belum disegarkan dari QAD
  sd.getRange(sd.getLastRow() + 1, 1, rows.length, SO_DETAIL_HDR.length).setNumberFormat('@').setValues(rows);
  return { id: nid, mulai: mulai, akhir: akhir, jumlah: rows.length };
}

// Group yang BOLEH menambah item baru saat upload ulang di periode berjalan (group lain: master SKU tetap)
var SO_GROUP_TAMBAH_ITEM = ['I053', 'Q055'];
function _soBolehTambahItem(group) { return SO_GROUP_TAMBAH_ITEM.some(function (g) { return _soKey(g) === _soKey(group); }); }

// payload: {pic, group, items:[{item,desc,um,lokasi,sistem}], qadKeys:[kode item bernilai di data QAD terbaru], user}
// UPLOAD PERTAMA di periode = MASTER SKU lembar (item yang dicentang PIC).
// UPLOAD ULANG di periode yang sama (digabung ke lembar aktif):
//   - SKU di lembar TETAP, walau tidak dicentang / tidak ikut dikirim (tidak ada lagi pemangkasan target);
//   - item sudah di-SO dikunci; item belum di-SO diperbarui qty-nya (bila ikut dikirim);
//   - SKU belum di-SO DIKELUARKAN hanya bila di data QAD terbaru stok-nya 0 / sudah tidak ada (qadKeys);
//   - item BARU hanya ditambahkan utk group I053 & Q055; group lain diabaikan.
// Item QTY 0/minus tidak pernah ditarik. Item di luar list sheet group tetap ditarik (upload pertama) bila QTY > 0.
function soBuatLembar(payload) {
  var lock = LockService.getScriptLock();
  try {
    payload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    var g = _soGroupItemMap(payload.group);
    var master = soGetMaster().data.filter(function (m) { return _soNorm(m.group) === _soNorm(payload.group); })[0];
    if (!master) return { success: false, error: 'Group belum terdaftar di SO_MASTER.' };
    var seen = {}, keep = [], keepKeys = {}, dibuang = 0, tambahan = 0;
    (payload.items || []).forEach(function (it) {
      var k = _soNorm(it.item);
      if (!k || seen[k]) return;
      if (!(Number(it.sistem) > 0)) { dibuang++; return; }
      if (!g.map.hasOwnProperty(k)) tambahan++;
      seen[k] = 1; keepKeys[k] = 1; keep.push(it);
    });
    var aktif = _soLembarAktif(payload.group);
    var qadKeys = null;
    if (payload.qadKeys && payload.qadKeys.length !== undefined) {
      qadKeys = {}; payload.qadKeys.forEach(function (c) { var k = _soNorm(c); if (k) qadKeys[k] = 1; });
    }
    if (aktif && qadKeys && !Object.keys(qadKeys).length) return { success: false, error: 'Data QAD untuk group ini kosong -- tidak ada yang diperbarui (mencegah lembar terhapus karena file salah).' };
    if (!keep.length && !(aktif && qadKeys) && !(_soCarryoverInfo(payload.group) || { pending: [] }).pending.length) return { success: false, error: 'Tidak ada item bernilai (QTY > 0) pada data upload.' };
    lock.waitLock(25000);
    var sl = _soSheet('SO_LEMBAR', SO_LEMBAR_HDR), sd = _soSheet('SO_DETAIL', SO_DETAIL_HDR);

    if (aktif) {
      var last = sd.getLastRow(), all = last >= 2 ? sd.getRange(1, 1, last, 7).getValues() : [[]], rowOf = {}, filled = {};
      for (var r = 1; r < all.length; r++) if (String(all[r][0]) === aktif.id) { var kk = _soNorm(all[r][1]); rowOf[kk] = r + 1; filled[kk] = String(all[r][6]) !== ''; }
      var baru = [], diperbarui = 0, dikunci = 0, minR = 0, maxR = 0, hapus = [], ditolakBaru = 0, boleh = _soBolehTambahItem(payload.group), updRows = [], hariIni = _soToday();
      keep.forEach(function (it) {
        var k = _soNorm(it.item), row = rowOf[k];
        if (row) {
          if (filled[k]) { dikunci++; return; }
          var c = all[row - 1];
          c[2] = it.desc || c[2] || g.map[k] || ''; c[3] = it.um || c[3] || ''; c[4] = it.lokasi || c[4] || ''; c[5] = Number(it.sistem) || 0;
          if (!minR || row < minR) minR = row; if (row > maxR) maxR = row; diperbarui++; updRows.push(row);
        } else if (boleh) {
          baru.push(_soDetailRow(aktif.id, it.item, it.desc || g.map[k] || '', it.um, it.lokasi, it.sistem, hariIni, ''));
        } else {
          ditolakBaru++; // master SKU tetap: item baru tidak ditambahkan di group ini
        }
      });
      // Keluarkan HANYA SKU belum di-SO yang stok-nya 0 / tidak ada di data QAD terbaru. Tanpa qadKeys (klien lama) -> tidak ada yang dikeluarkan.
      if (qadKeys) Object.keys(rowOf).forEach(function (k) { if (!filled[k] && !qadKeys[k]) hapus.push(rowOf[k]); });
      if (diperbarui) { sd.getRange(minR, 3, maxR - minR + 1, 4).setValues(all.slice(minR - 1, maxR).map(function (c) { return c.slice(2, 6); })); _soTulisTglData(sd, updRows, hariIni); }
      if (baru.length) sd.getRange(sd.getLastRow() + 1, 1, baru.length, SO_DETAIL_HDR.length).setNumberFormat('@').setValues(baru);
      hapus.sort(function (a, b) { return b - a; });
      for (var h = 0; h < hapus.length;) { // hapus baris berurutan sekaligus (dari bawah)
        var start = hapus[h], cnt = 1;
        while (h + cnt < hapus.length && hapus[h + cnt] === start - cnt) cnt++;
        sd.deleteRows(start - cnt + 1, cnt); h += cnt;
      }
      var total = Object.keys(rowOf).length - hapus.length + baru.length;
      var ls = sl.getRange(1, 1, sl.getLastRow(), 1).getValues();
      for (var i = 1; i < ls.length; i++) if (String(ls[i][0]) === aktif.id) { sl.getRange(i + 1, 8).setValue(total); break; }
      var terbuka = _soBukaHold(aktif.id); // bila SKU sisa yg belum di-SO sudah tidak ada (mis. stok 0), item terkunci ikut terbuka
      var lanjut = _soCekSelesaiDanLanjut(aktif.id);
      return { success: true, id: aktif.id, digabung: true, terbuka: terbuka, baru: baru.length, diperbarui: diperbarui, dikunci: dikunci, dihapus: hapus.length, ditolakBaru: ditolakBaru, total: total, dibuang: dibuang, tambahan: tambahan, sheetAda: g.found, mulai: aktif.mulai, akhir: aktif.akhir, lanjut: lanjut };
    }

    var today = _soToday();
    var mulai = master.mode === 'MINGGUAN' ? _soPeriodeMulai(today) : today;
    var akhir = master.mode === 'MINGGUAN' ? _soAddDays(mulai, SO_PERIODE_HARI - 1) : _soAddDays(today, master.hari);
    var id = _soUniqueId('SO-' + _soNorm(payload.group).replace(/\s+/g, '') + '-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss'), _soLembarList().map(function (l) { return l.id; }));
    // Sisa periode lalu (I053 & Q055): item yg belum di-SO -> CARRY (dikerjakan dulu); item yg sudah di-SO -> HOLD sampai CARRY selesai
    var info = _soCarryoverInfo(payload.group), finalItems = [], carryN = 0, holdN = 0, keepMap = {};
    keep.forEach(function (it) { keepMap[_soNorm(it.item)] = it; });
    if (info && info.pending.length) {
      var pendKeys = {};
      info.pending.forEach(function (pd) {
        var k = _soNorm(pd.item); pendKeys[k] = 1;
        if (qadKeys && !qadKeys[k]) return;               // stok 0 / sudah tidak ada di data QAD -> tidak perlu di-SO
        finalItems.push({ it: keepMap[k] || pd, mode: 'CARRY' }); carryN++;
      });
      keep.forEach(function (it) {
        var k = _soNorm(it.item); if (pendKeys[k]) return;
        var mode = (info.done[k] && carryN > 0) ? 'HOLD' : '';
        if (mode === 'HOLD') holdN++;
        finalItems.push({ it: it, mode: mode });
      });
    } else keep.forEach(function (it) { finalItems.push({ it: it, mode: '' }); });
    sl.appendRow([id, master.pic, master.group, today, mulai, akhir, payload.user || '', finalItems.length]);
    var rows = finalItems.map(function (o) {
      var k = _soNorm(o.it.item);
      return _soDetailRow(id, o.it.item, o.it.desc || g.map[k] || '', o.it.um, o.it.lokasi, o.it.sistem, today, o.mode);
    });
    sd.getRange(sd.getLastRow() + 1, 1, rows.length, SO_DETAIL_HDR.length).setNumberFormat('@').setValues(rows);
    return { success: true, id: id, digabung: false, carry: carryN, hold: holdN, baru: finalItems.length, diperbarui: 0, dikunci: 0, dihapus: 0, total: finalItems.length, dibuang: dibuang, tambahan: tambahan, sheetAda: g.found, mulai: mulai, akhir: akhir };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}

function _soLembarList() {
  if (_SO_MEM.lembar) return _SO_MEM.lembar;
  return _SO_MEM.lembar = _soRows(_soSheet('SO_LEMBAR', SO_LEMBAR_HDR), 8).map(function (r) {
    var mu = _soTgl(r[4]), ak = _soTgl(r[5]);
    if (_so2Minggu(r[2]) && mu >= SO_MINGGUAN_MULAI) ak = _soAddDays(_soPeriodeMulai(mu), SO_PERIODE_HARI - 1);   // akhir = akhir periode 2 minggu (lembar lama ikut diperpanjang, data tidak diubah)
    return { id: String(r[0]), pic: String(r[1]), group: String(r[2]), dibuat: _soTgl(r[3]), mulai: mu, akhir: ak, oleh: String(r[6]), jumlah: Number(r[7]) || 0 };
  });
}
function _soDetailRows() {
  if (_SO_MEM.det) return _SO_MEM.det;
  return _SO_MEM.det = _soRows(_soSheet('SO_DETAIL', SO_DETAIL_HDR), 18).map(function (r, i) {
    return { row: i + 2, lembar: String(r[0]), item: String(r[1]), desc: String(r[2]), um: String(r[3]), lokasi: String(r[4]),
      sistem: Number(r[5]) || 0, fisik: r[6] === '' ? null : Number(r[6]), selisih: r[7] === '' ? null : Number(r[7]),
      tglIsi: _soTgl(r[8]), diisiOleh: String(r[9]), statusSel: String(r[10]), ket: String(r[11]),
      tglClose: _soTgl(r[12]), closeOleh: String(r[13]), alasanClose: String(r[14]), konfirmasi: String(r[15]),
      tglData: _soTgl(r[16]), mode: String(r[17] || '') };
  });
}

// Daftar lembar (+ ringkas progres). pic kosong = semua
function soListLembar(pic) {
  try {
    var det = _soDetailRows(), agg = {};
    det.forEach(function (d) {
      var a = agg[d.lembar] = agg[d.lembar] || { total: 0, isi: 0, open: 0, closed: 0 };
      a.total++; if (d.fisik !== null) a.isi++;
      if (d.statusSel === 'OPEN') a.open++; if (d.statusSel === 'CLOSED') a.closed++;
    });
    var latestOf = {}; _soLembarList().forEach(function (l) { latestOf[_soNorm(l.group)] = l.id; });
    var openRev = {}, cntRev = {};
    _soRevisiList().forEach(function (r) { cntRev[r.lembar] = (cntRev[r.lembar] || 0) + 1; if (r.status === 'TERBUKA') openRev[r.lembar] = r; });
    var out = _soLembarList().filter(function (l) { return !pic || _soNorm(l.pic) === _soNorm(pic); })
      .map(function (l) { var a = agg[l.id] || { total: 0, isi: 0, open: 0, closed: 0 }; l.isi = a.isi; l.open = a.open; l.closed = a.closed; l.terkunci = latestOf[_soNorm(l.group)] !== l.id; l.dibuka = !!openRev[l.id]; l.jumlahRevisi = cntRev[l.id] || 0; return l; });
    out.reverse();
    return { success: true, data: out };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

function soGetLembarDetail(id) {
  try {
    var l = _soLembarList().filter(function (x) { return x.id === id; })[0];
    if (!l) return { success: false, error: 'Lembar tidak ditemukan.' };
    var lastId = null; _soLembarList().forEach(function (x) { if (_soNorm(x.group) === _soNorm(l.group)) lastId = x.id; });
    l.terkunci = lastId !== l.id;
    var rv = _soRevisiList().filter(function (x) { return x.lembar === id; });
    var lg = rv.length ? _soRevLogRows() : [];
    l.dibuka = rv.some(function (x) { return x.status === 'TERBUKA'; });
    rv.forEach(function (x) { x.perubahan = lg.filter(function (g) { return g.rev === x.id; }); });
    // Barang tidak bergerak: qty sistem SAMA dengan qty pada pengambilan data sebelumnya (data baru dari QAD, bukan salinan otomatis)
    var chain = _soLembarList().filter(function (x) { return _soNorm(x.group) === _soNorm(l.group); }), ci = 0;
    chain.forEach(function (x, i) { if (x.id === id) ci = i; });
    var detAll = _soDetailRows(), byL = {}, prevMap = {};
    detAll.forEach(function (d) { (byL[d.lembar] = byL[d.lembar] || []).push(d); });
    for (var pi = 0; pi < ci; pi++) (byL[chain[pi].id] || []).forEach(function (d) { prevMap[_soNorm(d.item)] = { sistem: d.sistem, tgl: d.tglData || _soTgl(chain[pi].dibuat) }; });
    var items = (byL[id] || []).map(function (d) {
      var pv = prevMap[_soNorm(d.item)], rowTgl = d.tglData || (String(l.oleh) === 'AUTO' ? '' : _soTgl(l.dibuat));
      d.prevSistem = pv ? pv.sistem : null; d.prevTgl = pv ? pv.tgl : '';
      d.tidakBergerak = !!(pv && pv.sistem === d.sistem && rowTgl && pv.tgl && rowTgl > pv.tgl);
      return d;
    });
    var carryBelum = items.filter(function (d) { return d.mode === 'CARRY' && d.fisik === null; }).length;
    l.carryBelum = carryBelum; l.adaHold = items.some(function (d) { return d.mode === 'HOLD'; });
    return { success: true, lembar: l, items: items, revisi: rv.reverse() };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// payload: {id, user, rows:[{row, fisik, konfirmasi}]}
// Selisih otomatis. Baris yang selisih != 0 hanya disimpan bila konfirmasi=true; selain itu ditahan
// (dikembalikan di `ditahan`) supaya PIC cek ulang dulu.
function soSimpanIsi(payload) {
  var lock = LockService.getScriptLock();
  try {
    payload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    // Data SO periode sebelumnya TERKUNCI begitu periode berikutnya (lembar baru) sudah ada
    var lm = _soLembarList().filter(function (x) { return x.id === payload.id; })[0];
    if (!lm) return { success: false, error: 'Lembar tidak ditemukan.' };
    var latest = null; _soLembarList().forEach(function (x) { if (_soNorm(x.group) === _soNorm(lm.group)) latest = x; });
    var rev = _soRevisiAktif(lm.id); // lembar lama yang DIBUKA TL/Admin untuk diedit
    if (latest && latest.id !== lm.id && !rev) return { success: false, error: 'Lembar periode sebelumnya sudah terkunci karena periode berikutnya sudah dimulai. Minta TL/Admin membuka kuncinya bila perlu diedit.' };
    lock.waitLock(25000);
    var sd = _soSheet('SO_DETAIL', SO_DETAIL_HDR), today = _soToday(), n = 0, ditahan = [], revLog = [];
    var last = sd.getLastRow(); if (last < 2) return { success: true, tersimpan: 0, ditahan: [] };
    var all = sd.getRange(1, 1, last, 18).getValues(), minR = 0, maxR = 0, ditahanKunci = [];
    (payload.rows || []).forEach(function (r) {
      var row = Number(r.row); if (!row || row < 2 || row > last) return;
      var cur = all[row - 1];
      if (String(cur[0]) !== payload.id) return; // pengaman: baris harus milik lembar ini
      if (String(cur[17]) === 'HOLD') { ditahanKunci.push(row); return; } // terkunci sampai item sisa periode lalu selesai
      if (r.fisik === '' || r.fisik === null || r.fisik === undefined) return;
      var fisik = Number(r.fisik), sistem = Number(cur[5]) || 0, sel = fisik - sistem, konf = String(cur[15]);
      if (sel !== 0 && !r.konfirmasi) { ditahan.push(row); return; }
      if (sel === 0) konf = '';
      else konf = 'DIKONFIRMASI ' + today + ' ' + (payload.user || '');
      var changedRev = !!rev && (String(cur[6]) === '' || Number(cur[6]) !== fisik);
      var status = sel === 0 ? '' : ((String(cur[10]) === 'CLOSED' && !changedRev) ? 'CLOSED' : 'OPEN');
      if (changedRev) {
        revLog.push([rev.id, _soNow(), payload.user || '', String(cur[1]), String(cur[6]), fisik, String(cur[7]), sel]);
        cur[12] = ''; cur[13] = ''; cur[14] = ''; // nilai berubah -> info close lama tidak berlaku lagi (jejaknya ada di log revisi)
      }
      cur[6] = fisik; cur[7] = sel; cur[8] = today; cur[9] = payload.user || ''; cur[10] = status; cur[15] = konf;
      if (!minR || row < minR) minR = row; if (row > maxR) maxR = row; n++;
    });
    if (n) sd.getRange(minR, 7, maxR - minR + 1, 10).setValues(all.slice(minR - 1, maxR).map(function (c) { return c.slice(6, 16); }));
    var terbuka = n ? _soBukaHold(payload.id) : 0; // semua item sisa selesai -> item terkunci terbuka otomatis
    if (revLog.length) {
      var sr = _soSheet('SO_REVISI_LOG', SO_REVLOG_HDR);
      sr.getRange(sr.getLastRow() + 1, 1, revLog.length, SO_REVLOG_HDR.length).setNumberFormat('@').setValues(revLog);
    }
    var lanjut = (n && !rev) ? _soCekSelesaiDanLanjut(payload.id) : null;
    return { success: true, tersimpan: n, ditahan: ditahan, ditahanKunci: ditahanKunci, terbuka: terbuka, lanjut: lanjut, revisi: !!rev, diubah: revLog.length };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}

// payload: {group, id (lembar yg sedang diisi), items:[kode item]} -> hasil SO sebelumnya per item (lembar lain, group sama)
function soGetRiwayatItems(payload) {
  try {
    payload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    var want = {}; (payload.items || []).forEach(function (i) { want[_soNorm(i)] = 1; });
    var prev = _soLembarList().filter(function (l) { return _soNorm(l.group) === _soNorm(payload.group) && l.id !== payload.id; });
    var order = {}, info = {}; prev.forEach(function (l, i) { order[l.id] = i; info[l.id] = l; });
    var best = {};
    _soDetailRows().forEach(function (d) {
      var k = _soNorm(d.item);
      if (!want[k] || order[d.lembar] === undefined || d.fisik === null) return;
      if (!best[k] || order[d.lembar] > order[best[k].lembar]) best[k] = d;
    });
    var out = {};
    Object.keys(best).forEach(function (k) {
      var d = best[k]; out[k] = { lembar: d.lembar, tgl: d.tglIsi || info[d.lembar].dibuat, sistem: d.sistem, fisik: d.fisik, selisih: d.selisih, status: d.statusSel };
    });
    return { success: true, data: out };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// payload: {row, id, ket, user}  -> keterangan selisih (tetap OPEN)
function soSimpanKeterangan(payload) {
  try {
    payload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    var sd = _soSheet('SO_DETAIL', SO_DETAIL_HDR), row = Number(payload.row);
    if (String(sd.getRange(row, 1).getValue()) !== payload.id) return { success: false, error: 'Baris tidak cocok.' };
    sd.getRange(row, 12).setValue(String(payload.ket || ''));
    return { success: true };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// payload: {row, id, alasan, user} -> selisih ditandai CLOSED (sudah tidak bermasalah)
function soCloseSelisih(payload) {
  try {
    payload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    var sd = _soSheet('SO_DETAIL', SO_DETAIL_HDR), row = Number(payload.row);
    var cur = sd.getRange(row, 1, 1, 15).getValues()[0];
    if (String(cur[0]) !== payload.id) return { success: false, error: 'Baris tidak cocok.' };
    if (!payload.alasan || !String(payload.alasan).trim()) return { success: false, error: 'Alasan close wajib diisi.' };
    sd.getRange(row, 11).setValue('CLOSED');
    sd.getRange(row, 13, 1, 3).setValues([[_soToday(), payload.user || '', String(payload.alasan)]]);
    return { success: true };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// ================================================================
//  BUKA KUNCI / REVISI SO -- lembar periode sebelumnya terkunci otomatis. TL / Admin / Super Admin
//  dapat MEMBUKA-nya supaya PIC bisa mengedit (salah isi, atau stok sudah ketemu). Setelah selesai
//  edit, WAJIB mengisi keterangan alasan agar TL & tim terkait tahu. Setiap perubahan fisik dicatat.
//    SO_REVISI     : 1 baris per pembukaan (siapa, kapan, alasan buka, status, keterangan selesai edit)
//    SO_REVISI_LOG : 1 baris per item yang berubah (fisik/selisih lama -> baru)
// ================================================================
var SO_REVISI_HDR = ['ID', 'LembarID', 'Group', 'PIC', 'Dibuka Oleh', 'Tgl Buka', 'Alasan Buka', 'Status', 'Selesai Oleh', 'Tgl Selesai', 'Keterangan Edit', 'Jumlah Perubahan'];
var SO_REVLOG_HDR = ['RevID', 'Waktu', 'Diubah Oleh', 'Item', 'Fisik Lama', 'Fisik Baru', 'Selisih Lama', 'Selisih Baru'];
function _soNow() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'); }
function _soRevisiList() {
  if (_SO_MEM.rev) return _SO_MEM.rev;
  return _SO_MEM.rev = _soRows(_soSheet('SO_REVISI', SO_REVISI_HDR), SO_REVISI_HDR.length).map(function (r) {
    return { id: String(r[0]), lembar: String(r[1]), group: String(r[2]), pic: String(r[3]), dibukaOleh: String(r[4]), tglBuka: String(r[5]),
      alasanBuka: String(r[6]), status: String(r[7]), selesaiOleh: String(r[8]), tglSelesai: String(r[9]), ketEdit: String(r[10]), jumlahUbah: Number(r[11]) || 0 };
  });
}
function _soRevLogRows() {
  return _soRows(_soSheet('SO_REVISI_LOG', SO_REVLOG_HDR), SO_REVLOG_HDR.length).map(function (r) {
    return { rev: String(r[0]), waktu: String(r[1]), oleh: String(r[2]), item: String(r[3]), fisikLama: r[4] === '' ? null : Number(r[4]), fisikBaru: r[5] === '' ? null : Number(r[5]),
      selisihLama: r[6] === '' ? null : Number(r[6]), selisihBaru: r[7] === '' ? null : Number(r[7]) };
  });
}
function _soRevisiAktif(lembarId) {
  var out = null; _soRevisiList().forEach(function (r) { if (r.lembar === lembarId && r.status === 'TERBUKA') out = r; });
  return out;
}
// Cek akun di AKUN_LOGIN departemen aktif (verifikasi sisi server, bukan cuma dari browser)
function _soUserInfo(nik) {
  nik = String(nik || '').trim().toUpperCase(); if (!nik) return null;
  try {
    var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH_AKUN_LOGIN); if (!sh) return null;
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === nik && data[i][4] !== false) return { nik: nik, nama: String(data[i][1]), role: String(data[i][2]) };
    }
  } catch (e) {}
  return null;
}
function _soBolehBuka(nik) {
  if (_isSuperAdmin(nik)) return true;
  var u = _soUserInfo(nik); if (!u) return false;
  var r = String(u.role).toUpperCase().trim();
  return r === 'TL' || r.indexOf('ADMIN') !== -1;
}

// payload: {id (lembar), alasan, nik, user}
function soBukaKunci(payload) {
  var lock = LockService.getScriptLock();
  try {
    payload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!_soBolehBuka(payload.nik)) return { success: false, error: 'Akses ditolak. Hanya TL, Admin, atau Super Admin yang dapat membuka kunci SO.' };
    var alasan = String(payload.alasan || '').trim();
    if (alasan.length < 5) return { success: false, error: 'Alasan membuka kunci wajib diisi (minimal 5 karakter).' };
    lock.waitLock(25000);
    var lm = _soLembarList().filter(function (x) { return x.id === payload.id; })[0];
    if (!lm) return { success: false, error: 'Lembar tidak ditemukan.' };
    var latest = null; _soLembarList().forEach(function (x) { if (_soNorm(x.group) === _soNorm(lm.group)) latest = x; });
    if (latest && latest.id === lm.id) return { success: false, error: 'Lembar ini adalah periode berjalan dan sudah bisa diedit langsung oleh PIC di tab Pengisian.' };
    if (_soRevisiAktif(lm.id)) return { success: false, error: 'Lembar ini sudah dalam keadaan terbuka untuk edit.' };
    var u = _soUserInfo(payload.nik), nama = (u && u.nama) || payload.user || String(payload.nik);
    var id = _soUniqueId('REV-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss'), _soRevisiList().map(function (r) { return r.id; }));
    var sh = _soSheet('SO_REVISI', SO_REVISI_HDR);
    sh.getRange(sh.getLastRow() + 1, 1, 1, SO_REVISI_HDR.length).setNumberFormat('@').setValues([[id, lm.id, lm.group, lm.pic, nama, _soNow(), alasan, 'TERBUKA', '', '', '', 0]]);
    _SO_MEM.rev = null;
    return { success: true, id: id };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}

// payload: {id (lembar), ket (WAJIB), nik, user}
function soSelesaiEdit(payload) {
  var lock = LockService.getScriptLock();
  try {
    payload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    var ket = String(payload.ket || '').trim();
    if (ket.length < 5) return { success: false, error: 'Keterangan wajib diisi (minimal 5 karakter): jelaskan apa yang diedit dan alasannya.' };
    var u = _soUserInfo(payload.nik);
    if (!u && !_isSuperAdmin(payload.nik)) return { success: false, error: 'Akun tidak dikenali. Login ulang lalu coba lagi.' };
    lock.waitLock(25000);
    var rv = _soRevisiAktif(payload.id);
    if (!rv) return { success: false, error: 'Lembar ini tidak sedang dibuka untuk edit.' };
    var jml = _soRevLogRows().filter(function (g) { return g.rev === rv.id; }).length;
    var sh = _soSheet('SO_REVISI', SO_REVISI_HDR), ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues(), row = 0;
    for (var i = 1; i < ids.length; i++) if (String(ids[i][0]) === rv.id) { row = i + 1; break; }
    if (!row) return { success: false, error: 'Catatan revisi tidak ditemukan.' };
    sh.getRange(row, 8, 1, 5).setValues([['SELESAI', (u && u.nama) || payload.user || String(payload.nik), _soNow(), ket, jml]]);
    _SO_MEM.rev = null;
    return { success: true, jumlahUbah: jml };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}


// ================================================================
//  LENGKAPI SKU LEMBAR (perbaikan) -- TL / Admin / Super Admin
//  Dipakai bila lembar sudah "selesai" tetapi SKU-nya tidak lengkap (mis. 12 dari 29 SKU, akibat aturan lama
//  yang memangkas target). Item yang SUDAH di-SO tidak disentuh sama sekali; SKU yang belum ada ditambahkan
//  sebagai item belum di-SO (dari data QAD terbaru, QTY > 0); qty item belum di-SO diperbarui.
//  Lembar periode berikutnya yang dibuat otomatis & belum dikerjakan sama sekali dihapus supaya lembar yang
//  dilengkapi kembali menjadi lembar berjalan (bisa langsung dilanjutkan PIC). Tercatat di SO_REVISI.
// payload: {id (lembar), items:[{item,desc,um,lokasi,sistem}], alasan, nik, user}
// ================================================================
function soLengkapiLembar(payload) {
  var lock = LockService.getScriptLock();
  try {
    payload = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!_soBolehBuka(payload.nik)) return { success: false, error: 'Akses ditolak. Hanya TL, Admin, atau Super Admin.' };
    var alasan = String(payload.alasan || '').trim();
    if (alasan.length < 5) return { success: false, error: 'Alasan wajib diisi (minimal 5 karakter).' };
    var lembarAll = _soLembarList(), idx = -1;
    lembarAll.forEach(function (x, i) { if (x.id === payload.id) idx = i; });
    if (idx < 0) return { success: false, error: 'Lembar tidak ditemukan.' };
    var lm = lembarAll[idx], g = _soGroupItemMap(lm.group), seen = {}, items = [];
    (payload.items || []).forEach(function (it) {
      var k = _soNorm(it.item); if (!k || seen[k] || !(Number(it.sistem) > 0)) return;
      seen[k] = 1; items.push(it);
    });
    if (!items.length) return { success: false, error: 'Tidak ada item bernilai (QTY > 0) pada data upload.' };
    lock.waitLock(25000);
    var sd = _soSheet('SO_DETAIL', SO_DETAIL_HDR), sl = _soSheet('SO_LEMBAR', SO_LEMBAR_HDR);
    var last = sd.getLastRow(), all = last >= 2 ? sd.getRange(1, 1, last, 7).getValues() : [[]];
    var rowOf = {}, filled = {}, filledPerLembar = {};
    for (var r = 1; r < all.length; r++) {
      var lid = String(all[r][0]), isFilled = String(all[r][6]) !== '';
      if (isFilled) filledPerLembar[lid] = (filledPerLembar[lid] || 0) + 1;
      if (lid === lm.id) { var kk = _soNorm(all[r][1]); rowOf[kk] = r + 1; filled[kk] = isFilled; }
    }
    var baru = [], diperbarui = 0, dikunci = 0, minR = 0, maxR = 0, updRows = [];
    items.forEach(function (it) {
      var k = _soNorm(it.item), row = rowOf[k];
      if (row) {
        if (filled[k]) { dikunci++; return; }                 // sudah di-SO -> TIDAK disentuh
        var c = all[row - 1];
        c[2] = it.desc || c[2] || g.map[k] || ''; c[3] = it.um || c[3] || ''; c[4] = it.lokasi || c[4] || ''; c[5] = Number(it.sistem) || 0;
        if (!minR || row < minR) minR = row; if (row > maxR) maxR = row; diperbarui++; updRows.push(row);
      } else {
        baru.push(_soDetailRow(lm.id, it.item, it.desc || g.map[k] || '', it.um, it.lokasi, it.sistem, _soToday(), ''));
      }
    });
    if (diperbarui) { sd.getRange(minR, 3, maxR - minR + 1, 4).setValues(all.slice(minR - 1, maxR).map(function (c) { return c.slice(2, 6); })); _soTulisTglData(sd, updRows, _soToday()); }
    if (baru.length) sd.getRange(sd.getLastRow() + 1, 1, baru.length, SO_DETAIL_HDR.length).setNumberFormat('@').setValues(baru);
    var total = Object.keys(rowOf).length + baru.length;
    var ids = sl.getRange(1, 1, sl.getLastRow(), 1).getValues();
    for (var i = 1; i < ids.length; i++) if (String(ids[i][0]) === lm.id) { sl.getRange(i + 1, 8).setValue(total); break; }

    // Lembar periode berikutnya hasil AUTO yang belum disentuh -> dihapus agar lembar ini kembali jadi lembar berjalan
    var hapusId = {}, berikutnyaDikerjakan = false;
    lembarAll.slice(idx + 1).forEach(function (x) {
      if (_soNorm(x.group) !== _soNorm(lm.group)) return;
      if (String(x.oleh) === 'AUTO' && !filledPerLembar[x.id]) hapusId[x.id] = 1; else berikutnyaDikerjakan = true;
    });
    var nHapus = Object.keys(hapusId).length;
    if (nHapus) {
      var dRows = []; for (var q = 1; q < all.length; q++) if (hapusId[String(all[q][0])]) dRows.push(q + 1);
      dRows.sort(function (a, b) { return b - a; });
      for (var h = 0; h < dRows.length;) { var st = dRows[h], cnt = 1; while (h + cnt < dRows.length && dRows[h + cnt] === st - cnt) cnt++; sd.deleteRows(st - cnt + 1, cnt); h += cnt; }
      var lRows = []; for (var z = 1; z < ids.length; z++) if (hapusId[String(ids[z][0])]) lRows.push(z + 1);
      lRows.sort(function (a, b) { return b - a; });
      lRows.forEach(function (rw) { sl.deleteRow(rw); });
    }
    // catat di SO_REVISI (siapa, kapan, alasan, apa yang berubah)
    var u = _soUserInfo(payload.nik), nama = (u && u.nama) || payload.user || String(payload.nik);
    var revId = _soUniqueId('REV-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyMMddHHmmss'), _soRevisiList().map(function (rv) { return rv.id; }));
    var shR = _soSheet('SO_REVISI', SO_REVISI_HDR);
    shR.getRange(shR.getLastRow() + 1, 1, 1, SO_REVISI_HDR.length).setNumberFormat('@').setValues([[revId, lm.id, lm.group, lm.pic, nama, _soNow(), alasan, 'SELESAI', nama, _soNow(),
      'Melengkapi SKU: +' + baru.length + ' item baru, ' + diperbarui + ' qty diperbarui, ' + dikunci + ' sudah di-SO dipertahankan' + (nHapus ? '; ' + nHapus + ' lembar periode berikutnya (otomatis, belum dikerjakan) dihapus' : ''), baru.length]]);
    return { success: true, id: lm.id, baru: baru.length, diperbarui: diperbarui, dikunci: dikunci, total: total, lembarBerikutDihapus: nHapus, berikutnyaSudahDikerjakan: berikutnyaDikerjakan };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
  finally { try { lock.releaseLock(); } catch (x) {} }
}

// Dashboard monitoring: 1 baris per PIC x Group (lembar terbaru) + peringatan TL
// Senin pertama yg dihitung utk group MINGGUAN (I053). Aplikasi baru berjalan -> minggu sebelum tanggal ini TIDAK dianggap terlambat.
var SO_MINGGUAN_MULAI = '2026-10-19';
// SO WMS dilakukan 2 MINGGU SEKALI (progress per periode 2 minggu, bukan per minggu). Periode dihitung dari SO_MINGGUAN_MULAI (Senin) tiap 14 hari.
var SO_PERIODE_HARI = 14;
var SO_GROUP_2MINGGU = ['I053', 'Q055'];
function _so2Minggu(group) { return SO_GROUP_2MINGGU.some(function (g) { return _soKey(g) === _soKey(group); }); }
function _soPeriodeMulai(iso) {
  var d = _soDiffDays(SO_MINGGUAN_MULAI, iso);
  if (d < 0) return _soMonday(iso);
  return _soAddDays(SO_MINGGUAN_MULAI, Math.floor(d / SO_PERIODE_HARI) * SO_PERIODE_HARI);
}
var SO_BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function _soTglId(iso) { var p = iso.split('-'); return Number(p[2]) + ' ' + SO_BULAN_ID[Number(p[1]) - 1] + ' ' + p[0]; }
// Periode (2 minggu) ke-N dalam bulan; bulan ditentukan dari tanggal mulai periode
function _soMingguKe(startIso) {
  var ym = startIso.slice(0, 7), n = 0;
  for (var w = SO_MINGGUAN_MULAI; w <= startIso; w = _soAddDays(w, SO_PERIODE_HARI)) if (w.slice(0, 7) === ym) n++;
  return n || 1;
}
// Detail mingguan utk group MINGGUAN: status tiap minggu sejak SO_MINGGUAN_MULAI + peringatan minggu terlambat
function _soMingguanDetail(m, mine, byLembar, today) {
  var out = { weeks: [], warnings: [], sisaMinggu: 0 }, thisMon = _soPeriodeMulai(today);
  for (var w = SO_MINGGUAN_MULAI; w <= thisMon; w = _soAddDays(w, SO_PERIODE_HARI)) {
    var akhir = _soAddDays(w, SO_PERIODE_HARI - 1), l = null;
    mine.forEach(function (x) { if (x.mulai >= w && x.mulai <= akhir) l = x; });   // lembar yang dimulai di dalam periode ini
    var a = l ? (byLembar[l.id] || { total: 0, isi: 0, last: '' }) : null;
    var pr = a && a.total ? Math.round(a.isi / a.total * 10000) / 100 : 0, st;
    if (!l) st = today > akhir ? 'TERLAMBAT' : 'BELUM MULAI';
    else if (pr >= 100) st = (a.last && a.last > akhir) ? 'SELESAI TERLAMBAT' : 'SELESAI';
    else st = today > akhir ? 'TERLAMBAT' : 'ON PROGRESS';
    var wk = { mulai: w, akhir: akhir, minggu: _soMingguKe(w), bulan: SO_BULAN_ID[Number(w.split('-')[1]) - 1] + ' ' + w.split('-')[0],
      lembarId: l ? l.id : '', jumlah: a ? a.total : 0, isi: a ? a.isi : 0, progress: pr, status: st,
      tglSelesai: (l && pr >= 100) ? a.last : '', sejak: st === 'TERLAMBAT' ? _soAddDays(akhir, 1) : '' };
    out.weeks.push(wk);
    if (st === 'TERLAMBAT') out.warnings.push({ level: 'danger', group: m.group, pic: m.pic, sejak: wk.sejak, progress: pr, isi: wk.isi, total: wk.jumlah,
      minggu: wk.minggu, periode: _soTglId(w) + ' - ' + _soTglId(akhir),
      msg: 'SO ' + m.pic + ' group ' + m.group + ' periode ke-' + wk.minggu + ' (' + _soTglId(w) + ' - ' + _soTglId(akhir) + ') terlambat sejak ' + _soTglId(wk.sejak) + '. Segera selesaikan dan input datanya pada sistem.' });
  }
  // Rekap per BULAN (bulan ditentukan dari hari Senin tiap minggu): berapa item yang berhasil di-SO PIC dalam sebulan
  var bm = {}, order = [];
  out.weeks.forEach(function (wk) {
    var key = wk.mulai.slice(0, 7), b = bm[key];
    if (!b) { b = bm[key] = { key: key, label: wk.bulan, minggu: 0, mingguSelesai: 0, itemTarget: 0, itemSelesai: 0, uniq: {} }; order.push(key); }
    b.minggu++; if (wk.status === 'SELESAI' || wk.status === 'SELESAI TERLAMBAT') b.mingguSelesai++;
    b.itemTarget += wk.jumlah; b.itemSelesai += wk.isi;
    var fs = wk.lembarId && _SO_MEM.filled ? _SO_MEM.filled[wk.lembarId] : null;
    if (fs) Object.keys(fs).forEach(function (k) { b.uniq[k] = 1; });
  });
  out.bulanan = order.map(function (k) {
    var b = bm[k];
    return { key: b.key, label: b.label, minggu: b.minggu, mingguSelesai: b.mingguSelesai, itemTarget: b.itemTarget, itemSelesai: b.itemSelesai,
      itemUnik: Object.keys(b.uniq).length, progress: b.itemTarget ? Math.round(b.itemSelesai / b.itemTarget * 10000) / 100 : 0,
      rataPerMinggu: b.minggu ? Math.round(b.itemSelesai / b.minggu * 10) / 10 : 0 };
  }).reverse();
  var p2 = today.split('-'), endMonth = p2[0] + '-' + p2[1] + '-' + ('0' + new Date(Number(p2[0]), Number(p2[1]), 0).getDate()).slice(-2);
  for (var w2 = thisMon; w2 <= endMonth; w2 = _soAddDays(w2, SO_PERIODE_HARI)) out.sisaMinggu++;
  return out;
}

function soGetDashboard() {
  try {
    var master = soGetMaster().data, lembar = _soLembarList(), det = _soDetailRows(), today = _soToday();
    var byLembar = {};
    det.forEach(function (d) {
      var a = byLembar[d.lembar] = byLembar[d.lembar] || { total: 0, isi: 0, open: 0, closed: 0, last: '' };
      a.total++; if (d.fisik !== null) { a.isi++; if (d.tglIsi && d.tglIsi > a.last) a.last = d.tglIsi; ((_SO_MEM.filled = _SO_MEM.filled || {})[d.lembar] = _SO_MEM.filled[d.lembar] || {})[_soNorm(d.item)] = 1; }
      if (d.statusSel === 'OPEN') a.open++; if (d.statusSel === 'CLOSED') a.closed++;
    });
    var warnings = [], mingguan = [], counts = _soCountsCached();
    var rows = master.map(function (m) {
      var mine = lembar.filter(function (l) { return _soNorm(l.group) === _soNorm(m.group); });
      var cur = null, nxt = null; // periode berjalan = lembar terakhir yg sudah mulai; lembar berikutnya (otomatis) belum mulai
      mine.forEach(function (l) { if (l.mulai <= today) cur = l; else if (!nxt) nxt = l; });
      if (m.mode !== 'MINGGUAN') { // lembar lama yg sudah selesai tetap jadi acuan selama durasinya masih berjalan
        var cov = mine.filter(function (l) { return l.mulai <= today && today <= l.akhir; });
        if (cov.length) cur = cov[0];
      }
      if (!cur && mine.length) cur = mine[0];
      var skuCount = counts ? (counts[_soKey(m.group)] || 0) : null;
      var row = { pic: m.pic, group: m.group, desc: m.desc, targetLabel: m.targetLabel, mode: m.mode,
        totalSku: skuCount, targetItem: 0, telahSo: 0, progress: 0, status: 'BELUM MULAI',
        selisih: '-', open: 0, closed: 0, lembarId: '', mulai: '', akhir: '', sisaHari: null, sejak: '', mingguTelat: 0, berikutnya: (nxt && nxt !== cur) ? nxt.mulai : '' };
      if (m.mode === 'MINGGUAN') { row.mulai = _soPeriodeMulai(today); row.akhir = _soAddDays(row.mulai, SO_PERIODE_HARI - 1); }
      if (cur) {
        var a = byLembar[cur.id] || { total: 0, isi: 0, open: 0, closed: 0 };
        row.lembarId = cur.id; row.targetItem = a.total; row.telahSo = a.isi; row.open = a.open; row.closed = a.closed;
        row.progress = a.total ? Math.round(a.isi / a.total * 10000) / 100 : 0; row.selesaiPada = (row.progress >= 100) ? (a.last || '') : '';
        row.mulai = cur.mulai; row.akhir = cur.akhir;
        var span = Math.max(1, _soDiffDays(cur.mulai, cur.akhir) + 1), el = Math.min(span, Math.max(0, _soDiffDays(cur.mulai, today) + 1));
        row.sisaHari = _soDiffDays(today, cur.akhir);
        // ON PROGRESS selama masih dalam durasi SO; TERLAMBAT hanya bila durasi lewat & belum 100%
        if (row.progress >= 100) row.status = (a.last && a.last > cur.akhir) ? 'SELESAI TERLAMBAT' : 'SELESAI';
        else if (today > cur.akhir) { row.status = 'TERLAMBAT'; row.sejak = _soAddDays(cur.akhir, 1); }
        else row.status = 'ON PROGRESS';
        row.selisih = a.open > 0 ? 'OPEN' : (a.closed > 0 ? 'CLOSED' : '-');
      }
      if (m.mode === 'MINGGUAN') {
        // I053: target selesai TIAP MINGGU; minggu sebelum SO_MINGGUAN_MULAI tidak dihitung
        var wd = _soMingguanDetail(m, mine, byLembar, today), thisMon = _soPeriodeMulai(today), thisEnd = _soAddDays(thisMon, SO_PERIODE_HARI - 1);
        mingguan.push({ group: m.group, pic: m.pic, desc: m.desc, mulaiHitung: SO_MINGGUAN_MULAI, sisaMinggu: wd.sisaMinggu, weeks: wd.weeks, bulanan: wd.bulanan });
        row.mingguTelat = wd.weeks.filter(function (x) { return x.status === 'TERLAMBAT'; }).length;
        wd.warnings.forEach(function (x) { warnings.push(x); });
        if (SO_MINGGUAN_MULAI <= thisMon && !mine.some(function (l) { return l.mulai >= thisMon && l.mulai <= thisEnd; }))
          warnings.push({ level: 'warn', group: m.group, pic: m.pic, msg: 'Lembar SO periode ini (' + _soTglId(thisMon) + ' - ' + _soTglId(thisEnd) + ') belum dibuat. Upload data QAD untuk memulai SO periode ini.' });
      } else if (row.status === 'TERLAMBAT') {
        warnings.push({ level: 'danger', group: m.group, pic: m.pic, sejak: row.sejak, progress: row.progress, isi: row.telahSo, total: row.targetItem,
          periode: _soTglId(row.mulai) + ' - ' + _soTglId(row.akhir),
          msg: 'SO ' + m.pic + ' group ' + m.group + ' terlambat sejak ' + _soTglId(row.sejak) + '. Segera selesaikan dan input datanya pada sistem.' });
      }
      return row;
    });
    var lmById = {}; lembar.forEach(function (l) { lmById[l.id] = l; });
    _soRevisiList().forEach(function (rv) {
      if (rv.status !== 'TERBUKA') return;
      var l = lmById[rv.lembar];
      warnings.push({ level: 'warn', revisi: true, lembarId: rv.lembar, group: rv.group, pic: rv.pic,
        msg: 'SO group ' + rv.group + (l ? ' periode ' + _soTglId(l.mulai) + ' - ' + _soTglId(l.akhir) : '') + ' sedang DIBUKA untuk edit oleh ' + rv.pic + ' (dibuka ' + rv.dibukaOleh + ', ' + rv.tglBuka + '). Alasan: ' + rv.alasanBuka + '. Setelah selesai edit, wajib isi keterangan perubahan.' });
    });
    return { success: true, today: today, data: rows, warnings: warnings, mingguan: mingguan };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// Rekap per PIC: ringkasan group + daftar selisih (dipakai Rekap PIC)
function soGetRekapPIC() {
  try {
    var dash = soGetDashboard();
    if (!dash.success) return dash;
    var det = _soDetailRows(), lembar = _soLembarList(), picOf = {}, grpOf = {};
    lembar.forEach(function (l) { picOf[l.id] = l.pic; grpOf[l.id] = l.group; });
    var selisih = det.filter(function (d) { return d.statusSel === 'OPEN' || d.statusSel === 'CLOSED'; }).map(function (d) {
      d.pic = picOf[d.lembar] || ''; d.group = grpOf[d.lembar] || ''; return d;
    });
    return { success: true, groups: dash.data, selisih: selisih, warnings: dash.warnings };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}


// SATU panggilan utk halaman Monitoring SO: master + dashboard + daftar lembar + selisih (data dibaca sekali)
function soGetAll(force) {
  try {
    var dash = soGetDashboard();
    if (!dash.success) return dash;
    var lembar = soListLembar('');
    if (!lembar.success) return lembar;
    var det = _soDetailRows(), picOf = {}, grpOf = {};
    _soLembarList().forEach(function (l) { picOf[l.id] = l.pic; grpOf[l.id] = l.group; });
    var selisih = det.filter(function (d) { return d.statusSel === 'OPEN' || d.statusSel === 'CLOSED'; }).map(function (d) {
      return { row: d.row, lembar: d.lembar, item: d.item, desc: d.desc, sistem: d.sistem, fisik: d.fisik, selisih: d.selisih,
               statusSel: d.statusSel, ket: d.ket, tglClose: d.tglClose, alasanClose: d.alasanClose, konfirmasi: d.konfirmasi, pic: picOf[d.lembar] || '', group: grpOf[d.lembar] || '' };
    });
    return { success: true, today: dash.today, master: soGetMaster().data, dash: dash.data, warnings: dash.warnings, mingguan: dash.mingguan, lembar: lembar.data, selisih: selisih, akun: _soAkunMap(), revisi: _soRevisiList().slice().reverse().slice(0, 100), sumberMaster: soGetMaster().sumber || 'SO_MASTER' };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// ================================================================
//  MONITORING PENYIMPANAN SUPABASE (menu Kelola User) -- hanya Super Admin & TL
// ----------------------------------------------------------------
//  Data diambil dari fungsi SQL wh_storage_stats() (lihat supabase/storage_stats.sql
//  -> WAJIB dijalankan sekali di SQL Editor Supabase). Batas kapasitas paket diatur lewat
//  Script Property SUPABASE_DB_LIMIT_MB (default 500 = paket Free; Pro = 8192).
//  Estimasi "penuh dalam berapa lama" = sisa kapasitas / pertumbuhan per hari, dgn pola
//  data yang SAMA seperti sekarang (snapshot harian bertambah 1 key/hari, arsip bulanan 1 key/bulan,
//  snapshot lain ditimpa -> tidak menambah ukuran). Bila riwayat >= 14 hari tersedia, laju
//  pertumbuhan aktual (regresi linear ukuran DB) dipakai sebagai pembanding.
// ================================================================
var SB_MENU_MAP = {
  stock: 'Monitoring Stock', stock_trend: 'Monitoring Stock',
  outbound: 'Dashboard WH Import (Inbound & Outbound)', inbound: 'Dashboard WH Import (Inbound & Outbound)', io_trend: 'Dashboard WH Import (Inbound & Outbound)',
  kanban: 'Monitoring Kanban', rekap: 'Rekap PIC (Rekap Muatan)', residence_time: 'Loading Time',
  fte: 'Monitoring FTE', ot_trend6: 'Monitoring FTE', kat_trend6: 'Monitoring FTE',
  group_list: 'Umum (daftar group)'
};
var SB_TIDAK_DISIMPAN = ['Monitoring Stock Opname (SO)', 'Input Lembur & Data Karyawan', 'Akun login / Kelola User', 'Upload Data Harian (data mentah)', 'Akurasi Scan Barcode', 'Akurasi QAD vs WMS', 'Kepatuhan PIC WMS', 'Monitoring Susun WMS'];

function _actorIsTlOrSuper(actorNik) {
  if (_isSuperAdmin(actorNik)) return true;
  var sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SH_AKUN_LOGIN);
  if (!sh) return false;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(actorNik)) return String(data[i][2] || '').trim().toUpperCase() === 'TL';
  }
  return false;
}

function _supabaseRpc(fn, body) {
  var props = PropertiesService.getScriptProperties();
  var baseUrl = props.getProperty('SUPABASE_URL'), svcKey = props.getProperty('SUPABASE_SERVICE_KEY');
  if (!baseUrl || !svcKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY belum di-set di Script Properties');
  var res = UrlFetchApp.fetch(baseUrl.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: svcKey, Authorization: 'Bearer ' + svcKey }, payload: JSON.stringify(body || {})
  });
  var code = res.getResponseCode(), text = res.getContentText();
  if (code === 404 || /PGRST202|Could not find the function/i.test(text)) {
    throw new Error('Fungsi ' + fn + ' belum ada di Supabase -- jalankan supabase/storage_stats.sql di SQL Editor Supabase.');
  }
  if (code >= 300) throw new Error('Supabase RPC ' + fn + ' gagal (' + code + '): ' + text.slice(0, 250));
  return JSON.parse(text);
}

function _sbDayDiff(a, b) { // YYYY-MM-DD
  var pa = a.split('-'), pb = b.split('-');
  return Math.round((new Date(+pb[0], +pb[1] - 1, +pb[2]) - new Date(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
}
function _sbMonthDiff(a, b) { // YYYY-MM
  var pa = a.split('-'), pb = b.split('-');
  return (+pb[0] - +pa[0]) * 12 + (+pb[1] - +pa[1]);
}

// Pertumbuhan (byte/hari) per kelompok snapshot dgn pola data yang sama seperti sekarang
function _sbGrowthPerDay(g) {
  var avg = Number(g.avg_bytes) || 0, keys = Number(g.keys) || 0;
  if (g.pattern === 'daily') {
    var span = Math.max(1, _sbDayDiff(g.first_period, g.last_period) + 1);
    return avg * Math.min(1, keys / span);
  }
  if (g.pattern === 'monthly') {
    var m = Math.max(1, _sbMonthDiff(g.first_period.slice(0, 7), g.last_period.slice(0, 7)) + 1);
    return avg * Math.min(1, keys / m) / 30.4375;
  }
  return 0; // snapshot yg ditimpa (upsert) -> tidak menambah ukuran
}

// Laju aktual dari riwayat harian (regresi linear). null bila data kurang / tidak naik.
function _sbGrowthEmpiris(history) {
  var h = (history || []).filter(function (r) { return r && r.day && r.db_bytes != null; });
  if (h.length < 3) return { perDay: null, hari: h.length ? _sbDayDiff(h[0].day, h[h.length - 1].day) : 0 };
  var t0 = h[0].day, xs = h.map(function (r) { return _sbDayDiff(t0, r.day); }), ys = h.map(function (r) { return Number(r.db_bytes); });
  var n = xs.length, mx = xs.reduce(function (a, b) { return a + b; }, 0) / n, my = ys.reduce(function (a, b) { return a + b; }, 0) / n;
  var num = 0, den = 0;
  for (var i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
  var span = xs[n - 1] - xs[0];
  return { perDay: (den > 0 && num > 0) ? num / den : null, hari: span };
}

function _sbEstimasi(limitBytes, usedBytes, perDayModel, emp, todayIso) {
  var perDay = perDayModel, metode = 'model';
  if (emp.perDay && emp.hari >= 14) { perDay = emp.perDay; metode = 'riwayat'; }
  var sisa = Math.max(0, limitBytes - usedBytes), hari = perDay > 0 ? sisa / perDay : null;
  var tgl = null;
  if (hari !== null && isFinite(hari)) {
    var p = todayIso.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2] + Math.min(Math.floor(hari), 36500));
    tgl = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  return { perDayModel: perDayModel, perDayRiwayat: emp.perDay, riwayatHari: emp.hari, perDay: perDay, metode: metode,
    sisaBytes: sisa, sisaHari: hari, sisaBulan: hari === null ? null : hari / 30.4375, sisaTahun: hari === null ? null : hari / 365.25, tanggalPenuh: tgl };
}

function getSupabaseStorageStats(actorNik, force) {
  try {
    if (!_actorIsTlOrSuper(actorNik)) return { success: false, error: 'Akses ditolak -- hanya Super Admin dan TL.' };
    var cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
    var limitMB = Number(props.getProperty('SUPABASE_DB_LIMIT_MB')) || 500;
    var key = 'SB_STORAGE_v1_' + limitMB;
    if (!force) { var hit = cache.get(key); if (hit) { var o = JSON.parse(hit); o.dariCache = true; o.isSuperAdmin = _isSuperAdmin(actorNik); return o; } }

    var raw = _supabaseRpc('wh_storage_stats', {});
    var used = Number(raw.db_bytes) || 0, limitBytes = limitMB * 1024 * 1024;
    var groups = raw.groups || [], perMenu = {}, perWs = {}, growthTotal = 0;
    groups.forEach(function (g) {
      var menu = SB_MENU_MAP[g.type] || ('Lainnya (' + g.type + ')'), gr = _sbGrowthPerDay(g);
      growthTotal += gr; g.growthPerDay = gr;
      var m = perMenu[menu] = perMenu[menu] || { menu: menu, keys: 0, bytes: 0, growthPerDay: 0, jenis: {} };
      m.keys += Number(g.keys) || 0; m.bytes += Number(g.bytes) || 0; m.growthPerDay += gr; m.jenis[g.type + (g.mode ? ':' + g.mode : '')] = 1;
      var w = perWs[g.ws] = perWs[g.ws] || { ws: g.ws, keys: 0, bytes: 0, growthPerDay: 0 };
      w.keys += Number(g.keys) || 0; w.bytes += Number(g.bytes) || 0; w.growthPerDay += gr;
    });
    var menus = Object.keys(perMenu).map(function (k) { perMenu[k].jenis = Object.keys(perMenu[k].jenis); return perMenu[k]; }).sort(function (a, b) { return b.bytes - a.bytes; });
    var wss = Object.keys(perWs).map(function (k) { return perWs[k]; }).sort(function (a, b) { return b.bytes - a.bytes; });
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var est = _sbEstimasi(limitBytes, used, growthTotal, _sbGrowthEmpiris(raw.history), today);

    var out = { success: true, generatedAt: raw.generated_at || new Date().toISOString(), today: today,
      limitMB: limitMB, plan: limitMB === 500 ? 'Free (500 MB)' : (limitMB === 8192 ? 'Pro (8 GB)' : 'Kustom'),
      dbBytes: used, appBytes: Number(raw.app_bytes) || 0, limitBytes: limitBytes,
      sisaBytes: Math.max(0, limitBytes - used), persen: limitBytes ? Math.round(used / limitBytes * 10000) / 100 : 0,
      snapshotRows: Number(raw.snapshot_rows) || 0, tables: raw.tables || [], menus: menus, departemen: wss,
      estimasi: est, history: raw.history || [], tidakDisimpan: SB_TIDAK_DISIMPAN, isSuperAdmin: _isSuperAdmin(actorNik) };
    try { cache.put(key, JSON.stringify(out), 300); } catch (e) { /* >100KB: lewati cache */ }
    return out;
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// Ubah batas kapasitas paket (MB) -- hanya Super Admin. Free = 500, Pro = 8192.
function setSupabaseDbLimitMB(actorNik, mb) {
  try {
    if (!_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- hanya Super Admin.' };
    mb = Number(mb);
    if (!(mb >= 50 && mb <= 1048576)) return { success: false, error: 'Batas harus antara 50 MB dan 1.048.576 MB.' };
    PropertiesService.getScriptProperties().setProperty('SUPABASE_DB_LIMIT_MB', String(Math.round(mb)));
    return { success: true, limitMB: Math.round(mb) };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}

// ================================================================
//  AUDIT PRODUKTIVITAS FTE -- membongkar tiap langkah hitung dari DATA ASLI sheet
//  (hanya TL / Admin). Mencari: baris ganda, hari yang ter-upload 2x, baris yang tidak
//  dihitung (tanpa kategori), tanggal berupa teks, berat minus, baris terbesar, rincian
//  jumlah karyawan, lalu menghitung ulang produktivitas dgn beberapa skenario pembanding.
// ================================================================
function _auditSheetTransaksi(ss, sheetName, range) {
  var out = { sheet: sheetName, ada: false, totalBaris: 0, barisBulan: 0, barisTerhitung: 0, terhitung: 0, barisDikecualikan: 0, dikecualikan: 0,
    positif: 0, negatif: 0, barisNegatif: 0, tanggalTeks: 0, tanpaTanggal: 0, perKategori: {}, perHari: [], duplikat: { kelompok: 0, barisLebih: 0, beratLebih: 0, contoh: [] }, hariGanda: [], terbesar: [] };
  var sh = ss.getSheetByName(sheetName); if (!sh) return out;
  out.ada = true;
  var data = sh.getDataRange().getValues(), rucika = isRucikaFitting(), tz = Session.getScriptTimeZone();
  out.totalBaris = Math.max(0, data.length - 1);
  var sig = {}, hari = {}, hariSig = {}, top = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i], raw = row[4];
    if (typeof raw === 'string' && raw.trim()) out.tanggalTeks++;
    var tgl = toDate(raw);
    if (!tgl) { out.tanpaTanggal++; continue; }
    if (!inRange(tgl, range)) continue;
    out.barisBulan++;
    var w = parseFloat(row[5]) || 0, kat;
    if (rucika) kat = getKategoriRucika(_drawingTransaksiRucika(row), _namaItemLengkap(row[6], row[2], row[3]));
    else kat = getKategoriTransaksiV2(row[1], row[2], row[3]);
    if (!kat) { out.barisDikecualikan++; out.dikecualikan += w; continue; }
    out.barisTerhitung++; out.terhitung += w; out.perKategori[kat] = (out.perKategori[kat] || 0) + w;
    if (w < 0) { out.barisNegatif++; out.negatif += w; } else out.positif += w;
    var dk = Utilities.formatDate(tgl, tz, 'yyyy-MM-dd');
    hari[dk] = hari[dk] || { tgl: dk, baris: 0, berat: 0 }; hari[dk].baris++; hari[dk].berat += w;
    var k = [String(row[0]).trim().toUpperCase(), String(row[2]).trim(), String(row[3]).trim(), dk, Math.round(w * 10000) / 10000].join('|');
    if (!sig[k]) sig[k] = { n: 0, item: String(row[0]).trim(), desc: String(row[2]).trim(), tgl: dk, berat: w };
    sig[k].n++;
    hariSig[dk] = hariSig[dk] || { total: 0, dup: 0 }; hariSig[dk].total++;
    top.push({ item: String(row[0]).trim(), desc: String(row[2]).trim(), tgl: dk, berat: w });
  }
  var dups = [];
  Object.keys(sig).forEach(function (k) {
    var g = sig[k]; if (g.n > 1) { out.duplikat.kelompok++; out.duplikat.barisLebih += g.n - 1; out.duplikat.beratLebih += (g.n - 1) * g.berat; dups.push({ item: g.item, desc: g.desc, tgl: g.tgl, berat: g.berat, salinan: g.n, beratLebih: (g.n - 1) * g.berat }); }
  });
  dups.sort(function (a, b) { return Math.abs(b.beratLebih) - Math.abs(a.beratLebih); });
  out.duplikat.contoh = dups.slice(0, 8);
  Object.keys(sig).forEach(function (k) { var g = sig[k]; if (g.n > 1 && hariSig[g.tgl]) hariSig[g.tgl].dup += g.n; }); // semua salinan, termasuk yg pertama
  Object.keys(hariSig).forEach(function (dk) { var h = hariSig[dk]; if (h.total >= 5 && h.dup / h.total >= 0.8) out.hariGanda.push({ tgl: dk, baris: h.total, berat: hari[dk].berat }); });
  top.sort(function (a, b) { return Math.abs(b.berat) - Math.abs(a.berat); });
  out.terbesar = top.slice(0, 8);
  out.perHari = Object.keys(hari).sort().map(function (d) { return hari[d]; });
  return out;
}

function auditProduktivitasFTE(actorNik, bulan, tahun) {
  try {
    if (!_actorIsFullAccess(actorNik) && !_isSuperAdmin(actorNik)) return { success: false, error: 'Akses ditolak -- hanya TL / Admin.' };
    bulan = Number(bulan); tahun = Number(tahun);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID), range = buildIODateRange({ bulan: bulan, tahun: tahun });
    var kirim = _auditSheetTransaksi(ss, SH_KIRIM, range), terima = _auditSheetTransaksi(ss, SH_PRODUKSI, range);

    var kar = getKaryawanList(); if (!kar.success) return kar;
    var aktif = kar.data.filter(function (k) { return k.aktif; });
    var internal = aktif.filter(function (k) { return k.kategori === 'Internal'; }), os = aktif.filter(function (k) { return k.kategori === 'OS'; });
    var lemb = getLemburList({ bulan: bulan, tahun: tahun }), kodeInt = {}; internal.forEach(function (k) { kodeInt[k.kode] = 1; });
    var jamInt = 0; (lemb.success ? lemb.data : []).forEach(function (l) { if (kodeInt[l.kode]) jamInt += Number(l.totalJam) || 0; });
    var fteLembur = internal.length ? jamInt / FTE_STANDAR_JAM_BULAN : 0, totalFTE = internal.length + fteLembur;

    var kg = function (kirimKg, terimaKg, fte) { var avg = (kirimKg + terimaKg) / 2; return { avgKg: Math.round(avg * 100) / 100, ton: fte > 0 ? Math.round(avg / fte / 10) / 100 : 0 }; };
    var asIs = kg(kirim.terhitung, terima.terhitung, totalFTE);
    var tanpaDup = kg(kirim.terhitung - kirim.duplikat.beratLebih, terima.terhitung - terima.duplikat.beratLebih, totalFTE);
    var now = new Date(), berjalan = (bulan === now.getMonth() + 1 && tahun === now.getFullYear());
    var hariBulan = new Date(tahun, bulan, 0).getDate(), hariLewat = berjalan ? now.getDate() : hariBulan;
    var skenario = [
      { nama: 'Perhitungan sekarang', ton: asIs.ton, ket: '(Kirim + Terima) / 2 ÷ ' + (Math.round(totalFTE * 1000) / 1000) + ' FTE' },
      { nama: 'Tanpa baris ganda (identik)', ton: tanpaDup.ton, ket: 'membuang ' + (kirim.duplikat.barisLebih + terima.duplikat.barisLebih) + ' baris kelebihan' },
      { nama: 'Hanya Kirim', ton: totalFTE > 0 ? Math.round(kirim.terhitung / totalFTE / 10) / 100 : 0, ket: 'Kirim ÷ FTE' },
      { nama: 'Hanya Terima', ton: totalFTE > 0 ? Math.round(terima.terhitung / totalFTE / 10) / 100 : 0, ket: 'Terima ÷ FTE' },
      { nama: 'FTE ditambah karyawan OS', ton: (totalFTE + os.length) > 0 ? Math.round(asIs.avgKg / (totalFTE + os.length) / 10) / 100 : 0, ket: totalFTE + os.length > 0 ? 'FTE ' + (Math.round((totalFTE + os.length) * 100) / 100) + ' (internal + ' + os.length + ' OS)' : '' }
    ];
    if (berjalan) skenario.push({ nama: 'Proyeksi akhir bulan', ton: Math.round(asIs.ton * hariBulan / Math.max(1, hariLewat) * 100) / 100, ket: 'data baru s/d tgl ' + hariLewat + ' dari ' + hariBulan + ' hari' });

    var temuan = [];
    var dupTotal = kirim.duplikat.barisLebih + terima.duplikat.barisLebih;
    if (dupTotal > 0) temuan.push({ level: 'danger', teks: 'Ditemukan ' + dupTotal + ' baris identik (item + tanggal + berat sama) -- Kirim ' + kirim.duplikat.barisLebih + ' baris (' + Math.round(kirim.duplikat.beratLebih) + ' Kg), Terima ' + terima.duplikat.barisLebih + ' baris (' + Math.round(terima.duplikat.beratLebih) + ' Kg). Kemungkinan upload ganda / retry upload.' });
    kirim.hariGanda.concat(terima.hariGanda).forEach(function (h) { temuan.push({ level: 'danger', teks: 'Tanggal ' + h.tgl + ' tampak ter-upload 2x atau lebih (hampir semua baris-nya identik, ' + h.baris + ' baris, ' + Math.round(h.berat) + ' Kg).' }); });
    if (kirim.terhitung > 0 && terima.terhitung / kirim.terhitung >= 3) temuan.push({ level: 'warn', teks: 'Terima (' + Math.round(terima.terhitung / 1000) + ' Ton) lebih dari 3x Kirim (' + Math.round(kirim.terhitung / 1000) + ' Ton). Rata-rata (Kirim+Terima)/2 jadi didominasi Terima. Cek baris terbesar & apakah DASHBOARD_PRODUKSI memuat transaksi non-penerimaan.' });
    if (kirim.barisDikecualikan + terima.barisDikecualikan > 0) temuan.push({ level: 'warn', teks: (kirim.barisDikecualikan + terima.barisDikecualikan) + ' baris bulan ini TIDAK dihitung karena kategorinya tidak dikenali (bukan Pipa/Fitting) -- total ' + Math.round(kirim.dikecualikan + terima.dikecualikan) + ' Kg.' });
    if (kirim.tanggalTeks + terima.tanggalTeks > 0) temuan.push({ level: 'warn', teks: (kirim.tanggalTeks + terima.tanggalTeks) + ' sel tanggal berupa TEKS (bukan tanggal asli) -- format dd/mm vs mm/dd bisa salah bulan.' });
    if (kirim.tanpaTanggal + terima.tanpaTanggal > 0) temuan.push({ level: 'warn', teks: (kirim.tanpaTanggal + terima.tanpaTanggal) + ' baris tanpa tanggal terbaca -- tidak ikut terhitung di bulan mana pun.' });
    if (kirim.barisNegatif > 0 && kirim.negatif < 0) temuan.push({ level: 'info', teks: 'Kirim punya ' + kirim.barisNegatif + ' baris minus (retur/koreksi) total ' + Math.round(kirim.negatif) + ' Kg -- ikut mengurangi total.' });
    if (internal.length <= 5) temuan.push({ level: 'info', teks: 'Pembagi FTE hanya ' + internal.length + ' karyawan internal aktif + ' + (Math.round(fteLembur * 1000) / 1000) + ' FTE lembur. Karyawan OS (' + os.length + ' orang) TIDAK ikut sebagai pembagi. Makin sedikit pembagi, makin tinggi Ton/FTE.' });
    if (berjalan) temuan.push({ level: 'info', teks: 'Bulan ini masih berjalan (tgl ' + hariLewat + ' dari ' + hariBulan + '): data Kirim/Terima belum penuh sebulan, sedangkan jumlah karyawan sudah penuh.' });
    if (!temuan.length) temuan.push({ level: 'ok', teks: 'Tidak ada anomali data yang terdeteksi. Angka berasal langsung dari baris sheet.' });

    return { success: true, bulan: bulan, tahun: tahun, berjalan: berjalan,
      kirim: kirim, terima: terima,
      fte: { karyawanInternal: internal.length, namaInternal: internal.map(function (k) { return { kode: k.kode, nama: k.nama, jabatan: k.jabatan }; }), karyawanOS: os.length, nonaktif: kar.data.length - aktif.length, jamLemburInternal: Math.round(jamInt * 100) / 100, fteLembur: Math.round(fteLembur * 10000) / 10000, totalFTE: Math.round(totalFTE * 10000) / 10000, standarJam: FTE_STANDAR_JAM_BULAN },
      hitung: { avgKg: asIs.avgKg, kgPerFTE: totalFTE > 0 ? Math.round(asIs.avgKg / totalFTE * 100) / 100 : 0, tonPerFTE: asIs.ton, target: _targetProduktivitasTonFTE() },
      skenario: skenario, temuan: temuan };
  } catch (e) { return { success: false, error: String(e.message || e) }; }
}


// ================================================================
//  AKURASI QAD vs WMS -- penyimpanan bersama (per workspace)
//  Sheet WMSQAD_DATA: A=sumber (wms|qad), B=tanggal (yyyy-mm-dd),
//                     C=voucher (khusus WMS), D=item, E=nama item, F=qty
//  HANYA kolom di atas yang disimpan. Kolom lain dari file WMS/QAD
//  dibuang di browser SEBELUM dikirim, dan disaring ulang di sini.
//  Baris yang nama itemnya bukan PIPE PPR yang dimaksud juga dibuang.
//  Data TIDAK dikirim ke Supabase (sama seperti Akurasi Scan Barcode).
// ================================================================
var SH_WMSQAD = 'WMSQAD_DATA';
var WMSQAD_PREFIXES = ['PIPE PPR RUCIKA KELEN G REEN DIA', 'PIPE PPR KELEN DIA'];

function _wqSquash(s) { return String(s == null ? '' : s).toUpperCase().replace(/\s+/g, ''); }
function _wqLolos(nama) {
  var s = _wqSquash(nama);
  for (var i = 0; i < WMSQAD_PREFIXES.length; i++) {
    if (s.indexOf(_wqSquash(WMSQAD_PREFIXES[i])) === 0) return true;
  }
  return false;
}
function _wqTgl(v) {
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return v.getFullYear() + '-' + _pad2(v.getMonth() + 1) + '-' + _pad2(v.getDate());
  }
  return String(v == null ? '' : v).trim();
}
function _getOrCreateWmsQadSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_WMSQAD);
  if (!sh) {
    sh = ss.insertSheet(SH_WMSQAD);
    sh.getRange('A1:F1').setValues([['sumber', 'tanggal', 'voucher', 'item', 'nama', 'qty']]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function _wqBaca(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 6).getValues().map(function (r) {
    return [String(r[0]).trim(), _wqTgl(r[1]), String(r[2] == null ? '' : r[2]).trim(),
            String(r[3] == null ? '' : r[3]).trim(), String(r[4] == null ? '' : r[4]).trim(), Number(r[5]) || 0];
  });
}
function _wqTulis(sh, rows) {
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 6).clearContent();
  if (!rows.length) return;
  rows.sort(function (a, b) { return (a[0] + a[1] + a[3]).localeCompare(b[0] + b[1] + b[3]); });
  if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
  sh.getRange(2, 1, rows.length, 5).setNumberFormat('@');
  sh.getRange(2, 1, rows.length, 6).setValues(rows);
}

function getWmsQadData() {
  try {
    var all = _wqBaca(_getOrCreateWmsQadSheet()), wms = [], qad = [];
    all.forEach(function (r) {
      if (r[0] === 'wms') wms.push({ t: r[1], v: r[2], i: r[3], n: r[4], q: r[5] });
      else if (r[0] === 'qad') qad.push({ t: r[1], i: r[3], n: r[4], q: r[5] });
    });
    return { success: true, wms: wms, qad: qad };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  }
}

// kind: 'wms' | 'qad'. jsonStr: array baris. Tanggal yang ada di file diganti
// seluruhnya (upload ulang file yang sama tidak membuat data dobel);
// tanggal lain dibiarkan.
function saveWmsQadData(kind, jsonStr) {
  var lock = LockService.getScriptLock();
  try {
    kind = String(kind || '');
    if (kind !== 'wms' && kind !== 'qad') return { success: false, error: 'Jenis data tidak dikenal: ' + kind };
    var arr = JSON.parse(String(jsonStr || '[]'));
    if (!arr || !arr.length) return { success: false, error: 'Tidak ada baris yang lolos filter untuk disimpan.' };
    var baru = [], tgls = {}, dibuang = 0;
    arr.forEach(function (r) {
      var t = String(r.t || '').trim(), nama = String(r.n || '').replace(/\s+/g, ' ').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || !_wqLolos(nama)) { dibuang++; return; }
      tgls[t] = 1;
      baru.push([kind, t, kind === 'wms' ? String(r.v || '').trim() : '', String(r.i || '').trim(), nama, Number(r.q) || 0]);
    });
    if (!baru.length) return { success: false, error: 'Semua baris ditolak server (tanggal / deskripsi tidak sesuai).' };
    lock.waitLock(25000);
    var sh = _getOrCreateWmsQadSheet();
    var lama = _wqBaca(sh), diganti = 0;
    var sisa = lama.filter(function (r) {
      var hapus = (r[0] === kind && tgls[r[1]]);
      if (hapus) diganti++;
      return !hapus;
    });
    var semua = sisa.concat(baru);
    _wqTulis(sh, semua);
    return { success: true, ditambah: baru.length, diganti: diganti, dibuang: dibuang, tanggal: Object.keys(tgls).sort(), total: semua.length };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// kind: 'wms' | 'qad' | 'semua'. dari/sampai: yyyy-mm-dd (kosong = tanpa batas).
function hapusWmsQadData(kind, dari, sampai) {
  var lock = LockService.getScriptLock();
  try {
    kind = String(kind || '');
    if (kind !== 'wms' && kind !== 'qad' && kind !== 'semua') return { success: false, error: 'Jenis data tidak dikenal: ' + kind };
    dari = String(dari || ''); sampai = String(sampai || '');
    lock.waitLock(25000);
    var sh = _getOrCreateWmsQadSheet();
    var lama = _wqBaca(sh), dihapus = 0;
    var sisa = lama.filter(function (r) {
      var kena = (kind === 'semua' || r[0] === kind) && (!dari || r[1] >= dari) && (!sampai || r[1] <= sampai);
      if (kena) dihapus++;
      return !kena;
    });
    _wqTulis(sh, sisa);
    return { success: true, dihapus: dihapus, sisa: sisa.length };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


// ================================================================
//  KEPATUHAN PIC WMS -- sheet PICWMS_DATA (per workspace)
//  A=sumber (master|jadwal)  B=tanggal  C=no SPM  D=ship to  E=PIC muat
//  master = dari Laporan Persiapan Muat WMS (hanya Ship To, Tgl Muat, No SPM,
//           PIC Muat; kolom lain & item non-PIPE PPR dibuang di browser).
//  jadwal = nomor SPM yang diinput manual.
//  Data TIDAK dikirim ke Supabase.
// ================================================================
var SH_PICWMS = 'PICWMS_DATA';

function _getOrCreatePicWmsSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sh = ss.getSheetByName(SH_PICWMS);
  if (!sh) {
    sh = ss.insertSheet(SH_PICWMS);
    sh.getRange('A1:E1').setValues([['sumber', 'tanggal', 'spm', 'ship_to', 'pic_muat']]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function _pwBaca(sh) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 5).getValues().map(function (r) {
    return [String(r[0]).trim(), _wqTgl(r[1]), String(r[2]).trim(), String(r[3]).trim(), String(r[4]).trim()];
  });
}
function _pwTulis(sh, rows) {
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 5).clearContent();
  if (!rows.length) return;
  rows.sort(function (a, b) { return (a[0] + a[1] + a[2]).localeCompare(b[0] + b[1] + b[2]); });
  if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
  sh.getRange(2, 1, rows.length, 5).setNumberFormat('@');
  sh.getRange(2, 1, rows.length, 5).setValues(rows);
}

function getPicWmsData() {
  try {
    var master = [], jadwal = [];
    _pwBaca(_getOrCreatePicWmsSheet()).forEach(function (r) {
      if (r[0] === 'master') master.push({ t: r[1], s: r[2], c: r[3], p: r[4] });
      else if (r[0] === 'jadwal') jadwal.push({ t: r[1], s: r[2] });
    });
    return { success: true, master: master, jadwal: jadwal };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  }
}

// kind: 'master' | 'jadwal'. Tanggal yang ada di kiriman diganti seluruhnya.
function savePicWmsData(kind, jsonStr) {
  var lock = LockService.getScriptLock();
  try {
    kind = String(kind || '');
    if (kind !== 'master' && kind !== 'jadwal') return { success: false, error: 'Jenis data tidak dikenal: ' + kind };
    var arr = JSON.parse(String(jsonStr || '[]'));
    if (!arr || !arr.length) return { success: false, error: 'Tidak ada baris untuk disimpan.' };
    var baru = [], tgls = {};
    arr.forEach(function (r) {
      var t = String(r.t || '').trim(), s = String(r.s || '').replace(/\s+/g, '').toUpperCase();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || !/^[A-Z0-9]{6,12}$/.test(s)) return;
      tgls[t] = 1;
      baru.push([kind, t, s, kind === 'master' ? String(r.c || '').replace(/\s+/g, ' ').trim() : '', kind === 'master' ? String(r.p || '').replace(/\s+/g, ' ').trim() : '']);
    });
    if (!baru.length) return { success: false, error: 'Semua baris ditolak server (tanggal / nomor SPM tidak valid).' };
    lock.waitLock(25000);
    var sh = _getOrCreatePicWmsSheet(), diganti = 0;
    var sisa = _pwBaca(sh).filter(function (r) {
      var hapus = (r[0] === kind && tgls[r[1]]);
      if (hapus) diganti++;
      return !hapus;
    });
    var semua = sisa.concat(baru);
    _pwTulis(sh, semua);
    return { success: true, ditambah: baru.length, diganti: diganti, tanggal: Object.keys(tgls).sort(), total: semua.length };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// kind: 'master' | 'jadwal' | 'semua'
function hapusPicWmsData(kind, dari, sampai) {
  var lock = LockService.getScriptLock();
  try {
    kind = String(kind || '');
    if (kind !== 'master' && kind !== 'jadwal' && kind !== 'semua') return { success: false, error: 'Jenis data tidak dikenal: ' + kind };
    dari = String(dari || ''); sampai = String(sampai || '');
    lock.waitLock(25000);
    var sh = _getOrCreatePicWmsSheet(), dihapus = 0;
    var sisa = _pwBaca(sh).filter(function (r) {
      var kena = (kind === 'semua' || r[0] === kind) && (!dari || r[1] >= dari) && (!sampai || r[1] <= sampai);
      if (kena) dihapus++;
      return !kena;
    });
    _pwTulis(sh, sisa);
    return { success: true, dihapus: dihapus, sisa: sisa.length };
  } catch (err) {
    return { success: false, error: String(err && err.message || err) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}


// ================================================================
//  MONITORING SUSUN WMS
//  SUSUN_DATA: A=tanggal B=voucher C=nama item D=rak E=qty F=PIC susun
//     (hanya 6 kolom ini; kolom lain & item non PIPE PPR Kelen dibuang,
//      rak hanya I-xx-01-x / J-xx-01-x atau rak bernama item = area transit.
//      Data dobel (voucher+tanggal+rak+qty) otomatis dibuang.)
//  SUSUN_CEK : hasil pencocokan kertas juru lokasi oleh admin
//     k, voucher, rak_wms, qty_wms, rak_kertas, qty_kertas, item_kertas, status, alasan, selesai, adjustment, waktu
//  Tidak dikirim ke Supabase.
// ================================================================
var SH_SUSUN = 'SUSUN_DATA';
var SH_SUSUN_CEK = 'SUSUN_CEK';
var SUSUN_RACK_RE = /^[IJ]-\d{1,2}-01(?:-|$)/;

function _suRakOk(rak) { return _wqLolos(rak) || SUSUN_RACK_RE.test(String(rak).toUpperCase().replace(/\s+/g, '')); }
function _suKey(r) { return r[1] + '|' + r[0] + '|' + String(r[3]).toUpperCase().replace(/\s+/g, '') + '|' + r[4]; }

function _suSheet(name, head) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function _suMaster() { return _suSheet(SH_SUSUN, ['tanggal', 'voucher', 'item', 'rak', 'qty', 'pic_susun']); }
function _suCek() { return _suSheet(SH_SUSUN_CEK, ['k', 'voucher', 'rak_wms', 'qty_wms', 'rak_kertas', 'qty_kertas', 'item_kertas', 'status', 'alasan', 'selesai', 'adjustment', 'waktu']); }
function _suRead(sh, ncol) {
  var last = sh.getLastRow();
  return last < 2 ? [] : sh.getRange(2, 1, last - 1, ncol).getValues();
}
function _suWrite(sh, ncol, rows, textCols) {
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, ncol).clearContent();
  if (!rows.length) return;
  if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
  textCols.forEach(function (c) { sh.getRange(2, c, rows.length, 1).setNumberFormat('@'); });
  sh.getRange(2, 1, rows.length, ncol).setValues(rows);
}
function _suMasterRows() {
  return _suRead(_suMaster(), 6).map(function (r) {
    return [_wqTgl(r[0]), String(r[1]).trim(), String(r[2]).trim(), String(r[3]).trim(), Number(r[4]) || 0, String(r[5]).trim()];
  });
}

function getSusunData() {
  try {
    var master = _suMasterRows().map(function (r) { return { t: r[0], v: r[1], i: r[2], r: r[3], q: r[4], p: r[5] }; });
    var cek = _suRead(_suCek(), 12).map(function (r) {
      return { k: String(r[0]), v: String(r[1]), rw: String(r[2]), qw: Number(r[3]) || 0, rk: String(r[4]), qk: r[5] === '' ? '' : Number(r[5]),
               ik: String(r[6]), st: String(r[7]), rs: String(r[8]), sl: Number(r[9]) ? 1 : 0, adj: String(r[10]), ts: String(r[11]) };
    });
    return { success: true, master: master, cek: cek };
  } catch (err) { return { success: false, error: String(err && err.message || err) }; }
}

// Tambah master susun. Baris yang sudah ada (voucher+tanggal+rak+qty) dibuang otomatis.
function saveSusunMaster(jsonStr) {
  var lock = LockService.getScriptLock();
  try {
    var arr = JSON.parse(String(jsonStr || '[]'));
    if (!arr || !arr.length) return { success: false, error: 'Tidak ada baris untuk disimpan.' };
    lock.waitLock(25000);
    var sh = _suMaster(), lama = _suMasterRows(), have = {};
    lama.forEach(function (r) { have[_suKey(r)] = 1; });
    var baru = [], dobel = 0, dibuang = 0, tgls = {};
    arr.forEach(function (x) {
      var t = String(x.t || '').trim(), v = String(x.v || '').replace(/\s+/g, ''), i = String(x.i || '').replace(/\s+/g, ' ').trim(), rak = String(x.r || '').replace(/\s+/g, ' ').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || !v || !_wqLolos(i) || !_suRakOk(rak)) { dibuang++; return; }
      var row = [t, v, i, rak, Number(x.q) || 0, String(x.p || '').replace(/\s+/g, ' ').trim()], k = _suKey(row);
      if (have[k]) { dobel++; return; }
      have[k] = 1; baru.push(row); tgls[t] = 1;
    });
    var semua = lama.concat(baru).sort(function (a, b) { return (a[0] + a[1] + a[3]).localeCompare(b[0] + b[1] + b[3]); });
    if (baru.length) _suWrite(sh, 6, semua, [1, 2, 3, 4, 6]);
    return { success: true, ditambah: baru.length, dobel: dobel, dibuang: dibuang, tanggal: Object.keys(tgls).sort(), total: semua.length };
  } catch (err) { return { success: false, error: String(err && err.message || err) }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

// Simpan / perbarui hasil pencocokan kertas (kunci k).
function saveSusunCek(jsonStr) {
  var lock = LockService.getScriptLock();
  try {
    var arr = JSON.parse(String(jsonStr || '[]'));
    if (!arr || !arr.length) return { success: false, error: 'Tidak ada data pencocokan.' };
    lock.waitLock(25000);
    var sh = _suCek(), cur = _suRead(sh, 12), map = {}, order = [];
    cur.forEach(function (r) { map[String(r[0])] = r; order.push(String(r[0])); });
    var now = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm'), n = 0;
    arr.forEach(function (c) {
      var k = String(c.k || '').trim(); if (!k) return;
      var st = c.st === 'sesuai' ? 'sesuai' : 'tidak', adj = (c.adj === 'ya' || c.adj === 'belum') ? c.adj : '';
      var row = [k, String(c.v || ''), String(c.rw || ''), Number(c.qw) || 0, String(c.rk || '').trim(), c.qk === '' || c.qk == null ? '' : Number(c.qk),
                 String(c.ik || '').trim(), st, String(c.rs || ''), c.sl ? 1 : 0, adj, now];
      if (!map[k]) order.push(k);
      map[k] = row; n++;
    });
    _suWrite(sh, 12, order.map(function (k) { return map[k]; }), [1, 2, 3, 5, 7, 8, 9, 11, 12]);
    return { success: true, disimpan: n, total: order.length };
  } catch (err) { return { success: false, error: String(err && err.message || err) }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}

// kind: 'master' | 'cek' | 'semua'
function hapusSusunData(kind, dari, sampai) {
  var lock = LockService.getScriptLock();
  try {
    kind = String(kind || '');
    if (kind !== 'master' && kind !== 'cek' && kind !== 'semua') return { success: false, error: 'Jenis data tidak dikenal: ' + kind };
    dari = String(dari || ''); sampai = String(sampai || '');
    lock.waitLock(25000);
    var dihapus = 0, sisaM = null;
    if (kind === 'master' || kind === 'semua') {
      var lama = _suMasterRows();
      sisaM = lama.filter(function (r) { var kena = (!dari || r[0] >= dari) && (!sampai || r[0] <= sampai); if (kena) dihapus++; return !kena; });
      _suWrite(_suMaster(), 6, sisaM, [1, 2, 3, 4, 6]);
    }
    var cs = _suCek(), cur = _suRead(cs, 12), keep;
    if (kind === 'cek') keep = []; else {
      var ada = {}; (sisaM || _suMasterRows()).forEach(function (r) { ada[r[1] + '|' + String(r[3]).toUpperCase().replace(/\s+/g, '') + '|' + r[4]] = 1; });
      keep = cur.filter(function (r) { return ada[String(r[0])]; });          // cek yatim ikut dibuang
    }
    if (kind === 'cek') dihapus = cur.length;
    _suWrite(cs, 12, keep, [1, 2, 3, 5, 7, 8, 9, 11, 12]);
    return { success: true, dihapus: dihapus };
  } catch (err) { return { success: false, error: String(err && err.message || err) }; }
  finally { try { lock.releaseLock(); } catch (e) {} }
}
