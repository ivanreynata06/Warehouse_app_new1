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
  var isTL = (roleUpper === 'TL');
  var ALLOWED_FILES_RESTRICTED = ['index.html', 'input_lembur.html', 'residance_time.html', 'fte_dashboard.html', 'login.html', ''];
  // Menu sidebar yang harus disembunyikan untuk role terbatas (pola onclick
  // navTo('kanban') / navTo('index') dipakai konsisten di semua halaman;
  // 'index' = key menu utk Monitoring Stock, lihat PAGE_MAP di index.html)
  var HIDDEN_NAV_KEYS_RESTRICTED = ['kanban', 'index'];

  // ---- Departemen/Plant selain Fitting Import (Cibitung) ----
  // Sengaja dibatasi jauh lebih sempit daripada Fitting Import: HANYA
  // Monitoring FTE, Monitoring Stock, dan Input Lembur -- berlaku untuk
  // SEMUA role (bukan cuma role terbatas), karena menu lain (Control
  // Tower, Kanban, Rekap Muatan, Loading Time, Upload Data Harian) belum
  // relevan/di-provision untuk departemen itu. Aturan/algoritma lain
  // (approval, FTE, dst) TETAP SAMA seperti Fitting Import -- yang beda
  // cuma menu yang tersedia. Kalau nanti ada permintaan menu tambahan
  // (mis. Control Tower) untuk departemen tertentu, longgarkan di sini.
  var isFittingImport = workspace === 'cibitung_fitting_import';
  var ALLOWED_FILES_OTHER_DEPT = ['monitoring_stock.html', 'input_lembur.html', 'fte_dashboard.html', 'admin_users.html', 'upload_data.html', 'login.html', ''];
  var HIDDEN_NAV_KEYS_OTHER_DEPT = ['wh_control_tower', 'kanban', 'residance', 'rekap'];
  // Upload Data Harian: SEKARANG diizinkan untuk departemen lain juga
  // (sebelumnya diblokir total), tapi khusus tab Outbound & Inbound --
  // tab Stock tetap KHUSUS Fitting Import (dicek juga di dalam
  // upload_data.html sendiri lewat window.WH_SESSION.isFittingImport).

  // "Upload Data Harian" -- SEBELUMNYA dibatasi ke 2 NIK spesifik
  // hardcode (Ivan, Saepulloh), jadi admin baru di plant/departemen lain
  // (mis. Lemah Abang) TIDAK bisa akses walau role-nya "Admin". Sekarang
  // digeneralisasi: SEMUA role TL / mengandung "ADMIN" boleh akses (sama
  // seperti fullAccess di atas) -- tab Stock tetap otomatis disembunyikan
  // untuk departemen selain Fitting Import (lihat
  // restrictStockTabForOtherDept() di upload_data.html), jadi Admin/TL
  // departemen lain cuma lihat Outbound & Inbound, sesuai yang diminta.
  var canUploadData = fullAccess;

  // Info sesi yang sedang login, dipakai halaman lain (nama di header, dst)
  window.WH_SESSION = {
    workspace: workspace,
    nik: nik,
    nama: sessionStorage.getItem('wh_nama') || '',
    role: sessionStorage.getItem('wh_role') || '',
    fullAccess: fullAccess,
    isTL: isTL,
    canUploadData: canUploadData,
    isFittingImport: isFittingImport,
    // Rekap Muatan sengaja CUMA ada di departemen Fitting Import (sheet-nya
    // tidak di-provision di departemen lain) -- boleh dilihat SEMUA role
    // (termasuk Technician), asal masih di departemen Fitting Import.
    hasRekapMuatan: isFittingImport
  };

  // ---- Departemen selain Fitting Import: batasi ke 3 halaman inti ----
  // Dicek PALING AWAL (sebelum aturan role) karena berlaku untuk SEMUA
  // role -- bukan cuma role terbatas.
  if (!isFittingImport) {
    var hereFileDept = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (ALLOWED_FILES_OTHER_DEPT.indexOf(hereFileDept) === -1) {
      window.location.replace('./monitoring_stock.html');
      return;
    }
  }

  // Role terbatas coba buka halaman yang tidak diizinkan -> tendang ke Control Tower
  if (isFittingImport && !fullAccess) {
    var hereFile = (window.location.pathname.split('/').pop() || '').toLowerCase();
    // Rekap Muatan BUKAN halaman "admin-only" -- boleh dibuka role apa pun
    // (termasuk Technician) SELAMA workspace-nya memang punya Rekap Muatan
    // (hasRekapMuatan). Sebelumnya file ini ketinggalan dari daftar, jadi
    // walaupun hasRekapMuatan true, tetap ketendang ke Control Tower.
    var allowedNow = ALLOWED_FILES_RESTRICTED.slice();
    if (window.WH_SESSION.hasRekapMuatan) allowedNow.push('rekap_muatan.html');
    if (allowedNow.indexOf(hereFile) === -1) {
      window.location.replace('./index.html');
      return;
    }
  }

  // Panel Admin (Kelola User) -- khusus TL/Admin, berlaku di SEMUA
  // departemen. Role terbatas coba buka langsung lewat URL -> tendang.
  if (!fullAccess) {
    var hereFileAdmin = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (hereFileAdmin === 'admin_users.html') {
      window.location.replace(isFittingImport ? './index.html' : './monitoring_stock.html');
      return;
    }
  }

  // Upload Data Harian: blokir akses LANGSUNG lewat URL juga (bukan cuma
  // sembunyikan menunya) -- untuk role terbatas (bukan TL/Admin).
  if (!canUploadData) {
    var hereFile2 = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if (hereFile2 === 'upload_data.html') {
      window.location.replace('./index.html');
      return;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    // ================================================================
    //  USERBAR MENGAMBANG -- Selamat Pagi/Siang/Sore/Malam + nama user
    //  yang login + tombol Logout, SELALU muncul di pojok kanan atas di
    //  SEMUA halaman & SEMUA akun, TIDAK tergantung sidebar terbuka/
    //  tertutup (sebelumnya greeting cuma ada di index.html, dan Logout
    //  cuma nempel di menu sidebar -- kalau sidebar tersembunyi/di-
    //  collapse, mis. di layar sempit, Logout jadi tidak kelihatan sama
    //  sekali). index.html DILEWATI krn sudah punya versi sendiri
    //  (greeting-badge + user-session-badge + tombol Logout di topbar).
    // ================================================================
    (function injectFloatingUserBar() {
      if (document.getElementById('greeting-badge') || document.getElementById('user-session-badge')) return; // halaman ini sudah punya versinya sendiri
      if (document.getElementById('wh-userbar')) return; // jaga2 anti dobel
      try {
        var jam = new Date().getHours();
        var salam = jam < 11 ? 'Selamat Pagi' : jam < 15 ? 'Selamat Siang' : jam < 19 ? 'Selamat Sore' : 'Selamat Malam';
        var nama = String(window.WH_SESSION.nama || '').trim() || window.WH_SESSION.nik;
        var namaAman = nama.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });

        var bar = document.createElement('div');
        bar.id = 'wh-userbar';
        bar.style.cssText = 'position:fixed;top:10px;right:14px;z-index:99999;display:flex;align-items:center;gap:8px;' +
          'background:rgba(18,20,30,.94);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.09);' +
          'border-radius:999px;padding:6px 8px 6px 14px;font-family:inherit;font-size:11px;line-height:1;' +
          'color:#e8eaf0;box-shadow:0 4px 16px rgba(0,0,0,.35);';
        bar.innerHTML =
          '<span style="opacity:.7;white-space:nowrap;">' + salam + ',</span>' +
          '<span style="font-weight:700;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;">' + namaAman + '</span>' +
          '<button type="button" onclick="whLogout()" title="Logout" ' +
            'style="display:flex;align-items:center;gap:4px;background:rgba(255,80,80,.14);border:1px solid rgba(255,80,80,.35);' +
            'color:#ff8f8f;border-radius:999px;padding:5px 11px;cursor:pointer;font-size:10.5px;font-weight:700;white-space:nowrap;">' +
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Logout</button>';
        document.body.appendChild(bar);
      } catch (e) { /* jangan sampai userbar gagal bikin seluruh halaman error */ }
    })();

    // ---- Departemen selain Fitting Import: sembunyikan menu di luar
    //      3 menu inti (Monitoring FTE, Monitoring Stock, Input Lembur) ----
    if (!window.WH_SESSION.isFittingImport) {
      HIDDEN_NAV_KEYS_OTHER_DEPT.forEach(function (key) {
        document.querySelectorAll('[onclick*="\'' + key + '\'"]').forEach(function (el) {
          el.style.display = 'none';
        });
      });
    }

    if (window.WH_SESSION.isFittingImport && !window.WH_SESSION.fullAccess) {
      HIDDEN_NAV_KEYS_RESTRICTED.forEach(function (key) {
        document.querySelectorAll('[onclick*="\'' + key + '\'"]').forEach(function (el) {
          el.style.display = 'none';
        });
      });
    }

    // ---- Menu "Kelola User" (Panel Admin) -- disisipkan otomatis di
    //      SEMUA halaman untuk TL/Admin, berlaku di SEMUA departemen.
    //      Pakai location.href langsung (bukan navTo()) supaya tidak
    //      perlu edit PAGE_MAP di tiap halaman satu-satu. ----
    if (window.WH_SESSION.fullAccess) {
      var sidebarEl = document.getElementById('sidebar');
      var hereFileNow = (window.location.pathname.split('/').pop() || '').toLowerCase();
      if (sidebarEl && !document.getElementById('mitem-kelola-user')) {
        var adminItem = document.createElement('div');
        adminItem.id = 'mitem-kelola-user';
        adminItem.className = 'mitem' + (hereFileNow === 'admin_users.html' ? ' active' : '');
        adminItem.setAttribute('onclick', "location.href='./admin_users.html?v='+(window.SITE_VERSION||Date.now())");
        adminItem.innerHTML = '<i data-lucide="shield" style="width:12px;flex-shrink:0;"></i><span>Kelola User</span>';
        sidebarEl.appendChild(adminItem);
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }

    // Sembunyikan menu "Upload Data Harian" untuk role terbatas (bukan
    // TL/Admin) -- lihat canUploadData di atas (sekarang berbasis role,
    // bukan lagi hardcode NIK tertentu).
    if (!window.WH_SESSION.canUploadData) {
      document.querySelectorAll('[onclick*="\'upload\'"]').forEach(function (el) {
        el.style.display = 'none';
      });
    }

    // ---- Tombol "Logout" -- disisipkan otomatis di SEMUA halaman ----
    // Sebelumnya cuma ada di 2 dari 9 halaman (ditulis manual, gampang
    // kelewat kalau bikin halaman baru). Sekarang selalu ada dimana pun,
    // konsisten, tanpa perlu edit tiap file satu-satu.
    if (document.getElementById('sidebar') && !document.querySelector('[onclick*="whLogout"]')) {
      var logoutItem = document.createElement('div');
      logoutItem.id = 'mitem-logout';
      logoutItem.className = 'mitem';
      logoutItem.setAttribute('onclick', 'whLogout()');
      logoutItem.innerHTML = '<i data-lucide="log-out" style="width:12px;flex-shrink:0;"></i><span>Logout</span>';
      document.getElementById('sidebar').appendChild(logoutItem);
      if (typeof lucide !== 'undefined') lucide.createIcons();
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
      var rekapEl  = document.querySelector('[onclick*="\'rekap\'"]');
      if (!stockEl && !kanbanEl && !fteEl && !rekapEl) return; // halaman ini tidak punya menu-menu ini

      var wrapper = document.createElement('div');
      wrapper.className = 'mgroup open';
      wrapper.innerHTML =
        '<div class="mgroup-hdr" onclick="this.parentElement.classList.toggle(\'open\')">' +
          '<div class="mgroup-hdr-left"><i data-lucide="monitor" style="width:12px;flex-shrink:0;"></i><span>Monitoring</span></div>' +
          '<svg class="chev" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>' +
        '</div>' +
        '<div class="mgroup-body"></div>';

      var anchor = stockEl || kanbanEl || fteEl || rekapEl;
      anchor.parentElement.insertBefore(wrapper, anchor);
      var body = wrapper.querySelector('.mgroup-body');
      if (stockEl)  body.appendChild(stockEl);
      if (kanbanEl) body.appendChild(kanbanEl);
      if (fteEl)    body.appendChild(fteEl);
      // Rekap Muatan: cuma dipindah ke grup Monitoring kalau memang boleh
      // tampil (departemen Fitting Import); kalau tidak, biarkan tetap di
      // luar supaya logic sembunyikan di bawah (hasRekapMuatan false) tetap
      // jalan seperti biasa.
      if (rekapEl && window.WH_SESSION.hasRekapMuatan) body.appendChild(rekapEl);

      if (typeof lucide !== 'undefined') lucide.createIcons();
    })();

    // ---- Menu "Input Lembur" / "Pengajuan Cuti" ----
    // Disisipkan & disesuaikan otomatis di SEMUA halaman (bukan edit
    // manual tiap file), tergantung role:
    //  - TL      : menu asli DIGANTI NAMA jadi "Inputan Karyawan" (tetap
    //              ke input_lembur.html), PLUS tetap dapat menu terpisah
    //              "Pengajuan Cuti" untuk cuti/sakit/mangkir dirinya sendiri.
    //  - Technician (role terbatas): DIGABUNG jadi SATU menu saja,
    //              "Input Lemburan, Cuti DLL" -- tidak perlu menu Pengajuan
    //              Cuti terpisah karena halamannya sudah punya 2 tab.
    //  - Role lain (Admin dkk): dibiarkan default (Input Lembur + Pengajuan
    //              Cuti terpisah, nama asli).
    var lemburMenuEl = document.querySelector('[onclick*="\'input_lembur\'"]');
    if (lemburMenuEl) {
      var roleUp = (window.WH_SESSION.role || '').trim().toUpperCase();
      var labelEl = lemburMenuEl.querySelector('span');

      if (roleUp === 'TL') {
        if (labelEl) labelEl.textContent = 'Inputan Karyawan';
        var cutiMenuEl = lemburMenuEl.cloneNode(true);
        cutiMenuEl.setAttribute('onclick', "location.href='./input_lembur.html?tab=cuti'");
        var cutiLabelEl = cutiMenuEl.querySelector('span');
        if (cutiLabelEl) cutiLabelEl.textContent = 'Pengajuan Cuti';
        lemburMenuEl.insertAdjacentElement('afterend', cutiMenuEl);
      } else if (!window.WH_SESSION.fullAccess) {
        if (labelEl) labelEl.textContent = 'Input Lemburan, Cuti DLL';
        // Technician: tidak perlu menu Pengajuan Cuti terpisah, 1 menu ini
        // sudah membuka halaman yang sama dengan 2 tab (Lembur & Cuti).
      } else {
        var cutiMenuEl2 = lemburMenuEl.cloneNode(true);
        cutiMenuEl2.setAttribute('onclick', "location.href='./input_lembur.html?tab=cuti'");
        var cutiLabelEl2 = cutiMenuEl2.querySelector('span');
        if (cutiLabelEl2) cutiLabelEl2.textContent = 'Pengajuan Cuti';
        lemburMenuEl.insertAdjacentElement('afterend', cutiMenuEl2);
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
