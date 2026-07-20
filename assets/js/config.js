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
window.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwgwpJCXVnmdwGjmOAAxieYweUEZQUdVXoX-v6eP9R6QYvNb1QJ0hZyxiuMK6EgLbIqlw/exec';

// Berapa lama (ms) data hasil panggilan backend dianggap "masih segar"
// sebelum diambil ulang otomatis. Selama masih segar, saat pindah menu
// atau reload halaman, data akan langsung tampil dari cache (cepat),
// lalu tetap di-refresh diam-diam di belakang layar.
window.APPS_CACHE_TTL_MS = 3 * 60 * 1000; // 3 menit

// Nomor versi situs — dipakai sebagai cache-buster (?v=...) saat pindah
// menu (lihat navTo()/goTo() di tiap halaman). SELAMA angka ini SAMA,
// browser boleh pakai cache normal saat pindah-pindah menu (cepat).
// Naikkan angka ini SETIAP kali ada file HTML/JS yang diupdate, supaya
// semua pengguna otomatis dapat versi terbaru tanpa perlu hard refresh.
window.SITE_VERSION = '20260720a';
