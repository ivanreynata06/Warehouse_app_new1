/*!
 * rakwms-ui.js -- tampilan tab "Akurasi Rak WMS" (glass + 3D)
 * Logika murni ada di rakwms.js (RakWmsCore). Data hanya di browser.
 */
(function () {
  'use strict';
  var K = window.RakWmsCore, esc = K.esc, fmt = K.fmt;
  var USER = (sessionStorage.getItem('wh_nama') || 'anon').trim().toLowerCase();
  var KEY = 'rakwms_v1::' + USER;
  var S = load(), ui = { allowed: [], g: 'all', q: '', f: 'all', open: null, items: [], plan: null, sum: null };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- penyimpanan lokal (BUKAN Supabase / Spreadsheet) ---------- */
  function load() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && j.wms) { var b = K.blank(); for (var k in b) if (j[k] === undefined) j[k] = b[k]; return j; } } catch (e) {} return K.blank(); }
  var NIK = (sessionStorage.getItem('wh_nik') || '').trim(), syncTimer = null, syncState = ['idle', ''];
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
  function scheduleSync() { if (!NIK) return; clearTimeout(syncTimer); setSync('pending'); syncTimer = setTimeout(syncNow, 2500); }
  function syncNow() {
    if (!NIK) return Promise.resolve(); clearTimeout(syncTimer); setSync('saving');
    return gs('saveRakWmsData', [NIK, JSON.stringify(S)]).then(function (r) {
      if (!r || r.success === false) throw new Error((r && r.error) || 'ditolak server');
      S.meta.syncAt = r.updatedAt; S.meta.dirty = false; saveLocal(); setSync('ok', 'Tersimpan di server ' + new Date().toLocaleTimeString('id-ID'));
    }).catch(function (e) { setSync('err', 'Gagal simpan ke server: ' + (e && e.message || e) + ' (data aman di browser, akan dicoba lagi)'); clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 30000); });
  }
  function pullServer() {
    if (!NIK) return;
    gs('getRakWmsData', [NIK]).then(function (r) {
      if (!r || r.success === false) throw new Error((r && r.error) || 'gagal');
      var local = (S.wms.length || S.qad.length);
      if (!r.found) { if (local) syncNow(); else setSync('idle', 'Belum ada data di server'); return; }
      if (local && S.meta.syncAt === r.updatedAt) { if (S.meta.dirty) syncNow(); else setSync('ok', 'Tersimpan di server'); return; }
      var j = JSON.parse(r.data);
      if (local && S.meta.dirty && !confirm('Ada perubahan di browser ini yang belum tersimpan, sementara data di server lebih baru (dari perangkat/browser lain).\n\nOK = pakai data SERVER\nBatal = pertahankan data browser ini dan timpa server')) { syncNow(); return; }
      adopt(j); S.meta.syncAt = r.updatedAt; S.meta.dirty = false; saveLocal(); render(); setSync('ok', 'Data dipulihkan dari server');
    }).catch(function (e) { setSync('err', 'Server tidak terjangkau: ' + (e && e.message || e)); });
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
      '<div id="rk-hero"></div><div class="glass" id="rk-up"></div><div class="glass" id="rk-chart"></div><div class="glass" id="rk-tbl"></div><div class="glass" id="rk-adj"></div>' +
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
      if (ui.f === 'todo') return c.n === 0;
      if (ui.f === 'done') return c.n > 0;
      return true;
    });
  }
  function renderTbl() {
    var a = filtered(), lim = 400;
    $('rk-tbl').innerHTML = '<div class="gh"><h3>Daftar Item &amp; Rak <em>klik baris untuk input aktual</em></h3><div class="rk-tools">' +
      '<button class="btn2 pri" onclick="RakUI.openSO()">&#128221; Form Stock Opname</button>' +
      '<input type="text" id="rk-q" placeholder="Cari kode / nama item..." value="' + esc(ui.q) + '" style="width:220px" oninput="RakUI.search(this.value)">' +
      (ui.allowed.length > 1 ? '<div class="rk-seg">' + [['all', 'Semua group'], ['I053', 'I053 Pipa'], ['Q055', 'Q055 Fitting']].map(function (x) { return '<button class="' + (ui.g === x[0] ? 'on' : '') + '" onclick="RakUI.grp(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>' : '') + '<div class="rk-seg">' + [['all', 'Semua'], ['sel', 'Selisih'], ['ok', 'Sesuai'], ['todo', 'Belum diinput'], ['done', 'Sudah diinput']].map(function (x) { return '<button class="' + (ui.f === x[0] ? 'on' : '') + '" onclick="RakUI.filter(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div></div></div>' +
      '<div class="gb"><div class="rk-tw"><table><thead><tr><th class="l">Item</th><th>Group</th><th class="l">Nama Rak</th><th>Jml Rak</th><th>Saldo QAD</th><th>Saldo WMS</th><th>Selisih</th><th>Status</th><th>Progres input</th></tr></thead><tbody>' +
      (a.length ? a.slice(0, lim).map(function (i) {
        var c = soCount(i), pc = c.t ? c.n / c.t * 100 : 0;
        return '<tr class="it" onclick="RakUI.open(\'' + i.kode + '\')"><td class="l"><div class="nm" title="' + esc(i.nama) + '">' + esc(i.nama) + '</div><div class="cd">' + esc(i.kode) + '</div></td><td><span class="chip2 nt">' + esc(i.grp) + '</span></td><td class="l" title="' + esc(i.racks.map(function (r) { return r.rak; }).join(', ')) + '"><div class="cd" style="max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--txt2)">' + (i.racks.length ? esc(i.racks.slice(0, 2).map(function (r) { return r.rak; }).join(', ')) + (i.racks.length > 2 ? ' +' + (i.racks.length - 2) : '') : '-') + '</div></td><td>' + i.racks.length + '</td><td>' + fmt(i.qadv) + '</td><td>' + fmt(i.wms) + '</td><td>' + sgn(i.sel) + '</td>' +
          '<td><span class="chip2 ' + (i.sel === 0 ? 'ok' : 'bd') + '">' + (i.sel === 0 ? 'SESUAI' : 'SELISIH') + '</span></td>' +
          '<td style="min-width:120px"><div class="prg"><i style="width:' + pc + '%"></i></div><div class="cd" style="text-align:right;margin-top:3px">' + c.n + '/' + c.t + ' rak</div></td></tr>';
      }).join('') : '<tr><td colspan="10" class="empty">' + (ui.items.length ? 'Tidak ada item yang cocok dengan filter.' : 'Belum ada data. Upload saldo QAD dan Informasi Rak WMS di atas.') + '</td></tr>') +
      '</tbody></table></div>' + (a.length > lim ? '<div class="sub" style="margin-top:8px">Menampilkan ' + lim + ' dari ' + fmt(a.length) + ' item - gunakan pencarian.</div>' : '') + '</div>';
    var q = $('rk-q'); if (q && ui._focusQ) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); ui._focusQ = false; }
  }

  /* ---------- DRAWER INPUT ---------- */
  function holders(kode, rak) { return S.wms.filter(function (r) { return r.rak === rak && r.kode !== kode && r.onhand; }); }
  function itemOf(kode) { return ui.items.filter(function (i) { return i.kode === kode; })[0]; }
  function renderDrawer() {
    var it = itemOf(ui.open); if (!it) return;
    var L = K.lines(S, it, ui.plan), rows = L.map(function (l, i) {
      var hl = l.manual ? holders(it.kode, l.rak) : [];
      return '<tr class="' + (l.manual ? 'man' : '') + '"><td class="l"><b style="font-family:var(--mono)">' + esc(l.rak) + '</b>' + (l.manual ? ' <span class="chip2 nt">MANUAL</span>' : '') +
        '<div class="cd">' + esc(l.area || '') + (hl.length ? ' - <span class="neg">dipakai item lain di WMS</span>' : '') + '</div>' +
        (hl.length ? '<div class="warnb" style="margin-top:6px">Rak ini di WMS masih berisi <b>' + hl.map(function (h) { return esc(short(h.nama)) + ' (' + fmt(h.onhand) + ')'; }).join(', ') + '</b>. Saat aktual diisi, stok tersebut otomatis masuk <b>Template Tahap 1</b> (dikeluarkan dengan tanda -) dan harus di-upload ke WMS lebih dulu.</div>' : '') + '</td>' +
        '<td>' + fmt(l.exist) + '</td>' +
        '<td><input type="number" min="0" step="any" class="aq" data-i="' + i + '" placeholder="aktual" value="' + (l.aktual === null ? '' : l.aktual) + '" oninput="RakUI.akt(this)"></td>' +
        '<td id="rk-d' + i + '" style="min-width:110px"></td>' +
        '<td>' + (l.manual ? '<button class="btn2 dng sm" onclick="RakUI.delManual(' + l.idx + ')">Hapus</button>' : '') + '</td></tr>';
    }).join('');
    $('rk-dr').innerHTML = '<div class="dh"><div><div class="cd">' + esc(it.kode) + '</div><div style="font-family:Outfit;font-size:16px;font-weight:700;line-height:1.3">' + esc(it.nama) + '</div></div><button class="btn2 sm" onclick="RakUI.close()">Tutup &#10005;</button></div>' +
      '<div class="db"><div class="rk-cmp"><div><span>Saldo QAD</span><b style="color:#fcd34d">' + fmt(it.qadv) + '</b></div><div><span>Saldo WMS</span><b style="color:#67e8f9">' + fmt(it.wms) + '</b></div><div><span>Selisih WMS - QAD</span><b>' + sgn(it.sel) + '</b></div><div><span>Aktual (diinput)</span><b id="rk-tA">0</b></div></div>' +
      '<div id="rk-proj" class="infob"></div>' +
      '<div class="rk-tw"><table><thead><tr><th class="l">Rak</th><th>Saldo rak WMS</th><th>Aktual</th><th>Adjustment</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="5" class="empty">Item ini belum punya rak di WMS. Tambahkan rak manual di bawah.</td></tr>') + '</tbody></table></div>' +
      '<div class="glass" style="border-radius:14px"><div class="gb"><div style="font-family:Outfit;font-weight:700;font-size:12.5px;margin-bottom:4px">+ Tambah rak manual</div><div class="sub" style="margin-bottom:10px">Gunakan bila rak aktual tidak terdaftar di WMS untuk item ini (mis. <span style="font-family:var(--mono)">I-05-02-C</span>).</div>' +
      '<div class="rk-tools"><input type="text" id="rk-newrak" placeholder="Kode rak, mis. I-05-02-C" style="width:220px" onkeydown="if(event.key===\'Enter\')RakUI.addManual()"><button class="btn2 pri" onclick="RakUI.addManual()">Tambah rak</button></div></div></div>' +
      '<div class="sub">Adjustment = aktual &minus; saldo rak WMS. Kelebihan di WMS menjadi <b class="neg">negatif (-)</b>; kekurangan ditulis <b class="pos">angka polos</b>. Qty hanya masuk template jika aktual diisi.</div></div>';
    updDrawer();
  }
  function updDrawer() {
    var it = itemOf(ui.open); if (!it) return; ui.plan = K.plan(S, ui.items);
    var L = K.lines(S, it, ui.plan), ta = 0, any = false, proj = 0;
    L.forEach(function (l, i) {
      var c = $('rk-d' + i); if (!c) return;
      if (l.aktual === null) { c.innerHTML = '<span class="zero">-</span>'; proj += l.exist; return; }
      any = true; ta += l.aktual;
      var d = l.aktual - l.exist; proj += l.cleared ? 0 : l.aktual;
      c.innerHTML = l.cleared ? '<span class="chip2 wr">DIKOSONGKAN T1</span>' : (d === 0 ? '<span class="chip2 ok">SESUAI</span>' : (d < 0 ? '<span class="neg" style="font-family:var(--mono);font-weight:700">' + fmt(d) + '</span> <span class="cd">kurangi</span>' : '<span class="pos" style="font-family:var(--mono);font-weight:700">' + fmt(d) + '</span> <span class="cd">tambah</span>'));
    });
    $('rk-tA').textContent = any ? fmt(ta) : '-';
    var ps = proj - it.qadv;
    $('rk-proj').innerHTML = 'Proyeksi saldo WMS setelah adjustment: <b>' + fmt(proj) + '</b> vs QAD <b>' + fmt(it.qadv) + '</b> &rarr; ' + (ps === 0 ? '<b class="pos">SESUAI &#10003;</b>' : 'masih selisih <b class="' + (ps > 0 ? 'neg' : 'pos') + '">' + fmt(ps) + '</b> (' + (ps > 0 ? 'WMS lebih besar dari QAD' : 'WMS lebih kecil dari QAD') + ')');
  }

  /* ---------- ADJUSTMENT ---------- */
  function miniT(rows) {
    return '<div class="rk-mini-t"><table><thead><tr><th class="l">Rak</th><th class="l">Item</th><th>Qty</th></tr></thead><tbody>' + rows.slice(0, 60).map(function (r) {
      return '<tr><td class="l" style="font-family:var(--mono)">' + esc(r.rak) + '</td><td class="l">' + esc(short(r.nama)) + '</td><td>' + sgn(r.qty) + '</td></tr>';
    }).join('') + '</tbody></table></div>' + (rows.length > 60 ? '<div class="sub">+' + (rows.length - 60) + ' baris lagi di file.</div>' : '');
  }
  function sig1(p) { return p.step1.map(function (r) { return r.rak + '|' + r.kode + '|' + r.qty; }).join(';'); }
  function renderAdj() {
    var p = ui.plan, c = S.cfg, has1 = p.step1.length > 0, ok1 = !has1 || (S.step1 && S.step1 === sig1(p)), has2 = p.step2.length > 0;
    $('rk-adj').innerHTML = '<div class="gh"><h3>Template Adjustment WMS <em>otomatis dari input aktual</em></h3></div><div class="gb" style="display:flex;flex-direction:column;gap:14px">' +
      '<div class="rk-cfg"><label>Tanggal<input type="date" value="' + esc(c.tgl) + '" onchange="RakUI.cfg(\'tgl\',this.value)"></label><label>Site<input type="number" value="' + esc(c.site) + '" style="width:90px" onchange="RakUI.cfg(\'site\',this.value)"></label>' +
      '<label>Keterangan<input type="text" value="' + esc(c.ket) + '" style="width:240px" onchange="RakUI.cfg(\'ket\',this.value)"></label><label>Kode Kategori<input type="number" value="' + esc(c.kat) + '" style="width:90px" onchange="RakUI.cfg(\'kat\',this.value)"></label><label>Location<input type="text" value="' + K.LOC + '" disabled style="width:100px;opacity:.6"></label></div>' +
      (p.dup.length ? '<div class="warnb">Rak manual yang sama dipakai oleh lebih dari satu item: <b>' + p.dup.map(function (d) { return esc(d.rak); }).join(', ') + '</b>. Pastikan hanya satu item per rak.</div>' : '') +
      '<div class="rk-steps">' +
      '<div class="rk-step"><div class="no">1</div><h4>Kosongkan rak yang bentrok</h4>' + (has1 ?
        '<ul><li>' + fmt(p.step1.length) + ' rak manual saat ini masih dipakai item lain di WMS.</li><li>Upload template ini ke WMS lebih dulu - Qty bertanda <b>-</b> menghapus stok lama.</li></ul>' + miniT(p.step1) +
        '<button class="btn2 pri" onclick="RakUI.dl(1)">&#11015; Unduh Template Tahap 1</button><label class="chk"><input type="checkbox" ' + (ok1 ? 'checked' : '') + ' onchange="RakUI.ack(this.checked)"> Tahap 1 sudah di-upload ke WMS</label>'
        : '<div class="infob">Tidak ada rak bentrok. Langsung lanjut ke Tahap 2.</div>') + '</div>' +
      '<div class="rk-step s2 ' + (ok1 ? '' : 'lock') + '"><div class="no">2</div><h4>Adjustment rak (aktual vs saldo WMS)</h4>' + (has2 ?
        '<ul><li>' + fmt(p.step2.length) + ' baris: ' + fmt(p.step2.filter(function (r) { return r.qty < 0; }).length) + ' pengurangan (-), ' + fmt(p.step2.filter(function (r) { return r.qty > 0; }).length) + ' penambahan.</li><li>Pengurangan ditempatkan di urutan awal.</li></ul>' + miniT(p.step2) +
        '<button class="btn2 pri" ' + (ok1 ? '' : 'disabled') + ' onclick="RakUI.dl(2)">&#11015; Unduh Template Adjustment</button>' + (ok1 ? '' : '<div class="sub">Terbuka setelah Tahap 1 dikonfirmasi.</div>')
        : '<div class="infob">Belum ada selisih. Input aktual rak pada tabel di atas; baris adjustment dibuat otomatis.</div>') + '</div></div></div>';
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
        S.step1 = ''; save(); render();
      } catch (x) { toast(x.message || String(x), true); }
    };
    rd.readAsArrayBuffer(f);
  }


  /* ---------- FORM STOCK OPNAME (menggantikan Cetak Laporan) ----------
     PIC melihat rak & saldo WMS tiap item, mengisi aktual di lapangan, dan bisa menambah rak yang tidak
     terdaftar. Rak tambahan yang di WMS masih berisi item lain otomatis dikosongkan (Qty bertanda -)
     di Template Tahap 1 -- logikanya di RakWmsCore.plan(). */
  var so = { q: '', lim: 30 };
  function soItems() { var a = filtered(); return a; }
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
      (L.map(function (l, i) { return soLine(it, l, i); }).join('') || '<tr><td colspan="5" class="empty">Item ini belum punya rak di WMS. Tambahkan rak di bawah.</td></tr>') + '</tbody></table></div>' +
      '<div class="rk-tools" style="margin-top:10px"><input type="text" id="so-n-' + id + '" placeholder="+ Tambah rak (mis. I-03-01-C)" style="width:230px" data-k="' + id + '" onkeydown="if(event.key===\'Enter\')RakUI.soAdd(this.dataset.k)"><button class="btn2 pri sm" data-k="' + id + '" onclick="RakUI.soAdd(this.dataset.k)">Tambah rak</button><span class="cd" id="so-p-' + id + '"></span></div>' +
      '</div></div>';
  }
  function soRefresh() {
    ui.plan = K.plan(S, ui.items);
    soItems().slice(0, so.lim).forEach(function (it) {
      var L = K.lines(S, it, ui.plan), proj = 0;
      L.forEach(function (l, i) {
        var c = $('so-d-' + it.kode + '-' + i); if (!c) return;
        if (l.aktual === null) { c.innerHTML = '<span class="zero">-</span>'; proj += l.exist; return; }
        var d = l.aktual - l.exist; proj += l.cleared ? 0 : l.aktual;
        c.innerHTML = l.cleared ? '<span class="chip2 wr">DIKOSONGKAN T1</span>' : (d === 0 ? '<span class="chip2 ok">SESUAI</span>' : (d < 0 ? '<span class="neg" style="font-family:var(--mono);font-weight:700">' + fmt(d) + '</span> <span class="cd">kurangi</span>' : '<span class="pos" style="font-family:var(--mono);font-weight:700">' + fmt(d) + '</span> <span class="cd">tambah</span>'));
      });
      var p = $('so-p-' + it.kode), n = L.filter(function (l) { return l.aktual !== null; }).length;
      if (p) p.innerHTML = n ? 'Proyeksi WMS: <b>' + fmt(proj) + '</b> vs QAD <b>' + fmt(it.qadv) + '</b> ' + (proj === it.qadv ? '<span class="pos">sesuai &#10003;</span>' : '<span class="neg">selisih ' + fmt(proj - it.qadv) + '</span>') : '';
    });
    var t = $('so-sum'); if (t) { var m = K.summary(S, ui.items, ui.plan); t.innerHTML = 'Rak terinput: <b>' + fmt(m.rin) + '</b> &middot; Template Tahap 1: <b>' + fmt(ui.plan.step1.length) + '</b> baris &middot; Tahap 2: <b>' + fmt(ui.plan.step2.length) + '</b> baris'; }
  }
  function renderSO() {
    var a = soItems(), el = $('rk-so'); if (!el) return;
    var ae = document.activeElement, keep = ae && ae.id === 'so-q';
    el.innerHTML = '<div class="dh"><div><div style="font-family:Outfit;font-size:18px;font-weight:700">&#128221; Form Stock Opname</div><div class="cd">Lihat rak &amp; saldo WMS, isi jumlah aktual di lapangan. Adjustment dibuat otomatis (kurang = -, tambah = angka polos).</div></div><button class="btn2 sm" onclick="RakUI.closeSO()">Tutup &#10005;</button></div>' +
      '<div class="db"><div class="rk-tools"><input type="text" id="so-q" placeholder="Cari kode / nama item..." value="' + esc(ui.q) + '" style="width:240px" oninput="RakUI.soSearch(this.value)">' +
      '<div class="rk-seg">' + [['all', 'Semua'], ['sel', 'Selisih'], ['todo', 'Belum diinput'], ['done', 'Sudah diinput']].map(function (x) { return '<button class="' + (ui.f === x[0] ? 'on' : '') + '" onclick="RakUI.soFilter(\'' + x[0] + '\')">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<button class="btn2 sm" onclick="RakUI.print()" title="Cetak lembar pegangan SO untuk di lapangan">&#128424; Cetak lembar SO</button></div>' +
      '<div class="sub" id="so-sum"></div>' +
      (a.length ? a.slice(0, so.lim).map(soCard).join('') : '<div class="empty">' + (ui.items.length ? 'Tidak ada item yang cocok dengan filter.' : 'Belum ada data. Upload saldo QAD dan Informasi Rak WMS dulu.') + '</div>') +
      (a.length > so.lim ? '<button class="btn2" onclick="RakUI.soMore()">Tampilkan lebih banyak (sisa ' + (a.length - so.lim) + ')</button>' : '') +
      '<div style="position:sticky;bottom:0;padding:10px 0;display:flex;gap:10px;justify-content:flex-end"><button class="btn2 pri" onclick="RakUI.soDone()">Selesai &amp; lihat Template Adjustment &darr;</button></div></div>';
    soRefresh();
    if (keep) { var q = $('so-q'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }

  /* ---------- cetak laporan akurasi QAD vs WMS (lengkap dengan nama rak) ---------- */
  function printReport() {
    var a = filtered(); if (!a.length) return toast('Tidak ada data untuk dicetak. Upload data dulu atau ubah filter.', true);
    var m = ui.sum, now = new Date().toLocaleString('id-ID'), nm = sessionStorage.getItem('wh_nama') || '';
    var rowsItem = a.map(function (i, n) {
      return '<tr><td>' + (n + 1) + '</td><td class="m">' + esc(i.kode) + '</td><td>' + esc(i.nama) + '</td><td class="c">' + esc(i.grp) + '</td><td class="m">' + esc(i.racks.map(function (r) { return r.rak; }).join(', ') || '-') + '</td><td class="r">' + fmt(i.qadv) + '</td><td class="r">' + fmt(i.wms) + '</td><td class="r ' + (i.sel ? 'bd' : '') + '">' + fmt(i.sel) + '</td><td class="c">' + (i.sel === 0 ? 'SESUAI' : 'SELISIH') + '</td></tr>';
    }).join('');
    var rowsRak = '';
    a.forEach(function (i) {
      K.lines(S, i, ui.plan).forEach(function (l) {
        var d = l.aktual === null ? '' : l.aktual - l.exist;
        rowsRak += '<tr><td class="m">' + esc(l.rak) + '</td><td>' + esc(l.area || '') + '</td><td class="m">' + esc(i.kode) + '</td><td>' + esc(i.nama) + '</td><td class="r">' + fmt(l.exist) + '</td><td class="r">' + (l.aktual === null ? '' : fmt(l.aktual)) + '</td><td class="r ' + (d ? 'bd' : '') + '">' + (d === '' ? '' : fmt(d)) + '</td></tr>';
      });
    });
    var css = '@page{size:A4 landscape;margin:10mm}body{font:11px Arial,sans-serif;color:#111;margin:0}h1{font-size:17px;margin:0}h2{font-size:13px;margin:18px 0 6px}.sub{color:#555;font-size:10px;margin:3px 0 10px}.k{display:flex;gap:10px;margin:8px 0}.k div{border:1px solid #bbb;border-radius:6px;padding:6px 12px;min-width:120px}.k b{display:block;font-size:17px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 5px;vertical-align:top}th{background:#e8ecf2;font-size:10px}.r{text-align:right}.c{text-align:center}.m{font-family:Consolas,monospace;font-size:10px}.bd{color:#b00020;font-weight:700}tr{page-break-inside:avoid}thead{display:table-header-group}';
    var h = '<!doctype html><html><head><meta charset="utf-8"><title>Akurasi Rak WMS ' + esc(S.cfg.tgl) + '</title><style>' + css + '</style></head><body>' +
      '<h1>Laporan Akurasi Stok Rak - QAD vs WMS (' + K.LOC + ')</h1><div class="sub">Group: ' + esc(ui.allowed.join(', ')) + (ui.g !== 'all' ? ' (filter ' + esc(ui.g) + ')' : '') + ' | Dicetak ' + esc(now) + (nm ? ' oleh ' + esc(nm) : '') + ' | Data WMS: ' + esc(S.meta.wmsAt || '-') + ' | Data QAD: ' + esc(S.meta.qadAt || '-') + '</div>' +
      '<div class="k"><div>Akurasi Item<b>' + pct(m.accItem) + '%</b></div><div>Akurasi Qty<b>' + pct(m.accQty) + '%</b></div><div>Akurasi Rak (SO)<b>' + (m.accRak == null ? '-' : pct(m.accRak) + '%') + '</b></div><div>Item sesuai<b>' + fmt(m.ok) + ' / ' + fmt(m.n) + '</b></div><div>Saldo QAD / WMS<b>' + fmt(m.qad) + ' / ' + fmt(m.wms) + '</b></div></div>' +
      '<h2>A. Perbandingan per item</h2><table><thead><tr><th>No</th><th>Kode Item</th><th>Nama Item</th><th>Group</th><th>Nama Rak</th><th>Saldo QAD</th><th>Saldo WMS</th><th>Selisih</th><th>Status</th></tr></thead><tbody>' + rowsItem + '</tbody></table>' +
      '<h2>B. Detail per rak</h2><table><thead><tr><th>Rak</th><th>Area</th><th>Kode Item</th><th>Nama Item</th><th>Saldo WMS</th><th>Aktual</th><th>Adjustment</th></tr></thead><tbody>' + rowsRak + '</tbody></table></body></html>';
    var w = window.open('', '_blank'); if (!w) return toast('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.', true);
    w.document.open(); w.document.write(h); w.document.close(); w.focus(); setTimeout(function () { w.print(); }, 400);
  }

  /* ---------- aksi publik ---------- */
  var API = {
    pick: function (kind) { var i = $('rk-file'); i.value = ''; i.onchange = function () { if (i.files[0]) readFile(kind, i.files[0]); }; i.click(); },
    clear: function (kind) { if (!confirm('Hapus data ' + (kind === 'wms' ? 'Informasi Rak WMS' : 'Saldo QAD') + ' dari browser ini?')) return; if (kind === 'wms') { S.wms = []; S.meta.wmsFile = ''; S.meta.wmsAt = ''; } else { S.qad = []; S.qadSkip = []; S.meta.qadFile = ''; S.meta.qadAt = ''; } S.step1 = ''; save(); render(); },
    search: function (v) { ui.q = v; ui._focusQ = true; renderTbl(); },
    grp: function (g) { ui.g = g; renderTbl(); },
    filter: function (f) { ui.f = f; renderTbl(); },
    open: function (kode) { ui.open = kode; renderDrawer(); $('rk-ov').classList.add('on'); $('rk-dr').classList.add('on'); },
    close: function () { if (ui.soOpen) return API.closeSO(); ui.open = null; $('rk-ov').classList.remove('on'); $('rk-dr').classList.remove('on'); save(); recalc(); renderHero(); renderChart(); renderTbl(); renderAdj(); animate(); },
    akt: function (inp) {
      var it = itemOf(ui.open), L = K.lines(S, it, ui.plan), l = L[+inp.dataset.i], v = inp.value;
      if (l.manual) { S.manual[it.kode][l.idx].aktual = v; } else { (S.inputs[it.kode] = S.inputs[it.kode] || {})[l.rak] = v; }
      save(); updDrawer();
    },
    addManual: function () {
      var inp = $('rk-newrak'), r = String(inp.value || '').trim().toUpperCase().replace(/\s+/g, ''), it = itemOf(ui.open);
      if (!r) return toast('Isi kode rak dulu.', true);
      if (it.racks.some(function (x) { return x.rak === r; })) return toast('Rak ' + r + ' sudah terdaftar di WMS untuk item ini - isi langsung kolom aktualnya.', true);
      var m = S.manual[it.kode] = S.manual[it.kode] || [];
      if (m.some(function (x) { return x.rak === r; })) return toast('Rak ' + r + ' sudah ditambahkan.', true);
      m.push({ rak: r, aktual: '' }); save(); recalc(); renderDrawer();
    },
    delManual: function (i) { var it = itemOf(ui.open); S.manual[it.kode].splice(i, 1); save(); recalc(); renderDrawer(); },
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
    closeSO: function () { ui.soOpen = false; $('rk-so').classList.remove('on'); $('rk-ov').classList.remove('on'); save(); recalc(); renderHero(); renderChart(); renderTbl(); renderAdj(); animate(); },
    soDone: function () { API.closeSO(); var a = $('rk-adj'); if (a && a.scrollIntoView) a.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    soSearch: function (v) { ui.q = v; so.lim = 30; renderSO(); },
    soFilter: function (f) { ui.f = f; so.lim = 30; renderSO(); },
    soMore: function () { so.lim += 30; renderSO(); },
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
    print: function () { printReport(); },
    ack: function (on) { S.step1 = on ? sig1(ui.plan) : ''; save(); renderAdj(); },
    dl: function (n) {
      var rows = n === 1 ? ui.plan.step1 : ui.plan.step2; if (!rows.length) return;
      var d = S.cfg.tgl.replace(/-/g, ''), name = (n === 1 ? 'ADJUST_RAK_TAHAP1_KOSONGKAN_' : 'ADJUST_RAK_TAHAP2_') + d + '.xlsx';
      XLSX.writeFile(K.buildWorkbook(XLSX, rows, S.cfg), name); toast('Template ' + name + ' diunduh (' + fmt(rows.length) + ' baris).');
    }
  };
  window.RakUI = API;

  function render() {
    if (!ui.allowed.length) {
      $('rk-hero').innerHTML = '<div class="glass"><div class="gb empty">Akurasi Rak WMS saat ini hanya untuk PIC / TL group <b>I053</b> (Pipa PPR) dan <b>Q055</b> (Fitting).<br><span class="sub">Jika Anda PIC salah satu group tersebut, tunggu data group selesai dimuat lalu buka ulang tab ini.</span></div></div>';
      ['rk-up', 'rk-chart', 'rk-tbl', 'rk-adj'].forEach(function (id) { $(id).innerHTML = ''; });
      return;
    }
    recalc(); renderHero(); renderUp(); renderChart(); renderTbl(); renderAdj(); animate(); }
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
    setTimeout(pullServer, 700);
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
