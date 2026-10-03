/*!
 * rucika-profile.js
 * Profil tampilan Control Tower khusus workspace "cibitung_fitting_rucika".
 * Kategori: LEM | FITTING (Rutape & Container Box Scrap digabung ke FITTING; dari backend, lihat
 * getKategoriRucika() di backend/kode.gs). Untuk workspace lain file ini
 * tidak melakukan apa-apa.
 *
 * Dimuat di index.html SETELAH script utama (menimpa fungsi render global).
 */
(function () {
  var ws = '';
  try { ws = sessionStorage.getItem('wh_workspace') || ''; } catch (e) {}
  if (ws !== 'cibitung_fitting_rucika') return;
  window.IS_RUCIKA = true;

  // Kapasitas rak per kategori. ISI angka sebenarnya; 0 = belum diatur ("—").
  var RAK_CAP = { lem: 0, fitting: 0 };
  var KAT = [
    { k: 'lem',       nm: 'LEM',                 rak: 'Rak Lem',               col: '#3b9dff', cls: 'c-blue'   },
    { k: 'fitting',   nm: 'Fitting',             rak: 'Rak Fitting',           col: '#22d3a5', cls: 'c-green'  }
  ];

  function $(id) { return document.getElementById(id); }
  function sumKeys(o, keys) { return keys.reduce(function (a, k) { return a + ((o && o[k]) || 0); }, 0); }

  function buildLayout() {
    var strip = $('kpi-strip');
    if (strip) {
      var h = '';
      KAT.forEach(function (c) {
        h += '<div class="kpi-card ' + c.cls + '"><div class="kpi-label">Stok ' + c.nm + '</div>' +
             '<div class="kpi-val ' + c.cls + '" id="kpi-stok-' + c.k + '">—</div><div class="kpi-sub">kg hari ini</div>' +
             '<div class="kpi-delta flat" id="kpi-stok-' + c.k + '-delta">— vs bln lalu</div></div>';
      });
      h += '<div class="kpi-card c-amber"><div class="kpi-label">Outbound (Semua)</div><div class="kpi-val c-amber" id="kpi-out">—</div><div class="kpi-sub">kg periode ini</div><div class="kpi-delta flat" id="kpi-out-delta">— vs bln lalu</div></div>';
      h += '<div class="kpi-card c-cyan"><div class="kpi-label">Inbound (Semua)</div><div class="kpi-val c-cyan" id="kpi-in">—</div><div class="kpi-sub">kg periode ini</div><div class="kpi-delta flat" id="kpi-in-delta">— vs bln lalu</div></div>';
      KAT.forEach(function (c) {
        h += '<div class="kpi-card ' + c.cls + '"><div class="kpi-label">Utilisasi ' + c.rak + '</div>' +
             '<div class="kpi-val ' + c.cls + '" id="kpi-rak-' + c.k + '">—</div><div class="kpi-sub" id="kpi-rak-' + c.k + '-sub">kapasitas belum diatur</div></div>';
      });
      h += '<div class="kpi-card c-red"><div class="kpi-label">Loading Time Avg</div><div class="kpi-val c-red" id="kpi-loading-avg">—</div><div class="kpi-sub">mnt/pengiriman bln ini</div><div class="kpi-delta flat" id="kpi-loading-delta">— pengiriman</div></div>';
      strip.innerHTML = h;
    }
    var grid = document.querySelector('.stock-mini-grid');
    if (grid) {
      grid.innerHTML = KAT.map(function (c) {
        return '<div class="stock-mini" style="color:' + c.col + '"><div class="stock-mini-lbl">' + c.nm + '</div>' +
               '<div class="stock-mini-val" id="st-' + c.k + '">—</div><div class="stock-mini-sub">kg</div></div>';
      }).join('');
    }
    // Judul grafik IO
    document.querySelectorAll('.card-title').forEach(function (el) {
      if (/Outbound vs Inbound\s+—\s+PIPA/i.test(el.textContent)) el.lastChild.textContent = 'Outbound vs Inbound — LEM (kg)';
    });
    // Section kapasitas rak/kanban: sumber data Rucika belum ditentukan -> sembunyikan
    document.querySelectorAll('.sec-divider-label').forEach(function (el) {
      if (/Kapasitas Rak/i.test(el.textContent)) {
        var sec = el.closest('.sec-divider'), nxt = sec && sec.nextElementSibling;
        if (sec) sec.style.display = 'none';
        if (nxt && nxt.classList.contains('grid-gauge')) nxt.style.display = 'none';
      }
    });
  }

  window.renderKPIStrip = function () {
    if (window._dataStock && _dataStock.stock) {
      var t = _dataStock.stock.tonase || {};
      KAT.forEach(function (c) { setText('kpi-stok-' + c.k, fmt(t[c.k] || 0)); });
      KAT.forEach(function (c) {
        var cap = RAK_CAP[c.k];
        if (cap > 0) {
          setText('kpi-rak-' + c.k, Math.round(((_dataStock.stock.stok || {})[c.k] || 0) / cap * 100) + '%');
          setText('kpi-rak-' + c.k + '-sub', 'dari ' + fmt(cap));
        }
      });
    }
    var o = window._dataIOOut || {}, i = window._dataIOIn || {};
    setText('kpi-out', fmt(lemOf(o) + fitOf(o)));
    setText('kpi-in', fmt(lemOf(i) + fitOf(i)));
    if (window._dataLT) {
      var s = computeLTStats(_dataLT);
      setText('kpi-loading-avg', s.avgMin ? fmtMin(s.avgMin) : '—');
      setDelta('kpi-loading-delta', null);
      $('kpi-loading-delta').textContent = s.selesai + ' selesai dari ' + s.total;
    }
    var st = window._stockTrend || [], io = window._ioTrend || [];
    KAT.forEach(function (c) { setDelta('kpi-stok-' + c.k + '-delta', trendDelta(st, c.k)); });
    setDelta('kpi-out-delta', trendDelta(io.map(function (r) { return { v: r.outAll || 0 }; }), 'v'));
    setDelta('kpi-in-delta', trendDelta(io.map(function (r) { return { v: r.inAll || 0 }; }), 'v'));
  };

  window.renderStock = function () {
    if (!window._dataStock || !_dataStock.stock) return;
    var t = _dataStock.stock.tonase || {}, now = new Date();
    setText('stock-badge', now.getDate() + ' ' + BNAMES3[now.getMonth()] + ' ' + now.getFullYear());
    KAT.forEach(function (c) { setText('st-' + c.k, fmt(t[c.k] || 0)); });
    setText('st-total-global', fmt(t.total || 0) + ' kg');
  };

  window.loadStockTrend = function (months) {
    window._stockTrend = months.map(function (m) { return { label: m.label, lem: 0, fitting: 0, total: 0 }; });
    google.script.run.withSuccessHandler(function (resp) {
      if (!resp || !resp.success || !resp.results) { showChartError('chart-stock-trend', resp && resp.error); renderStockTrendChart(); return; }
      window._stockTrend = resp.results.map(function (d, idx) {
        var t = (d && d.stock && d.stock.tonase) || {};
        return { label: (months[idx] && months[idx].label) || '', lem: t.lem || 0, fitting: t.fitting || 0, total: t.total || 0 };
      });
      renderStockTrendChart();
    }).withFailureHandler(function (err) {
      showChartError('chart-stock-trend', err && err.message); renderStockTrendChart();
    }).getStockTrendBatch(months.map(function (m) { return { bulan: m.bulan, tahun: m.tahun }; }));
  };

  window.renderStockTrendChart = function () {
    if (!window._stockTrend || !_stockTrend.length) return;
    var ds = KAT.map(function (c, n) {
      return { type: 'bar', label: c.nm, data: _stockTrend.map(function (r) { return r[c.k]; }), backgroundColor: mkGrad(c.col), borderColor: c.col, borderWidth: 1.5, borderRadius: 6, order: 5 - n, barPercentage: .7 };
    });
    ds.push({ type: 'line', label: 'Total Tonase', data: _stockTrend.map(function (r) { return r.total; }), borderColor: '#5be3ff', borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: '#5be3ff', pointBorderColor: '#04101f', tension: .35, fill: false, order: 1 });
    buildChart('chart-stock-trend', 'bar', { labels: _stockTrend.map(function (r) { return r.label; }), datasets: ds },
      { plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + fmt(c.parsed.y) + ' kg'; } } } },
        scales: { x: { grid: { display: false } }, y: { ticks: { callback: function (v) { return fmt(v); } } } } });
    var lg = document.querySelector('#chart-stock-trend') && document.querySelector('#chart-stock-trend').closest('.card-body').querySelector('.legend');
    if (lg) lg.innerHTML = KAT.map(function (c) { return '<div class="leg-item"><div class="leg-sq" style="background:' + c.col + ';color:' + c.col + '"></div>' + c.nm + '</div>'; }).join('') +
      '<div class="leg-item"><div class="leg-dot" style="background:#5be3ff;color:#5be3ff"></div>Total Tonase</div>';
  };

  // IO: kiri = LEM, kanan = Fitting (Rutape & Container sudah masuk Fitting)
  // Respons getOutboundData / getInboundData membawa total di level atas sebagai
  // { pipa, fitting, ... } (pipa = LEM untuk Rucika) dan rinciannya di .outbound/.inbound.
  // Dulu kode ini membaca o.lem di level atas yang TIDAK ADA, sehingga grafik LEM selalu 0
  // setelah Refresh. lemOf() membaca semua kemungkinan lokasinya.
  function lemOf(o) {
    if (!o) return 0;
    if (o.lem != null) return Number(o.lem) || 0;
    if (o.pipa != null) return Number(o.pipa) || 0;
    var x = o.outbound || o.inbound;
    return (x && Number(x.lem)) || 0;
  }
  function fitOf(o) {
    if (!o) return 0;
    if (o.fitting != null) return Number(o.fitting) || 0;
    var x = o.outbound || o.inbound;
    return (x && Number(x.fitting)) || 0;
  }
  function nonFit(o) { return lemOf(o); }
  window.loadIOTrend = function (months) {
    window._ioTrend = months.map(function (m) { return { label: m.label, outPipa: 0, inPipa: 0, outFit: 0, inFit: 0, outAll: 0, inAll: 0 }; });
    google.script.run.withSuccessHandler(function (resp) {
      if (!resp || !resp.success || !resp.results) {
        showChartError('chart-io-pipa', resp && resp.error); showChartError('chart-io-fitting', resp && resp.error); renderIOTrendCharts(); return;
      }
      window._ioTrend = resp.results.map(function (pair, idx) {
        var o = (pair && pair.out) || {}, n = (pair && pair.in) || {};
        return { label: (months[idx] && months[idx].label) || '', outPipa: nonFit(o), inPipa: nonFit(n), outFit: fitOf(o), inFit: fitOf(n),
                 outAll: lemOf(o) + fitOf(o), inAll: lemOf(n) + fitOf(n) };
      });
      renderIOTrendCharts();
    }).withFailureHandler(function (err) {
      showChartError('chart-io-pipa', err && err.message); showChartError('chart-io-fitting', err && err.message); renderIOTrendCharts();
    }).getIOTrendBatch(months.map(function (m) { return { bulan: m.bulan, tahun: m.tahun }; }));
  };

  window.renderIOTrendCharts = function () {
    if (!window._ioTrend || !_ioTrend.length) return;
    var labels = _ioTrend.map(function (r) { return r.label; });
    var opt = { plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { label: function (c) { return ' ' + c.dataset.label + ': ' + fmt(c.parsed.y) + ' kg'; } } } },
                scales: { x: { grid: { display: false } }, y: { ticks: { callback: function (v) { return fmt(v); } } } } };
    function ds(nmOut, nmIn, kOut, kIn, c1, c2) {
      return [
        { type: 'bar', label: nmOut, data: _ioTrend.map(function (r) { return r[kOut]; }), backgroundColor: mkGrad(c1), borderColor: c1, borderWidth: 1.5, borderRadius: 6, order: 2, barPercentage: .6 },
        { type: 'line', label: nmIn, data: _ioTrend.map(function (r) { return r[kIn]; }), borderColor: c2, borderWidth: 2.5, pointRadius: 4, pointBackgroundColor: c2, pointBorderColor: '#04101f', tension: .35, fill: false, order: 1 }
      ];
    }
    buildChart('chart-io-pipa', 'bar', { labels: labels, datasets: ds('Outbound LEM', 'Inbound LEM', 'outPipa', 'inPipa', '#ffb020', '#00d4ff') }, opt);
    buildChart('chart-io-fitting', 'bar', { labels: labels, datasets: ds('Outbound Fitting', 'Inbound Fitting', 'outFit', 'inFit', '#a78bfa', '#22d3a5') }, opt);
  };

  window.renderIO = function () {
    var o = window._dataIOOut || {}, n = window._dataIOIn || {};
    var outP = lemOf(o), inP = lemOf(n), outF = fitOf(o), inF = fitOf(n);
    setText('io-pipa-badge', 'Out: ' + fmt(outP) + ' | In: ' + fmt(inP) + ' kg');
    setText('io-fit-badge', 'Out: ' + fmt(outF) + ' | In: ' + fmt(inF) + ' kg');
    var np = $('io-pipa-notif'), nf = $('io-fit-notif');
    if (np) { if (outP > inP * 1.15) { np.style.display = 'flex'; np.textContent = '⚠️ Outbound LEM (' + fmt(outP) + ' kg) melebihi Inbound (' + fmt(inP) + ' kg)'; } else np.style.display = 'none'; }
    if (nf) { if (outF > inF * 1.15) { nf.style.display = 'flex'; nf.textContent = '⚠️ Outbound Fitting (' + fmt(outF) + ' kg) melebihi Inbound (' + fmt(inF) + ' kg)!'; } else nf.style.display = 'none'; }
  };

  // Notifikasi "Persiapan Pipa / Rak Pipa" adalah konsep Fitting Import (target PPR),
  // tidak relevan untuk Rucika -> buang dari strip notifikasi.
  if (typeof window.renderNotifs === 'function') {
    var _rn = window.renderNotifs;
    window.renderNotifs = function () {
      _rn.apply(this, arguments);
      document.querySelectorAll('#notif-strip .notif-item').forEach(function (el) {
        if (/Persiapan Pipa|Rak Pipa|Rak Fitting|Box Fitting/i.test(el.textContent)) el.remove();
      });
    };
  }
  // Rekap muatan per PIC (target persiapan Pipa & Fitting PPR) khusus Fitting Import
  var rm = document.getElementById('section-rekap-muatan'); if (rm) rm.style.display = 'none';

  buildLayout();
})();
