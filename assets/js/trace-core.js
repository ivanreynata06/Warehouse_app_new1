/*!
 * trace-core.js -- penelusuran penyebab selisih Akurasi QAD vs WMS
 * Aturan berbasis pola (bukan tebakan acak). Tiap selisih dicocokkan dengan histori
 * laporan muat, laporan susun, dan relokasi, lalu diberi skor kemungkinan penyebab,
 * PIC yang perlu mengecek, dan langkah cek. Skor disetel oleh umpan balik PIC
 * ("Benar" / "Bukan penyebab").
 */
(function (root) {
  'use strict';
  var W = root.WmsQadCore || (typeof require !== 'undefined' ? require('./wmsqad-core.js') : null);

  function sq(s) { return String(s == null ? '' : s).toUpperCase().replace(/\s+/g, ''); }
  function dayDiff(a, b) { return Math.abs(Math.round((Date.parse(a) - Date.parse(b)) / 864e5)); }
  function dist(a, b) {                       // Damerau-Levenshtein untuk deret digit
    var la = a.length, lb = b.length, d = [], i, j;
    for (i = 0; i <= la; i++) d[i] = [i];
    for (j = 0; j <= lb; j++) d[0][j] = j;
    for (i = 1; i <= la; i++) for (j = 1; j <= lb; j++) {
      var c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[la][lb];
  }
  // salah ketik angka: dua digit tertukar (625 vs 652), digit hilang/lebih (625 vs 62), atau
  // satu digit salah tetapi selisihnya kecil (625 vs 626). 300 vs 500 BUKAN salah ketik.
  function digitSlip(a, b) {
    var x = String(Math.round(a)), y = String(Math.round(b));
    if (a === b || x.length < 2 || y.length < 2 || dist(x, y) !== 1) return false;
    if (x.length !== y.length) return true;
    var d = []; for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) d.push(i);
    if (d.length === 2 && x[d[0]] === y[d[1]] && x[d[1]] === y[d[0]]) return true;
    return Math.abs(a - b) <= Math.max(10, Math.max(a, b) * 0.15);
  }

  var LABEL = {
    qty_typo: 'Salah ketik qty saat input', item_swap: 'Item tertukar saat input', date_shift: 'Input bergeser ke tanggal lain',
    susun_qty: 'Qty di laporan susun berbeda', susun_done: 'Sudah disusun, belum diinput di QAD', pick_diff: 'Kemungkinan salah ambil saat muat',
    muat_match: 'Qty QAD sama dengan qty muat SPM', belum_input: 'Voucher belum diinput di QAD', tanpa_voucher: 'Input QAD tanpa voucher WMS', selisih_qty: 'Selisih qty belum terjelaskan'
  };

  // ctx: { tx, muat:[{t,s,c,p,i,q}], susun:[{t,v,i,r,q,p}], fb:{cause:{ya,bukan}} }
  function trace(x, ctx) {
    var all = ctx.tx || [], muat = ctx.muat || [], susun = ctx.susun || [], fb = ctx.fb || {};
    var nm = sq(x.n), out = [];
    function add(key, base, pic, check, evidence) {
      var f = fb[key] || { ya: 0, bukan: 0 }, m = Math.max(0.6, Math.min(1.4, (f.ya + 1) / (f.ya + f.bukan + 2) * 2));
      out.push({ key: key, label: LABEL[key], score: Math.min(98, Math.round(base * m)), base: base, pic: pic, check: check, evidence: evidence });
    }
    var unQ = all.filter(function (y) { return y.st === 'nowms' && y !== x; });       // input QAD tanpa voucher
    var unW = all.filter(function (y) { return y.st === 'noqad' && y !== x; });       // voucher tanpa input QAD
    var W_ = x.wq, Q_ = x.qq;

    if (x.st === 'noqad' || x.st === 'qty') {
      var w = W_;
      if (x.st === 'qty' && digitSlip(w, Q_)) add('qty_typo', 88, 'Operator input QAD', 'Cek ulang qty di QAD: tercatat ' + Q_ + ', di WMS ' + w + '.', 'Beda satu angka (' + Q_ + ' vs ' + w + ')');
      if (x.st === 'noqad') {
        unQ.filter(function (y) { return sq(y.n) === nm && dayDiff(y.t, x.t) <= 1 && digitSlip(w, y.qq); }).slice(0, 1).forEach(function (y) {
          add('qty_typo', 85, 'Operator input QAD', 'Input QAD ' + y.qq + ' (' + W.fmtDate(y.t) + ') kemungkinan maksudnya ' + w + ' (voucher ' + (x.v || '-') + ').', 'Input QAD tanpa voucher ' + y.qq + ' mirip qty voucher ' + w);
        });
        unQ.filter(function (y) { return sq(y.n) !== nm && y.t === x.t && y.qq === w; }).slice(0, 1).forEach(function (y) {
          add('item_swap', 80, 'Operator input QAD', 'Qty ' + w + ' justru tercatat di item lain: ' + W.shortName(y.n) + '. Pindahkan ke item ' + W.shortName(x.n) + '.', 'Qty sama pada tanggal sama, item berbeda');
        });
        unQ.filter(function (y) { return sq(y.n) === nm && y.qq === w && y.t !== x.t && dayDiff(y.t, x.t) <= 3; }).slice(0, 1).forEach(function (y) {
          add('date_shift', 75, 'Operator input QAD', 'Input QAD ' + w + ' ada di tanggal ' + W.fmtDate(y.t) + ', padahal voucher WMS tanggal ' + W.fmtDate(x.t) + '. Cek Entered Date.', 'Qty dan item sama, tanggal berbeda ' + dayDiff(y.t, x.t) + ' hari');
        });
      }
      // laporan susun untuk voucher yang sama
      var sv = susun.filter(function (s) { return x.v && s.v === x.v; });
      if (sv.length) {
        var sum = sv.reduce(function (a, s) { return a + s.q; }, 0), pic = sv[0].p || 'Juru susun';
        if (sum !== w) add('susun_qty', 70, pic, 'Hitung fisik: laporan susun mencatat ' + sum + ', voucher WMS ' + w + '. Cek qty yang disusun.', 'Laporan susun voucher ' + x.v + ' = ' + sum);
        else if (x.st === 'noqad') add('susun_done', 65, 'Operator input QAD', 'Voucher ' + x.v + ' sudah disusun (' + sv[0].r + '), tinggal diinput di QAD.', 'Ada di laporan susun, tidak ada di QAD');
      }
      // salah ambil: selisih sama dengan qty muat satu SPM
      if (x.st === 'qty') {
        var d = Math.abs(w - Q_);
        muat.filter(function (m) { return sq(m.i) === nm && dayDiff(m.t, x.t) <= 1 && m.q === d; }).slice(0, 1).forEach(function (m) {
          add('pick_diff', 72, m.p || 'PIC muat', 'Selisih ' + d + ' sama dengan qty muat SPM ' + m.s + ' (' + (m.c || '-') + '). Cek apakah barang diambil dari voucher/rak yang salah.', 'SPM ' + m.s + ', PIC muat ' + (m.p || '-'));
        });
      }
    }
    if (x.st === 'nowms') {
      var q = Q_;
      unW.filter(function (y) { return sq(y.n) === nm && dayDiff(y.t, x.t) <= 1 && digitSlip(y.wq, q); }).slice(0, 1).forEach(function (y) {
        add('qty_typo', 85, 'Operator input QAD', 'Input QAD ' + q + ' kemungkinan untuk voucher ' + (y.v || '-') + ' (' + y.wq + ').', 'Mirip qty voucher ' + y.wq);
      });
      unW.filter(function (y) { return sq(y.n) !== nm && y.t === x.t && y.wq === q; }).slice(0, 1).forEach(function (y) {
        add('item_swap', 80, 'Operator input QAD', 'Qty ' + q + ' cocok dengan voucher ' + (y.v || '-') + ' item ' + W.shortName(y.n) + '. Item di QAD mungkin tertukar.', 'Qty sama, item berbeda');
      });
      unW.filter(function (y) { return sq(y.n) === nm && y.wq === q && y.t !== x.t && dayDiff(y.t, x.t) <= 3; }).slice(0, 1).forEach(function (y) {
        add('date_shift', 75, 'Operator input QAD', 'Cocok dengan voucher ' + (y.v || '-') + ' tanggal ' + W.fmtDate(y.t) + '. Cek Entered Date.', 'Tanggal berbeda ' + dayDiff(y.t, x.t) + ' hari');
      });
      muat.filter(function (m) { return sq(m.i) === nm && dayDiff(m.t, x.t) <= 1 && m.q === q; }).slice(0, 1).forEach(function (m) {
        add('muat_match', 60, m.p || 'PIC muat', 'Qty ' + q + ' sama dengan muat SPM ' + m.s + '. Pastikan transfer WMS untuk pengambilan ini sudah dibuat.', 'SPM ' + m.s + ', PIC muat ' + (m.p || '-'));
      });
    }
    if (!out.length) {
      if (x.st === 'noqad') add('belum_input', 50, 'Operator input QAD', 'Voucher ' + (x.v || '-') + ' belum diinput di QAD. Input atau konfirmasi apakah transfer dibatalkan.', 'Tidak ditemukan input QAD yang mirip');
      else if (x.st === 'nowms') add('tanpa_voucher', 45, 'Admin WMS', 'Tidak ada voucher WMS yang cocok. Cek apakah transfer WMS belum dibuat.', 'Tidak ditemukan voucher WMS yang mirip');
      else add('selisih_qty', 40, 'Operator input QAD', 'Bandingkan qty fisik dengan WMS (' + W_ + ') dan QAD (' + Q_ + ').', 'Tidak ada pola yang cocok');
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 3);
  }

  function fbKey(x) { return x.t + '|' + x.i + '|' + x.st + '|' + (x.v || '') + '|' + x.wq + '|' + x.qq; }
  // ringkas umpan balik: [{k,cause,ans}] -> {cause:{ya,bukan}}
  function fbStats(list) {
    var m = {}; (list || []).forEach(function (r) { var o = m[r.cause] = m[r.cause] || { ya: 0, bukan: 0 }; if (r.ans === 'ya') o.ya++; else if (r.ans === 'bukan') o.bukan++; });
    return m;
  }

  var api = { trace: trace, fbKey: fbKey, fbStats: fbStats, digitSlip: digitSlip, LABEL: LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TraceCore = api;
})(typeof window !== 'undefined' ? window : this);
