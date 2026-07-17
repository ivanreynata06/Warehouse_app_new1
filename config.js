/*!
 * config.js
 * -----------------------------------------------------------------
 * SATU-SATUNYA file yang perlu kamu ubah setiap kali deploy ulang
 * Apps Script.
 *
 * Cara mendapatkan URL:
 *   1. Buka project Apps Script (kode.gs) -> Deploy -> New deployment
 *   2. Type: "Web app"
 *   3. Execute as: Me
 *   4. Who has access: Anyone
 *   5. Deploy -> copy URL yang berakhiran /exec
 *   6. Paste di bawah ini.
 * -----------------------------------------------------------------
 */
window.APPS_SCRIPT_URL = 'PASTE_URL_WEB_APP_APPS_SCRIPT_DI_SINI/exec';

// Berapa lama (ms) data hasil panggilan backend dianggap "masih segar"
// sebelum diambil ulang otomatis. Selama masih segar, saat pindah menu
// atau reload halaman, data akan langsung tampil dari cache (cepat),
// lalu tetap di-refresh diam-diam di belakang layar.
window.APPS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 menit
