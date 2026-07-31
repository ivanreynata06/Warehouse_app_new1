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

  // Klasifikasi akses berdasarkan Role (kolom Role di sheet AKUN_LOGIN):
  //  - TL / Admin (mengandung kata "Admin", mis. "Admin Wh Fitting") -> FULL ACCESS
  //  - Role lain (Technician I, dst) -> AKSES TERBATAS, cuma boleh:
  //    Control Tower, Input Lembur (+Cuti), Loading Time, Monitoring FTE
  var roleUpper = (sessionStorage.getItem('wh_role') || '').trim().toUpperCase();
  var fullAccess = (roleUpper === 'TL') || roleUpper.indexOf('ADMIN') !== -1;
  var ALLOWED_FILES_RESTRICTED = ['index.html', 'input_lembur.html', 'residance_time.html', 'fte_dashboard.html', 'login.html', ''];
  // Menu sidebar yang harus disembunyikan untuk role terbatas (pola onclick
  // navTo('kanban') / navTo('index') dipakai konsisten di semua halaman;
  // 'index' = key menu utk Monitoring Stock, lihat PAGE_MAP di index.html)
  var HIDDEN_NAV_KEYS_RESTRICTED = ['kanban', 'index'];

  // Info sesi yang sedang login, dipakai halaman lain (nama di header, dst)
  window.WH_SESSION = {
    workspace: workspace,
    nik: nik,
    nama: sessionStorage.getItem('wh_nama') || '',
    role: sessionStorage.getItem('wh_role') || '',
    fullAccess: fullAccess,
    // Rekap Muatan sengaja CUMA ada di departemen Fitting Import (sheet-nya
    // tidak di-provision di departemen lain) DAN cuma untuk TL/Admin --
    // dipakai untuk sembunyikan menu & section terkait secara otomatis.
    hasRekapMuatan: workspace === 'cibitung_fitting_import' && fullAccess
  };

  // Role terbatas coba buka halaman yang tidak diizinkan -> tendang ke Control Tower
  if (!fullAccess) {
    var hereFile = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (ALLOWED_FILES_RESTRICTED.indexOf(hereFile) === -1) {
      window.location.replace('./index.html');
      return;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!window.WH_SESSION.fullAccess) {
      HIDDEN_NAV_KEYS_RESTRICTED.forEach(function (key) {
        document.querySelectorAll('[onclick*="\'' + key + '\'"]').forEach(function (el) {
          el.style.display = 'none';
        });
      });
    }

    // ---- Grup menu "Monitoring" ----
    // Menggabungkan Monitoring Stock, Monitoring Kanban, dan Monitoring FTE
    // (dulunya Monitoring FTE nempel di dalam grup "Transaksi") jadi satu
    // dropdown baru "Monitoring" di level atas. "Dashboard WH Import"
    // sengaja TIDAK dimasukkan -- tetap berdiri sendiri di luar grup ini.
    (function buildMonitoringGroup(){
      var stockEl  = document.querySelector('[onclick*="\'index\'"]');
      var kanbanEl = document.querySelector('[onclick*="\'kanban\'"]');
      var fteEl    = document.querySelector('[onclick*="\'fte_dashboard\'"]');
      if (!stockEl && !kanbanEl && !fteEl) return; // halaman ini tidak punya menu-menu ini

      var wrapper = document.createElement('div');
      wrapper.className = 'mgroup open';
      wrapper.innerHTML =
        '<div class="mgroup-hdr" onclick="this.parentElement.classList.toggle(\'open\')">' +
          '<div class="mgroup-hdr-left"><i data-lucide="monitor" style="width:12px;flex-shrink:0;"></i><span>Monitoring</span></div>' +
          '<svg class="chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' +
        '</div>' +
        '<div class="mgroup-body"></div>';

      var anchor = stockEl || kanbanEl || fteEl;
      anchor.parentElement.insertBefore(wrapper, anchor);
      var body = wrapper.querySelector('.mgroup-body');
      if (stockEl)  body.appendChild(stockEl);
      if (kanbanEl) body.appendChild(kanbanEl);
      if (fteEl)    body.appendChild(fteEl);

      if (typeof lucide !== 'undefined') lucide.createIcons();
    })();

    // ---- Menu "Pengajuan Cuti" ----
    // Disisipkan otomatis tepat setelah menu "Input Lembur" di SEMUA
    // halaman (bukan edit manual tiap file). Untuk TL, menu "Input Lembur"
    // aslinya malah disembunyikan (TL tidak input lembur lewat sana,
    // cukup approve) -- tapi tetap dapat menu "Pengajuan Cuti" karena TL
    // juga bisa mengajukan cuti/sakit/mangkir untuk dirinya sendiri.
    var lemburMenuEl = document.querySelector('[onclick*="\'input_lembur\'"]');
    if (lemburMenuEl) {
      var cutiMenuEl = lemburMenuEl.cloneNode(true);
      cutiMenuEl.setAttribute('onclick', "location.href='./input_lembur.html?tab=cuti'");
      var labelEl = cutiMenuEl.querySelector('span');
      if (labelEl) labelEl.textContent = 'Pengajuan Cuti';
      lemburMenuEl.insertAdjacentElement('afterend', cutiMenuEl);

      var roleUp = (window.WH_SESSION.role || '').trim().toUpperCase();
      if (roleUp === 'TL') {
        lemburMenuEl.style.display = 'none'; // TL: sembunyikan "Input Lembur", sisakan "Pengajuan Cuti"
      }
    }

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
