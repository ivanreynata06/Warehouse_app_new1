/*!
 * akurasi-store.js
 * -----------------------------------------------------------------
 * Penyimpanan data "Akurasi Scan Barcode", dipakai bersama oleh
 *   - upload_data.html  (tab Akurasi Scan  -> menulis / upload)
 *   - akurasi_scan.html (Monitoring        -> membaca)
 *
 * Sumber utama = server (Apps Script, sheet AKURASI_DATA per workspace),
 * jadi data yang sama tampil di PC / akun mana pun. IndexedDB hanya
 * cadangan supaya halaman tetap tampil saat server lambat / belum
 * di-deploy ulang.
 *
 * Butuh: AkurasiCore (akurasi-core.js), XLSX (SheetJS) untuk file Excel,
 *        google.script.run (api-shim.js).
 * -----------------------------------------------------------------
 */
(function (root) {
  'use strict';
  var C = root.AkurasiCore;
  var KINDS = ['voucher', 'std', 'bfl', 'ter'];
  var TITLES = { voucher: 'Master Voucher & Box ID', std: 'Standar Isi Box', bfl: 'Master Backflush', ter: 'Master TER (Barcode Out)' };
  var DBN = 'wh_akurasi2';

  function ws() { try { return (root.getWorkspace && root.getWorkspace()) || 'default'; } catch (e) { return 'default'; } }
  function who() { var s = root.WH_SESSION || {}; return s.nama || s.nik || ''; }
  function stamp() {
    var d = new Date();
    return d.getDate() + ' ' + C.MONTHS[d.getMonth()] + ' ' + d.getFullYear() + ', ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* ---------- cache lokal (IndexedDB, fallback memori) ---------- */
  var MEM = {}, DB = null;
  function idb() {
    return new Promise(function (res, rej) {
      if (DB) return res(DB);
      if (!root.indexedDB) return rej(new Error('no idb'));
      var rq = indexedDB.open(DBN, 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore('kv'); };
      rq.onsuccess = function () { DB = rq.result; res(DB); };
      rq.onerror = function () { rej(rq.error); };
    });
  }
  function lkey(k) { return 'akurasi::' + ws() + '::' + k; }
  function lget(k) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var r = db.transaction('kv').objectStore('kv').get(lkey(k));
        r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
      });
    }).catch(function () { return MEM[lkey(k)]; });
  }
  function lset(k, v) {
    MEM[lkey(k)] = v;
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('kv', 'readwrite');
        if (v == null) tx.objectStore('kv').delete(lkey(k)); else tx.objectStore('kv').put(v, lkey(k));
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    }).catch(function () { /* tetap ada di memori sesi ini */ });
  }

  /* ---------- panggilan server ---------- */
  function api(fn, args) {
    return new Promise(function (resolve, reject) {
      if (!root.google || !root.google.script || !root.google.script.run) return reject(new Error('Backend belum siap'));
      root.google.script.run
        .withSuccessHandler(function (r) {
          if (r && r.success === false) reject(new Error(r.error || 'Server menolak permintaan'));
          else resolve(r);
        })
        .withFailureHandler(function (e) { reject(e instanceof Error ? e : new Error(String(e && e.message || e))); })[fn].apply(null, args || []);
    });
  }
  function friendly(err) {
    var m = String(err && err.message || err || '');
    if (/tidak dikenali|tidak diizinkan/i.test(m)) return 'Backend belum di-deploy ulang (kode.gs terbaru belum aktif di Apps Script).';
    return m || 'Server tidak bisa dihubungi.';
  }

  /* ---------- load / save / clear ---------- */
  // Mengembalikan { data:{voucher,std,bfl,ter}, source:'server'|'local', warn:'' }
  function load() {
    return api('getAkurasiData', []).then(function (r) {
      var d = (r && r.data) || {};
      return Promise.all(KINDS.map(function (k) { return lset(k, d[k] || null); })).then(function () {
        return { data: pick(d), source: 'server', warn: '' };
      });
    }).catch(function (err) {
      return Promise.all(KINDS.map(lget)).then(function (a) {
        var d = {}; KINDS.forEach(function (k, i) { d[k] = a[i] || null; });
        return { data: pick(d), source: 'local', warn: friendly(err) };
      });
    });
  }
  function pick(d) { var o = {}; KINDS.forEach(function (k) { o[k] = d[k] || null; }); return o; }

  function save(kind, rec) {
    return lset(kind, rec).then(function () {
      return api('saveAkurasiData', [kind, JSON.stringify(rec)]).then(function () { return { remote: true }; })
        .catch(function (err) { return { remote: false, warn: friendly(err) }; });
    });
  }
  function clear(kind) {
    return lset(kind, null).then(function () {
      return api('hapusAkurasiData', [kind]).then(function () { return { remote: true }; })
        .catch(function (err) { return { remote: false, warn: friendly(err) }; });
    });
  }

  /* ---------- baca file ---------- */
  function readSheets(file) {
    if (typeof root.XLSX === 'undefined') return Promise.reject(new Error('Library Excel belum termuat. Periksa koneksi lalu coba lagi.'));
    return file.arrayBuffer().then(function (buf) {
      var wb = root.XLSX.read(buf, { type: 'array' });
      return wb.SheetNames.map(function (n) { return { name: n, aoa: root.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) }; });
    });
  }
  function bestSheet(sheets, parse) {
    var best = null;
    sheets.forEach(function (s) {
      var r = parse(s.aoa), n = r.rows ? r.rows.length : r.count;
      if (!r.error && (!best || n > best.n)) best = { r: r, n: n };
    });
    if (!best) throw new Error(parse(sheets[0].aoa).error || 'File tidak dikenali.');
    return best.r;
  }

  /* ---------- ingest: parse file -> gabung dengan data server -> simpan ---------- */
  // opts.dateMode: 'auto' | 'swap' | 'none' (khusus Master Voucher)
  // Mengembalikan { msg, remote, warn, rec }
  function ingest(kind, files, opts) {
    opts = opts || {};
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return Promise.reject(new Error('Pilih file dulu.'));
    // Selalu gabung dengan data TERBARU di server (bukan cache), supaya upload dari
    // dua PC tidak saling menimpa.
    return load().then(function (cur) {
      var old = cur.data[kind];
      if (kind === 'ter') return mergeTer(files, old);
      return readSheets(files[0]).then(function (sheets) {
        if (kind === 'std') {
          var p = bestSheet(sheets, C.parseStdSheet);
          return { rec: { map: p.map, count: p.count, meta: { name: files[0].name, at: stamp(), by: who(), info: p.info } },
                   msg: 'Standar isi box dimuat: ' + p.count.toLocaleString('id-ID') + ' item (' + p.info + ')' };
        }
        var parsed = bestSheet(sheets, kind === 'voucher' ? C.parseVoucherSheet : C.parseBflSheet);
        var rows = parsed.rows, extra = '';
        if (kind === 'voucher') {
          var pr = C.prepareVoucherRows(rows, opts.dateMode || 'auto');
          rows = pr.rows;
          extra = pr.swapped ? ' Tanggal bulan/hari yang tertukar sudah dibetulkan otomatis.' : '';
        }
        var map = {};
        ((old && old.rows) || []).forEach(function (r) { map[r.voucher] = r; });
        var added = 0, updated = 0;
        rows.forEach(function (r) { if (map[r.voucher]) updated++; else added++; map[r.voucher] = r; });
        var all = Object.keys(map).map(function (x) { return map[x]; });
        return { rec: { rows: all, count: all.length, meta: { name: files[0].name, at: stamp(), by: who() } },
                 msg: 'Berhasil: ' + added.toLocaleString('id-ID') + ' baris baru, ' + updated.toLocaleString('id-ID') + ' diperbarui.' + extra };
      });
    }).then(function (o) {
      return save(kind, o.rec).then(function (s) {
        return { msg: o.msg, remote: s.remote, warn: s.warn || '', rec: o.rec };
      });
    });
  }
  function mergeTer(files, old) {
    return Promise.all(files.map(function (f) { return f.text().then(function (t) { return { f: f, p: C.parseTER(t) }; }); })).then(function (rs) {
      var bad = rs.filter(function (x) { return x.p.error; });
      if (bad.length === rs.length) throw new Error(bad[0].p.error);
      var map = {}, added = 0;
      ((old && old.rows) || []).forEach(function (r) { map[r.spm + '|' + r.item + '|' + r.group] = r; });
      rs.forEach(function (x) { x.p.rows.forEach(function (r) { map[r.spm + '|' + r.item + '|' + r.group] = r; added++; }); });
      var all = Object.keys(map).map(function (x) { return map[x]; });
      var names = rs.map(function (x) { return x.f.name; }).join(', ');
      return { rec: { rows: all, count: all.length, meta: { name: names.length > 60 ? rs.length + ' file TER' : names, at: stamp(), by: who() } },
               msg: 'Berhasil: ' + added.toLocaleString('id-ID') + ' baris SPM' + (bad.length ? ' (' + bad.length + ' file dilewati)' : '') + '.' };
    });
  }

  root.AkurasiStore = { KINDS: KINDS, TITLES: TITLES, load: load, save: save, clear: clear, ingest: ingest };
})(typeof window !== 'undefined' ? window : this);
