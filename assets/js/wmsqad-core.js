/*!
 * wmsqad-core.js
 * -----------------------------------------------------------------
 * Logika murni (tanpa DOM) untuk menu "Akurasi QAD vs WMS":
 *   - membaca file WMS (.xls/.xlsx) dan QAD (.xlsx) dari baris-baris sheet
 *   - MEMBUANG semua kolom selain yang dibutuhkan
 *   - MEMBUANG semua baris yang deskripsinya bukan PIPE PPR yang dimaksud
 *   - mencocokkan transaksi WMS dengan input QAD per tanggal
 *
 * Dipakai bersama oleh upload_data.html (tab WMS & QAD) dan wms_qad.html
 * (monitoring). Bisa juga dijalankan di Node untuk pengujian.
 * -----------------------------------------------------------------
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------------
  // FILTER DESKRIPSI -- hanya item yang namanya DIAWALI salah satu teks ini
  // yang disimpan. Spasi & huruf besar/kecil diabaikan (jadi "G REEN" dan
  // "GREEN" dianggap sama). Ubah daftar ini kalau awalan item bertambah.
  // ------------------------------------------------------------------
  var PREFIXES = [
    'PIPE PPR RUCIKA KELEN G REEN DIA',
    'PIPE PPR KELEN DIA'
  ];
  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function squash(s) { return String(s == null ? '' : s).toUpperCase().replace(/\s+/g, ''); }
  var PFX = PREFIXES.map(squash);
  function lolosNama(nama) {
    var s = squash(nama);
    for (var i = 0; i < PFX.length; i++) if (s.indexOf(PFX[i]) === 0) return true;
    return false;
  }
  function cleanText(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function normHead(v) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(y, m, d) { return y + '-' + p2(m) + '-' + p2(d); }

  // ------------------------------------------------------------------
  // Parser nilai
  // ------------------------------------------------------------------
  // "1032740/2C" -> "1032740": hanya nomor voucher, akhiran setelah "/" bukan bagian parameter
  function voucherNo(v) {
    if (v == null) return '';
    if (typeof v === 'number') return isFinite(v) ? v.toFixed(0) : '';
    return String(v).split('/')[0].replace(/\s+/g, '').trim();
  }
  function parseDate(v) {
    if (v == null || v === '') return '';
    if (v instanceof Date) return isNaN(v) ? '' : ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') {           // serial Excel
      if (!isFinite(v) || v < 20000 || v > 80000) return '';
      var d0 = new Date((Math.floor(v + 1e-6) - 25569) * 864e5);
      return ymd(d0.getUTCFullYear(), d0.getUTCMonth() + 1, d0.getUTCDate());
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return ymd(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) {
      var a = +m[1], b = +m[2];
      if (b > 12 && a <= 12) { var t = a; a = b; b = t; }   // terbalik (mm-dd-yyyy)
      return ymd(+m[3], b, a);               // dd-mm-yyyy (format Indonesia)
    }
    return '';
  }
  function parseQty(v) {
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v == null ? '' : v).replace(/\s/g, '');
    if (!s) return 0;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function parseItem(v) {
    if (typeof v === 'number') return isFinite(v) ? v.toFixed(0) : '';
    return String(v == null ? '' : v).trim();
  }

  // Cari baris judul (maks. 25 baris pertama) yang memuat semua kolom wajib
  function findHeader(rows, mustHave) {
    for (var r = 0; r < Math.min(rows.length, 25); r++) {
      var heads = (rows[r] || []).map(normHead);
      var ok = mustHave.every(function (k) { return heads.indexOf(k) !== -1; });
      if (ok) return { row: r, heads: heads };
    }
    return null;
  }
  function idxOf(heads, names) {
    for (var i = 0; i < names.length; i++) { var x = heads.indexOf(names[i]); if (x !== -1) return x; }
    return -1;
  }

  // ------------------------------------------------------------------
  // WMS: hanya No.Voucher, Item, Nama Item, Qty (+ Tgl Transfer sebagai kunci
  // tanggal, karena data dikelompokkan per tanggal). Kolom lain dibuang.
  // ------------------------------------------------------------------
  function parseWms(rows) {
    var h = findHeader(rows, ['novoucher', 'namaitem']);
    if (!h) throw new Error('Kolom "No.Voucher" dan "Nama Item" tidak ditemukan. Pastikan ini file Voucher Transfer QAD dari WMS.');
    var cV = idxOf(h.heads, ['novoucher']), cI = idxOf(h.heads, ['item', 'itemnumber', 'kodeitem']),
        cN = idxOf(h.heads, ['namaitem']), cQ = idxOf(h.heads, ['qty']),
        cT = idxOf(h.heads, ['tgltransfer', 'tanggaltransfer', 'tgl', 'tanggal']);
    if (cI === -1 || cQ === -1) throw new Error('Kolom "Item" atau "Qty" tidak ditemukan di file WMS.');
    if (cT === -1) throw new Error('Kolom "Tgl Transfer" tidak ditemukan. Kolom ini dipakai sebagai tanggal data.');
    var out = [], st = { total: 0, kept: 0, dropped: 0, noDate: 0 };
    for (var r = h.row + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var nama = cleanText(row[cN]), vou = voucherNo(row[cV]), item = parseItem(row[cI]);
      if (!nama && !vou && !item) continue;           // baris kosong
      st.total++;
      if (!lolosNama(nama)) { st.dropped++; continue; }
      var t = parseDate(row[cT]);
      if (!t) { st.noDate++; continue; }
      out.push({ t: t, v: vou, i: item, n: nama, q: parseQty(row[cQ]) });
      st.kept++;
    }
    return { rows: out, stats: st };
  }

  // ------------------------------------------------------------------
  // QAD: Item Number, Description(1+2), tanggal, Loc Qty Change.
  // dateCol: 'entered' (disarankan, sejajar dengan Tgl Transfer WMS) | 'effective'
  // ------------------------------------------------------------------
  function parseQad(rows, dateCol) {
    var h = findHeader(rows, ['itemnumber', 'locqtychange']);
    if (!h) throw new Error('Kolom "Item Number" dan "Loc Qty Change" tidak ditemukan. Pastikan ini export "Transactions by Item Browse" dari QAD (sheet Data).');
    var cI = idxOf(h.heads, ['itemnumber']), cQ = idxOf(h.heads, ['locqtychange']);
    var cDesc = [];
    h.heads.forEach(function (x, i) { if (x === 'description') cDesc.push(i); });
    if (!cDesc.length) throw new Error('Kolom "Description" tidak ditemukan di file QAD.');
    var cEnt = idxOf(h.heads, ['entereddate']), cEff = idxOf(h.heads, ['effectivedate']);
    // nomor referensi/voucher QAD (opsional) -- dipakai untuk menelusuri input QAD yang tidak punya voucher WMS
    var cRef = idxOf(h.heads, ['document', 'documentno', 'docno', 'nodocument', 'nomordokumen', 'dokumen', 'reference', 'ref', 'referensi', 'nbr', 'ordernbr', 'order', 'trnbr', 'transactionnbr', 'novoucher', 'voucher', 'nomorreferensi', 'lotserial', 'lotref']);
    var VRE = /(?:^|\D)(10\d{5})(?!\d)/;   // pola nomor voucher WMS (mis. 1033248)
    function voucherOf(row) {
      var c, m;
      if (cRef !== -1) { c = voucherNo(row[cRef]); if (c) return c; }
      for (var k = 0; k < row.length; k++) {            // tidak ada kolom referensi dikenal -> cari pola voucher di sel teks lain
        if (k === cI || k === cQ || k === cT || cDesc.indexOf(k) !== -1) continue;
        c = String(row[k] == null ? '' : row[k]).trim();
        if (c.length > 40) continue;
        m = c.match(VRE); if (m) return m[1];
      }
      return '';
    }
    var cT = (dateCol === 'effective') ? (cEff !== -1 ? cEff : cEnt) : (cEnt !== -1 ? cEnt : cEff);
    if (cT === -1) throw new Error('Kolom tanggal ("Entered Date" / "Effective Date") tidak ditemukan di file QAD.');
    var out = [], st = { total: 0, kept: 0, dropped: 0, noDate: 0, withV: 0, refCol: cRef === -1 ? '' : String((rows[h.row] || [])[cRef] || ''), cols: (rows[h.row] || []).map(cleanText).filter(Boolean).slice(0, 30) };
    for (var r = h.row + 1; r < rows.length; r++) {
      var row = rows[r] || [];
      var item = parseItem(row[cI]);
      var nama = cleanText(cDesc.map(function (c) { return row[c]; }).join(' '));
      if (!item && !nama) continue;
      st.total++;
      if (!lolosNama(nama)) { st.dropped++; continue; }
      var t = parseDate(row[cT]);
      if (!t) { st.noDate++; continue; }
      var vv = voucherOf(row);
      out.push({ t: t, i: item, n: nama, q: parseQty(row[cQ]), v: vv });
      st.kept++; if (vv) st.withV = (st.withV || 0) + 1;
    }
    return { rows: out, stats: st };
  }

  // ------------------------------------------------------------------
  // PENCOCOKAN  (per tanggal + item)
  //   1. voucher WMS yang qty-nya sama persis dengan satu input QAD -> SESUAI
  //   2. sisa yang qty-nya beda dipasangkan berdasarkan selisih terkecil -> QTY BEDA
  //   3. sisa voucher WMS tanpa pasangan -> BELUM DIINPUT DI QAD
  //   4. sisa input QAD tanpa pasangan -> TIDAK ADA VOUCHER WMS
  // ------------------------------------------------------------------
  var ST_LABEL = { ok: 'Sesuai', qty: 'Qty berbeda', noqad: 'Belum diinput QAD', nowms: 'Tidak ada di WMS' };

  function shortName(n) {
    var m = String(n || '').match(/DIA\s*(.*)$/i);
    return m ? 'Ø ' + m[1].replace(/^\s+/, '') : String(n || '');
  }
  function mon(t) { return t ? t.slice(0, 7) : ''; }
  function monLabel(ym) { var p = ym.split('-'); return MONTHS[+p[1] - 1] + ' ' + p[0]; }
  function dayLabel(t) { var p = t.split('-'); return +p[2] + ' ' + MON3[+p[1] - 1]; }
  function fmtDate(t) { var p = String(t || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : (t || '-'); }

  function analyze(wms, qad) {
    wms = wms || []; qad = qad || [];
    var groups = {}, keys = [];
    function g(t, i, n) {
      var k = t + '|' + i;
      if (!groups[k]) { groups[k] = { t: t, i: i, n: n || '', W: [], Q: [] }; keys.push(k); }
      if (n && !groups[k].n) groups[k].n = n;
      return groups[k];
    }
    // Voucher QAD dicocokkan ke voucher WMS (item yang sama) di tanggal mana pun.
    var wmsByV = {}, qadV = {};
    wms.forEach(function (r) { if (r.v) wmsByV[r.v + '|' + r.i] = r; });
    qad.forEach(function (r) { if (r.v) qadV[r.v + '|' + r.i] = 1; });
    wms.forEach(function (r) { var G = g(r.t, r.i, r.n); if (!(r.v && qadV[r.v + '|' + r.i])) G.W.push(r); });   // yang vouchernya ada di QAD diurus lewat baris QAD
    qad.forEach(function (r) { g(r.t, r.i, r.n).Q.push(r); });

    var tx = [], items = [], seq = 0;
    keys.sort().forEach(function (k) {
      var G = groups[k], usedQ = {}, leftW = [], pairs = [];
      // 0. QAD yang punya nomor voucher: ada di WMS -> cocok (qty sama = sesuai); tidak ada -> TIDAK SESUAI (voucher QAD tak ada di WMS)
      G.Q.forEach(function (q, j) {
        if (!q.v) return;
        var w = wmsByV[q.v + '|' + q.i];
        usedQ[j] = 1;
        if (w) pairs.push({ w: w, q: q, st: w.q === q.q ? 'ok' : 'qty', byV: true });
        else pairs.push({ w: null, q: q, st: 'nowms', byV: true });
      });
      // 1. (data QAD tanpa nomor voucher) qty sama persis
      G.W.forEach(function (w) {
        var hit = -1;
        for (var j = 0; j < G.Q.length; j++) if (!usedQ[j] && G.Q[j].q === w.q) { hit = j; break; }
        if (hit !== -1) { usedQ[hit] = 1; pairs.push({ w: w, q: G.Q[hit], st: 'ok' }); }
        else leftW.push(w);
      });
      var leftQ = [];
      G.Q.forEach(function (q, j) { if (!usedQ[j]) leftQ.push(q); });
      // 2. pasangkan sisa berdasarkan selisih terkecil
      while (leftW.length && leftQ.length) {
        var bi = 0, bj = 0, best = Infinity;
        for (var a = 0; a < leftW.length; a++) for (var b = 0; b < leftQ.length; b++) {
          var dd = Math.abs(leftW[a].q - leftQ[b].q);
          if (dd < best) { best = dd; bi = a; bj = b; }
        }
        pairs.push({ w: leftW[bi], q: leftQ[bj], st: 'qty' });
        leftW.splice(bi, 1); leftQ.splice(bj, 1);
      }
      leftW.forEach(function (w) { pairs.push({ w: w, q: null, st: 'noqad' }); });
      leftQ.forEach(function (q) { pairs.push({ w: null, q: q, st: 'nowms' }); });

      var it = { t: G.t, i: G.i, n: G.n, wQty: 0, qQty: 0, wCnt: G.W.length, qCnt: G.Q.length, ok: 0, qty: 0, noqad: 0, nowms: 0 };
      pairs.forEach(function (p) {
        var wq = p.w ? p.w.q : null, qq = p.q ? p.q.q : null;
        tx.push({
          id: ++seq, t: G.t, i: G.i, n: G.n, v: p.w ? p.w.v : '', qv: p.q ? (p.q.v || '') : '', byV: !!p.byV,
          wq: wq, qq: qq, diff: (qq == null ? 0 : qq) - (wq == null ? 0 : wq), st: p.st
        });
        it[p.st]++;
        it.wQty += wq || 0; it.qQty += qq || 0;
      });
      it.diff = it.qQty - it.wQty;
      it.bad = it.qty + it.noqad + it.nowms;
      it.st = it.bad ? 'bad' : 'ok';
      items.push(it);
    });
    return { tx: tx, items: items, dates: dates(tx), months: months(tx) };
  }
  function dates(tx) { var s = {}; tx.forEach(function (x) { s[x.t] = 1; }); return Object.keys(s).sort(); }
  function months(tx) { var s = {}; tx.forEach(function (x) { s[mon(x.t)] = 1; }); return Object.keys(s).sort(); }

  // Ringkasan KPI untuk kumpulan transaksi
  function summarize(tx) {
    var o = { total: tx.length, ok: 0, qty: 0, noqad: 0, nowms: 0, bad: 0, wQty: 0, qQty: 0, diff: 0, acc: null, items: 0, itemsBad: 0 };
    var im = {};
    tx.forEach(function (x) {
      o[x.st]++;
      o.wQty += x.wq || 0; o.qQty += x.qq || 0;
      var k = x.t + '|' + x.i; im[k] = im[k] || 0;
      if (x.st !== 'ok') im[k]++;
    });
    o.bad = o.total - o.ok; o.diff = o.qQty - o.wQty;
    o.acc = o.total ? (o.ok / o.total) * 100 : null;
    Object.keys(im).forEach(function (k) { o.items++; if (im[k]) o.itemsBad++; });
    return o;
  }

  // Kalimat penjelasan untuk tiap transaksi bermasalah (bahasa user)
  function explain(x) {
    var nm = shortName(x.n), f = function (n) { return (Number(n) || 0).toLocaleString('id-ID'); };
    if (x.st === 'noqad') return 'Voucher ' + (x.v || '-') + ' (' + f(x.wq) + ') sudah ada di WMS, tetapi belum ada input di QAD.';
    if (x.st === 'nowms') return x.qv
      ? 'Voucher QAD ' + x.qv + ' (' + f(x.qq) + ') TIDAK ditemukan di WMS. Nomor voucher ini tercatat di QAD, tetapi belum ada transfernya di WMS.'
      : 'Ada input QAD ' + f(x.qq) + ' yang tidak punya nomor voucher, dan tidak ada voucher WMS dengan qty yang sama.';
    if (x.st === 'qty') return 'Voucher ' + (x.v || x.qv || '-') + (x.byV ? ' ada di QAD dan WMS' : '') + ': WMS ' + f(x.wq) + ', QAD ' + f(x.qq) + ' (' + (x.diff > 0 ? 'lebih ' : 'kurang ') + f(Math.abs(x.diff)) + ').';
    return 'Sesuai';
  }

  var api = {
    PREFIXES: PREFIXES, MONTHS: MONTHS, ST_LABEL: ST_LABEL,
    lolosNama: lolosNama, parseDate: parseDate, parseQty: parseQty,
    parseWms: parseWms, parseQad: parseQad, analyze: analyze, summarize: summarize,
    shortName: shortName, monLabel: monLabel, dayLabel: dayLabel, fmtDate: fmtDate, mon: mon, explain: explain
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.WmsQadCore = api;
})(typeof window !== 'undefined' ? window : this);
