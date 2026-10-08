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
  var KINDS = ['voucher', 'std', 'bfl', 'ter', 'alasan'];
  var TITLES = { voucher: 'Master Voucher & Box ID', std: 'Standar Isi Box', bfl: 'Master Backflush', ter: 'Master Scan Out (Barcode Out)' };
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
  // onProg(persen, tahap) opsional, dipakai halaman untuk loading bar
  function load(onProg) {
    var prog = function (v, t) { try { if (onProg) onProg(v, t); } catch (e) {} };
    prog(8, 'Menghubungi server');
    return api('getAkurasiData', []).then(function (r) {
      prog(70, 'Menyimpan salinan di perangkat');
      var d = (r && r.data) || {};
      return Promise.all(KINDS.map(function (k) { return lset(k, d[k] || null); })).then(function () {
        return scope({ data: pick(d), source: 'server', warn: '' });
      });
    }).catch(function (err) {
      prog(70, 'Server tidak terjangkau, memakai salinan perangkat');
      return Promise.all(KINDS.map(lget)).then(function (a) {
        var d = {}; KINDS.forEach(function (k, i) { d[k] = a[i] || null; });
        return scope({ data: pick(d), source: 'local', warn: friendly(err) });
      });
    });
  }
  // Hanya tampilkan / simpan baris milik departemen yang sedang aktif. Data lama yang sudah
  // tercampur di server ikut tersaring di sini, dan akan terbuang dari penyimpanan pada
  // upload berikutnya (karena upload selalu menggabungkan dengan data yang sudah disaring).
  function scope(res) {
    var w = ws(), hidden = {}, total = 0;
    ['voucher', 'bfl', 'ter'].forEach(function (k) {
      var rec = res.data[k];
      if (!rec || !rec.rows) return;
      var f = C.deptRows(rec.rows, w);
      hidden[k] = f.hidden; total += f.hidden;
      if (f.hidden) { var o = {}; for (var x in rec) o[x] = rec[x]; o.rows = f.rows; o.count = f.rows.length; res.data[k] = o; }
    });
    res.hidden = hidden; res.hiddenTotal = total; res.dept = C.DEPT_LABEL[w] || '';
    return res;
  }
  function pick(d) { var o = {}; KINDS.forEach(function (k) { o[k] = d[k] || null; }); return o; }

  function save(kind, rec, force) {
    return lset(kind, rec).then(function () {
      return api('saveAkurasiData', [kind, JSON.stringify(rec), force ? 1 : 0]).then(function () { return { remote: true }; })
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

  /* ---------- ingest: parse file -> bandingkan dengan data server -> simpan ---------- */
  // opts.dateMode : 'auto' | 'swap' | 'none' (Master Voucher)
  // opts.date     : 'yyyy-mm-dd' tanggal kirim (Master Scan Out, tarikan sistem tidak membawa tanggal)
  // opts.force    : izinkan mengganti Standar Isi Box yang sudah ada
  // Mengembalikan { msg, remote, warn, rec, stats }
  function nowInfo() {
    var d = new Date();
    return { text: stamp(), iso: d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), by: who() };
  }
  var OK_BFL = function (r) { return { ok: C.isBflOk(r.status), label: r.status || 'belum ada status' }; };

  function msgStats(st, extra) {
    var n = function (x) { return x.toLocaleString('id-ID'); };
    var m = n(st.added) + ' baris baru, ' + n(st.updated) + ' diperbarui, ' + n(st.same) + ' tidak berubah (dibiarkan).';
    if (st.closed) m += ' ' + n(st.closed) + ' item Close.';
    return m + (extra || '');
  }

  function ingest(kind, files, opts) {
    opts = opts || {};
    var prog = function (pct, label) { try { if (opts.onProgress) opts.onProgress(pct, label); } catch (e) {} };
    prog(5, 'Mengambil data terbaru dari server...');
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return Promise.reject(new Error('Pilih file dulu.'));
    // Selalu bandingkan dengan data TERBARU di server (bukan cache), supaya upload dari
    // dua PC tidak saling menimpa.
    return load().then(function (cur) {
      var old = cur.data[kind], now = nowInfo();
      var stdLengkapi = kind === 'std' && old && !opts.force && !(old.desc && Object.keys(old.desc).length);
      if (kind === 'std' && old && !opts.force && !stdLengkapi) {
        throw new Error('Standar Isi Box bersifat permanen dan sudah pernah diupload. Tidak bisa ditimpa.');
      }
      prog(20, 'Membaca file...');
      if (kind === 'ter') return mergeOut(files, old, opts, now);
      return readSheets(files[0]).then(function (sheets) {
        prog(40, 'Memeriksa isi file...');
        if (kind === 'std') {
          var p = bestSheet(sheets, C.parseStdSheet);
          if (stdLengkapi) {
            // Standar lama dipertahankan (permanen), hanya deskripsi item yang dilengkapi.
            var nd = Object.keys(p.desc || {}).length;
            if (!nd) throw new Error('File ini tidak punya kolom deskripsi (DESC). Tidak ada yang dilengkapi.');
            return { rec: { map: old.map, desc: p.desc, count: old.count, meta: old.meta }, force: true,
                     msg: 'Deskripsi ' + nd.toLocaleString('id-ID') + ' item dilengkapi. Standar isi box lama tidak diubah.' };
          }
          return { rec: { map: p.map, desc: p.desc, count: p.count, meta: { name: files[0].name, at: now.text, by: now.by, info: p.info } },
                   force: !!opts.force, msg: 'Standar isi box tersimpan permanen: ' + p.count.toLocaleString('id-ID') + ' item (' + p.info + ')' };
        }
        var parsed = bestSheet(sheets, kind === 'voucher' ? C.parseVoucherSheet : C.parseBflSheet);
        var dfl = C.deptRows(parsed.rows, ws()); parsed.rows = dfl.rows;
        var skipDept = dfl.hidden ? ' ' + dfl.hidden.toLocaleString('id-ID') + ' baris milik departemen lain dilewati (halaman ini hanya ' + (C.DEPT_LABEL[ws()] || 'departemen aktif') + ').' : '';
        if (!parsed.rows.length) throw new Error('Tidak ada baris milik ' + (C.DEPT_LABEL[ws()] || 'departemen ini') + ' di file ini.' + skipDept);
        var rows = parsed.rows, extra = skipDept;
        if (kind === 'voucher') {
          var pr = C.prepareVoucherRows(rows, opts.dateMode || 'auto');
          rows = pr.rows;
          extra = (pr.swapped ? ' Tanggal bulan/hari yang tertukar sudah dibetulkan otomatis.' : '') + skipDept;
          var selMode = C.selMode();   // Fitting Rucika: cek Box ID lewat kolom Selisih, tanpa standar isi
          var stdMap = cur.data.std ? cur.data.std.map : {}, hasStd = selMode || Object.keys(stdMap).length > 0;
          var boxState = function (r) { var e = C.evalIn(r, stdMap, { selisih: selMode }); return { ok: e.status === 'sesuai', label: e.status === 'kosong' ? 'Box ID kosong' : 'Tidak sesuai' }; };
          // dua pola yang sama: status backflush (TRM -> BFL/MANUAL) dan Box ID (kosong/tidak sesuai -> sesuai)
          var m1 = C.mergeRecords(old && old.rows, rows, { key: function (r) { return r.voucher; }, closeField: 'closeBfl', state: OK_BFL,
            fields: ['item', 'qty', 'status', 'box', 'sel', 'date', 'desc', 'group', 'type'] }, now);
          var all = m1.rows;
          if (hasStd && old && old.rows) {
            var oldBy = {}; old.rows.forEach(function (r) { oldBy[r.voucher] = r; });
            all = all.map(function (r) {
              var o = oldBy[r.voucher]; if (!o) return r;
              var ps = boxState(o), ns = boxState(r);
              if (ns.ok && !ps.ok) { r.closeBox = { from: ps.label, to: 'Sesuai', at: now.text, iso: now.iso, by: now.by }; }
              else if (ns.ok && o.closeBox) r.closeBox = o.closeBox;
              else if (!ns.ok) delete r.closeBox;
              return r;
            });
          }
          var st = m1.stats;
          st.closed = all.filter(function (r) {
            return (r.closeBfl && r.closeBfl.at === now.text && C.lateClose(r.closeBfl, r.date, 2)) || (r.closeBox && r.closeBox.at === now.text);
          }).length;
          return { rec: { rows: all, count: all.length, meta: { name: files[0].name, at: now.text, by: now.by } }, stats: st,
                   msg: 'Berhasil: ' + msgStats(st, extra) };
        }
        // backflush: bandingkan dengan baris backflush lama, atau status di Master Voucher kalau belum ada
        var vBy = {}; ((cur.data.voucher && cur.data.voucher.rows) || []).forEach(function (r) { vBy[r.voucher] = r; });
        var mb = C.mergeRecords(old && old.rows, parsed.rows, { key: function (r) { return r.voucher; }, closeField: 'closeBfl', state: OK_BFL,
          lookupOld: function (r) { return vBy[r.voucher] || null; },
          fields: ['item', 'qty', 'status', 'date', 'desc', 'group'] }, now);
        mb.stats.closed = mb.stats.closedItems.filter(function (r) { return C.lateClose(r.closeBfl, r.date, 2); }).length;
        return { rec: { rows: mb.rows, count: mb.rows.length, meta: { name: files[0].name, at: now.text, by: now.by } }, stats: mb.stats,
                 msg: 'Berhasil: ' + msgStats(mb.stats, skipDept) };
      });
    }).then(function (o) {
      prog(70, 'Menyimpan ke server...');
      return save(kind, o.rec, o.force).then(function (s) {
        prog(100, 'Selesai');
        return { msg: o.msg, remote: s.remote, warn: s.warn || '', rec: o.rec, stats: o.stats };
      });
    });
  }

  // Master Scan Out (.xlsx, tanggal dipilih saat upload) dan file TER lama (.txt)
  function mergeOut(files, old, opts, now) {
    var xl = files.filter(function (f) { return /\.(xlsx|xls)$/i.test(f.name); });
    if (xl.length && !opts.date) throw new Error('Pilih tanggal kirim dulu. Tarikan sistem Master Scan Out tidak membawa tanggal.');
    return Promise.all(files.map(function (f) {
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        return readSheets(f).then(function (sheets) { return { f: f, p: bestSheet2(sheets, function (a) { return C.parseScanOut(a, opts.date); }) }; });
      }
      return f.text().then(function (t) { return { f: f, p: C.parseTER(t) }; });
    })).then(function (rs) {
      var bad = rs.filter(function (x) { return x.p.error; });
      if (bad.length === rs.length) throw new Error(bad[0].p.error);
      var rows = []; rs.forEach(function (x) { if (!x.p.error) rows = rows.concat(x.p.rows); });
      var dfo = C.deptRows(rows, ws()); rows = dfo.rows;
      var skipO = dfo.hidden ? ' ' + dfo.hidden.toLocaleString('id-ID') + ' baris milik departemen lain dilewati.' : '';
      if (!rows.length) throw new Error('Tidak ada baris milik ' + (C.DEPT_LABEL[ws()] || 'departemen ini') + ' di file ini.' + skipO);
      var outState = function (r) { return { ok: C.outState(r) === 'full', label: r.status || (C.outState(r) === 'part' ? 'Sebagian' : 'Belum scan') }; };
      var m = C.mergeRecords(old && old.rows, rows, { key: function (r) { return r.key || (r.spm + '|' + r.item + '|' + r.group); }, closeField: 'close', state: outState,
        fields: ['qspm', 'qchk', 'status', 'date', 'tuj', 'qpick'] }, now);
      var names = rs.map(function (x) { return x.f.name; }).join(', ');
      return { rec: { rows: m.rows, count: m.rows.length, meta: { name: names.length > 60 ? rs.length + ' file' : names, at: now.text, by: now.by } },
               stats: m.stats, msg: 'Berhasil: ' + msgStats(m.stats, (bad.length ? ' (' + bad.length + ' file dilewati)' : '') + skipO) };
    });
  }
  function bestSheet2(sheets, parse) { try { return { rows: bestSheet(sheets, parse).rows || [], error: null }; } catch (e) { return { rows: [], error: e.message }; } }

  // Simpan alasan untuk satu / beberapa item. entries: [{ key, r, t }] (r kosong = hapus).
  // Server memperbarui per entri, jadi aman walau banyak orang mengisi bersamaan.
  function saveAlasan(entries) {
    return api('simpanAkurasiAlasan', [JSON.stringify({ by: who(), entries: entries })])
      .then(function (r) { return { remote: true, at: r && r.at }; })
      .catch(function (err) { return { remote: false, warn: friendly(err) }; });
  }
  function cacheAlasan(obj) { return lset('alasan', obj); }

  root.AkurasiStore = { KINDS: KINDS, TITLES: TITLES, load: load, save: save, clear: clear, ingest: ingest, saveAlasan: saveAlasan, cacheAlasan: cacheAlasan };
})(typeof window !== 'undefined' ? window : this);
