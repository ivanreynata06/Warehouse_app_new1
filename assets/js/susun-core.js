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
    if (/^C-?FITLK[2L]/.test(rakKey(rak))) return 'lokasi';      // lokasi khusus: C-FITLK2 / C-FITLKL
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
    var out = [], seen = {}, st = { total: 0, kept: 0, dropped: 0, dropRak: 0, noDate: 0, dupFile: 0, susun: 0, transit: 0, lokasi: 0 };
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
    var list = (master || []).filter(function (x) { var k = kategori(x.r); return k === 'susun' || k === 'lokasi' || (k === 'transit' && (all || C[cekKey(x)])); }).map(function (x) {
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

  // ---------- relokasi: transit -> rak ----------
  // Otomatis: voucher yang sama punya baris transit LALU baris rak I/J = sudah direlokasi.
  // Lokasi khusus C-FITLK2 / C-FITLKL: terdeteksi sebagai KANDIDAT relokasi dan perlu dikonfirmasi admin.
  function relocCandidates(master, cek, relokRows) {
    var T = [], L = [], auto = {}, ans = {};
    (master || []).forEach(function (x) { var k = kategori(x.r); if (k === 'transit') T.push(x); else if (k === 'lokasi') L.push(x); });
    var hasRak = {}; (master || []).forEach(function (x) { if (kategori(x.r) === 'susun') hasRak[x.v] = 1; });
    (cek || []).forEach(function (c) { if (String(c.k).indexOf('RELOK|') === 0) ans[c.v] = c; });
    T.forEach(function (t) { if (hasRak[t.v]) auto[t.v] = 1; });
    (relokRows || []).forEach(function (r) { if (r.v) auto[r.v] = 1; });           // sudah ada di laporan relokasi
    var used = {}, out = [];
    L.slice().sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; }).forEach(function (l) {
      var c = T.filter(function (t) { return !used[t.v] && !auto[t.v] && (t.v === l.v || (t.i === l.i && t.q === l.q)) && t.t <= l.t; })
        .sort(function (a, b) { return ((b.v === l.v) - (a.v === l.v)) || (a.t < b.t ? -1 : a.t > b.t ? 1 : 0) || (a.v < b.v ? -1 : 1); })[0];
      if (!c) return;
      used[c.v] = 1; var r = ans[c.v];
      out.push({ k: 'RELOK|' + c.v, tv: c.v, tt: c.t, ti: c.i, tq: c.q, tp: c.p, lv: l.v, lt: l.t, rack: l.r, ans: r ? (r.sl ? 'ya' : 'belum') : '' });
    });
    return out;
  }

  // ---------- kepatuhan operator produksi (area transit) ----------
  // wmsRows: baris master WMS (Akurasi QAD vs WMS) {t,v,i,n,q};  cek: untuk jawaban relokasi
  function analyzeOperator(wmsRows, master, cek, relokRows) {
    var tr = {}, rk = {}, lk = {}, relokYa = {}, rlk = {};
    (relokRows || []).forEach(function (r) { if (r.v) (rlk[r.v] = rlk[r.v] || []).push(r); });
    (master || []).forEach(function (x) { var k = kategori(x.r); if (k === 'transit') (tr[x.v] = tr[x.v] || []).push(x); else if (k === 'susun') (rk[x.v] = rk[x.v] || []).push(x); else if (k === 'lokasi') (lk[x.v] = lk[x.v] || []).push(x); });
    (cek || []).forEach(function (c) { if (String(c.k).indexOf('RELOK|') === 0 && c.sl) relokYa[c.v] = c; });
    var V = {};
    (wmsRows || []).forEach(function (w) {
      var o = V[w.v] = V[w.v] || { v: w.v, t: w.t, i: w.n, q: 0 };
      o.q += Number(w.q) || 0; if (w.t < o.t) o.t = w.t;
    });
    var list = Object.keys(V).map(function (k) {
      var o = V[k], a = tr[k], b = rk[k], l = lk[k], y = relokYa[k];
      var u = rlk[k];
      o.st = u || (a && b) || (a && y) ? 'reloc' : (a ? 'transit' : ((b || l) ? 'rak' : 'belum'));
      var any = a ? a[0] : (b ? b[0] : (l ? l[0] : null));
      o.p = any ? any.p : '';
      o.r = o.st === 'reloc' ? (u ? u[u.length - 1].to : (b ? b.map(function (x) { return x.r; }).join(', ') : y.rw)) : (a ? 'Area transit' : ((b || l) ? (b || l).map(function (x) { return x.r; }).join(', ') : ''));
      o.note = o.st === 'reloc' ? 'Sudah direlokasi' + (u ? ' dari ' + (u[0].from || 'area transit') + ' ke rak ' + o.r + ' (laporan relokasi)' : ' dari area transit ke rak ' + o.r)
        : o.st === 'transit' ? 'Operator produksi telah menyelesaikan inputan area transit'
        : o.st === 'rak' ? 'Voucher sudah disusun ke rak ' + o.r + ' (data juru susun)'
        : 'Operator belum menginput voucher tersebut di WMS';
      return o;
    }).sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : a.v < b.v ? -1 : 1; });
    return { list: list, dates: uniq(list.map(function (x) { return x.t; })), months: uniq(list.map(function (x) { return x.t.slice(0, 7); })) };
  }
  function sumOperator(list) {
    var o = { total: list.length, transit: 0, rak: 0, reloc: 0, belum: 0, pct: null };
    list.forEach(function (x) { o[x.st]++; });
    o.pct = o.total ? (o.transit + o.rak + o.reloc) / o.total * 100 : null;
    return o;
  }
  // ---------- laporan relokasi (template fleksibel) ----------
  var RL_SYN = {
    v: ['novoucher', 'novouchersjt', 'voucher', 'nosjt', 'nomorvoucher', 'novoucherrelokasi', 'norelokasi', 'nodokumen'],
    t: ['tanggalrelokasi', 'tglrelokasi', 'tanggal', 'tgl', 'tanggalproses', 'waktu', 'tanggaltransaksi', 'selesairelokasi'],
    from: ['asalrak', 'rakasal', 'darirak', 'dari', 'asal', 'lokasiasal', 'fromrak', 'rakawal', 'lokasidari'],
    to: ['tujuanrak', 'raktujuan', 'kerak', 'ke', 'tujuan', 'lokasitujuan', 'torak', 'rakbaru', 'lokasike'],
    q: ['qty', 'jumlah', 'qtyrelokasi', 'qtypindah'],
    p: ['picrelokasi', 'pic', 'user', 'operator', 'dikerjakanoleh', 'petugas', 'picsusun', 'jurususun', 'jurusun'],
    i: ['namaitem', 'deskripsi', 'item', 'descitem'],
    // template "Laporan Relokasi": ID Relokasi | Tanggal | Jenis Item | Kode Item | Nama Item | Asal Rak | Tujuan Rak | Asal MC | Tujuan MC | Qty | Jenis Relokasi | Keterangan | Juru Susun
    id: ['idrelokasi', 'idreloc', 'idrelok'],
    kode: ['kodeitem', 'itemnumber', 'kode'],
    jn: ['jenisrelokasi'],
    kt: ['keterangan', 'catatan', 'ket']
  };
  // kolom rak kadang berisi nama item (data relokasi dari area transit / tanpa rak) -> dianggap kosong
  function cleanRak(v) { var x = norm(v); return /^(PIPE|PIPA|RUCIKA|FITTING)\b/i.test(x) ? '' : x; }
  function parseRelokasi(rows, knownVouchers) {
    var h = null, map;
    for (var r = 0; r < Math.min(rows.length, 25) && !h; r++) {
      var hd = (rows[r] || []).map(normHead), m = {};
      Object.keys(RL_SYN).forEach(function (k) { m[k] = idx(hd, RL_SYN[k]); });
      if ((m.v !== -1 || m.id !== -1) && m.t !== -1 && (m.to !== -1 || m.from !== -1)) { h = { row: r, heads: hd }; map = m; }
    }
    if (!h) {
      var seen = (rows[0] || []).concat(rows[1] || []).map(norm).filter(Boolean).slice(0, 14).join(' | ');
      throw new Error('Kolom laporan relokasi belum dikenali. Dibutuhkan minimal: nomor voucher atau ID Relokasi, tanggal, dan rak asal/tujuan. Kolom yang terbaca: ' + (seen || '(kosong)') + '. Kirim template aslinya agar pembaca disesuaikan.');
    }
    var out = [], st = { total: 0, kept: 0, dropped: 0, noDate: 0, voucher: 0 }, vs = {};
    for (var i = h.row + 1; i < rows.length; i++) {
      var row = rows[i] || [], v = map.v === -1 ? '' : vKey(row[map.v]), rid = map.id === -1 ? '' : vKey(row[map.id]);
      if (!v && !rid) continue;
      st.total++;
      var item = map.i === -1 ? '' : norm(row[map.i]);
      if (map.i !== -1 && item && !W.lolosNama(item)) { st.dropped++; continue; }        // bukan PIPE PPR Kelen
      if (map.i === -1 && knownVouchers && v && !knownVouchers[v]) { st.dropped++; continue; }   // tanpa kolom item: pakai voucher yang dikenal
      var t = W.parseDate(row[map.t]);
      if (!t) { st.noDate++; continue; }
      st.kept++; vs[v || ('ID' + rid)] = 1;
      out.push({ t: t, v: v, id: rid, from: map.from === -1 ? '' : cleanRak(row[map.from]), to: map.to === -1 ? '' : cleanRak(row[map.to]), q: map.q === -1 ? 0 : W.parseQty(row[map.q]), p: map.p === -1 ? '' : norm(row[map.p]), i: item, kode: map.kode === -1 ? '' : vKey(row[map.kode]), jn: map.jn === -1 ? '' : norm(row[map.jn]), kt: map.kt === -1 ? '' : norm(row[map.kt]) });
    }
    st.voucher = Object.keys(vs).length;
    return { rows: out, stats: st, detected: Object.keys(map).filter(function (k) { return map[k] !== -1; }) };
  }
  function relDup(r) { if (r.id) return 'ID|' + r.id + '|' + r.t + '|' + rakKey(r.from) + '|' + rakKey(r.to) + '|' + r.q; return r.v + '|' + r.t + '|' + rakKey(r.from) + '|' + rakKey(r.to) + '|' + r.q; }
  function dedupeRelok(newRows, existing) {
    var have = {}, add = [], dup = 0;
    (existing || []).forEach(function (r) { have[relDup(r)] = 1; });
    newRows.forEach(function (r) { var k = relDup(r); if (have[k]) dup++; else { have[k] = 1; add.push(r); } });
    return { add: add, dup: dup };
  }

  // histori relokasi gabungan: upload > konfirmasi admin (C-FITLK) > otomatis (transit lalu rak I/J)
  function relokHistory(master, relokRows, cek) {
    var out = [], have = {};
    function push(e) { var k = e.id ? 'ID|' + e.id + '|' + rakKey(e.to) : e.v + '|' + rakKey(e.to); if (have[k]) return; have[k] = 1; out.push(e); }
    var tr = {}; (master || []).forEach(function (x) { if (kategori(x.r) === 'transit') { var o = tr[x.v]; if (!o || x.t < o.t) tr[x.v] = x; } });
    (relokRows || []).forEach(function (r) { push({ v: r.v, id: r.id || '', kt: r.kt || '', jn: r.jn || '', t: r.t, from: r.from || (r.v && tr[r.v] ? 'Area transit' : ''), to: r.to, q: r.q || (r.v && tr[r.v] ? tr[r.v].q : 0), i: r.i || (r.v && tr[r.v] ? tr[r.v].i : ''), p: r.p, src: 'upload', tt: r.v && tr[r.v] ? tr[r.v].t : '' }); });
    (cek || []).forEach(function (c) {
      if (String(c.k).indexOf('RELOK|') !== 0 || !c.sl) return;
      var t0 = tr[c.v]; push({ v: c.v, t: String(c.ts || '').slice(0, 10) || (t0 ? t0.t : ''), from: 'Area transit', to: c.rw, q: c.qw, i: t0 ? t0.i : '', p: '', src: 'konfirmasi', tt: t0 ? t0.t : '' });
    });
    (master || []).forEach(function (x) {
      if (kategori(x.r) !== 'susun' || !tr[x.v] || x.t < tr[x.v].t) return;
      push({ v: x.v, t: x.t, from: 'Area transit', to: x.r, q: x.q, i: x.i, p: x.p, src: 'otomatis', tt: tr[x.v].t });
    });
    out.forEach(function (e) { e.days = e.tt && e.t ? Math.max(0, Math.round((Date.parse(e.t) - Date.parse(e.tt)) / 864e5)) : null; });
    return out.sort(function (a, b) { return a.t < b.t ? 1 : a.t > b.t ? -1 : (a.v < b.v ? -1 : 1); });
  }
  // aging: voucher yang masih di area transit (belum direlokasi) lebih lama dari batas jam
  function agingTransit(master, history, nowMs, hours) {
    var done = {}; (history || []).forEach(function (e) { done[e.v] = 1; });
    var hasRak = {}; (master || []).forEach(function (x) { if (kategori(x.r) !== 'transit') hasRak[x.v] = 1; });
    var out = [], seen = {};
    (master || []).forEach(function (x) {
      if (kategori(x.r) !== 'transit' || done[x.v] || hasRak[x.v] || seen[x.v]) return;
      seen[x.v] = 1;
      var h = (nowMs - Date.parse(x.t + 'T00:00:00')) / 36e5;
      if (h >= hours) out.push({ v: x.v, t: x.t, i: x.i, q: x.q, p: x.p, hours: Math.round(h), days: Math.floor(h / 24) });
    });
    return out.sort(function (a, b) { return b.hours - a.hours; });
  }
  // jejak satu voucher dari semua sumber
  function timeline(v, master, relokRows, cek, wmsRows) {
    var ev = [];
    (wmsRows || []).forEach(function (w) { if (w.v === v) ev.push({ t: w.t, k: 'wms', title: 'Voucher transfer WMS', det: 'Qty ' + w.q }); });
    (master || []).forEach(function (x) {
      if (x.v !== v) return; var k = kategori(x.r);
      ev.push({ t: x.t, k: k === 'transit' ? 'transit' : 'rak', title: k === 'transit' ? 'Masuk area transit' : 'Disusun ke rak ' + x.r, det: 'Qty ' + x.q + (x.p ? ' · PIC ' + x.p : '') });
    });
    (relokRows || []).forEach(function (r) { if ((r.v && r.v === v) || (r.id && v === 'ID ' + r.id)) ev.push({ t: r.t, k: 'reloc', title: 'Relokasi ' + (r.from || '?') + ' → ' + (r.to || '?'), det: (r.q ? 'Qty ' + r.q : '') + (r.p ? ' · PIC ' + r.p : '') + (r.jn ? ' · ' + r.jn : '') + (r.kt ? ' · ' + r.kt : '') }); });
    (cek || []).forEach(function (c) {
      if (c.v !== v) return;
      if (String(c.k).indexOf('RELOK|') === 0) ev.push({ t: String(c.ts || '').slice(0, 10), k: 'konf', title: c.sl ? 'Admin mengonfirmasi relokasi ke ' + c.rw : 'Admin: relokasi belum dilakukan', det: '' });
      else ev.push({ t: String(c.ts || '').slice(0, 10), k: c.st === 'sesuai' ? 'ok' : 'bad', title: c.st === 'sesuai' ? 'Dicocokkan dengan kertas: sesuai' : 'Dicocokkan dengan kertas: tidak sesuai', det: note(c) });
    });
    return ev.filter(function (e) { return e.t; }).sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
  }

  // ---------- OCR kertas juru lokasi: ambil rak, qty, voucher, ukuran dari teks hasil baca ----------
  function parseKertas(text, itemNames) {
    var t = String(text || '').replace(/[|]/g, ' '), out = { rak: '', qty: '', voucher: '', item: '', found: [] };
    var m = t.match(/\b([IJ1l])\s*[-–—.]\s*(\d{1,2})\s*[-–—.]\s*0?[1l]\s*[-–—.]\s*([A-Z0-9])\b/i);
    if (m) { out.rak = (m[1].toUpperCase() === 'J' ? 'J' : 'I') + '-' + (m[2].length === 1 ? '0' + m[2] : m[2]) + '-01-' + m[3].toUpperCase(); out.found.push('rak'); }
    var lk = t.match(/C\s*-?\s*FITLK\s*([2L])/i); if (!out.rak && lk) { out.rak = 'C-FITLK' + lk[1].toUpperCase(); out.found.push('rak'); }
    var v = t.match(/\b(10\d{5})\b/); if (v) { out.voucher = v[1]; out.found.push('voucher'); }
    var clean = t.replace(/\b10\d{5}\b/g, ' ').replace(/\d{1,2}\s*[-\/]\s*\d{1,2}\s*[-\/]\s*\d{2,4}/g, ' ').replace(/[IJ]\s*[-–—.]\s*\d{1,2}\s*[-–—.]\s*\d{1,2}\s*[-–—.]\s*[A-Z0-9]/gi, ' ');
    var uq = clean.match(/(\d[\d.]{1,6})\s*(?:btg|batang|pcs|bh|batg)/i);
    if (uq) out.qty = uq[1].replace(/\./g, '');
    else { var nums = (clean.match(/\b\d{2,5}\b/g) || []).filter(function (x) { return !/^(10|16|20|25|32|40|50|63|75|90|110|160)$/.test(x) || true; }); if (nums.length) out.qty = nums.sort(function (a, b) { return b.length - a.length || +b - +a; })[0]; }
    if (out.qty) out.found.push('qty');
    var sz = t.match(/(?:[Ø⌀]|\bdia)\s*(\d{2,3})\b/i) || t.match(/(?:^|\s)[0O]\s+(\d{2,3})\s*PN/i) || t.match(/\b(\d{2,3})\s*PN\s*\d{2}/i), pn = t.match(/PN\s*(\d{2})/i);
    if (sz && itemNames) {
      var best = null;
      itemNames.forEach(function (n) { var mm = String(n).match(/(\d+)\s*mm/i); if (mm && mm[1] === sz[1]) { if (!best || (pn && new RegExp('PN\\s*' + pn[1], 'i').test(n))) best = n; } });
      if (best) { out.item = best; out.found.push('item'); }
    }
    return out;
  }

  function uniq(a) { var s = {}; a.forEach(function (x) { if (x) s[x] = 1; }); return Object.keys(s).sort(); }

  var api = { parseKertas: parseKertas, rakLabel: rakLabel, fullName: fullName, kategori: kategori, parseMaster: parseMaster, dedupe: dedupe, dupKey: dupKey, cekKey: cekKey, matchEntry: matchEntry, note: note,
    analyzeSusun: analyzeSusun, sumSusun: sumSusun, analyzeOperator: analyzeOperator, sumOperator: sumOperator, relocCandidates: relocCandidates, parseRelokasi: parseRelokasi, dedupeRelok: dedupeRelok, relokHistory: relokHistory, agingTransit: agingTransit, timeline: timeline, rakKey: rakKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SusunCore = api;
})(typeof window !== 'undefined' ? window : this);
