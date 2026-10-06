/*!
 * akurasi-core.js
 * -----------------------------------------------------------------
 * Logika perhitungan "Akurasi Scan Barcode" (tanpa DOM, tanpa library
 * eksternal) -- dipisah dari akurasi_scan.html supaya mudah dites.
 *
 *  IN  : Voucher vs Box ID   -> evalIn / summarizeIn
 *  IN  : Voucher vs Backflush -> summarizeBfl
 *  OUT : Master TER (txt)     -> parseTER / summarizeOut
 *
 * Konvensi tanda selisih: NEGATIF = kurang (barang/box/backflush/scan
 * lebih sedikit dari seharusnya), sama seperti kolom TOTAL SELISIH di
 * sheet SUM.
 * -----------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  // ---------- util ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function digits(v) { return v == null ? '' : String(v).replace(/\D/g, ''); }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v == null) return null;
    var s = String(v).trim().replace(/\s/g, '');
    if (!s || s === '?') return null;
    // 1.440,00 (id) atau 1,440.00 (en)
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function serialToYMD(serial) {
    var dt = new Date(Math.round((serial - 25569) * 86400000));
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }

  // Tanggal teks. order: 'dmy' (Indonesia) | 'mdy' (TER). Juga yyyy-mm-dd.
  function parseDateText(s, order) {
    s = String(s == null ? '' : s).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return { y: +m[1], m: +m[2], d: +m[3] };
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (!m) return null;
    var a = +m[1], b = +m[2], y = +m[3];
    if (y < 100) y += 2000;
    if (a > 12) order = 'dmy'; else if (b > 12) order = 'mdy';   // tak ambigu -> pakai yang masuk akal
    var d = order === 'mdy' ? b : a, mo = order === 'mdy' ? a : b;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return { y: y, m: mo, d: d };
  }

  // Cari baris header: baris pertama (dalam 15 baris awal) yang cocok pola.
  function findHeader(aoa, test) {
    for (var i = 0; i < Math.min(aoa.length, 15); i++) {
      var row = (aoa[i] || []).map(norm);
      if (test(row)) return i;
    }
    return -1;
  }
  function colOf(headers, re, skip) {
    for (var i = 0; i < headers.length; i++) {
      if (skip && skip.indexOf(i) !== -1) continue;
      if (re.test(headers[i])) return i;
    }
    return -1;
  }

  // ---------- parser: Master Voucher & Box ID ----------
  // Mengembalikan {rows, error}. Baris sampah (judul laporan, "Page: 2",
  // garis ------) otomatis terbuang karena No.Voucher & Item harus angka.
  function parseVoucherSheet(aoa) {
    var h = findHeader(aoa, function (r) { return r.some(function (c) { return /no\.?\s*voucher/.test(c); }); });
    if (h < 0) return { rows: [], error: 'Header "No.Voucher" tidak ditemukan. Pastikan ini file Master Voucher & Box ID.' };
    var H = aoa[h].map(norm);
    var c = {
      v: colOf(H, /no\.?\s*voucher/), type: colOf(H, /^type/), st: colOf(H, /^status/),
      dt: colOf(H, /tgl/), it: colOf(H, /item/), ds: colOf(H, /desc/),
      gr: colOf(H, /shift|group/), qv: colOf(H, /qty\s*voucher/), qb: colOf(H, /qty\s*box/),
      sl: colOf(H, /^selisih/)
    };
    if (c.v < 0 || c.it < 0 || c.qv < 0 || c.qb < 0)
      return { rows: [], error: 'Kolom wajib (No.Voucher, Item Number, QTY Voucher, Qty Box Id) tidak lengkap.' };
    var rows = [];
    for (var i = h + 1; i < aoa.length; i++) {
      var r = aoa[i] || [];
      var vno = digits(r[c.v]), item = digits(r[c.it]), qty = num(r[c.qv]);
      if (vno.length < 8 || item.length < 8 || qty == null) continue;
      var rawDt = c.dt >= 0 ? r[c.dt] : null, ymd = null, serial = false;
      if (typeof rawDt === 'number') { ymd = serialToYMD(rawDt); serial = true; }
      else ymd = parseDateText(rawDt, 'mdy');   // teks hasil export = mm/dd/yyyy
      var box = num(r[c.qb]);
      rows.push({
        voucher: vno, type: c.type >= 0 ? String(r[c.type] || '').trim() : '',
        status: c.st >= 0 ? String(r[c.st] || '').trim().toUpperCase() : '',
        ymd: ymd, serial: serial, item: item,
        desc: c.ds >= 0 ? String(r[c.ds] || '').trim() : '',
        group: c.gr >= 0 ? String(r[c.gr] || '').trim() : '',
        qty: qty, box: (box != null && box > 0) ? box : null,
        sel: c.sl >= 0 ? num(r[c.sl]) : null          // kolom Selisih (dipakai mode Fitting Rucika)
      });
    }
    return { rows: rows, error: rows.length ? null : 'Tidak ada baris voucher yang valid di file ini.' };
  }

  // Tanggal Master Voucher kadang tertukar bulan<->hari (di-export sebagai
  // "dd/mm" tapi dibaca Excel sbg "mm/dd": 1 Sep -> 9 Jan). mode:
  //  'auto'  : tukar kalau semua tanggal-serial punya "hari" yang SAMA
  //            tapi "bulan"-nya beda-beda (tanda khas tertukar)
  //  'swap'  : selalu tukar | 'none': jangan tukar
  function resolveVoucherDates(rows, mode) {
    var ser = rows.filter(function (r) { return r.serial && r.ymd; });
    var doSwap = false;
    if (mode === 'swap') doSwap = true;
    else if (mode !== 'none' && ser.length) {
      var days = {}, mons = {};
      ser.forEach(function (r) { days[r.ymd.d] = 1; mons[r.ymd.m] = 1; });
      doSwap = Object.keys(days).length === 1 && Object.keys(mons).length > 1;
    }
    return {
      swapped: doSwap,
      rows: rows.map(function (r) {
        var y = r.ymd;
        if (y && r.serial && doSwap) {
          if (y.d <= 12) y = { y: y.y, m: y.d, d: y.m };
        }
        var o = {}; for (var k in r) o[k] = r[k];
        o.date = y ? iso(y.y, y.m, y.d) : '';
        return o;
      })
    };
  }

  // Siap simpan: tanggal sudah final (mm/dd tertukar dibereskan), field bantu dibuang
  function prepareVoucherRows(rows, mode) {
    var r = resolveVoucherDates(rows, mode);
    return {
      swapped: r.swapped,
      rows: r.rows.map(function (x) {
        return { voucher: x.voucher, type: x.type, status: x.status, date: x.date, item: x.item,
          desc: x.desc, group: x.group, qty: x.qty, box: x.box };
      })
    };
  }

  // ---------- parser: Standar Isi Box ----------
  function parseStdSheet(aoa) {
    var h = findHeader(aoa, function (r) { return r.some(function (c) { return /item/.test(c); }); });
    var ci = 0, cq = 1, info = 'kolom A = Item Number, kolom B = Standar isi box (tebakan, header tidak ketemu)';
    var start = 0;
    if (h >= 0) {
      var H = aoa[h].map(norm);
      ci = colOf(H, /item/);
      var skip = [ci];
      H.forEach(function (x, i) { if (/^desc|nama|uraian/.test(x)) skip.push(i); });   // kolom deskripsi jangan sampai terambil
      cq = colOf(H, /satuan\s*box|std|standar|isi|per\s*box|box|qty|pcs|quantity|jumlah|satuan/, skip);
      if (cq < 0) { cq = ci + 1; while (skip.indexOf(cq) !== -1) cq++; }
      start = h + 1;
      info = 'Item Number = "' + (aoa[h][ci] || '') + '", Standar = "' + (aoa[h][cq] || '') + '"';
    }
    var map = {}, desc = {}, n = 0, cd = -1;
    if (h >= 0) cd = colOf(aoa[h].map(norm), /^desc|nama|uraian/);
    for (var i = start; i < aoa.length; i++) {
      var r = aoa[i] || [];
      var item = digits(r[ci]), q = num(r[cq]);
      if (item.length < 8 || q == null || q <= 0) continue;
      if (!(item in map)) n++;
      map[item] = q;
      if (cd >= 0 && r[cd]) desc[item] = String(r[cd]).trim();
    }
    return { map: map, desc: desc, count: n, info: info, error: n ? null : 'Tidak ada pasangan Item Number & standar isi box yang terbaca.' };
  }

  // ---------- parser: Master Backflush ----------
  function parseBflSheet(aoa) {
    var h = findHeader(aoa, function (r) { return r.some(function (c) { return /voucher\s*id|no\.?\s*voucher/.test(c); }); });
    if (h < 0) return { rows: [], error: 'Header "Voucher ID" tidak ditemukan. Pastikan ini file Master Backflush.' };
    var H = aoa[h].map(norm);
    var c = {
      v: colOf(H, /voucher\s*id|no\.?\s*voucher/), st: colOf(H, /^status/), dt: colOf(H, /tgl/),
      it: colOf(H, /item/), gr: colOf(H, /shift|group/), qty: colOf(H, /^qty/)
    };
    var descCols = []; H.forEach(function (x, i) { if (/^desc/.test(x)) descCols.push(i); });
    if (c.v < 0 || c.qty < 0) return { rows: [], error: 'Kolom Voucher ID / Qty tidak ditemukan.' };
    var rows = [];
    for (var i = h + 1; i < aoa.length; i++) {
      var r = aoa[i] || [];
      var vno = digits(r[c.v]), qty = num(r[c.qty]);
      if (vno.length < 8 || qty == null) continue;
      var rawDt = c.dt >= 0 ? r[c.dt] : null, ymd = null;
      if (typeof rawDt === 'number') ymd = serialToYMD(rawDt); else ymd = parseDateText(rawDt, 'mdy');
      rows.push({
        voucher: vno, status: c.st >= 0 ? String(r[c.st] || '').trim().toUpperCase() : '',
        date: ymd ? iso(ymd.y, ymd.m, ymd.d) : '', item: c.it >= 0 ? digits(r[c.it]) : '',
        desc: descCols.map(function (j) { return String(r[j] || '').trim(); }).join(' ').trim(),
        group: c.gr >= 0 ? String(r[c.gr] || '').trim() : '', qty: qty
      });
    }
    return { rows: rows, error: rows.length ? null : 'Tidak ada baris backflush yang valid.' };
  }

  // ---------- parser: Master TER (txt, pemisah "|") ----------
  function parseTER(text) {
    var lines = String(text || '').split(/\r?\n/);
    var idx = { spm: 0, site: 1, item: 2, desc: 3, group: 4, qspm: 5, qchk: 6, qship: 9, batal: 11, dchk: 12, dship: 13, ket: 8, veh: 14, tuj: 15 };
    var rows = [];
    lines.forEach(function (ln) {
      if (ln.indexOf('|') === -1) return;
      var p = ln.split('|').map(function (x) { return x.trim(); });
      var first = norm(p[0]);
      if (first === 'spm') {            // baris header -> petakan kolom berdasarkan nama
        var m = {};
        p.forEach(function (name, i) {
          var n = norm(name);
          if (n === 'item') m.item = i; else if (n === 'description') m.desc = i; else if (n === 'group') m.group = i;
          else if (n === 'qty spm') m.qspm = i; else if (n === 'qty check') m.qchk = i;
          else if (n === 'keterangan selisih') m.ket = i; else if (n === 'qty shipped') m.qship = i;
          else if (n === 'batal muat') m.batal = i; else if (n === 'date check') m.dchk = i;
          else if (n === 'ship date') m.dship = i; else if (n === 'no kendaraan') m.veh = i; else if (n === 'tujuan') m.tuj = i;
        });
        for (var k in m) idx[k] = m[k];
        return;
      }
      if (!first || first === 'total' || !/^\d/.test(first)) return;
      var item = digits(p[idx.item]), qs = num(p[idx.qspm]), qc = num(p[idx.qchk]);
      if (item.length < 8 || qs == null) return;
      var dc = parseDateText(p[idx.dchk], 'mdy'), ds = parseDateText(p[idx.dship], 'mdy');
      var d = ds || dc;
      rows.push({
        spm: p[0], item: item, desc: p[idx.desc] || '', group: p[idx.group] || '',
        qspm: qs, qchk: qc == null ? 0 : qc, status: '', key: p[0] + '|' + item + '|' + (p[idx.group] || ''), qship: num(p[idx.qship]) || 0, batal: num(p[idx.batal]) || 0,
        ket: p[idx.ket] || '', veh: p[idx.veh] || '', tuj: p[idx.tuj] || '',
        date: d ? iso(d.y, d.m, d.d) : ''
      });
    });
    return { rows: rows, error: rows.length ? null : 'Tidak ada baris SPM yang valid. Pastikan ini file TER (.txt) dengan pemisah "|".' };
  }

  // ---------- parser: Master Scan Out (xlsx, hasil tarikan sistem per NO SPM) ----------
  // Tarikan sistem TIDAK membawa tanggal, jadi tanggal kirim dipilih saat upload
  // (dateIso 'yyyy-mm-dd') dan dipakai untuk semua baris file tsb.
  // Status PICK = belum ter-scan, CHECK = sudah ter-scan.
  function parseScanOut(aoa, dateIso) {
    var h = findHeader(aoa, function (r) { return r.some(function (c) { return /no\.?\s*spm/.test(c); }) && r.some(function (c) { return /qty\s*spm/.test(c); }); });
    if (h < 0) return { rows: [], error: 'Header "NO SPM" / "QTY SPM" tidak ditemukan. Pastikan ini file Master Scan Out.' };
    var H = aoa[h].map(norm);
    var c = { spm: colOf(H, /no\.?\s*spm/), it: colOf(H, /item/), qs: colOf(H, /qty\s*spm/), qp: colOf(H, /qty\s*pick/),
              qc: colOf(H, /qty\s*check/), st: colOf(H, /^status/), tj: colOf(H, /tujuan/) };
    if (c.it < 0 || c.qc < 0) return { rows: [], error: 'Kolom Item Number / Qty Check tidak ditemukan.' };
    var rows = [], occ = {};
    for (var i = h + 1; i < aoa.length; i++) {
      var r = aoa[i] || [];
      var spm = digits(r[c.spm]), item = digits(r[c.it]), qs = num(r[c.qs]), qc = num(r[c.qc]);
      if (!spm || item.length < 8 || qs == null) continue;
      // Satu SPM bisa memuat item yang sama di beberapa baris (qty berbeda), jadi kunci
      // memakai urutan kemunculan.
      var base = spm + '|' + item + '|' + qs, k = (occ[base] = (occ[base] || 0) + 1);
      rows.push({
        spm: spm, item: item, desc: '', group: '', qspm: qs, qpick: c.qp >= 0 ? (num(r[c.qp]) || 0) : 0, qchk: qc == null ? 0 : qc,
        status: c.st >= 0 ? String(r[c.st] || '').trim().toUpperCase() : '', tuj: c.tj >= 0 ? String(r[c.tj] || '').trim() : '',
        date: dateIso || '', key: base + '|' + k
      });
    }
    return { rows: rows, error: rows.length ? null : 'Tidak ada baris SPM yang valid di file ini.' };
  }

  // ---------- perhitungan: Voucher vs Box ID ----------
  // opt.tol (default false): toleransi box sisa -- box terakhir boleh
  // tidak penuh (jumlah box = pembulatan ke atas voucher / standar).
  // Mode SELISIH (Fitting Rucika, opt.selisih = true): tanpa Standar Isi Box.
  // Parameter = kolom Selisih di file voucher. Selisih 0 -> sesuai; selain 0 ->
  // tidak sesuai. Kalau kolom Selisih tidak ada, dipakai QTY Voucher - Qty Box Id.
  // Tanda hasil mengikuti konvensi dashboard: NEGATIF = kurang, POSITIF = lebih
  // (dilihat dari Qty Box Id vs QTY Voucher, bukan dari tanda di file).
  function evalSelisih(v) {
    var o = { status: '', aktual: 0, selisih: 0, std: null };
    var sel = (v.sel != null) ? v.sel : (v.box != null ? v.qty - v.box : null);
    if (sel == null) { o.status = 'kosong'; o.aktual = 0; o.selisih = -v.qty; return o; }
    if (sel === 0) { o.status = 'sesuai'; o.aktual = v.qty; o.selisih = 0; return o; }
    if (v.box == null) { o.status = 'kosong'; o.aktual = 0; o.selisih = -v.qty; return o; }
    var mag = Math.abs(sel);
    o.status = 'beda';
    o.selisih = (v.box > v.qty) ? mag : -mag;
    o.aktual = v.qty + o.selisih;
    return o;
  }

  function evalIn(v, std, opt) {
    if (opt && opt.selisih) return evalSelisih(v);
    var s = std[v.item] || null, tol = !!(opt && opt.tol);
    var o = { status: '', aktual: 0, selisih: 0, std: s };
    if (v.box == null) {                       // Box ID kosong / "?"
      o.status = 'kosong'; o.aktual = 0; o.selisih = -v.qty; return o;
    }
    if (!s) { o.status = 'nostd'; o.aktual = null; o.selisih = 0; return o; }
    if (v.box === 1) {
      // 1 box: sesuai bila isi voucher <= standar isi box (box penuh atau box
      // parsial, mis. voucher 6 pcs untuk standar 24). Kalau voucher LEBIH
      // BESAR dari standar tetapi Box ID hanya 1 -> tidak sesuai
      // (kemungkinan ada box yang tidak ter-scan).
      var ok1 = v.qty <= s;
      o.aktual = ok1 ? v.qty : s;
      o.status = ok1 ? 'sesuai' : 'beda';
    } else {
      var akt = v.box * s;
      var ok = akt === v.qty || (tol && v.box === Math.ceil(v.qty / s));
      o.aktual = ok ? v.qty : akt;
      o.status = ok ? 'sesuai' : 'beda';
    }
    o.selisih = o.aktual - v.qty;
    return o;
  }

  function newBucket() {
    return { lines: 0, qty: 0, aktual: 0, credit: 0, skuSelisih: 0, selisih: 0, nostd: 0, sesuai: 0, closed: 0,
             nBfl: 0, nManual: 0, nTrm: 0, qBfl: 0, qManual: 0, qTrm: 0, nWait: 0, qWait: 0 };
  }
  function pct(a, b) { return b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : null; }

  function summarizeIn(vouchers, std, opt) {
    var days = {}, items = [], tot = newBucket();
    vouchers.forEach(function (v) {
      var e = evalIn(v, std, opt);
      var it = { v: v, e: e, date: v.date, close: v.closeBox || null };
      items.push(it);
      var d = days[v.date] || (days[v.date] = newBucket());
      if (e.status === 'nostd') { d.nostd++; tot.nostd++; return; }
      [d, tot].forEach(function (b) {
        if (it.close && e.status === 'sesuai') b.closed = (b.closed || 0) + 1;
        b.lines++; b.qty += v.qty; b.aktual += e.aktual; b.selisih += e.selisih;
        if (e.status === 'sesuai') { b.sesuai++; b.credit += v.qty; }
        else { b.skuSelisih++; b.credit += Math.max(0, v.qty - Math.abs(e.selisih)); }
      });
    });
    return finish(days, items, tot);
  }

  // ---------- perhitungan: Voucher vs Backflush ----------
  // Status "BFL" dan "MANUAL" = OK. "TRM" (dan status kosong / lainnya)
  // = selisih. Kalau file Master Backflush diupload, statusnya MENIMPA
  // status di Master Voucher untuk nomor voucher yang sama; voucher yang
  // hanya ada di file Backflush ikut dihitung sebagai voucher sendiri.
  function isBflOk(st) { return st === 'BFL' || st === 'MANUAL'; }
  // ---- Aturan batas input Backflush (H+1) ----
  // Skema input: voucher Shift 3 diinput Shift 1 (hari berikutnya), Shift 1 diinput
  // Shift 2, Shift 2 diinput Shift 3. Group TIDAK dipakai, hanya digit pertama = shift.
  // Voucher berstatus TRM / kosong yang umurnya masih <= H+1 terhadap tanggal data
  // terbaru BUKAN masalah (status 'wait' = menunggu input). Lewat H+1 = bermasalah.
  var PENGINPUT = { 1: 'Shift 2', 2: 'Shift 3', 3: 'Shift 1 (hari berikutnya)' };
  function shiftOf(g) { var m = /^\s*([123])/.exec(String(g || '')); return m ? +m[1] : null; }
  function dayN(d) { var a = String(d || '').split('-'); return a.length === 3 && +a[0] ? Date.UTC(+a[0], +a[1] - 1, +a[2]) / 86400000 : null; }
  function plusDay(d, n) { var x = dayN(d); return x == null ? '' : new Date((x + n) * 86400000).toISOString().slice(0, 10); }
  function summarizeBfl(vouchers, bflRows, opt) {
    var grace = (opt && opt.grace != null) ? opt.grace : 1;
    var byNo = {}, seen = {}, recs = [];
    (bflRows || []).forEach(function (b) { byNo[b.voucher] = b; });
    vouchers.forEach(function (v) {
      var b = byNo[v.voucher]; seen[v.voucher] = 1;
      recs.push({ voucher: v.voucher, item: v.item, desc: v.desc, group: v.group, qty: v.qty,
        status: b && b.status ? b.status : v.status, date: v.date, src: b ? 'bfl' : 'voucher',
        close: (b && b.closeBfl) || v.closeBfl || null });
    });
    (bflRows || []).forEach(function (b) {
      if (seen[b.voucher]) return;
      recs.push({ voucher: b.voucher, item: b.item, desc: b.desc, group: b.group, qty: b.qty,
        status: b.status, date: b.date, src: 'bfl', close: b.closeBfl || null });
    });
    var days = {}, items = [], tot = newBucket();
    var refN = null;   // tanggal acuan = tanggal terbaru yang ada di data voucher/backflush
    recs.forEach(function (r) { var n = dayN(r.date); if (n != null && (refN == null || n > refN)) refN = n; });
    // BFL = di-scan barcode scanner (wajib). MANUAL = diinput manual di sistem. TRM (atau
    // status kosong) = belum ter-scan sama sekali / belum masuk stok.
    // Akurasi scan = hanya BFL; MANUAL dan TRM sama-sama dihitung belum ter-scan, tetapi
    // dipisah supaya kelihatan mana yang manual dan mana yang masih TRM.
    recs.forEach(function (r) {
      var kind = r.status === 'BFL' ? 'bfl' : (r.status === 'MANUAL' ? 'manual' : 'trm');
      r.shift = shiftOf(r.group); r.penginput = PENGINPUT[r.shift] || ''; r.batas = plusDay(r.date, grace);
      if (kind === 'trm') { var dn = dayN(r.date); if (refN != null && dn != null && refN - dn <= grace) kind = 'wait'; }
      var ok = kind === 'bfl' || kind === 'manual';
      var it = { v: r, e: { status: kind === 'trm' ? 'selisih' : kind,
        aktual: kind === 'bfl' ? r.qty : 0, selisih: (kind === 'bfl' || kind === 'wait') ? 0 : -r.qty }, date: r.date, close: ok ? (r.close || null) : null };
      items.push(it);
      var d = days[r.date] || (days[r.date] = newBucket());
      [d, tot].forEach(function (b) {
        b.lines++; b.qty += r.qty; b.aktual += it.e.aktual; b.selisih += it.e.selisih;
        if (kind === 'bfl') { b.nBfl++; b.qBfl += r.qty; b.sesuai++; b.credit += r.qty; }
        else if (kind === 'wait') { b.nWait++; b.qWait += r.qty; }   // masih dalam batas H+1: bukan selisih
        else { b.skuSelisih++; if (kind === 'manual') { b.nManual++; b.qManual += r.qty; } else { b.nTrm++; b.qTrm += r.qty; } }
        if (it.close) b.closed = (b.closed || 0) + 1;
      });
    });
    var res = finish(days, items, tot);
    res.ref = refN == null ? '' : plusDay('1970-01-01', refN); res.grace = grace;
    return res;
  }

  // ---------- perhitungan: Barcode OUT (Master Scan Out) ----------
  // PICK = belum ter-scan. CHECK + Qty Check >= Qty SPM = selesai. CHECK tapi
  // Qty Check < Qty SPM = sebagian. Tanpa kolom status (file TER lama) dinilai dari qty.
  function outState(r) {
    if (r.status === 'PICK') return 'none';
    if (r.qchk >= r.qspm && r.qspm > 0) return 'full';
    return r.qchk > 0 ? 'part' : 'none';
  }
  function summarizeOut(rows) {
    var days = {}, items = [], tot = newBucket();
    rows.forEach(function (r) {
      var st = outState(r);
      var chk = st === 'none' ? 0 : Math.min(r.qchk, r.qspm);
      var kurang = r.qspm - chk;
      var it = { v: r, e: { status: st, aktual: chk, selisih: -kurang }, date: r.date, close: r.close || null };
      items.push(it);
      var d = days[r.date] || (days[r.date] = newBucket());
      [d, tot].forEach(function (b) {
        b.lines++; b.qty += r.qspm; b.aktual += chk; b.selisih += -kurang; b.credit += chk;
        if (st === 'full') b.sesuai++; else b.skuSelisih++;
        if (it.close) b.closed = (b.closed || 0) + 1;
      });
    });
    return finish(days, items, tot);
  }

  // ---------- gabung hasil upload baru dengan data lama ----------
  // Aturan: baris yang SEMUA nilainya sama dengan data lama dibiarkan (tidak diperbarui).
  // Kalau ada perbedaan, baris diganti. Kalau perbedaannya membuat item yang tadinya
  // selisih (mis. status TRM) menjadi beres (BFL / MANUAL / sesuai), baris diberi tanda
  // "close" berisi status sebelum -> sesudah dan waktu upload.
  //  opt.key(row)        -> kunci unik baris
  //  opt.fields          -> daftar field yang dibandingkan
  //  opt.closeField      -> nama field penanda close di baris (mis. 'closeBfl')
  //  opt.state(row)      -> { ok: bool, label: 'TRM' }  (kondisi baris)
  //  opt.lookupOld(row)  -> (opsional) baris lama pembanding kalau baris ini belum ada
  function mergeRecords(oldRows, newRows, opt, now) {
    var map = {}, order = [];
    (oldRows || []).forEach(function (r) { var k = opt.key(r); if (!(k in map)) order.push(k); map[k] = r; });
    var st = { added: 0, updated: 0, same: 0, closed: 0, closedItems: [] };
    newRows.forEach(function (n) {
      var k = opt.key(n), o = map[k];
      var prev = o || (opt.lookupOld ? opt.lookupOld(n) : null);
      if (o) {
        var same = opt.fields.every(function (f) { return String(o[f] == null ? '' : o[f]) === String(n[f] == null ? '' : n[f]); });
        if (same) { st.same++; return; }
      }
      var row = {}; for (var f in n) row[f] = n[f];
      var ns = opt.state(row), ps = prev ? opt.state(prev) : null;
      if (ns.ok && ps && !ps.ok) {
        row[opt.closeField] = { from: ps.label, to: ns.label, at: now.text, iso: now.iso, by: now.by };
        st.closed++; st.closedItems.push(row);
      } else if (ns.ok && prev && prev[opt.closeField]) {
        row[opt.closeField] = prev[opt.closeField];      // tetap tercatat pernah Close
      }
      if (o) st.updated++; else { st.added++; order.push(k); }
      map[k] = row;
    });
    return { rows: order.map(function (k) { return map[k]; }), stats: st };
  }

  function finish(days, items, tot) {
    var list = Object.keys(days).filter(Boolean).sort().map(function (k) {
      var b = days[k]; b.date = k; b.pct = pct(b.credit, b.qty - (b.qWait || 0));
      b.pctLines = pct(b.sesuai, b.lines - (b.nWait || 0)); return b;
    });
    tot.pct = pct(tot.credit, tot.qty - (tot.qWait || 0)); tot.pctLines = pct(tot.sesuai, tot.lines - (tot.nWait || 0));
    return { days: list, items: items, total: tot };
  }

  // Jumlahkan baris harian (bucket) menjadi satu total
  function sumDays(days, lane, basis) {
    var t = newBucket();
    days.forEach(function (d) { for (var f in t) t[f] += d[f] || 0; });
    t.pct = pct(t.credit, t.qty - (t.qWait || 0)); t.pctLines = pct(t.sesuai, t.lines - (t.nWait || 0));
    if (lane === 'bfl' && basis !== 'qty') t.pct = t.pctLines;
    return t;
  }

  var api = {
    sumDays: sumDays, shiftOf: shiftOf, plusDay: plusDay,
    MONTHS: MONTHS, num: num, digits: digits,
    parseVoucherSheet: parseVoucherSheet, resolveVoucherDates: resolveVoucherDates, prepareVoucherRows: prepareVoucherRows,
    parseStdSheet: parseStdSheet, parseBflSheet: parseBflSheet, parseTER: parseTER, parseScanOut: parseScanOut,
    outState: outState, mergeRecords: mergeRecords,
    evalIn: evalIn, summarizeIn: summarizeIn, summarizeBfl: summarizeBfl, summarizeOut: summarizeOut,
    isBflOk: isBflOk,
    // true bila sesi login = workspace Fitting Rucika (akurasi Box ID pakai kolom Selisih, tanpa Standar Isi Box)
    selMode: function () {
      try { return !!(root.WH_SESSION && root.WH_SESSION.workspace === 'cibitung_fitting_rucika'); } catch (e) { return false; }
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AkurasiCore = api;
})(typeof window !== 'undefined' ? window : this);
