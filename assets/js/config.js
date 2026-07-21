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
window.SITE_VERSION = '20260721e';

// ------------------------------------------------------------
// SUPABASE (opsional, buat percepat loading dashboard Stock/
// Kanban/Rekap Muatan/Control Tower — Loading Time TETAP pakai
// Apps Script langsung karena sifatnya real-time).
// Aman dipublikasikan: anon key ini memang didesain untuk publik,
// perlindungannya lewat Row Level Security (RLS) di sisi Supabase
// (cuma boleh baca, tidak boleh ubah data).
// ------------------------------------------------------------
window.SUPABASE_URL = 'https://lfplllzsvpbgzcftcgmi.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmcGxsbHpzdnBiZ3pjZnRjZ21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1OTUyMTUsImV4cCI6MjEwMDE3MTIxNX0.ZvIuXS2DyWjws_nUaIhstE1MoyzLsjfXZyy4hwHnXlU';
