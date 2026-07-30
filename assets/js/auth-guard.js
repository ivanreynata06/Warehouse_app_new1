/**
 * auth-guard.js
 * Dipasang di SEMUA halaman kecuali login.html. Cek apakah user sudah
 * login (workspace tersimpan di sessionStorage) -- kalau belum, langsung
 * redirect ke login.html sebelum halaman sempat menampilkan data apapun.
 *
 * HARUS di-load PALING AWAL di <head>, sebelum script lain (config.js,
 * api-shim.js, dst), supaya redirect terjadi secepat mungkin.
 */
(function () {
  var workspace = null, nik = null;
  try {
    workspace = sessionStorage.getItem('wh_workspace');
    nik = sessionStorage.getItem('wh_nik');
  } catch (e) { /* sessionStorage diblokir browser -> anggap belum login */ }

  if (!workspace || !nik) {
    var here = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (here !== 'login.html') {
      window.location.replace('./login.html');
    }
    return;
  }

  // Info sesi yang sedang login, dipakai halaman lain (nama di header, dst)
  window.WH_SESSION = {
    workspace: workspace,
    nik: nik,
    nama: sessionStorage.getItem('wh_nama') || '',
    role: sessionStorage.getItem('wh_role') || '',
    // Rekap Muatan sengaja CUMA ada di departemen Fitting Import (sheet-nya
    // tidak di-provision di departemen lain) -- dipakai untuk sembunyikan
    // menu & section terkait di halaman manapun secara otomatis.
    hasRekapMuatan: workspace === 'cibitung_fitting_import'
  };

  document.addEventListener('DOMContentLoaded', function () {
    if (window.WH_SESSION.hasRekapMuatan) return;
    // Sembunyikan menu sidebar "Rekap Muatan" (pola onclick="navTo('rekap')"
    // atau onclick="goTo('rekap')" -- dipakai konsisten di semua halaman)
    document.querySelectorAll('[onclick*="\'rekap\'"]').forEach(function (el) {
      el.style.display = 'none';
    });
    // Sembunyikan section "Rekap Muatan per PIC" khusus di Control Tower
    var sec = document.getElementById('section-rekap-muatan');
    if (sec) sec.style.display = 'none';
  });
})();

// Dipanggil dari tombol "Logout" di halaman manapun
function whLogout() {
  try { sessionStorage.clear(); } catch (e) {}
  window.location.href = './login.html';
}
