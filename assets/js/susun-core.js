/*!
 * susun-core.js -- logika murni menu "Monitoring Susun WMS"
 *  - baca Laporan Susun Voucher: hanya No. Voucher/SJT, Tanggal Susun, Nama Item,
 *    Rak, Qty, PIC Susun; item selain PIPE PPR Kelen & rak di luar aturan dibuang
 *  - hapus data dobel otomatis (voucher + tanggal + rak + qty)
 *  - pencocokan input kertas (juru lokasi) dengan data WMS
 *  - kepatuhan operator produksi (area transit) terhadap voucher WMS
 * Bergantung pada wmsqad-core.js.
 */
(function (root) {
  'use strict';
  var W = root.WmsQadCore || (typeof require !== 'undefined' ? require('./wmsqad-core.js') : null);

  // Rak reguler yang dipakai: I-xx-01-x dan J-xx-01-x. Rak yang berisi NAMA ITEM = area transit.
  var RACK_SUSUN = /^[IJ]-\d{1,2}-01(?:-|$)/;

  function norm(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function normHead(v) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  // nama item lengkap untuk ditampilkan (rapikan 'G REEN' -> 'GREEN')
  function fullName(n) { return norm(n).replace(/\bG\s+REEN\b/i, 'GREEN'); }
  function rakKey(r) { return String(r == null ? '' : r).toUpperCase().replace(/\s+/g, ''); }
  function vKey(v) { return typeof v === 'number' ? v.toFixed(0) : String(v == null ? '' : v).replace(/\s+/g, ''); }
  function idx(heads, names) { for (var i = 0; i < names.length; i++) { var x = heads.indexOf(names[i]); if (x !== -1) return x; } return -1; }
  function kategori(rak) {
    if (W.lolosNama(rak)) return 'transit';
    if (RACK_SUSUN.test(rakKey(rak))) return 'susun';
    return '';
  }
  function rakLabel(r) { return kategori(r) === 'transit' ? 'Area transit' : r; }
  function dupKey(r) { return r.v + '|' + r.t + '|' + rakKey(r.r) + '|' + r.q; }

  // ---------- master susun ----------
  function parseMaster(rows) {
    var h = null;
    for (var r = 0; r < Math.min(rows.length, 25) && !h; r++) {
      var hd = (rows[r] || []).map(normHead);
      if (idx(hd, ['novouchersjt', 'novoucher']) !== -1 && hd.indexOf('tanggalsusun') !== -1) h = { row: r, heads: hd };
    }
    if (!h) throw new Error('Kolom "No. Voucher / SJT" dan "Tanggal Susun" tidak ditemukan. Pastikan ini file Laporan Susun Voucher dari WMS.');
    var cV = idx(h.heads, ['novouchersjt', 'novoucher']), cT = h.heads.indexOf('tanggalsusun'), cN = idx(h.heads, ['namaitem']),
        cR = idx(h.heads, ['rak']), cQ = idx(h.heads, ['qty']), cP = idx(h.heads, ['picsusun']);
    if (cN === -1 || cR === -1 || cQ === -1) throw new Error('Kolom "Nama Item", "Rak", atau "Qty" tidak ditemukan.');
    var out = [], seen = {}, st = { total: 0, kept: 0, dropped: 0, dropRak: 0, noDate: 0, dupFile: 0, susun: 0, transit: 0 };
    for (var i = h.row + 1; i < rows.length; i++) {
      var row = rows[i] || [], v = vKey(row[cV]);
      if (!v) continue;
      st.total++;
      var nama = norm(row[cN]);
      if (!W.lolosNama(nama)) { st.dropped++; continue; }
      var rak = norm(row[cR]), kat = kategori(rak);
      if (!kat) { st.dropRak++; continue; }
      var t = W.parseDate(row[cT]);
      if (!t) { st.noDate++; continue; }
      var rec = { t: t, v: v, i: nama, r: rak, q: W.parseQty(row[cQ]), p: cP === -1 ? '' : norm(row[cP]) };
      var k = dupKey(rec);
      if (seen[k]) { st.dupFile++; continue; }          // dobel di dalam file
      seen[k] = 1; st[kat]++; st.kept++;
      out.push(rec);
    }
    return { rows: out, stats: st };
  }
  // buang baris yang sudah ada di data tersimpan (upload dobel)
  function dedupe(newRows, existing) {
    var have = {}, add = [], dup = 0;
    (existing || []).forEach(function (r) { have[dupKey(r)] = 1; });
    newRows.forEach(function (r) { var k = dupKey(r); if (have[k]) dup++; else { have[k] = 1; add.push(r); } });
    return { add: add, dup: dup };
  }

  // ---------- pencocokan input kertas ----------
  function cekKey(row) { return row.v + '|' + rakKey(row.r) + '|' + row.q; }
  function sameItem(a, b) { return rakKey(a) === rakKey(b); }
  // entry: {v, i, q, r}  (dari kertas juru lokasi)
  function matchEntry(master, entry) {
    var v = vKey(entry.v), rows = (master || []).filter(function (x) { return x.v === v; });
    if (!v) return { code: 'kosong' };
    if (!rows.length) return { code: 'novoucher', v: v };
    var rk = rakKey(entry.r), q = entry.q === '' || entry.q == null ? null : Number(entry.q);
    function sameRak(x) { return rakKey(x.r) === rk || (kategori(x.r) === 'transit' && /TRANSIT/.test(rk)); }
    var hit = rows.filter(sameRak);
    var row = (hit.length ? hit : rows).slice().sort(function (a, b) { return (q != null && b.q === q) - (q != null && a.q === q); })[0];
    var f = { rak: sameRak(row), qty: q == null ? true : row.q === q, item: !entry.i || sameItem(row.i, entry.i) };
    var reasons = []; if (!f.rak) reasons.push('rak'); if (!f.qty) reasons.push('qty'); if (!f.item) reasons.push('item');
    return { code: 'ok', row: row, flags: f, reasons: reasons, st: reasons.length ? 'tidak' : 'sesuai',
      rec: { k: cekKey(row), v: row.v, rw: row.r, qw: row.q, rk: norm(entry.r).toUpperCase(), qk: q == null ? '' : q, ik: entry.i || '', st: reasons.length ? 'tidak' : 'sesuai', rs: reasons.join(','), sl: 0, adj: '' } };
  }
  function note(c, row) {
    if (!c) return '';
    if (c.st === 'sesuai') return 'Rak, qty, dan item sesuai dengan kertas';
    var p = [], f = (c.rs || '').split(',');
    if (f.indexOf('rak') !== -1) p.push('Tidak sesuai rak: kertas ' + (c.rk || '-') + ', ' + (kategori(c.rw) === 'transit' ? 'WMS masih di area transit' : 'WMS ' + c.rw));
    if (f.indexOf('qty') !== -1) p.push('qty kertas ' + c.qk + ', WMS ' + c.qw);
    if (f.indexOf('item') !== -1) p.push('item kertas berbeda dengan WMS');
    return p.join(' · ');
  }

  // ---------- analisis juru susun (rak I/J) ----------
  // opts.all = true -> sertakan juga voucher area transit (untuk form pengisian).
  // Default: rak I/J, ditambah voucher transit yang SUDAH dicocokkan dengan kertas.
  function analyzeSusun(master, cek, opts) {
    var C = {}; (cek || []).forEach(function (c) { C[c.k] = c; });
    var all = !!(opts && opts.all);
    var list = (master || []).filter(function (x) { var k = kategori(x.r); return k === 'susun' || (k === 'transit' && (all || C[cekKey(x)])); }).map(function (x) {
      var k = cekKey(x), c = C[k], st = 'belum';
      if (c) st = c.st === 'sesuai' ? 'sesuai' : (c.sl ? 'selesai' : 'tidak');
      return { k: k, t: x.t, v: x.v, i: x.i, r: x.r, rl: rakLabel(x.r), transit: kategori(x.r) === 'transit', q: x.q, p: x.p, cek: c || null, st: st, adj: c ? c.adj : '', note: note(c, x) };
    }).sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : a.v < b.v ? -1 : 1; });
    return { list: list, dates: uniq(list.map(function (x) { return x.t; })), months: uniq(list.map(function (x) { return x.t.slice(0, 7); })) };
  }
  function sumSusun(list) {
    var o = { total: list.length, belum: 0, sesuai: 0, tidak: 0, selesai: 0, adjYa: 0, adjBelum: 0, dicek: 0, acc: null, prog: null, resolved: null };
    list.forEach(function (x) { o[x.st]++; if (x.st === 'selesai') { if (x.adj === 'ya') o.adjYa++; else o.adjBelum++; } });
    o.dicek = o.total - o.belum;
    o.acc = o.dicek ? o.sesuai / o.dicek * 100 : null;
    o.prog = o.total ? o.dicek / o.total * 100 : null;
    var bad = o.tidak + o.selesai; o.resolved = bad ? o.selesai / bad * 100 : null;
    return o;
  }

  // ---------- kepatuhan operator produksi (area transit) ----------
  // wmsRows: baris master WMS (Akurasi QAD vs WMS) {t,v,i,n,q}
  function analyzeOperator(wmsRows, master) {
    var tr = {}, rk = {};
    (master || []).forEach(function (x) { var k = kategori(x.r); if (k === 'transit') (tr[x.v] = tr[x.v] || []).push(x); else if (k === 'susun') (rk[x.v] = rk[x.v] || []).push(x); });
    var V = {};
    (wmsRows || []).forEach(function (w) {
      var o = V[w.v] = V[w.v] || { v: w.v, t: w.t, i: w.n, q: 0 };
      o.q += Number(w.q) || 0; if (w.t < o.t) o.t = w.t;
    });
    var list = Object.keys(V).map(function (k) {
      var o = V[k], a = tr[k], b = rk[k];
      o.st = a ? 'transit' : (b ? 'rak' : 'belum');
      o.p = a ? a[0].p : (b ? b[0].p : '');
      o.r = a ? 'Area transit' : (b ? b.map(function (x) { return x.r; }).join(', ') : '');
      o.note = o.st === 'transit' ? 'Operator produksi telah menyelesaikan inputan area transit'
        : o.st === 'rak' ? 'Voucher sudah disusun ke rak ' + o.r + ' (data juru susun)'
        : 'Operator belum menginput voucher tersebut di WMS';
      return o;
    }).sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : a.v < b.v ? -1 : 1; });
    return { list: list, dates: uniq(list.map(function (x) { return x.t; })), months: uniq(list.map(function (x) { return x.t.slice(0, 7); })) };
  }
  function sumOperator(list) {
    var o = { total: list.length, transit: 0, rak: 0, belum: 0, pct: null };
    list.forEach(function (x) { o[x.st]++; });
    o.pct = o.total ? (o.transit + o.rak) / o.total * 100 : null;
    return o;
  }
  function uniq(a) { var s = {}; a.forEach(function (x) { if (x) s[x] = 1; }); return Object.keys(s).sort(); }

  var api = { rakLabel: rakLabel, fullName: fullName, kategori: kategori, parseMaster: parseMaster, dedupe: dedupe, dupKey: dupKey, cekKey: cekKey, matchEntry: matchEntry, note: note,
    analyzeSusun: analyzeSusun, sumSusun: sumSusun, analyzeOperator: analyzeOperator, sumOperator: sumOperator, rakKey: rakKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SusunCore = api;
})(typeof window !== 'undefined' ? window : this);
