/*! sb-storage-card.js — Kartu "Penyimpanan Supabase" di Kelola User (hanya Super Admin & TL).
 *  Butuh Chart.js 4.x + backend getSupabaseStorageStats(actorNik, force) / setSupabaseDbLimitMB(actorNik, mb). */
(function (w) {
  var C = { gold: '#d4af37', gold2: '#f4d675', blue: '#3b82f6', cyan: '#06b6d4', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#8b5cf6', pink: '#ec4899', teal: '#14b8a6' };
  var PAL = [C.blue, C.cyan, C.gold, C.green, C.purple, C.amber, C.pink, C.teal];
  var BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var S = { d: null, charts: {}, actor: '', loading: false, visible: false, observer: null };

  function $(id) { return document.getElementById(id); }
  function dark() { return !document.body.classList.contains('theme-light'); }
  function P() { return dark() ? { txt: '#aab1c6', mute: '#7a8199', grid: 'rgba(255,255,255,.07)', tipBg: 'rgba(12,14,26,.96)', tipTx: '#eef0f8', free: '#2a2a42' } : { txt: '#42506b', mute: '#6b7794', grid: 'rgba(16,26,48,.08)', tipBg: 'rgba(255,255,255,.98)', tipTx: '#101a30', free: '#e3e7f1' }; }
  function nf(v, d) { return (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fb(b) { if (b == null || isNaN(b)) return '—'; var a = Math.abs(b); if (a >= 1073741824) return nf(b / 1073741824, 2) + ' GB'; if (a >= 1048576) return nf(b / 1048576, 2) + ' MB'; if (a >= 1024) return nf(b / 1024, 1) + ' KB'; return nf(b, 0) + ' B'; }
  function idDate(iso) { if (!iso) return '—'; var p = iso.split('-'); return (+p[2]) + ' ' + BLN[+p[1] - 1] + ' ' + p[0]; }
  function wsLabel(k) { return k === '(umum)' ? 'Umum' : String(k).replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  var DPR = function () { return Math.max(2, w.devicePixelRatio || 1); };

  function levelColor(pct) { return pct >= 85 ? C.red : pct >= 60 ? C.amber : C.green; }
  function vGrad(chart, c1, c2) { var a = chart.chartArea; if (!a) return c1; var g = chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; }
  function hGrad(chart, c1, c2) { var a = chart.chartArea; if (!a) return c1; var g = chart.ctx.createLinearGradient(a.left, 0, a.right, 0); g.addColorStop(0, c1); g.addColorStop(1, c2); return g; }

  function countUp(el, to, dec, suffix) {
    if (!el) return; var t0 = null, dur = 1300;
    function step(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = nf(to * e, dec) + (suffix || ''); if (p < 1) requestAnimationFrame(step); else el.textContent = nf(to, dec) + (suffix || ''); }
    requestAnimationFrame(step);
  }

  /* ---------- plugin umum ---------- */
  var animProg = { onProgress: function (a) { a.chart.$prog = a.currentStep / (a.numSteps || 1); }, onComplete: function (a) { a.chart.$prog = 1; } };
  function baseOpts(extra) {
    var p = P(), o = {
      responsive: true, maintainAspectRatio: false, devicePixelRatio: DPR(),
      animation: { duration: 1500, easing: 'easeOutQuart', onProgress: animProg.onProgress, onComplete: animProg.onComplete },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: p.tipBg, titleColor: p.tipTx, bodyColor: p.tipTx, borderColor: 'rgba(212,175,55,.45)', borderWidth: 1, padding: 12, cornerRadius: 10, boxPadding: 5, usePointStyle: true, titleFont: { family: 'Outfit, sans-serif', size: 12, weight: '700' }, bodyFont: { family: 'Inter, sans-serif', size: 11 } } }
    };
    return merge(o, extra || {});
  }
  function merge(a, b) { Object.keys(b).forEach(function (k) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && typeof b[k] !== 'function') a[k] = merge(a[k] && typeof a[k] === 'object' ? a[k] : {}, b[k]); else a[k] = b[k]; }); return a; }

  var centerPlugin = {
    id: 'sbCenter',
    afterDraw: function (chart) {
      if (!chart.options.sbCenter) return;
      var o = chart.options.sbCenter, prog = chart.$prog == null ? 1 : chart.$prog, a = chart.chartArea, ctx = chart.ctx, p = P();
      var cx = (a.left + a.right) / 2, cy = (a.top + a.bottom) / 2, shown = o.value * Math.min(1, prog * 1.2);
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = o.color; ctx.font = '800 30px Outfit, sans-serif'; ctx.fillText(nf(shown, 1) + '%', cx, cy - 8);
      ctx.fillStyle = p.mute; ctx.font = '600 10.5px Inter, sans-serif'; ctx.fillText('TERPAKAI', cx, cy + 16); ctx.restore();
    }
  };
  var valuePlugin = { // nilai di ujung bar horizontal (fade-in)
    id: 'sbValues',
    afterDatasetsDraw: function (chart) {
      var o = chart.options.sbValues; if (!o) return; var prog = chart.$prog == null ? 1 : chart.$prog; if (prog < .7) return;
      var ctx = chart.ctx, p = P(), meta = chart.getDatasetMeta(0);
      ctx.save(); ctx.globalAlpha = Math.min(1, (prog - .7) / .3); ctx.font = '700 10.5px Inter, sans-serif'; ctx.fillStyle = p.tipTx; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      meta.data.forEach(function (el, i) { ctx.fillText(o.labels[i], el.x + 8, el.y); }); ctx.restore();
    }
  };
  var crossPlugin = {
    id: 'sbCross',
    afterDraw: function (chart) {
      if (!chart.options.sbCross) return; var t = chart.tooltip; if (!t || !t.getActiveElements || !t.getActiveElements().length) return;
      var x = t.getActiveElements()[0].element.x, a = chart.chartArea, ctx = chart.ctx;
      ctx.save(); ctx.strokeStyle = 'rgba(212,175,55,.55)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.restore();
    }
  };
  var fullPlugin = { // penanda titik "penuh" pada grafik proyeksi
    id: 'sbFull',
    afterDatasetsDraw: function (chart) {
      var o = chart.options.sbFull; if (!o) return; var prog = chart.$prog == null ? 1 : chart.$prog; if (prog < .85) return;
      var x = chart.scales.x.getPixelForValue(o.x), y = chart.scales.y.getPixelForValue(o.y), ctx = chart.ctx, p = P();
      ctx.save(); ctx.globalAlpha = Math.min(1, (prog - .85) / .15);
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = C.red; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = p.tipBg; ctx.stroke();
      ctx.font = '700 10.5px Inter, sans-serif'; var t = 'Penuh ≈ ' + o.label, tw = ctx.measureText(t).width + 16, bx = Math.min(x - tw / 2, chart.chartArea.right - tw), by = y + 14;
      ctx.fillStyle = p.tipBg; ctx.strokeStyle = C.red; ctx.lineWidth = 1; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, tw, 20, 9); else ctx.rect(bx, by, tw, 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.red; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, bx + 8, by + 10.5); ctx.restore();
    }
  };

  /* ---------- 1) gauge ---------- */
  function buildGauge() {
    var d = S.d, p = P(), col = levelColor(d.persen), used = Math.max(d.dbBytes, d.limitBytes * 0.012);
    S.charts.gauge = new Chart($('sb-gauge'), {
      type: 'doughnut',
      data: { labels: ['Terpakai', 'Sisa'], datasets: [{ data: [used, Math.max(0, d.limitBytes - used)], backgroundColor: [col, p.free], borderWidth: 0, borderRadius: 14, spacing: 3, hoverOffset: 4 }] },
      options: baseOpts({ cutout: '80%',
        animation: { animateRotate: true, animateScale: true, duration: 1700 },
        plugins: { tooltip: { callbacks: { label: function (c) { return ' ' + c.label + ': ' + fb(c.dataIndex === 0 ? d.dbBytes : d.sisaBytes); } } } },
        sbCenter: { value: d.persen, color: col } }),
      plugins: [centerPlugin]
    });
  }

  /* ---------- 2) proyeksi sampai penuh ---------- */
  function monthLabel(offsetMonths) { var t = new Date(S.d.today + 'T00:00:00'); t.setDate(t.getDate() + Math.round(offsetMonths * 30.4375)); return BLN[t.getMonth()] + ' ' + t.getFullYear(); }
  function buildProjection() {
    var d = S.d, e = d.estimasi, MB = 1048576, used = d.dbBytes / MB, limit = d.limitBytes / MB, rate = e.perDay * 30.4375 / MB; // MB per bulan
    var fullM = e.sisaBulan, H = fullM == null ? 36 : Math.max(12, Math.min(120, Math.ceil(fullM * 1.12 + 2)));
    var step = H > 60 ? 3 : (H > 24 ? 2 : 1), proj = [], x;
    for (x = 0; x <= H; x += step) proj.push({ x: x, y: Math.min(limit * 1.06, used + rate * x) });
    var hist = (d.history || []).map(function (r) { var off = -((new Date(d.today + 'T00:00:00') - new Date(r.day + 'T00:00:00')) / 86400000) / 30.4375; return { x: off, y: r.db_bytes / MB }; });
    var p = P(), ds = [];
    if (hist.length >= 2) ds.push({ label: 'Riwayat aktual', data: hist, borderColor: C.cyan, backgroundColor: 'rgba(6,182,212,.18)', borderWidth: 3, pointRadius: 3, pointBackgroundColor: C.cyan, tension: .3, fill: true });
    ds.push({ label: 'Proyeksi (pola data sama)', data: proj, borderColor: function (c) { return hGrad(c.chart, C.gold, C.red); }, borderWidth: 3.2, borderDash: [], pointRadius: 0, pointHoverRadius: 6, tension: 0, fill: true,
      backgroundColor: function (c) { return vGrad(c.chart, 'rgba(212,175,55,.30)', 'rgba(212,175,55,0)'); } });
    ds.push({ label: 'Batas paket ' + nf(limit, 0) + ' MB', data: [{ x: hist.length >= 2 ? hist[0].x : 0, y: limit }, { x: H, y: limit }], borderColor: C.red, borderDash: [7, 5], borderWidth: 1.8, pointRadius: 0, fill: false });
    var opts = baseOpts({
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      layout: { padding: { top: 12, right: 14, bottom: 2 } },
      plugins: { legend: { display: true, position: 'top', align: 'end', labels: { color: p.txt, usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 14, font: { family: 'Inter, sans-serif', size: 10.5, weight: '600' } } },
        tooltip: { callbacks: { title: function (it) { return monthLabel(it[0].parsed.x); }, label: function (c) { return ' ' + c.dataset.label + ': ' + nf(c.parsed.y, 1) + ' MB'; } } } },
      scales: {
        x: { type: 'linear', min: hist.length >= 2 ? hist[0].x : 0, max: H, grid: { display: false }, border: { display: false }, ticks: { color: p.txt, maxTicksLimit: 8, font: { family: 'Inter, sans-serif', size: 10.5, weight: '600' }, callback: function (v) { return v === 0 ? 'Sekarang' : monthLabel(v); } } },
        y: { min: 0, max: limit * 1.08, grid: { color: p.grid, drawTicks: false }, border: { display: false }, ticks: { color: p.txt, padding: 8, font: { size: 10.5 }, callback: function (v) { return nf(v, 0) + ' MB'; } } }
      },
      sbCross: true
    });
    if (fullM != null && fullM <= H) opts.sbFull = { x: fullM, y: limit, label: idDate(e.tanggalPenuh) };
    S.charts.proj = new Chart($('sb-proj'), { type: 'line', data: { datasets: ds }, options: opts, plugins: [crossPlugin, fullPlugin] });
  }

  /* ---------- 3) per menu (bar horizontal) ---------- */
  function buildMenu() {
    var d = S.d, p = P(), rows = d.menus.slice(0, 10), vals = rows.map(function (m) { return m.bytes / 1024; });
    S.charts.menu = new Chart($('sb-menu'), {
      type: 'bar',
      data: { labels: rows.map(function (m) { return m.menu.length > 34 ? m.menu.slice(0, 32) + '…' : m.menu; }), datasets: [{ data: vals, borderRadius: 8, borderSkipped: false, barPercentage: .66, categoryPercentage: .9,
        backgroundColor: function (c) { var col = PAL[c.dataIndex % PAL.length]; return hGrad(c.chart, col + '55', col); } }] },
      options: baseOpts({ indexAxis: 'y', layout: { padding: { right: 70 } },
        animation: { duration: 1500, delay: function (c) { return c.type === 'data' ? c.dataIndex * 110 : 0; }, onProgress: animProg.onProgress, onComplete: animProg.onComplete },
        plugins: { tooltip: { callbacks: { label: function (c) { var m = rows[c.dataIndex]; return [' ' + fb(m.bytes) + ' · ' + nf(m.keys, 0) + ' snapshot', ' +' + fb(m.growthPerDay) + '/hari']; } } } },
        scales: { x: { grid: { color: p.grid }, border: { display: false }, ticks: { display: false } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: p.txt, font: { family: 'Inter, sans-serif', size: 10.5, weight: '600' } } } },
        sbValues: { labels: rows.map(function (m) { return fb(m.bytes); }) } }),
      plugins: [valuePlugin]
    });
  }

  /* ---------- 4) per departemen (doughnut) ---------- */
  function buildWs() {
    var d = S.d, p = P(), rows = d.departemen.slice(0, 8);
    S.charts.ws = new Chart($('sb-ws'), {
      type: 'doughnut',
      data: { labels: rows.map(function (r) { return wsLabel(r.ws); }), datasets: [{ data: rows.map(function (r) { return r.bytes; }), backgroundColor: rows.map(function (r, i) { return PAL[i % PAL.length]; }), borderColor: dark() ? '#1c1c2a' : '#fff', borderWidth: 3, borderRadius: 6, hoverOffset: 8 }] },
      options: baseOpts({ cutout: '62%', animation: { animateRotate: true, duration: 1600 },
        plugins: { legend: { display: true, position: 'right', labels: { color: p.txt, usePointStyle: true, boxWidth: 8, boxHeight: 8, padding: 10, font: { family: 'Inter, sans-serif', size: 10.5, weight: '600' } } },
          tooltip: { callbacks: { label: function (c) { return ' ' + fb(c.raw) + ' · ' + nf(c.raw / d.snapshotBytes * 100, 1) + '%'; } } } } })
    });
  }

  /* ---------- teks / tabel ---------- */
  function headline(e) {
    if (e.sisaHari == null) return { big: 'Stabil', sub: 'Tidak ada pertumbuhan terdeteksi', tone: C.green };
    var h = e.sisaHari;
    if (h <= 0) return { big: 'Penuh', sub: 'Kapasitas sudah habis', tone: C.red };
    var big = h >= 730 ? nf(h / 365.25, 1) + ' tahun' : (h >= 90 ? nf(h / 30.4375, 1) + ' bulan' : nf(h, 0) + ' hari');
    return { big: big, sub: '≈ ' + nf(h / 365.25, 2) + ' tahun · ' + nf(h / 30.4375, 1) + ' bulan · ' + nf(h, 0) + ' hari', tone: h < 180 ? C.red : h < 730 ? C.amber : C.green };
  }
  function render() {
    var d = S.d, e = d.estimasi, hl = headline(e), col = levelColor(d.persen);
    d.snapshotBytes = d.menus.reduce(function (a, m) { return a + m.bytes; }, 0) || 1;
    $('sb-plan').textContent = d.plan; $('sb-updated').textContent = 'Diperbarui ' + new Date(d.generatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + (d.dariCache ? ' · cache' : '');
    $('sb-used').style.color = col; countUp($('sb-used'), d.dbBytes / 1048576, 2, ' MB');
    $('sb-free').textContent = fb(d.sisaBytes); $('sb-limit').textContent = nf(d.limitMB, 0) + ' MB';
    $('sb-app').textContent = fb(d.appBytes); $('sb-sys').textContent = fb(Math.max(0, d.dbBytes - d.appBytes)); $('sb-rows').textContent = nf(d.snapshotRows, 0);
    $('sb-est-big').textContent = hl.big; $('sb-est-big').style.color = hl.tone; $('sb-est-sub').textContent = hl.sub;
    $('sb-est-date').textContent = e.tanggalPenuh ? 'Perkiraan penuh: ' + idDate(e.tanggalPenuh) : 'Belum ada perkiraan tanggal penuh';
    $('sb-rate').textContent = '+' + fb(e.perDay) + ' / hari  (≈ ' + fb(e.perDay * 30.4375) + ' / bulan · ' + fb(e.perDay * 365.25) + ' / tahun)';
    $('sb-method').innerHTML = e.metode === 'riwayat' ? 'Dasar: <b>riwayat ukuran ' + nf(e.riwayatHari, 0) + ' hari</b> (regresi linear)' : 'Dasar: <b>pola data tersimpan saat ini</b>' + (e.perDayRiwayat ? '' : ' · riwayat ukuran masih ' + nf(e.riwayatHari || 0, 0) + ' hari (dicatat tiap sync harian)');
    $('sb-menu-body').innerHTML = d.menus.map(function (m, i) {
      var pc = m.bytes / d.snapshotBytes * 100;
      return '<tr><td><span class="sb-dot" style="background:' + PAL[i % PAL.length] + '"></span><b>' + esc(m.menu) + '</b></td><td class="sb-jenis">' + m.jenis.map(function (j) { return '<code>' + esc(j) + '</code>'; }).join(' ') + '</td><td class="sb-n">' + nf(m.keys, 0) + '</td><td class="sb-n">' + fb(m.bytes) + '</td><td style="min-width:110px"><div class="sb-bar"><i style="width:' + Math.max(2, pc) + '%;background:' + PAL[i % PAL.length] + '"></i></div><span class="sb-n">' + nf(pc, 1) + '%</span></td><td class="sb-n">' + (m.growthPerDay > 0 ? '+' + fb(m.growthPerDay) : '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="sb-empty">Belum ada snapshot tersimpan</td></tr>';
    $('sb-no').innerHTML = d.tidakDisimpan.map(function (t) { return '<span class="sb-chip">' + esc(t) + '</span>'; }).join('');
    $('sb-tables').innerHTML = d.tables.map(function (t) { return '<tr><td><code>' + esc(t.name) + '</code></td><td class="sb-n">' + nf(t.rows, 0) + '</td><td class="sb-n">' + fb(t.table_bytes) + '</td><td class="sb-n">' + fb(t.index_bytes) + '</td><td class="sb-n"><b>' + fb(t.total_bytes) + '</b></td></tr>'; }).join('');
    $('sb-limit-input').value = d.limitMB; $('sb-admin-box').style.display = d.isSuperAdmin ? 'flex' : 'none';
  }

  function destroy() { Object.keys(S.charts).forEach(function (k) { try { S.charts[k].destroy(); } catch (x) {} }); S.charts = {}; }
  function build() { if (!S.d || !w.Chart) return; destroy(); render(); buildGauge(); buildProjection(); buildMenu(); buildWs(); }

  function state(kind, msg) {
    var el = $('sb-state'); if (!el) return; el.style.display = kind ? 'flex' : 'none';
    if (kind === 'loading') el.innerHTML = '<div class="sb-spin"></div><div>Mengambil data penyimpanan Supabase…</div>';
    if (kind === 'error') el.innerHTML = '<div style="max-width:520px;text-align:center;line-height:1.55">' + esc(msg || 'Gagal memuat') + '</div><button class="btn-flat btn-flat-ghost" onclick="SbStorage.load(true)">Coba lagi</button>';
  }
  function load(force) {
    if (S.loading) return; S.loading = true; $('sb-card').style.display = 'flex'; state('loading');
    google.script.run.withSuccessHandler(function (res) {
      S.loading = false;
      if (!res || !res.success) {
        if (res && /Akses ditolak/.test(res.error || '')) { $('sb-card').style.display = 'none'; return; } // bukan Super Admin / TL -> sembunyikan
        return state('error', res && res.error);
      }
      S.d = res; state('');
      if (S.visible) build();
    }).withFailureHandler(function (e) { S.loading = false; state('error', e && e.message); }).getSupabaseStorageStats(S.actor, !!force);
  }
  function saveLimit() {
    var mb = Number($('sb-limit-input').value);
    google.script.run.withSuccessHandler(function (r) { if (!r || !r.success) { alert((r && r.error) || 'Gagal menyimpan'); return; } load(true); })
      .withFailureHandler(function (e) { alert(e && e.message); }).setSupabaseDbLimitMB(S.actor, mb);
  }
  function init(actorNik) {
    S.actor = actorNik || ''; var card = $('sb-card'); if (!card) return;
    if ('IntersectionObserver' in w) { S.observer = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !S.visible) { S.visible = true; if (S.d) build(); } }); }, { threshold: .1 }); S.observer.observe(card); } else S.visible = true;
    load(false);
  }
  w.SbStorage = { init: init, load: load, replay: function () { if (S.d) build(); }, saveLimit: saveLimit, rerender: function () { if (S.d) build(); }, _build: function (d) { S.d = d; S.visible = true; build(); }, _state: S };
})(window);
