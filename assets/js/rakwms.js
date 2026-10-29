/*!
 * rakwms.js  --  Akurasi Rak WMS (tab di Monitoring Stock Opname)
 * -----------------------------------------------------------------
 * - Data TIDAK dikirim/disimpan ke Supabase maupun Google Spreadsheet.
 *   Semua hanya hidup di browser PIC (localStorage), dipisah per nama user.
 * - File Informasi Rak WMS: hanya kolom Lokasi, Area, Rak, Kode Item,
 *   Nama Item, Onhand yang dipakai; lokasi dikunci C-FITLK2. Kolom lain
 *   langsung dibuang saat upload.
 * - File Saldo QAD: hanya Item, Deskripsi, Qty yang dipakai.
 * - Template adjustment (xlsx) mengikuti adjust_item.xlsx:
 *   Tanggal | Site | Location | Rak | Kode Item | Keterangan | Qty | Kode Kategori
 *   Qty NEGATIF bila saldo rak lebih banyak dari aktual (kurangi),
 *   POSITIF polos bila kurang (tambah).
 * -----------------------------------------------------------------
 */
(function (root) {
  'use strict';
  var LOC = 'C-FITLK2', SITE = 10021;
  var GROUPS = ['I053', 'Q055'];   // SEMENTARA: fitur hanya untuk group I053 (Pipa PPR) & Q055 (Fitting)
  function inferGroup(nama) { return /^PIPE\b/i.test(String(nama || '').trim()) ? 'I053' : 'Q055'; }
  var HEAD = ['Tanggal', 'Site', 'Location', 'Rak', 'Kode Item', 'Keterangan', 'Qty', 'Kode Kategori'];
  var NS = {};

  /* ================= util ================= */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n || 0).toLocaleString('id-ID'); }
  function num(v) { if (typeof v === 'number') return isFinite(v) ? v : 0; var n = Number(String(v == null ? '' : v).replace(/,/g, '').trim()); return isFinite(n) ? n : 0; }
  function code(v) {
    if (v == null) return '';
    if (typeof v === 'number') return isFinite(v) ? String(Math.round(v)) : '';
    var s = String(v).trim().toUpperCase().replace(/\s+/g, '');
    if (/^\d+(\.0+)?$/.test(s)) return s.replace(/\.0+$/, '');
    if (/^\d+(\.\d+)?E\+?\d+$/.test(s)) return String(Math.round(Number(s)));
    return s;
  }
  function rakCode(v) { return String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, ''); }
  function hdrIdx(H, re) { for (var i = 0; i < H.length; i++) { if (re.test(String(H[i]).trim())) return i; } return -1; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ================= PARSER (kolom lain langsung dibuang) ================= */
  NS.parseWms = function (aoa) {
    var h = -1, i;
    for (i = 0; i < Math.min(20, aoa.length); i++) {
      var r = aoa[i].map(function (x) { return String(x).trim().toLowerCase(); });
      if (r.indexOf('lokasi') >= 0 && r.indexOf('rak') >= 0 && r.indexOf('onhand') >= 0) { h = i; break; }
    }
    if (h < 0) throw new Error('Bukan file Informasi Rak: kolom Lokasi / Rak / Onhand tidak ditemukan.');
    var H = aoa[h].map(function (x) { return String(x).trim().toLowerCase(); });
    var c = { lok: H.indexOf('lokasi'), area: H.indexOf('area'), rak: H.indexOf('rak'), kode: H.indexOf('kode item'), nama: H.indexOf('nama item'), on: H.indexOf('onhand') };
    if (c.kode < 0) throw new Error('Kolom "Kode Item" tidak ditemukan.');
    var st = { total: 0, kept: 0, otherLoc: 0, noItem: 0 }, map = {};
    for (i = h + 1; i < aoa.length; i++) {
      var x = aoa[i]; if (!x || x.every(function (v) { return v === '' || v == null; })) continue;
      st.total++;
      if (String(x[c.lok]).trim().toUpperCase() !== LOC) { st.otherLoc++; continue; }
      var kd = code(x[c.kode]); if (!kd) { st.noItem++; continue; }
      var nama = c.nama >= 0 ? String(x[c.nama]).replace(/\s+/g, ' ').trim() : '';
      var area = c.area >= 0 ? String(x[c.area]).trim() : '';
      var rk = rakCode(x[c.rak]);
      if (!rk || (nama && String(x[c.rak]).replace(/\s+/g, ' ').trim() === nama)) rk = rakCode(area) || rk;   // baris TRANSIT: kolom Rak berisi nama item
      var key = rk + '|' + kd;
      if (!map[key]) map[key] = { lok: LOC, area: area, rak: rk, kode: kd, nama: nama, onhand: 0 };
      map[key].onhand += num(x[c.on]); st.kept++;
    }
    return { rows: Object.keys(map).map(function (k) { return map[k]; }), stats: st };
  };
  NS.parseQad = function (aoa) {
    var h = -1, i;
    for (i = 0; i < Math.min(15, aoa.length); i++) { if (hdrIdx(aoa[i], /^(item|part|material|kode)/i) >= 0) { h = i; break; } }
    if (h < 0) throw new Error('Kolom Item/Part tidak ditemukan di 15 baris awal file QAD.');
    var H = aoa[h], ci = hdrIdx(H, /^(item|part|material|kode)/i), cd = hdrIdx(H, /desc|nama|uraian/i), cq = hdrIdx(H, /qty|on ?hand|stock|stok|saldo/i), cg = hdrIdx(H, /^group/i);
    if (cq < 0) throw new Error('Kolom Qty/Stock/Saldo tidak ditemukan di file QAD.');
    var map = {}, total = 0, otherGroup = 0, skip = {};
    for (i = h + 1; i < aoa.length; i++) {
      var x = aoa[i], kd = code(x[ci]); if (!kd) continue; total++;
      var g = cg >= 0 ? String(x[cg]).trim().toUpperCase() : '';
      if (cg >= 0 && GROUPS.indexOf(g) < 0) { otherGroup++; skip[kd] = 1; continue; }   // group lain dibuang
      if (!map[kd]) map[kd] = { kode: kd, nama: cd >= 0 ? String(x[cd]).replace(/\s+/g, ' ').trim() : '', qty: 0, grp: g };
      map[kd].qty += num(x[cq]);
    }
    var rows = Object.keys(map).map(function (k) { return map[k]; });
    return { rows: rows, stats: { total: total, kept: rows.length, otherGroup: otherGroup, skip: Object.keys(skip) } };
  };

  /* ================= MODEL ================= */
  function blank() { return { wms: [], qad: [], qadSkip: [], inputs: {}, manual: {}, meta: { wmsAt: '', qadAt: '', wmsFile: '', qadFile: '' }, cfg: { tgl: today(), site: SITE, ket: 'Adjustment SO rak', kat: 1 }, step1: '' }; }
  NS.blank = blank;

  // item = { kode, nama, qad (null bila tak ada di QAD), racks:[{rak,area,onhand}], wms, sel }
  NS.items = function (S, allowed) {
    var m = {}, grpOf = {};
    S.qad.forEach(function (q) { if (q.grp) grpOf[q.kode] = q.grp; });
    S.wms.forEach(function (r) {
      var it = m[r.kode] || (m[r.kode] = { kode: r.kode, nama: r.nama, qad: null, racks: [], wms: 0 });
      it.racks.push({ rak: r.rak, area: r.area, onhand: r.onhand }); it.wms += r.onhand; if (!it.nama) it.nama = r.nama;
    });
    S.qad.forEach(function (q) {
      var it = m[q.kode];
      if (!it) { if (!(q.qty > 0)) return; it = m[q.kode] = { kode: q.kode, nama: q.nama, qad: 0, racks: [], wms: 0 }; }
      it.qad = (it.qad || 0) + q.qty; if (!it.nama) it.nama = q.nama;
    });
    var a = Object.keys(m).map(function (k) { var it = m[k]; it.grp = grpOf[k] || inferGroup(it.nama); it.qadv = it.qad == null ? 0 : it.qad; it.sel = it.wms - it.qadv; it.racks.sort(function (x, y) { return x.rak.localeCompare(y.rak, 'id', { numeric: true }); }); return it; });
    allowed = allowed || GROUPS; var sk = {}; (S.qadSkip || []).forEach(function (k) { sk[k] = 1; });
    a = a.filter(function (it) { return allowed.indexOf(it.grp) >= 0 && !sk[it.kode]; });   // item bergroup lain di QAD tidak ikut
    a.sort(function (x, y) { return Math.abs(y.sel) - Math.abs(x.sel) || x.nama.localeCompare(y.nama, 'id', { numeric: true }); });
    return a;
  };
  function inVal(S, kode, rak) { var v = (S.inputs[kode] || {})[rak]; return (v === undefined || v === '' || v === null) ? null : num(v); }
  function wmsByRak(S) { var m = {}; S.wms.forEach(function (r) { (m[r.rak] = m[r.rak] || []).push(r); }); return m; }

  // rencana adjustment: step1 (kosongkan rak bentrok) + step2 (adjust)
  NS.plan = function (S, items) {
    var byRak = wmsByRak(S), cleared = {}, step1 = [], step2 = [], dup = [], seenManual = {}, conflicts = [];
    items.forEach(function (it) {
      (S.manual[it.kode] || []).forEach(function (mr) {
        if (mr.aktual === '' || mr.aktual == null) return;
        (seenManual[mr.rak] = seenManual[mr.rak] || []).push(it.kode);
        (byRak[mr.rak] || []).forEach(function (o) {
          if (o.kode === it.kode || !o.onhand) return;
          var k = o.rak + '|' + o.kode; if (cleared[k]) return; cleared[k] = 1;
          step1.push({ rak: o.rak, kode: o.kode, nama: o.nama, qty: -o.onhand });
          conflicts.push({ rak: o.rak, pakaiOleh: o.kode, namaLama: o.nama, onhand: o.onhand, itemBaru: it.kode, namaBaru: it.nama });
        });
      });
    });
    Object.keys(seenManual).forEach(function (r) { var u = seenManual[r].filter(function (v, i, a) { return a.indexOf(v) === i; }); if (u.length > 1) dup.push({ rak: r, items: u }); });
    items.forEach(function (it) {
      it.racks.forEach(function (r) {
        if (cleared[r.rak + '|' + it.kode]) return;
        var a = inVal(S, it.kode, r.rak); if (a === null) return;
        var d = a - r.onhand; if (d) step2.push({ rak: r.rak, kode: it.kode, nama: it.nama, qty: d });
      });
      (S.manual[it.kode] || []).forEach(function (mr) {
        if (mr.aktual === '' || mr.aktual == null) return;
        var a = num(mr.aktual); if (a) step2.push({ rak: mr.rak, kode: it.kode, nama: it.nama, qty: a, manual: true });
      });
    });
    step2.sort(function (x, y) { return x.qty < 0 && y.qty >= 0 ? -1 : (x.qty >= 0 && y.qty < 0 ? 1 : 0); });   // pengurangan lebih dulu
    return { step1: step1, step2: step2, conflicts: conflicts, dup: dup, cleared: cleared };
  };

  // baris rak satu item (existing + manual) + proyeksi
  NS.lines = function (S, it, plan) {
    var L = it.racks.map(function (r) {
      var cl = !!(plan && plan.cleared[r.rak + '|' + it.kode]);
      return { rak: r.rak, area: r.area, exist: r.onhand, aktual: inVal(S, it.kode, r.rak), manual: false, cleared: cl };
    });
    (S.manual[it.kode] || []).forEach(function (mr, i) { L.push({ rak: mr.rak, area: 'MANUAL', exist: 0, aktual: (mr.aktual === '' || mr.aktual == null) ? null : num(mr.aktual), manual: true, idx: i }); });
    return L;
  };
  NS.summary = function (S, items, plan) {
    var n = items.length, ok = 0, sa = 0, sq = 0, sw = 0, rin = 0, rok = 0;
    items.forEach(function (it) {
      if (it.sel === 0) ok++; sa += Math.abs(it.sel); sq += it.qadv; sw += it.wms;
      NS.lines(S, it, plan).forEach(function (l) { if (l.aktual === null) return; rin++; if (l.aktual === l.exist) rok++; });
    });
    return {
      n: n, ok: ok, bad: n - ok, qad: sq, wms: sw, abs: sa,
      accItem: n ? ok / n * 100 : null,
      accQty: sq > 0 ? Math.max(0, (1 - sa / sq)) * 100 : null,
      rin: rin, rok: rok, accRak: rin ? rok / rin * 100 : null
    };
  };

  /* ================= TEMPLATE XLSX ================= */
  NS.templateRows = function (rows, cfg) {
    var parts = String(cfg.tgl || today()).split('-'), d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    return rows.map(function (r) { return [d, Number(cfg.site) || SITE, LOC, r.rak, /^\d+$/.test(r.kode) ? Number(r.kode) : r.kode, cfg.ket || '', r.qty, Number(cfg.kat) || 1]; });
  };
  NS.buildWorkbook = function (XLSX, rows, cfg) {
    var aoa = [HEAD].concat(NS.templateRows(rows, cfg)), ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
    for (var i = 1; i < aoa.length; i++) {
      var a = ws['A' + (i + 1)]; if (a) { a.t = 'd'; a.z = 'yyyy\\-mm\\-dd;@'; }
      var e = ws['E' + (i + 1)]; if (e && e.t === 'n') e.z = '0';
    }
    ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 11 }, { wch: 14 }, { wch: 17 }, { wch: 26 }, { wch: 8 }, { wch: 14 }];
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Area Rak'); return wb;
  };

  NS.GROUPS = GROUPS; NS.esc = esc; NS.fmt = fmt; NS.code = code; NS.LOC = LOC;
  root.RakWmsCore = NS;
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
