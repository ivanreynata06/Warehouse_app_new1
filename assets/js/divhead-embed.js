/*! divhead-embed.js -- efek 3D/animasi + keterbacaan grafik utk Control Tower versi Divisi Head
 *  (hanya jalan di iframe ?embed=1&dhws=...; dimuat oleh auth-guard.js). Tidak mengubah data/logika dashboard. */
(function () {
  'use strict';
  if (!document.documentElement.classList.contains('dh-embed')) return;
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  // Selalu mode gelap (konsisten dgn rangka Divisi Head)
  try { document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}

  // Grafik lebih terbaca: font lebih besar, warna kisi lembut, animasi halus
  function tuneCharts() {
    var C = window.Chart; if (!C || !C.defaults) return false;
    try {
      C.defaults.font.family = "'Plus Jakarta Sans','Inter',system-ui,sans-serif";
      C.defaults.font.size = 12;
      C.defaults.color = '#a3b0cf';
      C.defaults.borderColor = 'rgba(150,172,255,.1)';
      if (!REDUCE) { C.defaults.animation = C.defaults.animation || {}; C.defaults.animation.duration = 900; C.defaults.animation.easing = 'easeOutQuart'; }
      if (C.defaults.plugins && C.defaults.plugins.tooltip) {
        var t = C.defaults.plugins.tooltip; t.padding = 12; t.cornerRadius = 12; t.backgroundColor = 'rgba(12,19,38,.96)'; t.borderColor = 'rgba(243,185,77,.5)'; t.borderWidth = 1; t.titleFont = { size: 13, weight: '700' }; t.bodyFont = { size: 12.5 };
      }
      if (C.defaults.plugins && C.defaults.plugins.legend && C.defaults.plugins.legend.labels) C.defaults.plugins.legend.labels.font = { size: 12.5 };
    } catch (e) {}
    registerPremium();
    return true;
  }

  // Plugin grafik premium (hanya tampilan; data/logika dashboard tidak disentuh):
  //  - batang membulat, garis halus (kurva) dgn area gradien lembut, donat bercelah & membulat
  //  - animasi masuk berurutan per data + gerak halus saat hover
  var _reg = false;
  function registerPremium() {
    var C = window.Chart; if (_reg || !C || !C.register) return; _reg = true;
    try {
      if (!REDUCE) C.defaults.animation.delay = function (c) { return (c.type === 'data' && c.mode === 'default') ? c.dataIndex * 55 + c.datasetIndex * 110 : 0; };
      C.defaults.animation.duration = REDUCE ? 0 : 1200; C.defaults.transitions = C.defaults.transitions || {};
      C.defaults.plugins.legend.labels.usePointStyle = true; C.defaults.plugins.legend.labels.boxWidth = 8;
      C.register({
        id: 'dhPremium',
        beforeUpdate: function (ch) {
          var t = ch.config.type;
          ch.data.datasets.forEach(function (ds) {
            if (t === 'bar') { if (ds.borderRadius == null) ds.borderRadius = 10; if (ds.borderSkipped == null) ds.borderSkipped = false; }
            if (t === 'line') { if (ds.tension == null) ds.tension = 0.4; if (ds.pointRadius == null) ds.pointRadius = 0; if (ds.pointHoverRadius == null) ds.pointHoverRadius = 6; if (ds.borderWidth == null) ds.borderWidth = 2.5; }
            if (t === 'doughnut' || t === 'pie') { if (ds.spacing == null) ds.spacing = 4; if (ds.borderRadius == null) ds.borderRadius = 10; ds.borderWidth = 0; if (ds.hoverOffset == null) ds.hoverOffset = 12; }
          });
          var sc = ch.options && ch.options.scales;
          if (sc) Object.keys(sc).forEach(function (k) { var g = sc[k].grid; if (g && g.display !== false) g.color = 'rgba(160,180,255,.07)'; if (sc[k].border) sc[k].border.display = false; });
        }
      });
    } catch (e) {}
  }

  // Tilt 3D mengikuti kursor (halus; kartu besar miring lebih sedikit)
  function bindTilt() {
    if (REDUCE) return;
    var SEL = '.kpi-card,.content .card', cur = null, raf = 0, last = null;
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var el = e.target.closest && e.target.closest(SEL);
      if (cur && cur !== el) reset(cur);
      cur = el; last = e; if (!el || raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0; if (!cur || !last) return;
        var r = cur.getBoundingClientRect(), x = (last.clientX - r.left) / r.width, y = (last.clientY - r.top) / r.height;
        var big = r.width > 420 || r.height > 260, max = big ? 2.2 : 7;
        cur.classList.add('moving');
        cur.style.setProperty('--ry', ((x - .5) * max * 2).toFixed(2) + 'deg');
        cur.style.setProperty('--rx', ((.5 - y) * max * 1.6).toFixed(2) + 'deg');
        cur.style.setProperty('--gx', (x * 100).toFixed(0) + '%'); cur.style.setProperty('--gy', (y * 100).toFixed(0) + '%');
      });
    }, { passive: true });
    document.addEventListener('pointerleave', function () { if (cur) reset(cur); cur = null; }, true);
    function reset(el) { el.classList.remove('moving'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); }
  }

  // Animasi masuk berurutan (satu kali) -- elemen baru muncul saat terlihat
  function bindReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.content .kpi-card, .content .card, .content .sec-divider, .content .gt-card'));
    if (!items.length || REDUCE || !('IntersectionObserver' in window)) return;
    items.forEach(function (el) { el.classList.add('dh-pre'); });
    var n = 0, io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return; var el = en.target; io.unobserve(el);
        el.style.setProperty('--d', Math.min(n++, 10) * 70 + 'ms');
        el.classList.add('dh-show'); el.classList.remove('dh-pre');
        // setelah animasi masuk selesai, lepas kelas agar respon tilt/hover tidak ikut tertunda (--d)
        setTimeout(function () { el.classList.remove('dh-show'); el.style.removeProperty('--d'); n = Math.max(0, n - 1); }, 1300);
      });
    }, { root: document.querySelector('.content'), threshold: 0.06 });
    items.forEach(function (el) { io.observe(el); });
    // pengaman: bila observer macet, tampilkan semua setelah 2,5 dtk
    setTimeout(function () { items.forEach(function (el) { if (el.classList.contains('dh-pre')) { el.classList.add('dh-show'); el.classList.remove('dh-pre'); } }); }, 2500);
  }

  // Izin data dari Super Admin (Kelola User > Divisi Head): sembunyikan KPI & bagian dashboard yang tidak diizinkan
  function applyPerms() {
    var iz = null; try { iz = JSON.parse(sessionStorage.getItem('wh_dh_izin') || 'null'); } catch (e) {}
    if (!iz || !iz.length) return;
    function can(k) { return iz.indexOf(k) !== -1; }
    function hideEl(el) { if (el) el.style.display = 'none'; }
    function kpi(id) { var e = document.getElementById(id); hideEl(e && e.closest('.kpi-card')); }
    function section(label) {   // sembunyikan 1 bagian: dari judul bagian sampai judul bagian berikutnya
      var divs = Array.prototype.slice.call(document.querySelectorAll('.content .sec-divider'));
      divs.forEach(function (d) {
        if ((d.textContent || '').indexOf(label) === -1) return;
        var start = d.parentElement && d.parentElement.id && d.parentElement !== document.querySelector('.content') ? d.parentElement : d;
        var n = start; hideEl(n); n = n.nextElementSibling;
        while (n && !n.matches('.sec-divider') && !n.querySelector('.sec-divider') && !(n.id && /^section-/.test(n.id))) { hideEl(n); n = n.nextElementSibling; }
      });
    }
    if (!can('stock')) { kpi('kpi-stok-pipa'); kpi('kpi-stok-fitting'); section('Stock Hari Ini'); }
    if (!can('outbound')) kpi('kpi-out');
    if (!can('inbound')) kpi('kpi-in');
    if (!can('outbound') && !can('inbound')) section('Outbound vs Inbound');
    if (!can('kanban')) { kpi('kpi-rak-pipa'); kpi('kpi-rak-fit'); section('Kapasitas Rak'); }
    if (!can('loading')) { var lt = document.querySelector('.kpi-card.c-red'); hideEl(lt); section('Loading Time'); }
    if (!can('rekap')) hideEl(document.getElementById('section-rekap-muatan'));
    if (!can('akurasi')) { var ak = document.getElementById('section-akurasi'); if (ak) { ak.setAttribute('hidden', ''); ak.style.display = 'none'; ak.removeAttribute('data-show'); new MutationObserver(function () { ak.setAttribute('hidden', ''); ak.style.display = 'none'; }).observe(ak, { attributes: true, attributeFilter: ['hidden', 'style'] }); } }
  }

  ready(function () {
    applyPerms();
    var tries = 0; (function t() { if (!tuneCharts() && tries++ < 20) setTimeout(t, 150); })();
    document.querySelectorAll('.kpi-card').forEach(function (el, i) { el.style.setProperty('--fi', i); });
    bindTilt(); bindReveal();
  });
})();
