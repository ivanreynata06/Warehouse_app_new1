/*!
 * belumsusun-core.js -- logika murni "Voucher Belum Tersusun / Belum Direlokasi"
 *
 * ACUAN = input QAD (voucher dari kolom Document, qty bersih setelah revisi).
 * Setiap voucher QAD dibandingkan dengan 3 data:
 *   1. Voucher WMS          (voucher transfer yang sudah ada di WMS)
 *   2. Laporan Susun Voucher (voucher -> rak, qty)
 *   3. Laporan Relokasi      (WAJIB memuat nomor voucher pada kolom Keterangan; qty dihitung dari nomor voucher itu)
 * Qty tersusun = qty susun + qty relokasi (ke rak reguler). Belum tersusun = qty QAD - qty tersusun.
 * Hanya perbandingan murni (tanpa DOM / jaringan) supaya mudah diuji.
 */
(function (root) {
  'use strict';
  var NS = {};

  function nk(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function dayNum(t) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null; }
  function isoOf(n) { var d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2); }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // nomor voucher = 7 digit angka. Akhiran seperti "/2C" tidak dipakai ("1032740/2C" -> 1032740).
  NS.vouchersIn = function (text) {
    var out = [], seen = {};
    String(text == null ? '' : text).replace(/\D+/g, ' ').split(' ').forEach(function (x) { if (x.length === 7 && !seen[x]) { seen[x] = 1; out.push(x); } });
    return out;
  };
  // rak tujuan relokasi dianggap "tersusun" hanya bila rak reguler (bukan kosong / transit / nama item)
  function rakReguler(r) {
    var x = String(r == null ? '' : r).trim(); if (!x) return false;
    if (/TRANSIT/i.test(x)) return false;
    var n = nk(x);
    if (n.length >= 14 && /PIPE|PIPA|PPR|RUCIKA|KELEN|DIA\d/.test(n) && !/^[A-Z]{1,3}-?\d/.test(x.toUpperCase())) return false;
    return true;
  }

  /* d = { qad:[{t,v,i,n,q}], wms:[{t,v,i,n,q}], susun:[{t,v,i,r,q,p}], relok:[{t,v,from,to,q,i,kode,kt,id}] }
     opt = { items: {kode:1} (opsional, batasi item), today:'YYYY-MM-DD', sinceDays: 60 } */
  NS.analyze = function (d, opt) {
    d = d || {}; opt = opt || {};
    var qad = d.qad || [], wms = d.wms || [], susun = d.susun || [], relok = d.relok || [];
    var todayN = dayNum(opt.today) != null ? dayNum(opt.today) : Math.floor(Date.now() / 86400000);
    var sinceN = todayN - (opt.sinceDays || 60);
    var allow = opt.items || null;

    // 1) kebutuhan susun = voucher QAD (net setelah revisi)
    var need = {}, byV = {}, nameCode = {}, order = [];
    qad.forEach(function (r) {
      var v = String(r.v == null ? '' : r.v).trim(), code = String(r.i == null ? '' : r.i).trim();
      if (r.n && code) nameCode[nk(r.n)] = code;
      if (!v || !code) return;
      if (allow && !allow[code]) return;
      var k = v + '|' + code, o = need[k];
      if (!o) { o = need[k] = { v: v, i: code, n: r.n || '', t: r.t, qad: 0, wms: 0, susun: 0, relok: 0, racks: [], rel: [] }; order.push(k); (byV[v] = byV[v] || []).push(k); }
      o.qad += num(r.q); if (r.t && (!o.t || r.t < o.t)) o.t = r.t; if (!o.n && r.n) o.n = r.n;
    });
    wms.forEach(function (r) { if (r.n && r.i) nameCode[nk(r.n)] = String(r.i).trim(); });

    // 2) voucher WMS
    wms.forEach(function (r) {
      var k = String(r.v || '').trim() + '|' + String(r.i || '').trim(), o = need[k]; if (o) o.wms += num(r.q);
    });

    function pick(v, code, nama) {
      var c = code || nameCode[nk(nama)] || '';
      if (c && need[v + '|' + c]) return need[v + '|' + c];
      var ks = byV[v];
      return ks && ks.length === 1 ? need[ks[0]] : null;   // voucher berisi 1 item -> tak perlu cocokkan nama
    }

    // 3) laporan susun voucher (voucher -> rak, qty)
    var susunN = 0;
    susun.forEach(function (r) {
      var o = pick(String(r.v || '').trim(), '', r.i); if (!o) return;
      var q = num(r.q); if (q <= 0) return;
      o.susun += q; susunN++; if (r.r && o.racks.indexOf(r.r) < 0) o.racks.push(r.r);
    });

    // 4) laporan relokasi: voucher dibaca dari KETERANGAN (wajib). Tanpa nomor voucher -> tidak dapat dicocokkan.
    var tanpaVoucher = [], relokN = 0;
    relok.forEach(function (r) {
      var vs = NS.vouchersIn(r.kt);
      var code = String(r.kode || '').trim() || nameCode[nk(r.i)] || '';
      if (allow && code && !allow[code]) return;
      if (!vs.length) { tanpaVoucher.push({ id: r.id || '', t: r.t, i: r.i || '', q: num(r.q), from: r.from || '', to: r.to || '', kt: r.kt || '' }); return; }
      if (!rakReguler(r.to)) return;                               // relokasi ke transit bukan "tersusun"
      var rem = num(r.q); if (rem <= 0) return;
      vs.forEach(function (v) {
        if (rem <= 0) return;
        var o = pick(v, code, r.i); if (!o) return;
        var take = Math.min(rem, Math.max(0, o.qad - o.susun - o.relok)); if (take <= 0) return;
        o.relok += take; rem -= take; relokN++; o.rel.push({ id: r.id || '', to: r.to, q: take, t: r.t });
      });
    });

    // 5) cakupan data: QAD sebelum data susun/relokasi mulai tidak dibandingkan (hindari "belum" palsu)
    var cov = null;
    susun.concat(relok).forEach(function (r) { var n = dayNum(r.t); if (n != null && (cov === null || n < cov)) cov = n; });
    var from = Math.max(sinceN, cov == null ? -Infinity : cov);

    var rows = [], skipped = 0;
    order.forEach(function (k) {
      var o = need[k]; if (!(o.qad > 0)) return;
      var tn = dayNum(o.t); if (tn != null && tn < from) { skipped++; return; }
      o.arr = Math.min(o.qad, o.susun + o.relok);
      o.belum = Math.max(0, o.qad - o.susun - o.relok);
      o.umur = tn == null ? null : Math.max(0, todayN - tn);
      o.status = o.belum === 0 ? 'tersusun' : (o.arr > 0 ? 'sebagian' : 'belum');
      o.noWms = o.wms <= 0;                                         // voucher QAD belum ada di WMS
      rows.push(o);
    });
    rows.sort(function (a, b) { return (b.belum - a.belum) || String(a.t).localeCompare(String(b.t)); });

    // ringkasan per item
    var by = {}, items = [];
    rows.forEach(function (o) {
      var it = by[o.i] || (by[o.i] = { i: o.i, n: o.n, belum: 0, qad: 0, voucher: 0, belumVoucher: [] });
      it.qad += o.qad; it.voucher++;
      if (o.belum > 0) { it.belum += o.belum; it.belumVoucher.push(o); }
    });
    Object.keys(by).forEach(function (k) { items.push(by[k]); });
    items.sort(function (a, b) { return b.belum - a.belum; });

    var sum = { voucher: rows.length, tersusun: 0, sebagian: 0, belum: 0, belumQty: 0, itemBelum: 0, tanpaVoucher: tanpaVoucher.length, skipped: skipped };
    rows.forEach(function (o) { sum[o.status]++; sum.belumQty += o.belum; });
    sum.itemBelum = items.filter(function (x) { return x.belum > 0; }).length;
    return { rows: rows, items: items, by: by, sum: sum, tanpaVoucher: tanpaVoucher, coverage: cov == null ? null : isoOf(cov), pakai: { susun: susunN, relok: relokN }, data: { qad: qad.length, wms: wms.length, susun: susun.length, relok: relok.length } };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = NS; else root.BelumSusunCore = NS;
})(typeof window !== 'undefined' ? window : this);
