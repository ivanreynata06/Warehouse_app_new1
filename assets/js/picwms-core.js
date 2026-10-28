/*!
 * picwms-core.js -- logika murni menu "Kepatuhan PIC WMS"
 *  - baca Laporan Persiapan Muat (WMS): hanya Ship To, Tgl Muat, No SPM, PIC Muat
 *  - saring item (sama dengan Akurasi QAD vs WMS) & buang kolom lain
 *  - cocokkan SPM jadwal (input manual) dengan master WMS
 *  - deteksi akun terlarang & SPM yang mirip (dugaan typo)
 * Bergantung pada wmsqad-core.js (lolosNama, parseDate, label tanggal).
 */
(function (root) {
  'use strict';
  var W = root.WmsQadCore || (typeof require !== 'undefined' ? require('./wmsqad-core.js') : null);

  // Akun yang DILARANG dipakai PIC Muat
  var BANNED = /^administrator/i;
  function isBanned(pic) { return BANNED.test(String(pic || '').trim()); }

  function norm(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function normHead(v) { return String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function spmKey(v) {
    if (typeof v === 'number') return isFinite(v) ? v.toFixed(0) : '';
    return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase();
  }
  function idx(heads, names) { for (var i = 0; i < names.length; i++) { var x = heads.indexOf(names[i]); if (x !== -1) return x; } return -1; }

  // ---------- master WMS (Laporan Persiapan Muat) ----------
  function parseMaster(rows) {
    var h = null;
    for (var r = 0; r < Math.min(rows.length, 25) && !h; r++) {
      var hd = (rows[r] || []).map(normHead);
      if (hd.indexOf('nospm') !== -1 && hd.indexOf('tglmuat') !== -1) h = { row: r, heads: hd };
    }
    if (!h) throw new Error('Kolom "No SPM" dan "Tgl Muat" tidak ditemukan. Pastikan ini file Laporan Persiapan Muat dari WMS.');
    var cS = idx(h.heads, ['nospm']), cT = idx(h.heads, ['tglmuat']), cC = idx(h.heads, ['shipto']),
        cP = idx(h.heads, ['picmuat']), cD = idx(h.heads, ['deskripsi', 'namaitem']);
    if (cP === -1) throw new Error('Kolom "PIC Muat" tidak ditemukan.');
    if (cD === -1) throw new Error('Kolom "Deskripsi" tidak ditemukan (dipakai untuk menyaring item).');
    var out = [], seen = {}, st = { total: 0, kept: 0, dropped: 0, noDate: 0, spm: 0 }, spms = {};
    for (var i = h.row + 1; i < rows.length; i++) {
      var row = rows[i] || [], spm = spmKey(row[cS]);
      if (!spm) continue;
      st.total++;
      if (!W.lolosNama(norm(row[cD]))) { st.dropped++; continue; }
      var t = W.parseDate(row[cT]);
      if (!t) { st.noDate++; continue; }
      st.kept++;
      var pic = norm(row[cP]), key = spm + '|' + t + '|' + pic;
      if (seen[key]) continue;                 // satu baris per SPM + tanggal + PIC
      seen[key] = 1; spms[spm] = 1;
      out.push({ t: t, s: spm, c: norm(row[cC]), p: pic });
    }
    st.spm = Object.keys(spms).length;
    return { rows: out, stats: st };
  }

  // ---------- jadwal manual ----------
  function parseSpmList(text) {
    var toks = String(text || '').split(/[\s,;]+/).filter(Boolean), ok = [], bad = [], seen = {};
    toks.forEach(function (x) {
      var k = spmKey(x);
      if (!/^[A-Z0-9]{6,12}$/.test(k)) { bad.push(x); return; }
      if (!seen[k]) { seen[k] = 1; ok.push(k); }
    });
    return { ok: ok, bad: bad, dup: toks.length - ok.length - bad.length };
  }

  // ---------- kemiripan SPM (dugaan typo) ----------
  function dist(a, b) {                        // Damerau-Levenshtein (transposisi = 1)
    var la = a.length, lb = b.length, d = [], i, j;
    for (i = 0; i <= la; i++) { d[i] = [i]; }
    for (j = 0; j <= lb; j++) d[0][j] = j;
    for (i = 1; i <= la; i++) for (j = 1; j <= lb; j++) {
      var c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[la][lb];
  }
  // kandidat = daftar {s, t, c}; hasil: maksimal 3 yang paling mirip (jarak <= 2)
  function similar(spm, cands, skip) {
    var res = [];
    cands.forEach(function (c) {
      if (c.s === spm || (skip && skip[c.s])) return;
      var d = dist(spm, c.s);
      if (d <= 2 && Math.abs(spm.length - c.s.length) <= 2) res.push({ s: c.s, t: c.t, c: c.c, d: d });
    });
    res.sort(function (a, b) { return a.d - b.d || (a.s < b.s ? -1 : 1); });
    return res.slice(0, 3);
  }

  // ---------- analisis ----------
  // master: [{t,s,c,p}]  jadwal: [{t,s}]
  function analyze(master, jadwal) {
    master = master || []; jadwal = jadwal || [];
    var M = {}, J = {};
    master.forEach(function (r) {
      var m = M[r.s] = M[r.s] || { s: r.s, t: r.t, c: r.c, pics: [] };
      if (r.p && m.pics.indexOf(r.p) === -1) m.pics.push(r.p);
      if (r.t < m.t) m.t = r.t;
      if (!m.c && r.c) m.c = r.c;
    });
    jadwal.forEach(function (r) { J[r.s] = r.t; });
    var jDates = {}; jadwal.forEach(function (r) { jDates[r.t] = 1; });
    var mList = Object.keys(M).map(function (k) { return M[k]; });
    var all = {}; Object.keys(M).forEach(function (k) { all[k] = 1; }); Object.keys(J).forEach(function (k) { all[k] = 1; });
    var list = Object.keys(all).sort().map(function (k) {
      var m = M[k], jt = J[k], o = { s: k, inMaster: !!m, inJadwal: jt !== undefined, jt: jt || '', c: m ? m.c : '', pics: m ? m.pics.slice() : [], t: m ? m.t : jt };
      o.banned = o.pics.filter(isBanned);
      o.st = !m ? 'nowms' : (o.banned.length ? 'admin' : 'ok');
      o.dateDiff = !!(m && jt && jt !== m.t);
      o.noJadwal = !!(m && jt === undefined && jDates[m.t]);   // ada jadwal di tanggal itu, SPM ini tidak ada
      o.suggest = [];
      return o;
    });
    // saran typo: SPM jadwal yang tidak ada di master -> SPM master yang belum terpakai jadwal
    var free = mList.filter(function (m) { return J[m.s] === undefined; });
    list.forEach(function (o) { if (o.st === 'nowms') o.suggest = similar(o.s, free.length ? free : mList); });
    // sebaliknya: SPM master yang tidak ada di jadwal tapi mirip dengan SPM jadwal yang hilang -> sudah tercakup di atas
    return { spm: list, dates: uniq(list.map(function (x) { return x.t; })), months: uniq(list.map(function (x) { return x.t.slice(0, 7); })) };
  }
  function uniq(a) { var s = {}; a.forEach(function (x) { if (x) s[x] = 1; }); return Object.keys(s).sort(); }

  function summarize(list) {
    var o = { total: list.length, ok: 0, admin: 0, nowms: 0, acc: null, inWms: 0, wmsPct: null };
    list.forEach(function (x) { o[x.st]++; if (x.inMaster) o.inWms++; });
    o.acc = o.total ? o.ok / o.total * 100 : null;
    o.wmsPct = o.total ? o.inWms / o.total * 100 : null;
    return o;
  }
  // jumlah SPM per PIC (dari master)
  function picStats(list) {
    var m = {};
    list.forEach(function (x) { x.pics.forEach(function (p) { var o = m[p] = m[p] || { pic: p, n: 0, banned: isBanned(p) }; o.n++; }); });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return (b.banned - a.banned) || b.n - a.n; });
  }

  var ST_LABEL = { ok: 'Sesuai WMS', nowms: 'Tidak jalankan WMS', admin: 'Pakai akun administrator' };
  function explain(x) {
    if (x.st === 'nowms') return 'SPM ' + x.s + ' ada di jadwal tetapi tidak ada di data WMS: team persiapan tidak menjalankan WMS.';
    if (x.st === 'admin') return 'SPM ' + x.s + ' dimuat dengan akun ' + x.banned.join(', ') + '. PIC muat dilarang memakai akun administrator.';
    return 'SPM ' + x.s + ' dijalankan di WMS dengan PIC ' + (x.pics.join(', ') || '-') + '.';
  }

  var api = { BANNED_LABEL: 'administrator_wdj', isBanned: isBanned, parseMaster: parseMaster, parseSpmList: parseSpmList,
    similar: similar, dist: dist, analyze: analyze, summarize: summarize, picStats: picStats, ST_LABEL: ST_LABEL, explain: explain, spmKey: spmKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PicWmsCore = api;
})(typeof window !== 'undefined' ? window : this);
