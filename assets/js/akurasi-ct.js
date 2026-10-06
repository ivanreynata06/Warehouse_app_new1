/*!
 * akurasi-ct.js
 * -----------------------------------------------------------------
 * Rekap "Akurasi Scan Barcode" untuk halaman Control Tower (index.html).
 * Membaca data yang sama dengan menu Monitoring > Akurasi Scan Barcode
 * (AkurasiStore), menghitung ringkas per periode, lalu menampilkan 3 kartu
 * (Voucher vs Box ID, Voucher vs Backflush, Barcode Out) lengkap dengan
 * grafik alasan belum ter-scan. Bagian ini disembunyikan kalau akun tidak
 * punya menu Akurasi Scan atau belum ada data sama sekali.
 * Butuh: akurasi-core.js, akurasi-store.js, akurasi-reasons.js
 * -----------------------------------------------------------------
 */
(function () {
  'use strict';
  var C = window.AkurasiCore, ST = window.AkurasiStore, RZ = window.AkurasiReasons;
  var sec = document.getElementById('section-akurasi');
  if (!sec || !C || !ST || !RZ) return;

  // Akun yang tidak diberi menu Akurasi Scan tidak perlu melihat rekapnya
  try {
    var raw = sessionStorage.getItem('wh_menu_keys');
    var keys = raw ? JSON.parse(raw) : null;
    if (keys && keys.length && keys.indexOf('akurasi_scan') === -1) return;
  } catch (e) {}

  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var D = null, month = '', res = {};

  function esc(s) { return RZ.esc(s); }
  function fmt(n) { return (Math.round(n) || 0).toLocaleString('id-ID'); }
  function fmtP(p) { return p == null ? '-' : p.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
  function tone(p) { return p == null ? 'na' : (p >= 99 ? 'ok' : (p >= 95 ? 'warn' : 'bad')); }

  function ring(p) {
    var r = 34, c = 2 * Math.PI * r, v = p == null ? 0 : p / 100;
    var col = { ok: 'var(--green)', warn: 'var(--amber)', bad: 'var(--red)', na: 'var(--txt3)' }[tone(p)];
    return '<svg class="ak-ring" viewBox="0 0 84 84" role="img" aria-label="Akurasi ' + fmtP(p) + '">' +
      '<circle cx="42" cy="42" r="' + r + '" fill="none" stroke="var(--border2)" stroke-width="8"></circle>' +
      '<circle cx="42" cy="42" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (c * v) + ' ' + c + '" transform="rotate(-90 42 42)"></circle>' +
      '<text x="42" y="47" text-anchor="middle" class="ak-rt">' + (p == null ? '-' : (p >= 99.95 ? '100%' : p.toLocaleString('id-ID', { maximumFractionDigits: 1 }) + '%')) + '</text></svg>';
  }

  function compute() {
    var vr = D.voucher ? D.voucher.rows : [], std = D.std ? D.std.map : {}, hasStd = Object.keys(std).length > 0;
    var map = (D.alasan && D.alasan.map) || {};
    var raw = {
      'in': (vr.length && hasStd) ? C.summarizeIn(vr, std, {}) : null,
      bfl: (vr.length || D.bfl) ? C.summarizeBfl(vr, D.bfl ? D.bfl.rows : []) : null,
      out: D.ter ? C.summarizeOut(D.ter.rows) : null
    };
    var months = {};
    ['in', 'bfl', 'out'].forEach(function (k) { if (raw[k]) raw[k].days.forEach(function (d) { months[d.date.slice(0, 7)] = 1; }); });
    D._months = Object.keys(months).sort();
    if (!month || D._months.indexOf(month) === -1) {
      // Periode awal = bulan yang datanya paling lengkap (paling banyak jalur terisi), kalau sama pilih yang terbaru
      var best = '', bestN = -1;
      D._months.forEach(function (m) {
        var n = ['in', 'bfl', 'out'].filter(function (k) { return raw[k] && raw[k].days.some(function (d) { return d.date.indexOf(m) === 0; }); }).length;
        if (n >= bestN) { best = m; bestN = n; }
      });
      month = best;
    }
    res = {};
    ['in', 'bfl', 'out'].forEach(function (k) {
      if (!raw[k]) { res[k] = null; return; }
      var days = raw[k].days.filter(function (d) { return !month || d.date.indexOf(month) === 0; });
      var items = raw[k].items.filter(function (i) { return !month || (i.date || '').indexOf(month) === 0; });
      res[k] = { t: C.sumDays(days, k, 'item'), days: days, items: items, sets: RZ.aggregate(k, items, map, items) };
    });
    res.needStd = vr.length > 0 && !hasStd;
  }

  function card(k, name, tag) {
    var r = res[k];
    if (!r || !r.days.length) {
      var msg = k === 'in' && res.needStd ? 'Standar Isi Box belum diupload.' : 'Belum ada data pada periode ini.';
      return '<div class="ak-card nodata"><div class="ak-top">' + ring(null) + '<div><b>' + name + '</b><small>' + tag + '</small><p>' + msg + '</p></div></div></div>';
    }
    var t = r.t, lines;
    if (k === 'in') {
      lines = '<span><b>' + fmt(t.sesuai) + '</b> dari ' + fmt(t.lines) + ' voucher sesuai</span>' +
              '<span class="' + (t.skuSelisih ? 'bad' : '') + '"><b>' + fmt(t.skuSelisih) + '</b> voucher selisih (' + fmt(Math.abs(t.selisih)) + ' pcs)</span>';
    } else if (k === 'bfl') {
      lines = '<span>Di-scan (BFL) <b>' + fmt(t.nBfl) + '</b> dari ' + fmt(t.lines) + ' item</span>' +
              '<span>Manual <b class="' + (t.nManual ? 'warn' : '') + '">' + fmt(t.nManual) + '</b> · TRM <b class="' + (t.nTrm ? 'bad' : '') + '">' + fmt(t.nTrm) + '</b>' + (t.nWait ? ' · Menunggu <b>' + fmt(t.nWait) + '</b>' : '') + '</span>';
    } else {
      lines = '<span><b>' + fmt(t.sesuai) + '</b> dari ' + fmt(t.lines) + ' item sudah ter-scan</span>' +
              '<span class="' + (t.skuSelisih ? 'bad' : '') + '"><b>' + fmt(t.skuSelisih) + '</b> item belum selesai (' + fmt(Math.abs(t.selisih)) + ' pcs)</span>';
    }
    var sets = r.sets.filter(function (s) { return s.total > 0; });
    var charts = sets.length ? sets.map(function (s) { return '<div class="ak-rz">' + RZ.setHtml(s, { size: 84, top: 4 }) + '</div>'; }).join('')
                             : '<div class="ak-rz ak-none">Tidak ada item yang perlu alasan.</div>';
    return '<div class="ak-card"><div class="ak-top">' + ring(t.pct) + '<div><b>' + name + '</b><small>' + tag + (k === 'bfl' ? ' · akurasi scan per item' : '') + '</small>' +
      '<div class="ak-ln">' + lines + '</div></div></div>' + charts + '</div>';
  }

  function render() {
    var ok = D.voucher || D.bfl || D.ter;
    sec.hidden = !ok;
    if (!ok) return;
    var opts = D._months.map(function (m) { var a = m.split('-'); return '<option value="' + m + '"' + (m === month ? ' selected' : '') + '>' + MONTHS[+a[1] - 1] + ' ' + a[0] + '</option>'; }).join('');
    document.getElementById('ak-body').innerHTML =
      '<div class="ak-grid">' + card('in', 'Voucher vs Box ID', 'Barcode In') + card('bfl', 'Voucher vs Backflush', 'Barcode In') + card('out', 'Barcode Out (Scan Out)', 'Barcode Out') + '</div>';
    document.getElementById('ak-month').innerHTML = opts;
    var m = D.voucher || D.bfl || D.ter, meta = m.meta || {};
    document.getElementById('ak-badge').textContent = month ? MONTHS[+month.slice(5) - 1] + ' ' + month.slice(0, 4) : 'Semua';
  }

  window.akOnMonth = function (m) { month = m; compute(); render(); };
  window.akOpen = function () { if (window.navTo) window.navTo('akurasi_scan'); else location.href = 'akurasi_scan.html'; };

  var css = '' +
    '#section-akurasi{display:flex;flex-direction:column;gap:12px;}' +
    '#section-akurasi[hidden]{display:none !important;}' +
    '.ak-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}' +
    '.ak-bar select{background:var(--bg-sunken,#060c18);border:1px solid var(--border2);border-radius:8px;color:var(--txt);font-size:11px;padding:6px 9px;font-family:inherit;}' +
    '.ak-bar button{background:transparent;border:1px solid var(--border2);border-radius:8px;color:var(--txt2);font-size:11px;font-weight:600;padding:6px 11px;cursor:pointer;font-family:inherit;}' +
    '.ak-bar button:hover{color:var(--txt);border-color:var(--cyan-b,#00d4ff);}' +
    '.ak-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}' +
    '.ak-card{background:var(--bg-card2,#0d1830);border:1px solid var(--border);border-radius:var(--radius-sm,10px);padding:14px 14px 16px;display:flex;flex-direction:column;gap:14px;min-width:0;}' +
    '.ak-top{display:grid;grid-template-columns:78px minmax(0,1fr);gap:14px;align-items:center;}' +
    '.ak-ring{width:78px;height:78px;} .ak-rt{font-family:var(--font-disp,Outfit),sans-serif;font-size:16px;font-weight:700;fill:var(--txt);}' +
    '.ak-top b{display:block;font-family:var(--font-disp,Outfit),sans-serif;font-size:13px;font-weight:600;color:var(--txt);}' +
    '.ak-top small{display:block;font-size:10.5px;color:var(--txt3);margin-top:2px;}' +
    '.ak-top p{font-size:11px;color:var(--txt3);margin-top:6px;line-height:1.5;}' +
    '.ak-ln{display:flex;flex-direction:column;gap:3px;margin-top:8px;font-size:11px;color:var(--txt2);}' +
    '.ak-ln b{color:var(--txt);font-variant-numeric:tabular-nums;} .ak-ln .bad,.ak-ln b.bad{color:var(--red);} .ak-ln b.warn{color:var(--amber);}' +
    '.ak-rz{border-top:1px dashed var(--border2);padding-top:12px;} .ak-none{font-size:11px;color:var(--txt3);}' +
    '.ak-card.nodata{opacity:.85;}' +
    '@media(max-width:1180px){.ak-grid{grid-template-columns:1fr;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  document.getElementById('ak-body').innerHTML = '<div style="font-size:11px;color:var(--txt3);padding:6px 2px;">Memuat rekap akurasi scan...</div>';
  ST.load().then(function (r) {
    D = r.data; compute(); render();
  }).catch(function () { sec.hidden = true; });
})();
