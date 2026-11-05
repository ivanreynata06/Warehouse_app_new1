/*!
 * rakwms-ui.js -- tampilan tab "Akurasi Rak WMS" (glass + 3D)
 * Logika murni ada di rakwms.js (RakWmsCore).
 * Data disimpan di SERVER (kunci bersama 'SHARED' per departemen, sama seperti data Stock Opname) + salinan di browser,
 * dan hasil aktual yang lengkap per item otomatis masuk ke Stock Opname (SO_DETAIL lembar aktif).
 */
(function () {
  'use strict';
  var K = window.RakWmsCore, esc = K.esc, fmt = K.fmt;
  var USER = (sessionStorage.getItem('wh_nama') || 'anon').trim().toLowerCase();
  var KEY = 'rakwms_v1::' + USER;
  var S = load(), ui = { allowed: [], g: 'all', q: '', f: 'all', open: null, items: [], plan: null, sum: null, soStat: {}, soErr: '' };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- penyimpanan lokal (BUKAN Supabase / Spreadsheet) ---------- */
  function load() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && j.wms) { var b = K.blank(); for (var k in b) if (j[k] === undefined) j[k] = b[k]; return j; } } catch (e) {} return K.blank(); }
  var NIK = (sessionStorage.getItem('wh_nik') || '').trim(), NAMA = (sessionStorage.getItem('wh_nama') || '').trim(), SKEY = 'SHARED', syncTimer = null, syncState = ['idle', ''], soTimer = null, soBusy = false, lastPull = 0;
  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Penyimpanan browser penuh / diblokir. Data tetap disalin ke server; gunakan juga Simpan Cadangan.', true); }
    idbSet(JSON.stringify(S));
  }
  function save() { S.meta.dirty = true; saveLocal(); scheduleSync(); }
  /* ---------- sinkron ke server (hanya kolom terpilih; sisa kolom file sudah dibuang saat upload & disaring lagi di server) ---------- */
  function gs(fn, args) {
    return new Promise(function (res, rej) {
      if (!window.google || !google.script || !google.script.run) return rej(new Error('Backend belum siap'));
      google.script.run.withSuccessHandler(res).withFailureHandler(rej)[fn].apply(null, args);
    });
  }
  function setSync(st, msg) {
    syncState = [st, msg || '']; var el = $('rk-sync'); if (!el) return;
    var map = { idle: ['', 'x'], pending: ['Menunggu simpan ke server...', 'x'], saving: ['Menyimpan ke server...', 'x'], ok: ['Tersimpan di server', ''], err: ['Gagal simpan ke server', 'x'] };
    var m = map[st] || map.idle; el.className = 'rk-chip ' + m[1]; el.textContent = (st === 'ok' ? '\u2601 ' : '') + (msg || m[0]);
    el.style.borderColor = st === 'err' ? 'rgba(244,63,94,.5)' : ''; el.style.color = st === 'err' ? '#fda4af' : '';
  }
  function scheduleSync() { clearTimeout(syncTimer); setSync('pending'); syncTimer = setTimeout(syncNow, 2500); scheduleSo(); }
  function syncNow() {
    clearTimeout(syncTimer); setSync('saving');
    return gs('saveRakWmsData', [SKEY, JSON.stringify(S)]).then(function (r) {
      if (!r || r.success === false) throw new Error((r && r.error) || 'ditolak server');
      S.meta.syncAt = r.updatedAt; S.meta.dirty = false; saveLocal(); setSync('ok', 'Tersimpan di server ' + new Date().toLocaleTimeString('id-ID'));
    }).catch(function (e) { setSync('err', 'Gagal simpan ke server: ' + (e && e.message || e) + ' (data aman di browser, akan dicoba lagi)'); clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 30000); });
  }
  function pullServer(quiet) {
    lastPull = Date.now();
    gs('getRakWmsData', [SKEY]).then(function (r) {
      if (!r || r.success === false) throw new Error((r && r.error) || 'gagal');
      var local = (S.wms.length || S.qad.length);
      if (!r.found) {
        // belum ada data bersama: ambil data lama milik user ini (versi sebelumnya per-user), lalu jadikan data bersama
        return gs('getRakWmsData', [NIK || NAMA]).then(function (o) {
          if (o && o.found && !local) { try { adopt(JSON.parse(o.data)); saveLocal(); render(); } catch (e) {} }
          if (S.wms.length || S.qad.length) syncNow(); else setSync('idle', 'Belum ada data di server');
        }).catch(function () { if (local) syncNow(); else setSync('idle', 'Belum ada data di server'); });
      }
      if (local && S.meta.syncAt === r.updatedAt) { if (S.meta.dirty) syncNow(); else setSync('ok', 'Tersimpan di server'); return; }
      var j = JSON.parse(r.data);
      if (local && S.meta.dirty && !confirm('Ada perubahan di browser ini yang belum tersimpan, sementara data di server lebih baru (dari PIC/perangkat lain).\n\nOK = pakai data SERVER\nBatal = pertahankan data browser ini dan timpa server')) { syncNow(); return; }
      adopt(j); S.meta.syncAt = r.updatedAt; S.meta.dirty = false; saveLocal(); render(); setSync('ok', quiet ? 'Data diperbarui dari server' : 'Data dipulihkan dari server');
    }).catch(function (e) { setSync('err', 'Server tidak terjangkau: ' + (e && e.message || e)); });
  }
  /* ---------- LINK ke Stock Opname (SO_DETAIL lembar aktif) ---------- */
  var styledLib = null;
  function loadStyled() {
    return new Promise(function (res) {
      if (styledLib) return res(styledLib);
      var old = window.XLSX, sc = document.createElement('script'); sc.src = './assets/vendor/xlsx-js-style.min.js?v=1.2.0';
      sc.onload = function () { styledLib = window.XLSX; window.XLSX = old; res(styledLib); };
      sc.onerror = function () { window.XLSX = old; res(null); };
      document.head.appendChild(sc);
    });
  }
  function isTransit(rak) { return /TRANSIT/i.test(String(rak || '')); }
  var SOG = ['I053'];   // group yang pengisian SO-nya sudah dipindah ke Akurasi WMS (Fitting / Q055 menyusul)
  function inSOG(it) { return SOG.indexOf(String(it.grp).toUpperCase()) >= 0; }
  function sogAllowed() { return ui.allowed.filter(function (g) { return SOG.indexOf(String(g).toUpperCase()) >= 0; }); }
  function soKey(kode) { return String(kode == null ? '' : kode).trim().toUpperCase(); }
  function soRec(it) { var g = ui.soStat && ui.soStat[it.grp]; var r = g && g.items && g.items[soKey(it.kode)]; return r && r.fisik !== null && r.fisik !== undefined ? r : null; }
  function soTglF(t) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t || '')); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
  // SO ulang: item yang sudah di-SO tetapi kuncinya dibuka PIC (hanya di Akurasi WMS; Dashboard SO tidak berubah)
  function soGrp(it) { return ui.soStat && ui.soStat[it.grp]; }
  function ulangOf(it) { var g = soGrp(it); return (g && g.ulang && g.ulang[soKey(it.kode)]) || null; }
  function carryN(it) { var g = soGrp(it); return g ? (g.carryBelum || 0) : 0; }
  function locked(it) { return !!soRec(it) && !ulangOf(it); }
  function clearItem(kode) { if (S.adjDone) delete S.adjDone[kode]; delete S.inputs[kode]; delete S.manual[kode]; if (S.koreksi) delete S.koreksi[kode]; if (S.soSent) delete S.soSent[soKey(kode)]; }
  // keterangan resmi untuk item yang sudah di-SO (terkunci); bila data terbaru masih selisih, diberi catatan khusus
  function canUnlock() { return !!window.IS_TL; }   // TL atau Admin
  function soNote(it) {
    var r = soRec(it); if (!r) return '';
    var ad = S.adjDone && S.adjDone[it.kode];
    var b = 'Item ini telah di-SO pada tanggal ' + soTglF(r.tgl) + (r.oleh ? ' oleh ' + String(r.oleh).replace(/\s*\(Akurasi Rak\)\s*$/, '') : '') + ' dengan fisik ' + fmt(r.fisik) + (ad ? ' dan sudah di-adjustment (template diunduh ' + soTglF(ad) + ')' : '') + '.';
    if (it.sel !== 0) return b + ' Namun pada data terbaru masih terdapat selisih WMS - QAD sebesar ' + (it.sel > 0 ? '+' : '') + fmt(it.sel) + ' (WMS ' + fmt(it.wms) + ' vs QAD ' + fmt(it.qadv) + '). Apakah akan di-SO ulang? ' + (canUnlock() ? 'Jika ya, buka kunci untuk SO ulang.' : 'Jika ya, minta TL atau Admin membuka kunci.');
    return b + ' Pada data terbaru saldo WMS dan QAD sudah sesuai.';
  }
  function soTgl(t) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(t || '')); return m ? m[3] + '/' + m[2] : ''; }
  // item "lengkap" = semua rak (selain TRANSIT) sudah diisi aktual; Fisik = total aktual
  function completeItems() {
    var out = [];
    ui.items.forEach(function (it) {
      if (!inSOG(it) || !K.lines(S, it, ui.plan).complete) return;
      out.push({ group: it.grp, item: it.kode, fisik: K.fisik(S, it) });
    });
    return out;
  }
  function loadSoStat() {
    var gr = sogAllowed(); if (!gr.length) { ui.soStat = {}; return Promise.resolve(true); }
    return gs('soStatusDariRak', [JSON.stringify(gr)]).then(function (r) {
      if (!r || r.success === false) throw new Error((r && r.error) || 'gagal');
      ui.soStat = r.data || {}; ui.soErr = ''; return true;
    }).catch(function (e) { ui.soErr = String((e && e.message) || e || ''); return false; });
  }
  // jadwal sinkron ke SO: "segera" (saat drawer/form ditutup) tidak boleh ditimpa jadwal debounce 12 detik dari save()
  var soDue = 0;
  function scheduleSo(now) {
    if (!ui.items.length) return;
    var due = Date.now() + (now ? 50 : 12000);
    if (soTimer && soDue && soDue < due) return;
    clearTimeout(soTimer); soDue = due; soTimer = setTimeout(syncSo, now ? 50 : 12000);
  }
  function syncSo() {
    clearTimeout(soTimer); soTimer = null; soDue = 0; if (soBusy || !ui.items.length) return Promise.resolve();
    if (ui.open || ui.soOpen) return Promise.resolve();   // jangan mengunci item saat PIC masih mengetik
    S.soSent = S.soSent || {};
    var fresh = [], rep = [];
    completeItems().forEach(function (x) {
      var it = itemOf(x.item); if (!it) return;
      var u = ulangOf(it);
      if (u) rep.push({ u: u, x: x, it: it });                                                // SO ulang selesai -> dicatat terpisah, TIDAK menyentuh Dashboard SO
      else if (!soRec(it) && S.soSent[soKey(x.item)] !== x.fisik) fresh.push(x);              // SO pertama periode ini -> masuk SO_DETAIL
    });
    if (!fresh.length && !rep.length) return Promise.resolve();
    soBusy = true;
    var p = Promise.resolve();
    if (fresh.length) p = p.then(function () {
      return gs('soSyncDariRak', [JSON.stringify({ user: NAMA, items: fresh })]).then(function (r) {
        if (!r || r.success === false) throw new Error((r && r.error) || 'ditolak server');
        var d = r.data || {}, skip = {}; (d.tanpaLembar || []).forEach(function (g) { skip[g] = 1; });
        fresh.forEach(function (x) { if (!skip[x.group]) S.soSent[soKey(x.item)] = x.fisik; });
        saveLocal();
        if (d.tersimpan) toast('✓ ' + fmt(d.tersimpan) + ' item tercatat ke Stock Opname (progres SO terupdate).');
        if (d.tanpaLembar && d.tanpaLembar.length) ui.soErr = 'Lembar SO periode ini untuk group ' + d.tanpaLembar.join(', ') + ' belum dibuat. Buat dulu di tab Buat Lembar SO - hasil rak akan terkirim otomatis setelahnya.';
        else ui.soErr = '';
      });
    });
    rep.forEach(function (o) {
      p = p.then(function () {
        return gs('soUlangSelesai', [JSON.stringify({ id: o.u.id, fisik: o.x.fisik, qad: o.it.qadv, nik: NIK, user: NAMA })]).then(function (r) {
          if (!r || r.success === false) throw new Error((r && r.error) || 'ditolak server');
          toast('✓ SO ulang ' + short(o.it.nama) + ' selesai dan tercatat (fisik ' + fmt(o.x.fisik) + '). Dashboard Stock Opname tidak berubah.');
        });
      });
    });
    return p.then(function () { return loadSoStat(); }).then(function () {
      if (!ui.open && !ui.soOpen) { renderTbl(); renderAdj(); }
      loadRep();
      try { if (typeof window.soAfterRakSync === 'function') window.soAfterRakSync(); } catch (e) {}
    }).catch(function (e) { ui.soErr = 'Gagal kirim ke Stock Opname: ' + (e && e.message || e) + ' (akan dicoba lagi)'; if (!ui.open && !ui.soOpen) renderTbl(); clearTimeout(soTimer); soDue = Date.now() + 45000; soTimer = setTimeout(syncSo, 45000); })
      .then(function () { soBusy = false; });
  }
  /* IndexedDB = salinan kedua (tetap ada walau localStorage terhapus sebagian). Clear data situs tetap menghapus keduanya -> pakai file cadangan. */
  function idb(cb) { try { var r = indexedDB.open('rakwms', 1); r.onupgradeneeded = function () { r.result.createObjectStore('kv'); }; r.onsuccess = function () { cb(r.result); }; r.onerror = function () { cb(null); }; } catch (e) { cb(null); } }
  function idbSet(v) { idb(function (db) { if (!db) return; try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, KEY); } catch (e) {} }); }
  function idbGet(cb) { idb(function (db) { if (!db) return cb(null); try { var q = db.transaction('kv').objectStore('kv').get(KEY); q.onsuccess = function () { cb(q.result || null); }; q.onerror = function () { cb(null); }; } catch (e) { cb(null); } }); }
  function adopt(j) { var b = K.blank(); for (var k in b) if (j[k] === undefined) j[k] = b[k]; S = j; }
  function toast(m, err) { if (typeof window.toast === 'function') window.toast(m, err); else alert(m); }
  function recalc() { ui.items = K.items(S, ui.allowed); ui.plan = K.plan(S, ui.items); ui.sum = K.summary(S, ui.items, ui.plan); }
  function tone(p) { return p == null ? 'none' : (p >= 98 ? 'good' : (p >= 90 ? 'warn' : 'bad')); }
  function short(n) { return String(n || '').replace(/^PIPE PPR RUCIKA KELEN GREEN DIA\s*/i, '').replace(/^PIPE PPR\s*/i, '') || n; }
  function pct(p) { return p == null ? '-' : (Math.round(p * 10) / 10).toLocaleString('id-ID', { minimumFractionDigits: p >= 100 ? 0 : 1, maximumFractionDigits: 1 }); }
  function sgn(n) { return n > 0 ? '<span class="pos">' + fmt(n) + '</span>' : (n < 0 ? '<span class="neg">' + fmt(n) + '</span>' : '<span class="zero">0</span>'); }

  /* ---------- gauge 3D ---------- */
  function gauge(p, label, sm) {
    var C = 2 * Math.PI * 58, t = tone(p), tk = '', i;
    for (i = 0; i < 48; i++) tk += '<line class="tk" x1="70" y1="2" x2="70" y2="' + (i % 4 === 0 ? 8 : 5) + '" transform="rotate(' + (i * 7.5) + ' 70 70)"/>';
    return '<div class="rk-gauge ' + t + (sm ? ' sm' : '') + '" data-p="' + (p == null ? 0 : p) + '"><svg viewBox="0 0 140 140">' +
      '<circle class="orbit" cx="70" cy="70" r="66" style="fill:none;stroke:rgba(255,255,255,.16);stroke-width:1;stroke-dasharray:2 7;filter:none"/>' + tk +
      '<circle class="tr" cx="70" cy="70" r="58"/>' +
      '<circle class="br" cx="70" cy="70" r="58" stroke="url(#rk-g-' + (t === 'none' ? 'good' : t) + ')" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '" transform="rotate(-90 70 70)" data-c="' + C + '"/></svg>' +
      '<div class="mid"><b data-n="' + (p == null ? '' : p) + '">' + (p == null ? '-' : '0') + (p == null ? '' : '<small>%</small>') + '</b><span>' + esc(label) + '</span></div></div>';
  }
  function verdict(p) {
    var t = tone(p), tx = { good: 'Akurasi Sangat Baik', warn: 'Perlu Perhatian', bad: 'Kritis - Perlu Tindakan', none: 'Belum ada data' }[t];
    return '<div class="rk-verdict ' + t + '">' + tx + '</div>';
  }

  /* ---------- kerangka ---------- */
  function shell() {
    $('p-rak').innerHTML = '<div class="rk" id="rk"><div class="rk-bg"></div>' +
      '<svg width="0" height="0" style="position:absolute"><defs>' +
      '<linearGradient id="rk-g-good" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>' +
      '<linearGradient id="rk-g-warn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#fb923c"/></linearGradient>' +
      '<linearGradient id="rk-g-bad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fb7185"/><stop offset="1" stop-color="#e879f9"/></linearGradient></defs></svg>' +
      '<div id="rk-hero"></div><div id="rk-prog"></div><div class="glass" id="rk-up"></div><div class="glass" id="rk-chart"></div><div class="glass" id="rk-rep"></div><div class="glass" id="rk-tbl"></div><div class="glass" id="rk-adj"></div>' +
      '<div class="rk-ov" id="rk-ov" onclick="RakUI.close()"></div><div class="rk-dr" id="rk-dr"></div><div class="rk-so" id="rk-so"></div></div>';
  }

  /* ---------- HERO ---------- */
  function renderHero() {
    var m = ui.sum, has = m.n > 0, p = has ? m.accItem : null;
    $('rk-hero').innerHTML = '<div class="rk-hero">' +
      '<div class="glass rk-main tilt"><div class="ttl">Akurasi Stok Rak - QAD vs WMS</div>' + gauge(p, 'item sesuai') + verdict(p) +
      '<div class="rk-formula">Akurasi Item = item yang total saldo WMS-nya sama dengan saldo QAD &divide; seluruh item. Target &ge; 98%.</div></div>' +
      '<div class="rk-side"><div class="rk-minis">' +
      '<div class="glass rk-mini tilt">' + gauge(m.accQty, 'qty', true) + '<div><div class="t">Akurasi Qty</div><div class="d">1 &minus; (total |selisih| &divide; total saldo QAD). Mengukur seberapa besar batang yang meleset.</div></div></div>' +
      '<div class="glass rk-mini tilt">' + gauge(m.accRak, 'rak', true) + '<div><div class="t">Akurasi Rak (hasil SO)</div><div class="d">' + (m.rin ? fmt(m.rok) + ' dari ' + fmt(m.rin) + ' rak aktual cocok dengan saldo WMS.' : 'Terisi otomatis setelah PIC menginput aktual rak.') + '</div></div></div></div>' +
      '<div class="glass"><div class="gb"><div class="rk-kpis">' +
      kpi('Total Item', m.n, '#22d3ee') + kpi('Item Sesuai', m.ok, '#10b981') + kpi('Item Selisih', m.bad, '#f43f5e') + kpi('Saldo QAD', m.qad, '#fbbf24') + kpi('Saldo WMS', m.wms, '#8b5cf6') +
      '</div></div></div></div></div>';
  }
  function kpi(l, v, c) { return '<div class="rk-kpi" style="--c:' + c + '"><span>' + l + '</span><b data-k="' + v + '">0</b></div>'; }

  /* ---------- UPLOAD ---------- */
  function dz(kind, ic, title, hint, keep, has, meta, stats) {
    return '<div><div class="rk-drop" data-k="' + kind + '" onclick="RakUI.pick(\'' + kind + '\')"><div class="ic">' + ic + '</div><div><div style="font-family:Outfit;font-weight:700;font-size:13px">' + title + '</div><div class="sub">' + hint + '</div></div></div>' +
      '<div class="rk-chips">' + keep.map(function (c) { return '<span class="rk-chip">' + c + '</span>'; }).join('') + '<span class="rk-chip x">kolom lain otomatis dibuang</span></div>' +
      '<div class="rk-stat">' + stats + '</div>' +
      (has ? '<div class="sub" style="margin-top:6px">' + esc(meta) + '</div><div style="margin-top:8px"><button class="btn2 dng sm" onclick="RakUI.clear(\'' + kind + '\')">Hapus data ini</button></div>' : '') + '</div>';
  }
  function renderUp() {
    setTimeout(function () { setSync(syncState[0], syncState[1]); }, 0);
    var nr = new Set(S.wms.map(function (r) { return r.rak; })).size;
    $('rk-up').innerHTML = '<div class="gh"><h3>Upload Data <em>hanya kolom terpilih yang disimpan</em></h3><span id="rk-sync" class="rk-chip x">...</span></div><div class="gb"><div class="rk-up">' +
      dz('qad', '&#128230;', 'Saldo Item QAD', 'Klik atau seret file stock QAD (.xlsx / .xls)', ['Item', 'Deskripsi', 'Qty'], S.qad.length, (S.meta.qadFile || '') + ' - ' + (S.meta.qadAt || ''),
        '<span><b>' + fmt(S.qad.length) + '</b>item QAD</span>') +
      dz('wms', '&#127970;', 'Informasi Rak WMS', 'Klik atau seret file Informasi Rak (.xlsx / .xls) - hanya lokasi ' + K.LOC, ['Lokasi', 'Area', 'Rak', 'Kode Item', 'Nama Item', 'Onhand'], S.wms.length, (S.meta.wmsFile || '') + ' - ' + (S.meta.wmsAt || ''),
        '<span><b>' + fmt(nr) + '</b>rak</span><span><b>' + fmt(S.wms.length) + '</b>baris item-rak</span>') +
      '</div><div class="rk-tools" style="margin-top:14px"><button class="btn2" onclick="RakUI.backup()">&#128190; Simpan Cadangan (.json)</button><button class="btn2" onclick="RakUI.restore()">&#128194; Pulihkan Cadangan</button>' +
      '<span class="sub">Data otomatis disalin ke server (hanya kolom terpilih), jadi <b>aman walau cache dibersihkan</b> - setelah login data kembali sendiri. File cadangan tetap tersedia sebagai arsip pribadi.' + (S.meta.backupAt ? ' Cadangan terakhir: ' + esc(S.meta.backupAt) + '.' : '') + '</span></div>' +
      '<input type="file" id="rk-file" accept=".xls,.xlsx,.csv" style="display:none"><input type="file" id="rk-rest" accept=".json" style="display:none"></div>';
  }

  /* ---------- chart 3D ---------- */
  function renderChart() {
    var its = ui.items.filter(function (i) { return i.sel !== 0; }).slice(0, 8), tt = 'Perbandingan QAD vs WMS - 8 item selisih terbesar';
    if (!its.length) { its = ui.items.slice().sort(function (a, b) { return b.qadv - a.qadv; }).slice(0, 8); tt = 'Saldo QAD vs WMS - 8 item terbesar' + (ui.items.length ? ' (semua sesuai)' : ''); }
    if (!its.length) { $('rk-chart').innerHTML = '<div class="gh"><h3>' + tt + '</h3></div><div class="empty">Upload saldo QAD dan Informasi Rak WMS untuk menampilkan grafik 3D.</div>'; return; }
    var mx = Math.max.apply(null, its.map(function (i) { return Math.max(i.qadv, i.wms, 1); }));
    $('rk-chart').innerHTML = '<div class="gh"><h3>' + tt + '</h3><div class="rk-legend"><span><i style="background:#f59e0b"></i>Saldo QAD</span><span><i style="background:#06b6d4"></i>Saldo WMS</span></div></div>' +
      '<div class="gb"><div class="rk-3d" id="rk-3d">' + its.map(function (i, n) {
        var hq = Math.max(6, i.qadv / mx * 170), hw = Math.max(6, i.wms / mx * 170);
        return '<div class="rk-grp"><div class="rk-bars">' +
          '<div class="cub q" data-h="' + hq + '" style="--d:' + (n * .08) + 's"><i class="f"></i><i class="r"></i><i class="t"></i><span class="v">' + fmt(i.qadv) + '</span></div>' +
          '<div class="cub w" data-h="' + hw + '" style="--d:' + (n * .08 + .05) + 's"><i class="f"></i><i class="r"></i><i class="t"></i><span class="v">' + fmt(i.wms) + '</span></div></div>' +
          '<div class="rk-lab"><b title="' + esc(i.nama) + '">' + esc(short(i.nama)) + '</b>' + (i.sel ? 'selisih ' + sgn(i.sel) : '<span class="pos">sesuai</span>') + '</div></div>';
      }).join('') + '</div></div>';
  }

  /* ---------- TABEL ITEM ---------- */
  function soCount(it) { var L = K.lines(S, it, ui.plan), n = L.filter(function (l) { return l.aktual !== null; }).length; return { n: n, t: L.length }; }
  function filtered() {
    var q = ui.q.toUpperCase();
    return ui.items.filter(function (i) {
      if (q && (i.nama + ' ' + i.kode).toUpperCase().indexOf(q) < 0) return false;
      if (ui.g !== 'all' && i.grp !== ui.g) return false;
      var c = soCount(i);
      if (ui.f === 'sel') return i.sel !== 0;
      if (ui.f === 'ok') return i.sel === 0;
      if (ui.f === 'soSel') return !!soRec(i) && i.sel !== 0;
      var sd = !!soRec(i) || (c.t > 0 && c.n >= c.t);
      if (ui.f === 'todo') return !sd;
      if (ui.f === 'done') return sd;
      return true;
    });
  }
  function soChip(it) {
    var r = soRec(it); if (!r) return '';
    var u = ulangOf(it);
    if (u) return '<div class="cd" style="text-align:right;margin-top:3px;color:#c4b5fd;font-weight:700">&#9998; SO ulang berjalan &middot; dibuka ' + esc(soTgl(u.tgl)) + '</div>';
    var ad = S.adjDone && S.adjDone[it.kode];
    var h = '<div class="cd" style="text-align:right;margin-top:3px;color:#34d399;font-weight:700" title="Tercatat di Stock Opname' + (r.oleh ? ' oleh ' + esc(r.oleh) : '') + '">&#128274; Terkunci &middot; Sudah SO ' + esc(soTgl(r.tgl)) + ' &middot; fisik ' + fmt(r.fisik) + '</div>';
    if (it.sel !== 0) h += '<div class="cd" style="text-align:right;margin-top:3px;color:#fcd34d;white-space:normal;line-height:1.35" title="' + esc(soNote(it)) + '">Sudah di-SO ' + esc(soTgl(r.tgl)) + (ad ? ' dan sudah di-adjustment' : '') + ', namun data terbaru masih selisih ' + (it.sel > 0 ? '+' : '') + fmt(it.sel) + '. Apakah akan di-SO ulang?</div>';
    else if (ad) h += '<div class="cd" style="text-align:right;margin-top:3px;color:#67e8f9">&#10003; Sudah di-adjustment (' + esc(soTgl(ad)) + ') &middot; saldo WMS = QAD</div>';
    return h;
  }
  function soBanner() {
    var g0 = Object.keys(ui.soStat || {}).filter(function (g) { return ui.soStat[g]; });
    var t = g0.map(function (g) { var x = ui.soStat[g]; return '<b>' + esc(g) + '</b> ' + fmt(x.isi) + '/' + fmt(x.total) + ' item (' + esc(soTgl(x.mulai)) + ' - ' + esc(soTgl(x.akhir)) + ')'; }).join(' &middot; ');
    var h = '', nl = ui.items.filter(locked).length, nm = ui.items.filter(function (i) { return locked(i) && i.sel !== 0; }).length, nu = ui.items.filter(function (i) { return !!ulangOf(i); }).length;
    h += '<div class="rk-leg"><span><i style="background:#34d399"></i>Sudah di-SO &amp; sesuai</span><span><i style="background:#fbbf24"></i>Sudah di-SO, data terbaru selisih</span><span><i style="background:#a78bfa"></i>SO ulang berjalan</span></div>';
    if (t) h += '<div class="sub" style="margin-bottom:6px">Progres Stock Opname periode ini: ' + t + '. Item yang semua raknya sudah diisi aktual otomatis tercatat ke Stock Opname dan <b>terkunci</b> (tidak dapat dipilih / diubah lagi pada periode ini).</div>';
    if (nm) h += '<div class="warnb" style="margin-bottom:8px">' + fmt(nm) + ' dari ' + fmt(nl) + ' item yang sudah di-SO <b>masih menunjukkan selisih WMS - QAD</b> pada data terbaru. Mohon diperiksa apakah adjustment sudah diproses di WMS atau ada transaksi setelah SO. <button class="btn2 sm" style="margin-left:8px" onclick="RakUI.filter(\'soSel\')">Tampilkan item</button></div>';
    if (nu) h += '<div class="infob" style="margin-bottom:8px">&#9998; ' + fmt(nu) + ' item sedang <b>SO ulang</b> (kunci dibuka PIC). Hasilnya dicatat di Akurasi WMS dan tidak mengubah Dashboard Stock Opname.</div>';
    if (ui.soErr) h += '<div class="warnb" style="margin-bottom:8px">' + esc(ui.soErr) + '</div>';
    return h;
  }
  /* ---------- GRAFIK: frekuensi SO per item dalam sebulan (SO periode + SO ulang) ---------- */
  var BLN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  function curMonth() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function shiftMonth(m, n) { var p = m.split('-'), d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function monthLabel(m) { var p = String(m).split('-'); return (BLN[+p[1] - 1] || m) + ' ' + p[0]; }
  function loadRep() {
    if (!sogAllowed().length) return Promise.resolve();
    ui.repM = ui.repM || curMonth(); ui.repLoading = true; renderRep();
    return gs('soUlangStat', [JSON.stringify({ month: ui.repM, groups: sogAllowed() })]).then(function (r) {
      if (!r || r.success === false) throw new Error((r && r.error) || 'gagal'); ui.rep = r; ui.repErr = '';
    }).catch(function (e) { ui.repErr = String((e && e.message) || e || ''); }).then(function () { ui.repLoading = false; renderRep(); });
  }
  function renderRep() {
    var el = $('rk-rep'); if (!el) return;
    if (!sogAllowed().length) { el.innerHTML = ''; return; }
    var m = ui.repM || curMonth(), r = ui.rep && ui.rep.month === m ? ui.rep : null;
    var h = '<div class="gh"><h3>Frekuensi SO per Item <em>berapa kali item yang sama di-SO dalam sebulan</em></h3><div class="rk-tools">' +
      '<button class="btn2 sm" onclick="RakUI.repMonth(-1)" aria-label="Bulan sebelumnya">&lsaquo;</button><b style="min-width:120px;text-align:center;font-family:Outfit">' + esc(monthLabel(m)) + '</b>' +
      '<button class="btn2 sm" onclick="RakUI.repMonth(1)" ' + (m >= curMonth() ? 'disabled' : '') + ' aria-label="Bulan berikutnya">&rsaquo;</button></div></div><div class="gb">';
    if (ui.repErr) h += '<div class="warnb" style="margin-bottom:10px">Gagal memuat data frekuensi SO: ' + esc(ui.repErr) + '</div>';
    if (!r) { el.innerHTML = h + (ui.repErr ? '' : '<div class="sub">Memuat data...</div>') + '</div>'; return; }
    var k = r.kpi || {}, all = r.items || [], list = (ui.repAll ? all : all.filter(function (o) { return o.total >= 2; })).slice(0, 15), mx = Math.max.apply(null, [2].concat(list.map(function (o) { return o.total; })));
    h += '<div class="rep-k"><div><span>Item di-SO bulan ini</span><b>' + fmt(k.itemSO || 0) + '</b></div><div><span>Item di-SO berulang (&ge; 2&times;)</span><b class="' + (k.itemBerulang ? 'neg' : '') + '">' + fmt(k.itemBerulang || 0) + '</b></div>' +
      '<div><span>Kejadian SO ulang</span><b>' + fmt(k.kejadianUlang || 0) + '</b></div><div><span>Terbanyak</span><b style="font-size:13px;line-height:1.25">' + (k.top && k.top.total >= 2 ? esc(short(k.top.nama)) + ' &middot; ' + k.top.total + '&times;' : '-') + '</b></div></div>' +
      '<div class="rep-lg"><span><i style="background:#22d3ee"></i>SO periode (Dashboard, 2 mingguan)</span><span><i style="background:#fbbf24"></i>SO ulang (Akurasi WMS)</span>' +
      '<label class="chk" style="margin:0 0 0 auto"><input type="checkbox" ' + (ui.repAll ? 'checked' : '') + ' onchange="RakUI.repAll(this.checked)"> tampilkan semua item</label></div>';
    h += list.length ? '<div class="rep-b">' + list.map(function (o) {
      return '<div class="rep-r" title="' + esc(o.nama) + ' - ' + o.reguler + 'x SO periode, ' + o.ulang + 'x SO ulang"><div class="rn"><span class="nm">' + esc(short(o.nama)) + '</span><span class="cd">' + esc(o.item) + ' &middot; ' + esc(o.group) + '</span></div>' +
        '<div class="rt"><i style="width:' + (o.reguler / mx * 100) + '%;background:linear-gradient(90deg,#22d3ee,#34d399)"></i><i style="width:' + (o.ulang / mx * 100) + '%;background:linear-gradient(90deg,#fbbf24,#fb923c)"></i></div>' +
        '<div class="rv"><b>' + o.total + '&times;</b><span class="cd">' + o.reguler + ' + ' + o.ulang + '</span></div></div>';
    }).join('') + '</div>' : '<div class="infob">' + (all.length ? 'Belum ada item yang di-SO berulang pada bulan ini.' : 'Belum ada SO tercatat pada bulan ini.') + '</div>';
    var ev = (r.events || []).slice(0, 10);
    if (ev.length) h += '<div style="margin-top:14px;font-family:Outfit;font-weight:700;font-size:12.5px">Riwayat SO ulang</div><div class="rk-tw"><table><thead><tr><th>Tanggal</th><th class="l">Item</th><th class="l">Alasan</th><th>Selisih buka</th><th>Hasil ulang</th><th>Status</th></tr></thead><tbody>' + ev.map(function (e) {
      var cls = e.status === 'SELESAI' ? 'ok' : (e.status === 'TERBUKA' ? 'wr' : 'nt');
      return '<tr><td>' + esc(soTgl(e.tgl)) + '</td><td class="l"><div class="nm" title="' + esc(e.nama) + '">' + esc(short(e.nama)) + '</div><div class="cd">' + esc(e.item) + ' &middot; ' + esc(String(e.oleh || e.pic).replace(/\s*\(Akurasi Rak\)\s*$/, '')) + '</div></td><td class="l"><div class="cd" style="white-space:normal;max-width:240px">' + esc(e.alasan) + '</div></td>' +
        '<td>' + sgn(e.selBuka) + '</td><td>' + (e.fisikBaru == null ? '<span class="zero">-</span>' : fmt(e.fisikBaru) + ' <span class="cd">(' + (e.selUlang > 0 ? '+' : '') + fmt(e.selUlang) + ')</span>') + '</td><td><span class="chip2 ' + cls + '">' + esc(e.status) + '</span></td></tr>';
    }).join('') + '</tbody></table></div>';
    h += '<div class="sub" style="margin-top:10px">SO ulang hanya dicatat di Akurasi WMS dan tidak mengubah Dashboard Stock Opname (aturan 2 mingguan dan kunci SO pertama tetap berlaku).</div>';
    el.innerHTML = h + '</div>';
  }

  function renderTbl() {
    var a = filtered(), lim = 400;
    $('rk-tbl').innerHTML = '<div class="gh"><h3>Daftar Item &amp; Rak <em>klik baris untuk input aktual</em></h3><div class="rk-tools">' +
      '<button class="btn2 pri" onclick="RakUI.openSO()">&#128221; Form Stock Opname</button>' +
      '<input type="text" id="rk-q" placeholder="Cari kode / nama item..." value="' + esc(ui.q) + '" style="width:220px" oninput="RakUI.search(this.value)">' +
      (ui.allowed.length > 1 ? '<div class="rk-seg">' + [['all', 'Semua group'], ['I053', 'I053 Pipa'], ['Q055', 'Q055 Fitting']].map(function (x) { return '<button class="' + (ui.g === x[0] ? 'on' : '') + '" onclick="RakUI.grp(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>' : '') + '<div class="rk-seg">' + [['all', 'Semua'], ['sel', 'Selisih'], ['ok', 'Sesuai'], ['todo', 'Belum SO'], ['done', 'Sudah SO'], ['soSel', 'SO tapi selisih']].map(function (x) { return '<button class="' + (ui.f === x[0] ? 'on' : '') + '" onclick="RakUI.filter(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div></div></div>' +
      '<div class="gb">' + soBanner() + '<div class="rk-tw"><table><thead><tr><th class="l">Item</th><th>Group</th><th class="l">Nama Rak</th><th>Jml Rak</th><th>Saldo QAD</th><th>Saldo WMS</th><th>Selisih</th><th>Status</th><th>Progres input</th></tr></thead><tbody>' +
      (a.length ? a.slice(0, lim).map(function (i) {
        var c = soCount(i), pc = c.t ? c.n / c.t * 100 : 0;
        return '<tr class="it' + (locked(i) ? ' lk' + (i.sel !== 0 ? ' lksel' : '') : '') + (ulangOf(i) ? ' ul' : '') + '" onclick="RakUI.open(\'' + i.kode + '\')"><td class="l"><div class="nm" title="' + esc(i.nama) + '">' + esc(i.nama) + '</div><div class="cd">' + esc(i.kode) + '</div></td><td><span class="chip2 nt">' + esc(i.grp) + '</span></td><td class="l" title="' + esc(i.racks.map(function (r) { return r.rak; }).join(', ')) + '"><div class="cd" style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--txt2)">' + (i.racks.length ? esc(i.racks.slice(0, 2).map(function (r) { return r.rak; }).join(', ')) + (i.racks.length > 2 ? ' +' + (i.racks.length - 2) : '') : '-') + '</div></td><td>' + i.racks.length + '</td><td>' + fmt(i.qadv) + '</td><td>' + fmt(i.wms) + '</td><td>' + sgn(i.sel) + '</td>' +
          '<td><span class="chip2 ' + (i.sel === 0 ? 'ok' : 'bd') + '">' + (i.sel === 0 ? 'SESUAI' : 'SELISIH') + '</span></td>' +
          '<td style="min-width:120px"><div class="prg"><i style="width:' + pc + '%"></i></div><div class="cd" style="text-align:right;margin-top:3px">' + c.n + '/' + c.t + ' rak</div>' + soChip(i) + '</td></tr>';
      }).join('') : '<tr><td colspan="10" class="empty">' + (ui.items.length ? 'Tidak ada item yang cocok dengan filter.' : 'Belum ada data. Upload saldo QAD dan Informasi Rak WMS di atas.') + '</td></tr>') +
      '</tbody></table></div>' + (a.length > lim ? '<div class="sub" style="margin-top:8px">Menampilkan ' + lim + ' dari ' + fmt(a.length) + ' item - gunakan pencarian.</div>' : '') + '</div>';
    var q = $('rk-q'); if (q && ui._focusQ) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); ui._focusQ = false; }
  }

  /* ---------- DRAWER INPUT ---------- */
  function holders(kode, rak) { return S.wms.filter(function (r) { return r.rak === rak && r.kode !== kode && r.onhand; }); }
  function itemOf(kode) { return ui.items.filter(function (i) { return i.kode === kode; })[0]; }
  function lockBanner(it, ro) {
    var u = ulangOf(it), k = esc(it.kode);
    if (u) return '<div class="warnb">&#9998; <b>SO ulang sedang berjalan</b> (dibuka ' + esc(soTglF(u.tgl)) + (u.oleh ? ' oleh ' + esc(String(u.oleh).replace(/\s*\(Akurasi Rak\)\s*$/, '')) : '') + '). Alasan: ' + esc(u.alasan) + '. Hitung ulang semua rak, lalu tutup panel ini - hasilnya dicatat sebagai SO ulang. Hasil ini <b>tidak mengubah</b> data di Dashboard Stock Opname.' +
      '<div style="margin-top:8px"><button class="btn2 dng sm" data-k="' + k + '" onclick="RakUI.cancelUlang(this.dataset.k)">Batalkan SO ulang</button></div></div>';
    if (!ro) return '';
    var h = '<div class="' + (it.sel !== 0 ? 'warnb' : 'infob') + '">&#128274; <b>Item terkunci.</b> ' + esc(soNote(it));
    if (it.sel !== 0 && canUnlock()) {
      var n = carryN(it);
      h += n > 0 ? '<div class="sub" style="margin-top:8px">Buka kunci SO ulang belum dapat dilakukan: selesaikan dulu SO sisa periode sebelumnya (<b>' + fmt(n) + ' item</b> belum di-SO).</div>'
        : '<div style="margin-top:8px"><button class="btn2 pri sm" data-k="' + k + '" onclick="RakUI.unlock(this.dataset.k)">&#128275; Buka kunci untuk SO ulang</button></div>';
    }
    return h + '</div>';
  }
  function koreksiBlock(it, ctx) {
    var k = K.koreksiOf(S, it.kode), id = esc(it.kode), ro = ctx === 'dr' && locked(it), dis = ro ? ' disabled' : '';
    return '<div class="rk-kor"><div class="kh"><b>Rak Koreksi</b> <span class="chip2 nt">PENYEIMBANG STOK</span></div>' +
      '<div class="sub">Untuk barang yang sudah dikirim dan keluar di WMS, tetapi saldo QAD belum terpotong. Qty ini dihitung sebagai fisik sehingga tidak menjadi selisih di dashboard Stock Opname, dan <b>tidak</b> masuk template adjustment WMS.</div>' +
      '<div class="kf"><label>Qty koreksi<input type="number" min="0" step="any" placeholder="0" value="' + (k.q == null ? '' : k.q) + '" data-k="' + id + '" oninput="RakUI.kor(this,\'q\',\'' + ctx + '\')"' + dis + '></label>' +
      '<label>Keterangan<input type="text" maxlength="120" placeholder="mis. No. DO / pengiriman belum terpotong di QAD" value="' + esc(k.ket) + '" data-k="' + id + '" oninput="RakUI.kor(this,\'ket\',\'' + ctx + '\')"' + dis + '></label></div></div>';
  }
  function autoAdj(l) { return '<span class="neg" style="font-family:var(--mono);font-weight:700">' + fmt(-l.exist) + '</span> <span class="cd">kurangi &middot; transit otomatis</span>'; }
  function renderDrawer() {
    var it = itemOf(ui.open); if (!it) return;
    var ro = locked(it), dis = ro ? ' disabled' : '';
    var L = K.lines(S, it, ui.plan), rows = L.map(function (l, i) {
      var hl = l.manual ? holders(it.kode, l.rak) : [], tr = K.isTransit(l.rak);
      return '<tr class="' + (l.manual ? 'man' : '') + '"><td class="l"><b style="font-family:var(--mono)">' + esc(l.rak) + '</b>' + (l.manual ? ' <span class="chip2 nt">MANUAL</span>' : '') + (tr ? ' <span class="chip2 nt">TRANSIT</span>' : '') +
        '<div class="cd">' + esc(l.area || '') + (hl.length ? ' - <span class="neg">dipakai item lain di WMS</span>' : '') + '</div>' +
        (hl.length ? '<div class="warnb" style="margin-top:6px">Rak ini di WMS masih berisi <b>' + hl.map(function (h) { return esc(short(h.nama)) + ' (' + fmt(h.onhand) + ')'; }).join(', ') + '</b>. Saat aktual diisi, stok tersebut otomatis masuk <b>Template Tahap 1</b> (dikeluarkan dengan tanda -) dan harus di-upload ke WMS lebih dulu.</div>' : '') + '</td>' +
        '<td>' + fmt(l.exist) + '</td>' +
        '<td><input type="number" min="0" step="any" class="aq" data-i="' + i + '" placeholder="' + (tr ? 'kosong = 0' : 'aktual') + '" value="' + (l.aktual === null ? '' : l.aktual) + '" oninput="RakUI.akt(this)"' + dis + '></td>' +
        '<td id="rk-d' + i + '" style="min-width:110px"></td>' +
        '<td>' + (l.manual && !ro ? '<button class="btn2 dng sm" onclick="RakUI.delManual(' + l.idx + ')">Hapus</button>' : '') + '</td></tr>';
    }).join('');
    $('rk-dr').innerHTML = '<div class="dh"><div><div class="cd">' + esc(it.kode) + '</div><div style="font-family:Outfit;font-size:16px;font-weight:700;line-height:1.3">' + esc(it.nama) + '</div></div><button class="btn2 sm" onclick="RakUI.close()">Tutup &#10005;</button></div>' +
      '<div class="db">' + lockBanner(it, ro) +
      '<div class="rk-cmp"><div><span>Saldo QAD</span><b style="color:#fcd34d">' + fmt(it.qadv) + '</b></div><div><span>Saldo WMS</span><b style="color:#67e8f9">' + fmt(it.wms) + '</b></div><div><span>Selisih WMS - QAD</span><b>' + sgn(it.sel) + '</b></div><div><span>Aktual (diinput)</span><b id="rk-tA">0</b></div></div>' +
      '<div id="rk-proj" class="infob"></div>' +
      '<div class="rk-tw"><table><thead><tr><th class="l">Rak</th><th>Saldo rak WMS</th><th>Aktual</th><th>Adjustment</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="5" class="empty">Item ini belum punya rak di WMS. Tambahkan rak manual di bawah.</td></tr>') + '</tbody></table></div>' +
      koreksiBlock(it, 'dr') +
      (ro ? '' : '<div class="glass" style="border-radius:14px"><div class="gb"><div style="font-family:Outfit;font-weight:700;font-size:12.5px;margin-bottom:4px">+ Tambah rak manual</div><div class="sub" style="margin-bottom:10px">Gunakan bila rak aktual tidak terdaftar di WMS untuk item ini (mis. <span style="font-family:var(--mono)">I-05-02-C</span>).</div>' +
      '<div class="rk-tools"><input type="text" id="rk-newrak" placeholder="Kode rak, mis. I-05-02-C" style="width:220px" onkeydown="if(event.key===\'Enter\')RakUI.addManual()"><button class="btn2 pri" onclick="RakUI.addManual()">Tambah rak</button></div></div></div>') +
      '<div class="sub">Adjustment = aktual &minus; saldo rak WMS. Kelebihan di WMS menjadi <b class="neg">negatif (-)</b>; kekurangan ditulis <b class="pos">angka polos</b>. Qty hanya masuk template jika aktual diisi. Rak <b>TRANSIT</b> yang dibiarkan kosong akan otomatis dikurangi (-) setelah semua rak lain terisi.</div></div>';
    updDrawer();
  }
  function updDrawer() {
    var it = itemOf(ui.open); if (!it) return; ui.plan = K.plan(S, ui.items);
    var L = K.lines(S, it, ui.plan), ta = 0, any = false, proj = 0, kq = K.koreksiOf(S, it.kode).q || 0;
    L.forEach(function (l, i) {
      var c = $('rk-d' + i); if (!c) return;
      if (l.aktual === null) { if (l.auto) { c.innerHTML = autoAdj(l); return; } c.innerHTML = '<span class="zero">-</span>'; proj += l.exist; return; }
      any = true; ta += l.aktual;
      var d = l.aktual - l.exist; proj += l.cleared ? 0 : l.aktual;
      c.innerHTML = l.cleared ? '<span class="chip2 wr">DIKOSONGKAN T1</span>' : (d === 0 ? '<span class="chip2 ok">SESUAI</span>' : (d < 0 ? '<span class="neg" style="font-family:var(--mono);font-weight:700">' + fmt(d) + '</span> <span class="cd">kurangi</span>' : '<span class="pos" style="font-family:var(--mono);font-weight:700">' + fmt(d) + '</span> <span class="cd">tambah</span>'));
    });
    ta += kq; if (kq > 0) any = true; proj += kq;
    $('rk-tA').textContent = any ? fmt(ta) : '-';
    var ps = proj - it.qadv;
    $('rk-proj').innerHTML = 'Proyeksi saldo WMS setelah adjustment: <b>' + fmt(proj) + '</b>' + (kq ? ' (termasuk rak koreksi ' + fmt(kq) + ')' : '') + ' vs QAD <b>' + fmt(it.qadv) + '</b> &rarr; ' + (ps === 0 ? '<b class="pos">SESUAI &#10003;</b>' : 'masih selisih <b class="' + (ps > 0 ? 'neg' : 'pos') + '">' + fmt(ps) + '</b> (' + (ps > 0 ? 'WMS lebih besar dari QAD' : 'WMS lebih kecil dari QAD') + ')');
  }

  /* ---------- ADJUSTMENT ---------- */
  function miniT(rows) {
    return '<div class="rk-mini-t"><table><thead><tr><th class="l">Rak</th><th class="l">Item</th><th>Qty</th></tr></thead><tbody>' + rows.slice(0, 60).map(function (r) {
      return '<tr><td class="l" style="font-family:var(--mono)">' + esc(r.rak) + (r.auto ? ' <span class="chip2 wr">TRANSIT</span>' : '') + '</td><td class="l">' + esc(short(r.nama)) + '</td><td>' + sgn(r.qty) + '</td></tr>';
    }).join('') + '</tbody></table></div>' + (rows.length > 60 ? '<div class="sub">+' + (rows.length - 60) + ' baris lagi di file.</div>' : '');
  }
  function sig1(p) { return p.step1.map(function (r) { return r.rak + '|' + r.kode + '|' + r.qty; }).join(';'); }
  function adjOff() { return S.adjOff = S.adjOff || {}; }
  function adjDoneOf(kode) { return (S.adjDone && S.adjDone[kode]) || ''; }
  // item yang templatenya sudah diunduh (sudah di-adjustment) tidak masuk daftar adjustment lagi -> dicatat di Riwayat Adjustment
  function adjPlan() { var off = adjOff(); return K.plan(S, ui.items.filter(function (i) { return !off[i.kode] && !adjDoneOf(i.kode); })); }
  // item yang punya baris adjustment (dihitung dari seluruh input) -> daftar pilihan
  function adjCands() {
    var m = {}, p = ui.plan;
    function get(kode) { var it = itemOf(kode); if (!it || adjDoneOf(kode)) return null; return m[kode] || (m[kode] = { it: it, n2: 0, n1: 0, net: 0, auto: false }); }
    p.step2.forEach(function (r) { var o = get(r.kode); if (!o) return; o.n2++; o.net += r.qty; if (r.auto) o.auto = true; });
    p.step1.forEach(function (r) { var o = get(r.by); if (o) o.n1++; });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return a.it.nama.localeCompare(b.it.nama, 'id', { numeric: true }); });
  }
  function adjPick(c) {
    if (!c.length) return '';
    var off = adjOff(), q = (ui.adjQ || '').toUpperCase(), n = c.filter(function (o) { return !off[o.it.kode]; }).length;
    var shown = c.filter(function (o) { return !q || (o.it.nama + ' ' + o.it.kode).toUpperCase().indexOf(q) >= 0; });
    return '<div class="rk-apick"><div class="ap-h"><div><b>Pilih item yang akan di-adjust</b><div class="sub">' + fmt(n) + ' dari ' + fmt(c.length) + ' item dipilih. Template Tahap 1 dan Tahap 2 hanya memuat item yang dipilih.</div></div><div class="rk-tools">' +
      '<input type="text" id="rk-adjq" placeholder="Cari item..." value="' + esc(ui.adjQ || '') + '" style="width:170px" oninput="RakUI.adjSearch(this.value)">' +
      '<button class="btn2 sm" onclick="RakUI.adjAll(true)">Pilih semua</button><button class="btn2 sm" onclick="RakUI.adjAll(false)">Kosongkan</button></div></div>' +
      '<div class="ap-l">' + (shown.length ? shown.slice(0, 300).map(function (o) {
        var k = esc(o.it.kode);
        return '<label class="ap-r"><input type="checkbox" ' + (off[o.it.kode] ? '' : 'checked') + ' data-k="' + k + '" onchange="RakUI.adjTog(this.dataset.k,this.checked)"><span class="ap-n"><span class="nm" title="' + esc(o.it.nama) + '">' + esc(short(o.it.nama)) + '</span><span class="cd">' + k + '</span></span><span class="ap-c">' +
          (locked(o.it) ? '<span class="chip2 ok">SUDAH SO</span>' : '') + (o.auto ? '<span class="chip2 wr">TRANSIT</span>' : '') + (o.n1 ? '<span class="chip2 wr">T1 &middot; ' + fmt(o.n1) + '</span>' : '') +
          '<span class="cd">' + fmt(o.n2) + ' baris</span>' + sgn(o.net) + '</span></label>';
      }).join('') : '<div class="empty">Tidak ada item yang cocok.</div>') + '</div></div>';
  }
  function adjHist() {
    var h = (S.adjHist || []).slice(0, 40), nd = Object.keys(S.adjDone || {}).length;
    var head = '<div class="rk-hist"><div class="ah-h"><b>Riwayat Adjustment</b><div class="sub">Item yang sudah di-save dan di-adjustment tidak ditampilkan lagi di daftar di atas. Jika data baru di-upload, hanya riwayatnya yang tampil di sini.</div></div>';
    if (!h.length) return head + '<div class="infob">Belum ada riwayat adjustment. Setelah Template Adjustment diunduh, item terkait dipindahkan ke sini.</div></div>';
    return head + '<div class="rk-tw"><table><thead><tr><th>Tanggal</th><th class="l">Item</th><th>Tahap</th><th class="l">Rak yang di-adjust</th><th>Total</th></tr></thead><tbody>' + h.map(function (e) {
      var net = e.rows.reduce(function (a, r) { return a + r.q; }, 0);
      return '<tr><td class="mono">' + esc(soTglF(e.t)) + '</td><td class="l"><div class="nm" title="' + esc(e.n) + '">' + esc(short(e.n)) + '</div><div class="cd">' + esc(e.k) + (e.u ? ' &middot; ' + esc(e.u) : '') + '</div></td><td><span class="chip2 ' + (e.h === 1 ? 'wr' : 'ok') + '">' + (e.h === 1 ? 'TAHAP 1 &middot; KOSONGKAN' : 'TAHAP 2 &middot; ADJUSTMENT') + '</span></td>' +
        '<td class="l"><div class="ah-r">' + e.rows.slice(0, 6).map(function (r) { return '<span><b style="font-family:var(--mono)">' + esc(r.r) + '</b> ' + sgn(r.q) + (r.a ? ' <i class="chip2 wr" style="padding:0 5px">TRANSIT</i>' : '') + '</span>'; }).join('') + (e.rows.length > 6 ? '<span class="cd">+' + (e.rows.length - 6) + ' lagi</span>' : '') + '</div></td><td>' + sgn(net) + '</td></tr>';
    }).join('') + '</tbody></table></div>' + ((S.adjHist || []).length > 40 ? '<div class="sub">Menampilkan 40 riwayat terbaru dari ' + fmt(S.adjHist.length) + '.</div>' : '') + '</div>';
  }
  function renderAdj() {
    var cand = adjCands(), p = ui.planAdj = adjPlan(), c = S.cfg, has1 = p.step1.length > 0, ok1 = !has1 || (S.step1 && S.step1 === sig1(p)), has2 = p.step2.length > 0;
    var none = cand.length > 0 && !cand.some(function (o) { return !adjOff()[o.it.kode]; });
    var ndone = ui.items.filter(function (i) { return adjDoneOf(i.kode); }).length;
    var fa = document.activeElement && document.activeElement.id === 'rk-adjq';
    $('rk-adj').innerHTML = '<div class="gh"><h3>Template Adjustment WMS <em>otomatis dari input aktual</em></h3></div><div class="gb" style="display:flex;flex-direction:column;gap:14px">' +
      '<div class="rk-cfg"><label>Tanggal<input type="date" value="' + esc(c.tgl) + '" onchange="RakUI.cfg(\'tgl\',this.value)"></label><label>Site<input type="number" value="' + esc(c.site) + '" style="width:90px" onchange="RakUI.cfg(\'site\',this.value)"></label>' +
      '<label>Keterangan<input type="text" value="' + esc(c.ket) + '" style="width:240px" onchange="RakUI.cfg(\'ket\',this.value)"></label><label>Kode Kategori<input type="number" value="' + esc(c.kat) + '" style="width:90px" onchange="RakUI.cfg(\'kat\',this.value)"></label><label>Location<input type="text" value="' + K.LOC + '" disabled style="width:100px;opacity:.6"></label></div>' +
      (ndone ? '<div class="infob">&#10003; ' + fmt(ndone) + ' item sudah di-adjustment dan tidak ditampilkan lagi di daftar. Lihat <b>Riwayat Adjustment</b> di bawah.</div>' : '') +
      adjPick(cand) +
      (p.dup.length ? '<div class="warnb">Rak manual yang sama dipakai oleh lebih dari satu item: <b>' + p.dup.map(function (d) { return esc(d.rak); }).join(', ') + '</b>. Pastikan hanya satu item per rak.</div>' : '') +
      '<div class="rk-steps">' +
      '<div class="rk-step"><div class="no">1</div><h4>Kosongkan rak yang bentrok</h4>' + (has1 ?
        '<ul><li>' + fmt(p.step1.length) + ' rak manual saat ini masih dipakai item lain di WMS.</li><li>Upload template ini ke WMS lebih dulu - Qty bertanda <b>-</b> menghapus stok lama.</li></ul>' + miniT(p.step1) +
        '<button class="btn2 pri" onclick="RakUI.dl(1)">&#11015; Unduh Template Tahap 1</button><label class="chk"><input type="checkbox" ' + (ok1 ? 'checked' : '') + ' onchange="RakUI.ack(this.checked)"> Tahap 1 sudah di-upload ke WMS</label>'
        : '<div class="infob">' + (none ? 'Belum ada item yang dipilih.' : 'Tidak ada rak bentrok. Langsung lanjut ke Tahap 2.') + '</div>') + '</div>' +
      '<div class="rk-step s2 ' + (ok1 ? '' : 'lock') + '"><div class="no">2</div><h4>Adjustment rak (aktual vs saldo WMS)</h4>' + (has2 ?
        '<ul><li>' + fmt(p.step2.length) + ' baris: ' + fmt(p.step2.filter(function (r) { return r.qty < 0; }).length) + ' pengurangan (-), ' + fmt(p.step2.filter(function (r) { return r.qty > 0; }).length) + ' penambahan.</li><li>Pengurangan ditempatkan di urutan awal.</li></ul>' + miniT(p.step2) +
        '<button class="btn2 pri" ' + (ok1 ? '' : 'disabled') + ' onclick="RakUI.dl(2)">&#11015; Unduh Template Adjustment</button>' + (ok1 ? '' : '<div class="sub">Terbuka setelah Tahap 1 dikonfirmasi.</div>')
        : '<div class="infob">' + (none ? 'Belum ada item yang dipilih. Centang item pada daftar di atas, atau klik Pilih semua.' : (ndone ? 'Tidak ada item yang perlu di-adjust. Item yang sudah di-adjustment ada di Riwayat Adjustment.' : 'Belum ada selisih. Input aktual rak pada tabel di atas; baris adjustment dibuat otomatis.')) + '</div>') + '</div></div>' +
      adjHist() + '</div>';
    if (fa) { var q = $('rk-adjq'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }

  /* ---------- animasi masuk ---------- */
  function animate() {
    var root = $('rk'); if (!root) return;
    [].forEach.call(root.querySelectorAll('.rk-gauge'), function (g) {
      var p = +g.dataset.p, br = g.querySelector('.br'), C = +br.dataset.c, b = g.querySelector('b[data-n]');
      requestAnimationFrame(function () { requestAnimationFrame(function () { br.style.strokeDashoffset = C * (1 - Math.min(100, p) / 100); }); });
      if (b && b.dataset.n !== '') count(b, p, true);
    });
    [].forEach.call(root.querySelectorAll('.rk-kpi b'), function (b) { count(b, +b.dataset.k, false); });
    var c3 = $('rk-3d');
    if (c3) {
      requestAnimationFrame(function () { requestAnimationFrame(function () { [].forEach.call(c3.querySelectorAll('.cub'), function (c) { c.style.setProperty('--h', c.dataset.h + 'px'); }); c3.classList.add('on'); }); });
      c3.onmousemove = function (e) { var r = c3.getBoundingClientRect(); c3.style.setProperty('--cy', (-52 + (e.clientX - r.left) / r.width * 44) + 'deg'); };
      c3.onmouseleave = function () { c3.style.setProperty('--cy', '-30deg'); };
    }
  }
  function count(el, to, isPct) {
    var t0 = performance.now(), dur = 1700;
    (function step(t) {
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4), v = to * e;
      el.firstChild.nodeValue = isPct ? pct(v) : fmt(Math.round(v));
      if (isPct && el.querySelector('small') === null) el.insertAdjacentHTML('beforeend', '<small>%</small>');
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function tilt() {
    var root = $('rk');
    root.addEventListener('mousemove', function (e) {
      var g = e.target.closest && e.target.closest('.glass, .rk-step');
      if (g) { var gr = g.getBoundingClientRect(); g.style.setProperty('--mx', (e.clientX - gr.left) + 'px'); g.style.setProperty('--my', (e.clientY - gr.top) + 'px'); }
      var t = e.target.closest && e.target.closest('.tilt'); if (!t) return;
      var r = t.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      t.style.setProperty('--ry', (x * 14) + 'deg'); t.style.setProperty('--rx', (-y * 10) + 'deg');
    });
    root.addEventListener('mouseout', function (e) { var t = e.target.closest && e.target.closest('.tilt'); if (t && !t.contains(e.relatedTarget)) { t.style.setProperty('--ry', '0deg'); t.style.setProperty('--rx', '0deg'); } });
    root.addEventListener('dragover', function (e) { var d = e.target.closest && e.target.closest('.rk-drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
    root.addEventListener('dragleave', function (e) { var d = e.target.closest && e.target.closest('.rk-drop'); if (d) d.classList.remove('over'); });
    root.addEventListener('drop', function (e) { var d = e.target.closest && e.target.closest('.rk-drop'); if (!d) return; e.preventDefault(); d.classList.remove('over'); if (e.dataTransfer.files[0]) readFile(d.dataset.k, e.dataTransfer.files[0]); });
  }

  /* ---------- file ---------- */
  function readFile(kind, f) {
    var rd = new FileReader();
    rd.onerror = function () { toast('File tidak bisa dibaca.', true); };
    rd.onload = function (e) {
      try {
        var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }), names = wb.SheetNames.slice(), res = null, err = null;
        if (kind === 'qad') names.sort(function (a, b) { return (b === 'Data') - (a === 'Data'); });
        for (var i = 0; i < names.length && !res; i++) {
          var aoa = XLSX.utils.sheet_to_json(wb.Sheets[names[i]], { header: 1, raw: true, defval: '' });
          try { res = kind === 'wms' ? K.parseWms(aoa) : K.parseQad(aoa); } catch (x) { err = err || x; }
        }
        if (!res) throw err || new Error('Sheet yang sesuai tidak ditemukan.');
        var now = new Date().toLocaleString('id-ID');
        if (kind === 'wms') {
          if (!res.rows.length) throw new Error('Tidak ada baris lokasi ' + K.LOC + ' bernilai item di file ini (' + fmt(res.stats.otherLoc) + ' baris lokasi lain dibuang).');
          S.wms = res.rows; S.meta.wmsAt = now; S.meta.wmsFile = f.name;
          toast('Informasi Rak: ' + fmt(res.rows.length) + ' baris dipakai, ' + fmt(res.stats.otherLoc) + ' lokasi lain & ' + fmt(res.stats.noItem) + ' rak kosong dibuang. Kolom lain dihapus.');
        } else {
          if (!res.rows.length) throw new Error('File QAD tidak berisi item.');
          S.qad = res.rows; S.qadSkip = res.stats.skip || []; S.meta.qadAt = now; S.meta.qadFile = f.name;
          toast('Saldo QAD: ' + fmt(res.rows.length) + ' item dibaca' + (res.stats.otherGroup ? ', ' + fmt(res.stats.otherGroup) + ' baris group selain I053/Q055 dibuang' : '') + '. Kolom lain dihapus.');
        }
        S.step1 = ''; save(); syncNow(); render(); loadSoStat().then(renderTbl);
      } catch (x) { toast(x.message || String(x), true); }
    };
    rd.readAsArrayBuffer(f);
  }


  /* ---------- FORM STOCK OPNAME (menggantikan Cetak Laporan) ----------
     PIC melihat rak & saldo WMS tiap item, mengisi aktual di lapangan, dan bisa menambah rak yang tidak
     terdaftar. Rak tambahan yang di WMS masih berisi item lain otomatis dikosongkan (Qty bertanda -)
     di Template Tahap 1 -- logikanya di RakWmsCore.plan(). */
  var so = { q: '', lim: 30, sel: false, n: 10 };
  function picks() { return S.soPick = S.soPick || {}; }
  function soItems() { var pk = picks(); return ui.items.filter(function (i) { return inSOG(i) && pk[i.kode] && !locked(i); }); }
  function soCand() {
    var q = so.q.toUpperCase(), pk = picks();
    return ui.items.filter(function (i) { return inSOG(i) && !pk[i.kode] && !locked(i) && (!so.sel || i.sel !== 0) && (!q || (i.nama + ' ' + i.kode).toUpperCase().indexOf(q) >= 0); });
  }
  function soLine(it, l, i) {
    var hl = l.manual ? holders(it.kode, l.rak) : [], id = esc(it.kode);
    return '<tr class="' + (l.manual ? 'man' : '') + '"><td class="l"><b style="font-family:var(--mono)">' + esc(l.rak) + '</b>' + (l.manual ? ' <span class="chip2 nt">RAK TAMBAHAN</span>' : '') +
      '<div class="cd">' + esc(l.area || '') + '</div>' +
      (hl.length ? '<div class="warnb" style="margin-top:6px">Di WMS rak ini masih terbaca <b>' + hl.map(function (h) { return esc(short(h.nama)) + ' (' + fmt(h.onhand) + ')'; }).join(', ') + '</b>. Stok itu otomatis dikosongkan (<b>-' + hl.map(function (h) { return fmt(h.onhand); }).join(', -') + '</b>) di Template Tahap 1 saat aktual diisi.</div>' : '') + '</td>' +
      '<td>' + fmt(l.exist) + '</td>' +
      '<td><input type="number" min="0" step="any" class="aq" placeholder="aktual" value="' + (l.aktual === null ? '' : l.aktual) + '" oninput="RakUI.soAkt(this,' + i + ')" data-k="' + id + '"></td>' +
      '<td id="so-d-' + id + '-' + i + '" style="min-width:120px"></td>' +
      '<td>' + (l.manual ? '<button class="btn2 dng sm" onclick="RakUI.soDel(this.dataset.k,' + l.idx + ')" data-k="' + id + '">Hapus</button>' : '') + '</td></tr>';
  }
  function soCard(it) {
    var L = K.lines(S, it, ui.plan), id = esc(it.kode);
    return '<div class="glass" id="so-c-' + id + '" style="border-radius:14px;margin-bottom:12px"><div class="gb">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start"><div><div class="cd">' + id + ' &middot; ' + esc(it.grp) + '</div><div style="font-family:Outfit;font-size:15px;font-weight:700;line-height:1.3">' + esc(it.nama) + '</div></div>' +
      '<div class="rk-cmp" style="grid-template-columns:repeat(3,auto);gap:8px"><div><span>Saldo QAD</span><b style="font-size:16px;color:#fcd34d">' + fmt(it.qadv) + '</b></div><div><span>Saldo WMS</span><b style="font-size:16px;color:#67e8f9">' + fmt(it.wms) + '</b></div><div><span>Selisih</span><b style="font-size:16px">' + sgn(it.sel) + '</b></div></div></div>' +
      '<div class="rk-tw" style="margin-top:10px"><table><thead><tr><th class="l">Rak</th><th>Saldo WMS</th><th>Aktual (lapangan)</th><th>Adjustment</th><th></th></tr></thead><tbody>' +
      (L.map(function (l, i) { return soLine(it, l, i); }).join('') || '<tr><td colspan="5" class="empty">Item ini belum punya rak di WMS. Tambahkan rak di bawah.</td></tr>') + '</tbody></table></div>' + koreksiBlock(it, 'so') +
      '<div class="rk-tools" style="margin-top:10px"><input type="text" id="so-n-' + id + '" placeholder="+ Tambah rak (mis. I-03-01-C)" style="width:230px" data-k="' + id + '" onkeydown="if(event.key===\'Enter\')RakUI.soAdd(this.dataset.k)"><button class="btn2 pri sm" data-k="' + id + '" onclick="RakUI.soAdd(this.dataset.k)">Tambah rak</button><span class="cd" id="so-p-' + id + '"></span></div>' +
      '</div></div>';
  }
  function soRefresh() {
    ui.plan = K.plan(S, ui.items);
    soItems().forEach(function (it) {
      var L = K.lines(S, it, ui.plan), proj = 0;
      L.forEach(function (l, i) {
        var c = $('so-d-' + it.kode + '-' + i); if (!c) return;
        if (l.aktual === null) { if (l.auto) { c.innerHTML = autoAdj(l); return; } c.innerHTML = '<span class="zero">-</span>'; proj += l.exist; return; }
        var d = l.aktual - l.exist; proj += l.cleared ? 0 : l.aktual;
        c.innerHTML = l.cleared ? '<span class="chip2 wr">DIKOSONGKAN T1</span>' : (d === 0 ? '<span class="chip2 ok">SESUAI</span>' : (d < 0 ? '<span class="neg" style="font-family:var(--mono);font-weight:700">' + fmt(d) + '</span> <span class="cd">kurangi</span>' : '<span class="pos" style="font-family:var(--mono);font-weight:700">' + fmt(d) + '</span> <span class="cd">tambah</span>'));
      });
      proj += (K.koreksiOf(S, it.kode).q || 0);
      var p = $('so-p-' + it.kode), n = L.filter(function (l) { return l.aktual !== null; }).length;
      if (p) p.innerHTML = n ? 'Proyeksi WMS: <b>' + fmt(proj) + '</b> vs QAD <b>' + fmt(it.qadv) + '</b> ' + (proj === it.qadv ? '<span class="pos">sesuai &#10003;</span>' : '<span class="neg">selisih ' + fmt(proj - it.qadv) + '</span>') : '';
    });
    var t = $('so-sum'); if (t) { var m = K.summary(S, ui.items, ui.plan); t.innerHTML = 'Rak terinput: <b>' + fmt(m.rin) + '</b> &middot; Template Tahap 1: <b>' + fmt(ui.plan.step1.length) + '</b> baris &middot; Tahap 2: <b>' + fmt(ui.plan.step2.length) + '</b> baris'; }
  }
  function renderSO() {
    var el = $('rk-so'); if (!el) return;
    var ae = document.activeElement, keep = ae && ae.id === 'so-q';
    var a = soItems(), cand = soCand(), shown = cand.slice(0, 25);
    var sc0 = el.querySelector('.db'), pl0 = el.querySelector('.so-pick'), st0 = sc0 ? sc0.scrollTop : 0, pt0 = pl0 ? pl0.scrollTop : 0;
    el.innerHTML = '<div class="dh"><div><div style="font-family:Outfit;font-size:18px;font-weight:700">&#128221; Form Stock Opname</div><div class="cd">Pilih item yang akan di-SO, isi qty &amp; rak aktual. Adjustment dibuat otomatis (kurang = -, tambah = angka polos).</div></div><button class="btn2 sm" onclick="RakUI.closeSO()">Tutup &#10005;</button></div>' +
      '<div class="db">' +
      '<div class="glass" style="border-radius:14px"><div class="gb"><div style="font-family:Outfit;font-weight:700;font-size:13px;margin-bottom:8px">1. Pilih item yang akan di-SO <span class="cd">(' + fmt(a.length) + ' dipilih dari ' + fmt(ui.items.length) + ' item)</span></div>' +
      '<div class="rk-tools"><input type="text" id="so-q" placeholder="Cari kode / nama item..." value="' + esc(so.q) + '" style="width:240px" oninput="RakUI.soSearch(this.value)">' +
      '<label class="chk" style="margin:0"><input type="checkbox" ' + (so.sel ? 'checked' : '') + ' onchange="RakUI.soSelOnly(this.checked)"> hanya yang selisih</label>' +
      '<span class="cd">atau</span><input type="number" min="1" id="so-n" value="' + so.n + '" style="width:70px" onchange="RakUI.soSetN(this.value)"><button class="btn2 sm" onclick="RakUI.soTopN()">Pilih ' + so.n + ' selisih terbesar</button>' +
      (a.length ? '<button class="btn2 dng sm" onclick="RakUI.soClear()">Kosongkan pilihan</button>' : '') + '</div>' +
      (a.length ? '<div class="so-chips"><span class="cd">Dipilih:</span>' + a.map(function (i) { return '<span class="so-chip" title="' + esc(i.nama) + '">' + esc(short(i.nama)) + '<button data-k="' + esc(i.kode) + '" onclick="RakUI.soPick(this.dataset.k,false)" aria-label="Hapus">&#10005;</button></span>'; }).join('') + '</div>' : '') +
      (ui.items.some(function (i) { return !inSOG(i); }) ? '<div class="sub" style="margin-top:6px">Form SO di Akurasi WMS saat ini hanya untuk group <b>I053</b> (Pipa PPR). Pengisian SO group Fitting (Q055) masih di menu Stock Opname.</div>' : '') +
      (ui.items.filter(locked).length ? '<div class="sub" style="margin-top:6px">&#128274; ' + fmt(ui.items.filter(locked).length) + ' item sudah di-SO pada periode ini dan terkunci - tidak tampil di daftar pilihan.</div>' : '') +
      '<div class="rk-tw so-pick" style="margin-top:8px;max-height:300px;overflow:auto"><table><thead><tr><th class="l">Item</th><th>Saldo QAD</th><th>Saldo WMS</th><th>Selisih</th><th></th></tr></thead><tbody>' +
      (shown.map(function (i) { return '<tr><td class="l"><div class="nm">' + esc(i.nama) + (ulangOf(i) ? ' <span class="chip2 wr">SO ULANG</span>' : '') + '</div><div class="cd">' + esc(i.kode) + '</div></td><td>' + fmt(i.qadv) + '</td><td>' + fmt(i.wms) + '</td><td>' + sgn(i.sel) + '</td><td><button class="btn2 pri sm" data-k="' + esc(i.kode) + '" onclick="RakUI.soPick(this.dataset.k,true)">+ Pilih</button></td></tr>'; }).join('') || '<tr><td colspan="5" class="empty">' + (ui.items.length ? 'Tidak ada item lain yang cocok.' : 'Belum ada data. Upload saldo QAD dan Informasi Rak WMS dulu.') + '</td></tr>') +
      '</tbody></table></div>' + (cand.length > shown.length ? '<div class="sub">+' + fmt(cand.length - shown.length) + ' item lain, persempit dengan pencarian.</div>' : '') + '</div></div>' +
      '<div class="rk-tools"><div style="font-family:Outfit;font-weight:700;font-size:13px">2. Isi hasil SO</div><span style="flex:1"></span><button class="btn2 sm" onclick="RakUI.print()" ' + (a.length ? '' : 'disabled') + '>&#128424; Cetak Lembar SO (' + fmt(a.length) + ' item)</button></div>' +
      '<div class="sub" id="so-sum"></div>' +
      (a.length ? a.map(soCard).join('') : '<div class="empty">Belum ada item dipilih.</div>') +
      '<div style="position:sticky;bottom:0;padding:10px 0;display:flex;gap:10px;justify-content:flex-end"><button class="btn2 pri" onclick="RakUI.soDone()">Selesai &amp; lihat Template Adjustment &darr;</button></div></div>';
    soRefresh();
    var sc1 = el.querySelector('.db'), pl1 = el.querySelector('.so-pick'); if (sc1) sc1.scrollTop = st0; if (pl1) pl1.scrollTop = pt0;
    if (keep) { var q = $('so-q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }
  /* ---------- cetak LEMBAR STOCK OPNAME (format lembar SO: sistem diganti QAD & WMS, ada Fisik & Rak Aktual) ---------- */
  function printSO() {
    var a = soItems(); if (!a.length) return toast('Pilih dulu item yang akan di-SO.', true);
    var d = new Date(), p2 = function (n) { return n < 10 ? '0' + n : '' + n; };
    var grp = a.map(function (i) { return i.grp; }).filter(function (v, i, x) { return x.indexOf(v) === i; }).join(', ');
    var nm = (sessionStorage.getItem('wh_nama') || '').toUpperCase();
    var no = 'SO-' + (grp.split(', ')[0] || 'WMS') + '-' + String(d.getFullYear()).slice(2) + p2(d.getMonth() + 1) + p2(d.getDate()) + p2(d.getHours()) + p2(d.getMinutes()) + p2(d.getSeconds());
    var n = 0, rows = '';
    a.forEach(function (it) {
      var rk = it.racks.length ? it.racks : [{ rak: '', onhand: '' }];
      n++;
      rk.forEach(function (r, i) {
        rows += '<tr><td class="c">' + (i === 0 ? n : '') + '</td><td class="m">' + (i === 0 ? esc(it.kode) : '') + '</td><td>' + (i === 0 ? esc(it.nama) : '') + '</td><td></td><td class="c m">' + esc(r.rak) + '</td><td class="r">' + (i === 0 ? fmt(it.qadv) : '') + '</td><td class="r">' + (r.onhand === '' ? '' : fmt(r.onhand)) + '</td><td></td><td></td><td></td><td>' + (i === 0 && soRec(it) ? 'SUDAH SO ' + esc(soTgl(soRec(it).tgl)) + ' (fisik ' + fmt(soRec(it).fisik) + ')' : '') + '</td></tr>';
      });
      rows += '<tr class="ex"><td></td><td></td><td class="cd">rak lain / tambahan &rarr;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
    });
    var css = '@page{size:A4 landscape;margin:10mm}body{font:11px Arial,sans-serif;color:#000;margin:0}.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}h1{font-size:20px;margin:0}.mt{display:grid;grid-template-columns:repeat(4,auto);gap:3px 24px;margin-bottom:8px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:4px 5px;vertical-align:middle}th{background:#e6e6e6;font-size:10px}.r{text-align:right}.c{text-align:center}.m{font-family:Consolas,monospace}.ex td{height:20px;color:#888;font-size:9px}tr{page-break-inside:avoid}thead{display:table-header-group}.sg{display:flex;gap:60px;margin-top:26px}.sg div{width:170px;text-align:center}.sg span{display:block;height:50px;border-bottom:1px solid #000;margin-bottom:4px}';
    var h = '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(no) + '</title><style>' + css + '</style></head><body>' +
      '<div class="hd"><h1>LEMBAR STOCK OPNAME</h1><div>PT Rucika &mdash; Warehouse</div></div>' +
      '<div class="mt"><span>No. Lembar</span><b>' + esc(no) + '</b><span>Group</span><b>' + esc(grp) + '</b><span>PIC</span><b>' + esc(nm) + '</b><span>Lokasi WMS</span><b>' + K.LOC + '</b><span>Item dicetak</span><b>' + a.length + ' dari ' + ui.items.length + '</b><span>Tanggal cetak</span><b>' + d.toLocaleDateString('id-ID') + '</b><span>Data WMS</span><b>' + esc(S.meta.wmsAt || '-') + '</b><span>Data QAD</span><b>' + esc(S.meta.qadAt || '-') + '</b></div>' +
      '<table><thead><tr><th>NO</th><th>ITEM</th><th>DESKRIPSI</th><th>UM</th><th>RAK</th><th>QAD</th><th>WMS</th><th>FISIK (QTY)</th><th>RAK AKTUAL</th><th>SELISIH</th><th>KETERANGAN</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="sg"><div><span></span>PIC ( ' + esc(nm) + ' )</div><div><span></span>Checker (            )</div><div><span></span>Team Leader (            )</div></div></body></html>';
    var w = window.open('', '_blank'); if (!w) return toast('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.', true);
    w.document.open(); w.document.write(h); w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 400);
  }

  /* ---------- aksi publik ---------- */
  var API = {
    pick: function (kind) { var i = $('rk-file'); i.value = ''; i.onchange = function () { if (i.files[0]) readFile(kind, i.files[0]); }; i.click(); },
    clear: function (kind) { if (!confirm('Hapus data ' + (kind === 'wms' ? 'Informasi Rak WMS' : 'Saldo QAD') + '?\n\nData ini tersimpan di server dan dipakai semua PIC, jadi akan terhapus untuk semua. Hasil SO yang sudah tercatat di Stock Opname TIDAK ikut terhapus.')) return; if (kind === 'wms') { S.wms = []; S.meta.wmsFile = ''; S.meta.wmsAt = ''; } else { S.qad = []; S.qadSkip = []; S.meta.qadFile = ''; S.meta.qadAt = ''; } S.step1 = ''; save(); render(); },
    search: function (v) { ui.q = v; ui._focusQ = true; renderTbl(); },
    grp: function (g) { ui.g = g; renderTbl(); },
    filter: function (f) { ui.f = f; renderTbl(); },
    open: function (kode) { ui.open = kode; renderDrawer(); $('rk-ov').classList.add('on'); $('rk-dr').classList.add('on'); },
    close: function () { if (ui.soOpen) return API.closeSO(); ui.open = null; scheduleSo(true); $('rk-ov').classList.remove('on'); $('rk-dr').classList.remove('on'); save(); recalc(); renderHero(); renderChart(); renderTbl(); renderAdj(); animate(); },
    akt: function (inp) {
      var it = itemOf(ui.open); if (!it || locked(it)) return;
      var L = K.lines(S, it, ui.plan), l = L[+inp.dataset.i], v = inp.value;
      if (l.manual) { S.manual[it.kode][l.idx].aktual = v; } else { (S.inputs[it.kode] = S.inputs[it.kode] || {})[l.rak] = v; }
      save(); updDrawer();
    },
    addManual: function () {
      var inp = $('rk-newrak'), r = String(inp.value || '').trim().toUpperCase().replace(/\s+/g, ''), it = itemOf(ui.open);
      if (it && locked(it)) return toast('Item sudah di-SO dan terkunci.', true);
      if (!r) return toast('Isi kode rak dulu.', true);
      if (it.racks.some(function (x) { return x.rak === r; })) return toast('Rak ' + r + ' sudah terdaftar di WMS untuk item ini - isi langsung kolom aktualnya.', true);
      var m = S.manual[it.kode] = S.manual[it.kode] || [];
      if (m.some(function (x) { return x.rak === r; })) return toast('Rak ' + r + ' sudah ditambahkan.', true);
      m.push({ rak: r, aktual: '' }); save(); recalc(); renderDrawer();
    },
    delManual: function (i) { var it = itemOf(ui.open); if (locked(it)) return; S.manual[it.kode].splice(i, 1); save(); recalc(); renderDrawer(); },
    cfg: function (k, v) { S.cfg[k] = v; save(); },
    backup: function () {
      if (!S.wms.length && !S.qad.length) return toast('Belum ada data untuk dicadangkan.', true);
      S.meta.backupAt = new Date().toLocaleString('id-ID'); save();
      var blob = new Blob([JSON.stringify({ app: 'rakwms', v: 1, user: USER, S: S })], { type: 'application/json' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'CADANGAN_AKURASI_RAK_' + S.cfg.tgl.replace(/-/g, '') + '.json'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); renderUp(); toast('Cadangan diunduh.');
    },
    restore: function () {
      var i = $('rk-rest'); i.value = '';
      i.onchange = function () {
        var f = i.files[0]; if (!f) return; var rd = new FileReader();
        rd.onload = function (e) {
          try { var j = JSON.parse(e.target.result); if (!j || j.app !== 'rakwms' || !j.S || !j.S.wms) throw new Error('Bukan file cadangan Akurasi Rak WMS.'); adopt(j.S); save(); render(); toast('Data dipulihkan: ' + fmt(S.wms.length) + ' baris rak, ' + fmt(S.qad.length) + ' item QAD.'); }
          catch (x) { toast(x.message || 'File cadangan tidak valid.', true); }
        }; rd.readAsText(f);
      }; i.click();
    },
    openSO: function () { recalc(); so.lim = 30; renderSO(); $('rk-ov').classList.add('on'); $('rk-so').classList.add('on'); ui.soOpen = true; },
    closeSO: function () { scheduleSo(true); ui.soOpen = false; $('rk-so').classList.remove('on'); $('rk-ov').classList.remove('on'); save(); recalc(); renderHero(); renderChart(); renderTbl(); renderAdj(); animate(); },
    soDone: function () { API.closeSO(); var a = $('rk-adj'); if (a && a.scrollIntoView) a.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    soSearch: function (v) { so.q = v; renderSO(); },
    soSelOnly: function (on) { so.sel = !!on; renderSO(); },
    soSetN: function (v) { so.n = Math.max(1, Math.min(500, Math.floor(Number(v)) || 10)); renderSO(); },
    soPick: function (k, on) { if (on) picks()[k] = 1; else delete picks()[k]; save(); renderSO(); },
    soTopN: function () {
      var pk = picks(), c = ui.items.filter(function (i) { return inSOG(i) && !pk[i.kode] && !locked(i) && i.sel !== 0; }).sort(function (x, y) { return Math.abs(y.sel) - Math.abs(x.sel); }).slice(0, so.n);
      if (!c.length) return toast('Tidak ada item selisih yang tersisa.', true);
      c.forEach(function (i) { pk[i.kode] = 1; }); save(); renderSO();
    },
    soClear: function () { if (!confirm('Kosongkan pilihan item SO? (input aktual tidak dihapus)')) return; S.soPick = {}; save(); renderSO(); },
    soAkt: function (inp, i) {
      var it = itemOf(inp.dataset.k), l = K.lines(S, it, ui.plan)[i], v = inp.value;
      if (l.manual) { S.manual[it.kode][l.idx].aktual = v; } else { (S.inputs[it.kode] = S.inputs[it.kode] || {})[l.rak] = v; }
      save(); soRefresh();
    },
    soAdd: function (kode) {
      var inp = $('so-n-' + kode), r = String(inp.value || '').trim().toUpperCase().replace(/\s+/g, ''), it = itemOf(kode);
      if (!r) return toast('Isi kode rak dulu.', true);
      if (it.racks.some(function (x) { return x.rak === r; })) return toast('Rak ' + r + ' sudah terdaftar di WMS untuk item ini - isi langsung kolom aktualnya.', true);
      var m = S.manual[it.kode] = S.manual[it.kode] || [];
      if (m.some(function (x) { return x.rak === r; })) return toast('Rak ' + r + ' sudah ditambahkan.', true);
      m.push({ rak: r, aktual: '' }); save(); ui.plan = K.plan(S, ui.items);
      var c = $('so-c-' + kode); if (c) { c.outerHTML = soCard(it); } soRefresh();
      var n = $('so-n-' + kode); if (n) n.focus();
    },
    soDel: function (kode, idx) {
      var it = itemOf(kode); S.manual[kode].splice(idx, 1); save(); ui.plan = K.plan(S, ui.items);
      var c = $('so-c-' + kode); if (c) { c.outerHTML = soCard(it); } soRefresh();
    },
    print: function () { printSO(); },
    ack: function (on) { S.step1 = on ? sig1(adjPlan()) : ''; save(); renderAdj(); },
    adjTog: function (k, on) { if (on) delete adjOff()[k]; else adjOff()[k] = 1; save(); renderAdj(); },
    adjAll: function (on) { var o = adjOff(); adjCands().forEach(function (x) { if (on) delete o[x.it.kode]; else o[x.it.kode] = 1; }); save(); renderAdj(); },
    adjSearch: function (v) { ui.adjQ = v; renderAdj(); },
    repMonth: function (n) { var m = shiftMonth(ui.repM || curMonth(), n); if (m > curMonth()) return; ui.repM = m; ui.rep = null; loadRep(); },
    repAll: function (on) { ui.repAll = !!on; renderRep(); },
    // buka kunci -> SO ulang (PIC group / TL). Syarat dicek juga di server: ada selisih & SO sisa periode lalu (CARRY) sudah selesai
    unlock: function (kode) {
      var it = itemOf(kode); if (!it || !locked(it)) return;
      if (!canUnlock()) return toast('Buka kunci SO ulang hanya dapat dilakukan oleh TL atau Admin.', true);
      if (it.sel === 0) return toast('Tidak ada selisih WMS - QAD, SO ulang tidak diperlukan.', true);
      var n = carryN(it); if (n > 0) return toast('Selesaikan dulu SO sisa periode sebelumnya (' + n + ' item belum di-SO).', true);
      var al = prompt('Buka kunci untuk SO ulang:\n' + it.nama + '\n\nSelisih WMS - QAD pada data terbaru: ' + (it.sel > 0 ? '+' : '') + it.sel + '\n\nTulis alasan SO ulang (minimal 5 karakter):', '');
      if (al === null) return; al = String(al).trim();
      if (al.length < 5) return toast('Alasan SO ulang wajib diisi (minimal 5 karakter).', true);
      gs('soUlangBuka', [JSON.stringify({ group: it.grp, item: it.kode, nama: it.nama, alasan: al, nik: NIK, user: NAMA, wms: it.wms, qad: it.qadv })]).then(function (r) {
        if (!r || r.success === false) throw new Error((r && r.error) || 'ditolak server');
        clearItem(kode); save(); return loadSoStat();
      }).then(function () {
        recalc(); renderTbl(); renderAdj(); renderHero(); if (ui.open === kode) renderDrawer(); loadRep();
        toast('Kunci dibuka. Hitung ulang semua rak item ini - hasilnya dicatat sebagai SO ulang.');
      }).catch(function (e) { toast('Gagal membuka kunci: ' + ((e && e.message) || e), true); });
    },
    cancelUlang: function (kode) {
      var it = itemOf(kode), u = it && ulangOf(it); if (!u) return;
      if (!confirm('Batalkan SO ulang untuk item ini?\n\nIsian aktual yang sudah dimasukkan dihapus dan item terkunci kembali.')) return;
      gs('soUlangSelesai', [JSON.stringify({ id: u.id, batal: true, nik: NIK, user: NAMA })]).then(function (r) {
        if (!r || r.success === false) throw new Error((r && r.error) || 'ditolak server');
        clearItem(kode); save(); return loadSoStat();
      }).then(function () { recalc(); renderTbl(); renderAdj(); renderHero(); if (ui.open === kode) renderDrawer(); loadRep(); toast('SO ulang dibatalkan. Item terkunci kembali.'); })
        .catch(function (e) { toast('Gagal membatalkan: ' + ((e && e.message) || e), true); });
    },
    kor: function (inp, f, ctx) {
      var kode = inp.dataset.k, it = itemOf(kode); if (!it || locked(it)) return;
      var o = S.koreksi[kode] = S.koreksi[kode] || { q: '', ket: '' };
      if (f === 'q') o.q = inp.value; else o.ket = inp.value;
      if ((o.q === '' || o.q == null) && !o.ket) delete S.koreksi[kode];
      save(); if (ctx === 'dr') updDrawer(); else soRefresh();
    },
    dl: function (n) {
      var pl = adjPlan(), rows = n === 1 ? pl.step1 : pl.step2; if (!rows.length) return;
      var d = S.cfg.tgl.replace(/-/g, ''), name = (n === 1 ? 'ADJUST_RAK_TAHAP1_KOSONGKAN_' : 'ADJUST_RAK_TAHAP2_') + d + '.xlsx';
      // riwayat adjustment per item (Tahap 1 dicatat untuk item pemicunya); Tahap 2 -> item ditandai sudah di-adjustment & hilang dari daftar
      var byItem = {}, hist = S.adjHist = S.adjHist || [];
      rows.forEach(function (r) { var k = n === 1 ? r.by : r.kode; (byItem[k] = byItem[k] || []).push({ r: r.rak, q: r.qty, a: r.auto ? 1 : 0 }); });
      Object.keys(byItem).forEach(function (k) { var it0 = itemOf(k); hist.unshift({ t: S.cfg.tgl, k: k, n: it0 ? it0.nama : k, h: n, rows: byItem[k], u: NAMA, w: new Date().toISOString().slice(0, 16) }); });
      S.adjHist = hist.slice(0, 200);
      if (n === 2) { S.adjDone = S.adjDone || {}; pl.step2.forEach(function (r) { S.adjDone[r.kode] = S.cfg.tgl; }); }
      save();
      loadStyled().then(function (X) {   // X = SheetJS dengan dukungan format sel (rata kiri), sama untuk Tahap 1 & 2
        var lib = X || XLSX; lib.writeFile(K.buildWorkbook(lib, rows, S.cfg), name);
        renderAdj(); renderTbl();
        toast(X ? 'Template ' + name + ' diunduh (' + fmt(rows.length) + ' baris). Item yang sudah di-adjustment dipindahkan ke Riwayat Adjustment.' : 'Template ' + name + ' diunduh, tetapi format rata kiri tidak dapat diterapkan (library gagal dimuat).', !X);
      });
    }
  };
  window.RakUI = API;

  function render() {
    if (!ui.allowed.length) {
      $('rk-hero').innerHTML = '<div class="glass"><div class="gb empty">Akurasi Rak WMS saat ini hanya untuk PIC / TL group <b>I053</b> (Pipa PPR) dan <b>Q055</b> (Fitting).<br><span class="sub">Jika Anda PIC salah satu group tersebut, tunggu data group selesai dimuat lalu buka ulang tab ini.</span></div></div>';
      ['rk-prog', 'rk-up', 'rk-chart', 'rk-rep', 'rk-tbl', 'rk-adj'].forEach(function (id) { if ($(id)) $(id).innerHTML = ''; });
      return;
    }
    recalc(); renderHero(); try { if (typeof window.soRenderRakProgress === 'function') window.soRenderRakProgress(); } catch (e) {} renderUp(); renderChart(); renderRep(); renderTbl(); renderAdj(); animate(); }
  /* ---------- akses: SEMENTARA hanya group I053 & Q055 ---------- */
  function applyAccess() {
    var P = window.S || {}, m = P.master || [];
    if (!m.length) return false;
    var mine = (window.IS_TL ? m : m.filter(function (x) { return window.ownPic && window.ownPic(x.pic); })).map(function (x) { return String(x.group || '').toUpperCase(); });
    ui.allowed = K.GROUPS.filter(function (g) { return mine.indexOf(g) >= 0; });
    var tab = document.querySelector('.tab[data-t="rak"]');
    if (tab) tab.style.display = ui.allowed.length ? '' : 'none';
    var emb = /[?&]embed=1\b/.test(location.search);
    if (!ui.allowed.length && tab && tab.classList.contains('active') && !emb) { var d = document.querySelector('.tab[data-t="dash"]'); if (d) d.click(); }
    else if (tab && tab.classList.contains('active')) render();
    return true;
  }
  function init() {
    if (!$('p-rak')) return;
    var tb = document.querySelector('.tab[data-t="rak"]'); if (tb) tb.style.display = 'none';   // tersembunyi sampai akses dipastikan
    var tries = 0, iv = setInterval(function () { if (applyAccess() || ++tries > 120) clearInterval(iv); }, 500);
    shell(); tilt();
    setTimeout(function () { pullServer(); }, 700);
    setTimeout(function () { var w = setInterval(function () { if (ui.items.length) { clearInterval(w); loadSoStat().then(function () { renderTbl(); syncSo(); loadRep(); }); } }, 800); setTimeout(function () { clearInterval(w); }, 90000); }, 900);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && !ui.open && !ui.soOpen && !(S.meta && S.meta.dirty) && Date.now() - lastPull > 30000) { pullServer(true); loadSoStat().then(renderTbl); } });
    if (/[?&]embed=1\b/.test(location.search) && location.hash === '#rak') { var tbs = $('tabs'); if (tbs) tbs.style.display = 'none'; }   // dibuka dari tab Monitoring WMS: baris tab Stock Opname disembunyikan
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    if (!S.wms.length && !S.qad.length) idbGet(function (v) { if (!v) return; try { var j = JSON.parse(v); if (j && (j.wms || []).length) { adopt(j); try { localStorage.setItem(KEY, v); } catch (e) {} render(); } } catch (e) {} });
    document.getElementById('tabs').addEventListener('click', function (e) {
      var t = e.target.closest('.tab'); if (!t) return;
      var on = t.dataset.t === 'rak';
      ['fbar', 'loadBox'].forEach(function (id) { var el = $(id); if (el) el.style.display = on ? 'none' : ''; });
      if (on) render();
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ui.soOpen) API.closeSO(); else if (e.key === 'Escape' && ui.open) API.close(); });
    if (location.hash === '#rak') { var t = document.querySelector('.tab[data-t="rak"]'); if (t) setTimeout(function () { t.click(); }, 300); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
