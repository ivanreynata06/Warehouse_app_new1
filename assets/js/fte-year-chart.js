/*! fte-year-chart.js — Grafik perkembangan FTE per bulan (Januari–Desember)
 *  Butuh: Chart.js 4.x, elemen #fy-main #fy-ot #fy-prod, backend getFTETrendTahunan(tahun).
 *  Resolusi tinggi (devicePixelRatio >= 2), animasi bertahap, glow, label nilai, crosshair, tema gelap/terang. */
(function (w) {
  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var C = { gold: '#d4af37', gold2: '#f4d675', blue: '#3b82f6', blue2: '#1d4ed8', cyan: '#06b6d4', green: '#22c55e', red: '#ef4444', amber: '#f59e0b', purple: '#8b5cf6' };
  var S = { data: null, year: null, charts: {}, visible: false, loading: false, observer: null };

  function dark() { return !document.body.classList.contains('theme-light'); }
  function pal() {
    return dark()
      ? { txt: '#aab1c6', mute: '#7a8199', grid: 'rgba(255,255,255,.07)', tipBg: 'rgba(12,14,26,.96)', tipTx: '#eef0f8', dot: '#0d0d19', band: 'rgba(212,175,55,.08)', nodata: 'rgba(255,255,255,.04)' }
      : { txt: '#42506b', mute: '#6b7794', grid: 'rgba(16,26,48,.08)', tipBg: 'rgba(255,255,255,.98)', tipTx: '#101a30', dot: '#ffffff', band: 'rgba(212,175,55,.13)', nodata: 'rgba(16,26,48,.04)' };
  }
  function nf(v, d) { return (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function $(id) { return document.getElementById(id); }
  var DPR = function () { return Math.max(2, w.devicePixelRatio || 1); };

  /* ---------- helper warna ---------- */
  function vGrad(chart, c1, c2) {
    var a = chart.chartArea; if (!a) return c1;
    var g = chart.ctx.createLinearGradient(0, a.top, 0, a.bottom); g.addColorStop(0, c1); g.addColorStop(1, c2); return g;
  }
  function hGrad(chart, c1, c2) {
    var a = chart.chartArea; if (!a) return c1;
    var g = chart.ctx.createLinearGradient(a.left, 0, a.right, 0); g.addColorStop(0, c1); g.addColorStop(1, c2); return g;
  }

  /* ---------- animasi garis progresif (digambar titik demi titik) ---------- */
  function progressive(scaleId, total, n) {
    var step = total / Math.max(1, n);
    return {
      x: { type: 'number', easing: 'linear', duration: step, from: NaN, delay: function (ctx) { if (ctx.type !== 'data' || ctx.xStarted) return 0; ctx.xStarted = true; return ctx.index * step; } },
      y: {
        type: 'number', easing: 'linear', duration: step,
        from: function (ctx) {
          var sc = ctx.chart.scales[scaleId];
          if (ctx.index === 0) return sc.getPixelForValue(sc.min);
          var prev = ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1];
          var y = prev ? prev.getProps(['y'], true).y : NaN;
          return isNaN(y) ? sc.getPixelForValue(sc.min) : y;
        },
        delay: function (ctx) { if (ctx.type !== 'data' || ctx.yStarted) return 0; ctx.yStarted = true; return ctx.index * step; }
      }
    };
  }

  // label bergaris dengan latar (supaya terbaca di atas teks/grafik lain)
  function pill(ctx, text, xRight, yBottom, color) {
    var P = pal(); ctx.save(); ctx.font = '700 9.5px Inter, sans-serif';
    var tw = ctx.measureText(text).width, pw = tw + 14, ph = 17, x = xRight - pw, y = yBottom - ph;
    ctx.fillStyle = P.tipBg; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, pw, ph, 8); else ctx.rect(x, y, pw, ph);
    ctx.fill(); ctx.stroke(); ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(text, xRight - 7, y + ph / 2 + .5); ctx.restore();
  }

  /* ---------- plugin: sorotan bulan ini + bulan tanpa data ---------- */
  var bandPlugin = {
    id: 'fyBand',
    beforeDatasetsDraw: function (chart) {
      var D = S.data; if (!D) return;
      var x = chart.scales.x, a = chart.chartArea, ctx = chart.ctx, P = pal(), cw = (a.right - a.left) / 12, now = new Date();
      ctx.save();
      D.bulan.forEach(function (b, i) {
        var cx = x.getPixelForValue(i);
        if (!b.adaData && !b.berjalan) { // bulan lampau tanpa data lembur
          ctx.fillStyle = P.nodata; ctx.fillRect(cx - cw / 2 + 2, a.top, cw - 4, a.bottom - a.top);
          if (cw < 42) return;
          ctx.translate(cx, (a.top + a.bottom) / 2); ctx.rotate(-Math.PI / 2);
          ctx.fillStyle = P.mute; ctx.font = '500 10px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.globalAlpha = .6; ctx.fillText('belum ada data lembur', 0, 0); ctx.globalAlpha = 1;
          ctx.rotate(Math.PI / 2); ctx.translate(-cx, -(a.top + a.bottom) / 2);
        }
        if (D.tahun === now.getFullYear() && i === now.getMonth()) { // bulan berjalan
          ctx.fillStyle = P.band; ctx.fillRect(cx - cw / 2 + 1, a.top, cw - 2, a.bottom - a.top);
          ctx.fillStyle = C.gold; ctx.font = '700 9px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText('BULAN INI', cx, a.top + 4);
        }
      });
      ctx.restore();
    }
  };

  /* ---------- plugin: glow pada garis ---------- */
  var glowPlugin = {
    id: 'fyGlow',
    beforeDatasetDraw: function (chart, args) { var d = chart.data.datasets[args.index]; if (d.glow) { chart.ctx.save(); chart.ctx.shadowColor = d.glow; chart.ctx.shadowBlur = 18; chart.ctx.shadowOffsetY = 4; } },
    afterDatasetDraw: function (chart, args) { var d = chart.data.datasets[args.index]; if (d.glow) chart.ctx.restore(); }
  };

  /* ---------- plugin: label nilai (fade-in setelah animasi) ---------- */
  var labelPlugin = {
    id: 'fyLabels',
    afterDatasetsDraw: function (chart) {
      var prog = chart.$prog == null ? 1 : chart.$prog; if (prog < .72) return;
      var alpha = Math.min(1, (prog - .72) / .28), ctx = chart.ctx, P = pal();
      chart.data.datasets.forEach(function (ds, di) {
        if (!ds.fyLabel) return;
        var meta = chart.getDatasetMeta(di); if (meta.hidden) return;
        meta.data.forEach(function (el, i) {
          var v = ds.data[i]; if (v == null || isNaN(v)) return;
          var pos = el.tooltipPosition ? el.tooltipPosition(true) : { x: el.x, y: el.y };
          ctx.save(); ctx.globalAlpha = alpha;
          ctx.font = '700 ' + (ds.fyLabel.size || 11) + 'px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillStyle = ds.fyLabel.color || P.tipTx; ctx.fillText(ds.fyLabel.fmt(v), pos.x, pos.y - (ds.fyLabel.dy || 9)); ctx.restore();
        });
      });
    }
  };

  /* ---------- plugin: crosshair saat hover ---------- */
  var crossPlugin = {
    id: 'fyCross',
    afterDraw: function (chart) {
      var t = chart.tooltip; if (!t || !t.getActiveElements || !t.getActiveElements().length) return;
      var x = t.getActiveElements()[0].element.x, a = chart.chartArea, ctx = chart.ctx;
      ctx.save(); ctx.strokeStyle = 'rgba(212,175,55,.55)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.restore();
    }
  };

  /* ---------- opsi dasar ---------- */
  function baseOptions(extra) {
    var P = pal();
    var o = {
      responsive: true, maintainAspectRatio: false, devicePixelRatio: DPR(),
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 26, right: 8, left: 4, bottom: 2 } },
      animation: {
        duration: 1700, easing: 'easeOutQuart',
        delay: function (ctx) { return (ctx.type === 'data' && ctx.mode === 'default') ? ctx.dataIndex * 95 + ctx.datasetIndex * 140 : 0; },
        onProgress: function (a) { a.chart.$prog = a.currentStep / (a.numSteps || 1); },
        onComplete: function (a) { a.chart.$prog = 1; }
      },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { color: P.txt, usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { family: 'Inter, sans-serif', size: 11, weight: '600' } } },
        tooltip: {
          backgroundColor: P.tipBg, titleColor: P.tipTx, bodyColor: P.tipTx, borderColor: 'rgba(212,175,55,.45)', borderWidth: 1,
          padding: 13, cornerRadius: 12, boxPadding: 6, usePointStyle: true, caretSize: 7,
          titleFont: { family: 'Outfit, sans-serif', size: 13, weight: '700' }, bodyFont: { family: 'Inter, sans-serif', size: 11.5 },
          callbacks: { title: function (it) { return MONTHS[it[0].dataIndex] + ' ' + (S.data ? S.data.tahun : ''); } }
        }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: P.txt, font: { family: 'Inter, sans-serif', size: 11.5, weight: '600' } } }
      }
    };
    return deepMerge(o, extra || {});
  }
  function deepMerge(a, b) {
    Object.keys(b).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && typeof b[k] !== 'function') { a[k] = deepMerge(a[k] && typeof a[k] === 'object' ? a[k] : {}, b[k]); } else a[k] = b[k];
    });
    return a;
  }
  function yScale(extra) {
    var P = pal();
    return deepMerge({ grid: { color: P.grid, drawTicks: false }, border: { display: false }, ticks: { color: P.txt, padding: 8, font: { family: 'Inter, sans-serif', size: 11 } }, title: { display: false, color: P.mute, font: { family: 'Inter, sans-serif', size: 10, weight: '600' } } }, extra || {});
  }

  /* ---------- data ---------- */
  function col(key) { return S.data.bulan.map(function (b) { return b.adaData ? b[key] : null; }); }
  function valid(arr) { return arr.filter(function (v) { return v != null && !isNaN(v); }); }

  /* ---------- 1) FTE utama: bar FTE lembur + garis Total FTE ---------- */
  function buildMain() {
    var D = S.data, P = pal(), total = col('totalFTE'), lembur = col('fteLembur'), kary = col('jumlahKaryawan');
    var tv = valid(total), lv = valid(lembur), kv = valid(kary);
    var yMin = tv.length ? Math.max(0, Math.floor(Math.min.apply(null, kv.concat(tv))) - 1) : 0;
    var yMax = tv.length ? Math.ceil(Math.max.apply(null, tv)) + 1 : 10;
    var y1Max = lv.length ? Math.max(Math.max.apply(null, lv) / 0.42, 0.5) : 1;
    S.charts.main = new Chart($('fy-main'), {
      data: {
        labels: MS,
        datasets: [
          { type: 'bar', label: 'FTE Lembur', data: lembur, yAxisID: 'y1', order: 3, borderRadius: { topLeft: 10, topRight: 10 }, borderSkipped: false, barPercentage: .5, categoryPercentage: .8,
            backgroundColor: function (c) { return vGrad(c.chart, C.gold2, 'rgba(212,175,55,.14)'); }, hoverBackgroundColor: C.gold2,
            fyLabel: { fmt: function (v) { return nf(v, 2); }, color: C.gold, size: 10.5, dy: 6 } },
          { type: 'line', label: 'Total FTE', data: total, yAxisID: 'y', order: 1, tension: .38, fill: true, borderWidth: 3.5, spanGaps: false,
            borderColor: function (c) { return hGrad(c.chart, C.cyan, C.blue); },
            backgroundColor: function (c) { return vGrad(c.chart, 'rgba(59,130,246,.34)', 'rgba(59,130,246,0)'); },
            pointRadius: 5.5, pointHoverRadius: 9, pointBorderWidth: 3, pointBackgroundColor: P.dot, pointBorderColor: C.blue, glow: 'rgba(59,130,246,.7)',
            animations: progressive('y', 1500, 12),
            fyLabel: { fmt: function (v) { return nf(v, 2); }, color: dark() ? '#9cc3ff' : '#1d4ed8', size: 11.5, dy: 12 } },
          { type: 'line', label: 'Karyawan Internal', data: kary, yAxisID: 'y', order: 2, borderWidth: 1.8, borderDash: [6, 5], borderColor: C.purple, pointRadius: 0, pointHoverRadius: 0, tension: 0, fill: false }
        ]
      },
      options: baseOptions({
        plugins: { tooltip: { callbacks: {
          label: function (c) { return ' ' + c.dataset.label + ': ' + nf(c.parsed.y, 2) + (c.dataset.label === 'Karyawan Internal' ? ' orang' : ' FTE'); },
          afterBody: function (it) { var b = D.bulan[it[0].dataIndex]; return b.adaData ? ['', '  Jam lembur Internal: ' + nf(b.jamLemburInternal, 1) + ' jam', '  Jam lembur OS: ' + nf(b.jamLemburOS, 1) + ' jam', '  Over Time: ' + nf(b.overtimePct, 2) + '%'] : ['', '  Belum ada data lembur']; }
        } } },
        scales: {
          y: yScale({ position: 'left', min: yMin, max: yMax, title: { display: true, text: 'Total FTE / Karyawan (orang)' }, ticks: { stepSize: (yMax - yMin) <= 14 ? 1 : undefined, callback: function (v) { return nf(v, 0); } } }),
          y1: yScale({ position: 'right', min: 0, max: y1Max, grid: { drawOnChartArea: false }, title: { display: true, text: 'FTE Lembur' }, ticks: { callback: function (v) { return nf(v, 1); } } })
        }
      }),
      plugins: [bandPlugin, glowPlugin, labelPlugin, crossPlugin]
    });
  }

  /* ---------- 2) Over Time % ---------- */
  function buildOT() {
    var D = S.data, P = pal(), T = D.target.overtimePctMax, ot = col('overtimePct'), ov = valid(ot);
    var yMax = Math.max(T * 1.6, ov.length ? Math.max.apply(null, ov) * 1.3 : T * 1.6);
    var tgtPlugin = {
      id: 'fyZone',
      beforeDatasetsDraw: function (chart) {
        var y = chart.scales.y, a = chart.chartArea, py = y.getPixelForValue(T), ctx = chart.ctx;
        ctx.save(); ctx.fillStyle = 'rgba(239,68,68,.07)'; ctx.fillRect(a.left, a.top, a.right - a.left, Math.max(0, py - a.top));
        ctx.restore(); pill(ctx, 'TARGET < ' + T + '%', a.right - 4, py - 3, C.red);
      }
    };
    S.charts.ot = new Chart($('fy-ot'), {
      type: 'line',
      data: {
        labels: MS,
        datasets: [
          { label: 'Over Time %', data: ot, tension: .38, fill: true, borderWidth: 3.2, spanGaps: false,
            borderColor: C.green, segment: { borderColor: function (c) { return (c.p1.parsed.y > T) ? C.red : C.green; } },
            backgroundColor: function (c) { return vGrad(c.chart, 'rgba(34,197,94,.30)', 'rgba(34,197,94,0)'); },
            pointRadius: 5, pointHoverRadius: 9, pointBorderWidth: 3, pointBackgroundColor: P.dot,
            pointBorderColor: function (c) { var v = c.raw; return v > T ? C.red : C.green; },
            glow: 'rgba(34,197,94,.55)', animations: progressive('y', 1400, 12),
            fyLabel: { fmt: function (v) { return nf(v, 2) + '%'; }, color: P.tipTx, size: 10.5, dy: 12 } },
          { label: 'Target', data: MS.map(function () { return T; }), borderColor: C.red, borderDash: [6, 5], borderWidth: 1.6, pointRadius: 0, pointHoverRadius: 0, fill: false }
        ]
      },
      options: baseOptions({
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + nf(c.parsed.y, 2) + '%'; }, afterBody: function (it) { var b = D.bulan[it[0].dataIndex]; return b.adaData ? ['', '  ' + (b.overtimePct <= T ? '✔ Dalam target' : '✖ Melebihi target')] : []; } } } },
        scales: { x: { offset: true }, y: yScale({ min: 0, max: yMax, ticks: { maxTicksLimit: 7, callback: function (v) { return nf(v, 0) + '%'; } } }) }
      }),
      plugins: [bandPlugin, tgtPlugin, glowPlugin, labelPlugin, crossPlugin]
    });
  }

  /* ---------- 3) Produktivitas Ton/FTE ---------- */
  function buildProd() {
    var D = S.data, P = pal(), T = D.target.produktivitasTonFTE, pr = D.bulan.map(function (b) { return b.adaData ? b.produktivitasTonFTE : null; }), pv = valid(pr);
    var yMax = Math.max(T, pv.length ? Math.max.apply(null, pv) : 0) * 1.25 || 10;
    var lineT = { id: 'fyTarget', afterDatasetsDraw: function (chart) {
      var y = chart.scales.y, a = chart.chartArea, ctx = chart.ctx, py = y.getPixelForValue(T);
      ctx.save(); ctx.strokeStyle = C.gold; ctx.setLineDash([7, 5]); ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
      ctx.restore(); pill(ctx, 'TARGET ' + nf(T, 1) + ' Ton/FTE', a.right - 4, py - 3, C.gold); } };
    S.charts.prod = new Chart($('fy-prod'), {
      type: 'bar',
      data: { labels: MS, datasets: [ {
        label: 'Produktivitas (Ton/FTE)', data: pr, borderRadius: { topLeft: 12, topRight: 12 }, borderSkipped: false, barPercentage: .62, categoryPercentage: .85,
        backgroundColor: function (c) { var ok = c.raw != null && c.raw >= T; return ok ? vGrad(c.chart, '#4ade80', 'rgba(34,197,94,.30)') : vGrad(c.chart, '#fbbf24', 'rgba(245,158,11,.28)'); },
        fyLabel: { fmt: function (v) { return nf(v, 1); }, color: P.tipTx, size: 10.5, dy: 6 }
      } ] },
      options: baseOptions({
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ' ' + nf(c.parsed.y, 2) + ' Ton/FTE'; }, afterBody: function (it) { var v = it[0].parsed.y; return ['', '  ' + (v >= T ? '✔ Mencapai target' : '✖ Di bawah target') + ' (' + nf(T, 1) + ')']; } } } },
        scales: { y: yScale({ min: 0, max: yMax, ticks: { maxTicksLimit: 7, callback: function (v) { return nf(v, 0); } } }) }
      }),
      plugins: [bandPlugin, lineT, labelPlugin, crossPlugin]
    });
  }

  /* ---------- KPI + count-up ---------- */
  function countUp(el, to, dec, suffix) {
    if (!el) return; var t0 = null, dur = 1300;
    function step(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 4); el.textContent = nf(to * e, dec) + (suffix || ''); if (p < 1) requestAnimationFrame(step); else el.textContent = nf(to, dec) + (suffix || ''); }
    requestAnimationFrame(step);
  }
  function renderKpi() {
    var D = S.data, rows = D.bulan.filter(function (b) { return b.adaData; });
    var T = D.target.overtimePctMax;
    if (!rows.length) { ['fy-k1', 'fy-k2', 'fy-k3', 'fy-k4'].forEach(function (id) { $(id).textContent = '—'; }); ['fy-k1s', 'fy-k2s', 'fy-k3s', 'fy-k4s'].forEach(function (id) { $(id).textContent = 'Belum ada data lembur'; }); return; }
    var avg = rows.reduce(function (a, b) { return a + b.totalFTE; }, 0) / rows.length;
    var top = rows.reduce(function (m, b) { return b.totalFTE > m.totalFTE ? b : m; }, rows[0]);
    var avgOT = rows.reduce(function (a, b) { return a + b.overtimePct; }, 0) / rows.length;
    var okN = rows.filter(function (b) { return b.overtimePct <= T; }).length;
    countUp($('fy-k1'), avg, 2, ''); $('fy-k1s').textContent = 'rata-rata dari ' + rows.length + ' bulan berdata';
    countUp($('fy-k2'), top.totalFTE, 2, ''); $('fy-k2s').textContent = 'tertinggi · ' + MONTHS[top.bulan - 1];
    countUp($('fy-k3'), avgOT, 2, '%'); $('fy-k3s').textContent = avgOT <= T ? 'dalam target (< ' + T + '%)' : 'melebihi target (< ' + T + '%)';
    $('fy-k3').style.color = avgOT <= T ? C.green : C.red;
    countUp($('fy-k4'), okN, 0, ' / ' + rows.length); $('fy-k4s').textContent = 'bulan OT di bawah target';
  }

  /* ---------- siklus hidup ---------- */
  function destroy() { Object.keys(S.charts).forEach(function (k) { try { S.charts[k].destroy(); } catch (e) {} }); S.charts = {}; }
  function build() {
    if (!S.data || !w.Chart) return;
    destroy(); renderKpi();
    var hasAny = S.data.bulan.some(function (b) { return b.adaData; });
    $('fy-empty').style.display = hasAny ? 'none' : 'flex';
    $('fy-body').style.opacity = hasAny ? '1' : '.35';
    buildMain(); buildOT(); buildProd();
  }
  function showState(kind, msg) {
    var el = $('fy-state'); if (!el) return;
    el.className = 'fy-state ' + (kind || ''); el.style.display = kind ? 'flex' : 'none';
    if (kind === 'loading') el.innerHTML = '<div class="fy-spin"></div><div>Memuat grafik FTE ' + S.year + '…</div>';
    if (kind === 'error') el.innerHTML = '<div>Gagal memuat grafik: ' + (msg || 'koneksi bermasalah') + '</div><button class="fy-btn" onclick="FteYear.load()">Coba lagi</button>';
  }
  function load(year) {
    if (year) S.year = Number(year); if (!S.year) S.year = new Date().getFullYear();
    var sel = $('fy-tahun'); if (sel && Number(sel.value) !== S.year) sel.value = S.year;
    if (S.loading) return; S.loading = true; showState('loading');
    google.script.run.withSuccessHandler(function (res) {
      S.loading = false;
      if (!res || !res.success) return showState('error', res && res.error);
      S.data = res; showState('');
      if (S.visible) build();
    }).withFailureHandler(function (e) { S.loading = false; showState('error', e && e.message); }).getFTETrendTahunan(S.year);
  }
  function init(startYear) {
    S.year = Number(startYear) || new Date().getFullYear();
    var sel = $('fy-tahun');
    if (sel && !sel.options.length) { for (var y = S.year - 3; y <= S.year + 1; y++) { var o = document.createElement('option'); o.value = y; o.textContent = y; if (y === S.year) o.selected = true; sel.appendChild(o); } sel.onchange = function () { load(this.value); }; }
    var card = $('fy-card');
    if ('IntersectionObserver' in w && card) {
      S.observer = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !S.visible) { S.visible = true; if (S.data) build(); } }); }, { threshold: .15 });
      S.observer.observe(card);
    } else S.visible = true;
    load();
  }
  w.FteYear = { init: init, load: load, replay: function () { if (S.data) build(); }, rerender: function () { if (S.data) build(); }, setYear: function (y) { if (Number(y) !== S.year) load(y); }, _state: S, _build: function (d) { S.data = d; S.visible = true; build(); } };
})(window);
