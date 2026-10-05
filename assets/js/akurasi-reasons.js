/*!
 * akurasi-reasons.js
 * -----------------------------------------------------------------
 * Alasan item yang belum ter-scan + grafiknya. Dipakai bersama oleh
 *   - akurasi_scan.html (isi alasan lewat dropdown di kartu + grafik)
 *   - index.html        (rekap di Control Tower)
 * Tidak bergantung pada library apa pun. Grafik berupa SVG donut.
 * Style disisipkan sendiri (memakai variabel warna halaman yang
 * memuatnya, dengan nilai cadangan).
 * -----------------------------------------------------------------
 */
(function (root) {
  'use strict';

  var OTHER = 'LAINNYA';
  var LIST = {
    out_item: ['BARCODE RUSAK', 'ITEM TIDAK DAPAT DIBUATKAN STICKER BARCODE', 'BARANG LAMA'],
    out_spm:  ['JARINGAN ERROR', 'LUPA SCAN', 'TIDAK PAHAM'],
    'in':     ['BELUM BISA DIBUATKAN BARCODE', 'LUPA SCAN'],
    bfl:      ['BARCODE RUSAK', 'TERLEWAT', 'TIDAK BISA DIBUAT STICKER BARCODE']
  };
  var PALETTE = ['#3b9dff', '#a78bfa', '#22d3a5', '#ffb020', '#f472b6'];
  var C_OTHER = '#8b95ad', C_EMPTY = '#4b5163';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return (Math.round(n) || 0).toLocaleString('id-ID'); }
  function fmtP(p) { return p == null ? '-' : p.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }

  /* ---------- kunci & status ---------- */
  function keyOf(lane, rec) {
    if (lane === 'out') return 'out:' + (rec.key || (rec.spm + '|' + rec.item + '|' + rec.group));
    return lane + ':' + rec.voucher;
  }
  function spmKey(spm) { return 'outspm:' + spm; }

  // Apakah item ini perlu diberi alasan (belum ter-scan)?
  function needs(lane, it) {
    var st = it.e.status;
    if (lane === 'in') return st === 'kosong' || st === 'beda';
    if (lane === 'bfl') return st === 'manual';
    if (lane === 'out') return st === 'none' || st === 'part';
    return false;
  }

  // Scan Out: SPM yang SELURUH itemnya belum ter-scan sama sekali (PICK) -> 1 alasan per SPM
  function outGroups(items) {
    var by = {};
    items.forEach(function (i) {
      var g = by[i.v.spm] || (by[i.v.spm] = { spm: i.v.spm, date: i.date, tuj: i.v.tuj || '', items: [], qty: 0, all: true });
      g.items.push(i); g.qty += i.v.qspm || 0;
      if (i.e.status !== 'none') g.all = false;
    });
    var out = {};
    Object.keys(by).forEach(function (k) { if (by[k].all && by[k].items.length) out[k] = by[k]; });
    return out;
  }

  function label(e) { return !e || !e.r ? '' : (e.r === OTHER ? (e.t || 'Lainnya') : e.r); }
  function bucketOf(e) { return !e || !e.r ? 'EMPTY' : (e.r === OTHER ? OTHER : e.r); }

  /* ---------- agregasi untuk grafik ---------- */
  function mkSet(id, title, unit, list) {
    var b = {}, order = list.slice();
    order.forEach(function (n, i) { b[n] = { key: n, label: n, n: 0, qty: 0, color: PALETTE[i % PALETTE.length] }; });
    b[OTHER] = { key: OTHER, label: 'Lainnya', n: 0, qty: 0, color: C_OTHER };
    b.EMPTY = { key: 'EMPTY', label: 'Belum diisi', n: 0, qty: 0, color: C_EMPTY };
    return { id: id, title: title, unit: unit, total: 0, filled: 0, b: b, order: order.concat([OTHER, 'EMPTY']), others: [] };
  }
  function add(set, e, qty) {
    var k = bucketOf(e); if (!set.b[k]) k = OTHER;
    set.b[k].n++; set.b[k].qty += qty || 0; set.total++;
    if (k !== 'EMPTY') set.filled++;
    if (k === OTHER && e && e.t) set.others.push(e.t);
  }
  function finalize(set) {
    set.buckets = set.order.map(function (k) { return set.b[k]; }).filter(function (x) { return x.n > 0; });
    return set;
  }

  // items: daftar item yang sedang ditampilkan; map: peta alasan { kunci: {r,t,...} }
  // all (opsional): seluruh item pada periode yang sama, dipakai menentukan SPM yang SELURUH
  // itemnya belum ter-scan walau tampilan sedang difilter tanggal / pencarian.
  function aggregate(lane, items, map, all) {
    map = map || {};
    if (lane === 'out') {
      var groups = outGroups(all || items), vis = {};
      items.forEach(function (i) { vis[i.v.spm] = 1; });
      var s1 = mkSet('item', 'Alasan per item', 'item', LIST.out_item);
      var s2 = mkSet('spm', 'Alasan per SPM (seluruh item tidak ter-scan)', 'SPM', LIST.out_spm);
      items.forEach(function (i) {
        if (!needs('out', i) || groups[i.v.spm]) return;
        add(s1, map[keyOf('out', i.v)], Math.max(0, (i.v.qspm || 0) - (i.e.aktual || 0)));
      });
      Object.keys(groups).forEach(function (k) { if (vis[k]) add(s2, map[spmKey(k)], groups[k].qty); });
      return [finalize(s1), finalize(s2)];
    }
    var s = mkSet('item', lane === 'bfl' ? 'Alasan voucher diinput manual' : 'Alasan Box ID kosong / tidak sesuai', 'voucher', LIST[lane] || []);
    items.forEach(function (i) { if (needs(lane, i)) add(s, map[keyOf(lane, i.v)], i.v.qty || 0); });
    return [finalize(s)];
  }

  /* ---------- markup ---------- */
  function donut(set, size) {
    var r = 40, c = 2 * Math.PI * r, off = 0, segs = '';
    set.buckets.forEach(function (x) {
      var len = set.total ? x.n / set.total * c : 0;
      segs += '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + x.color + '" stroke-width="13" stroke-dasharray="' + len + ' ' + (c - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 50 50)"></circle>';
      off += len;
    });
    return '<svg class="rz-donut" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" role="img" aria-label="' + esc(set.title) + '">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--rz-track)" stroke-width="13"></circle>' + segs +
      '<text x="50" y="49" text-anchor="middle" class="rz-n">' + fmt(set.total) + '</text><text x="50" y="62" text-anchor="middle" class="rz-u">' + esc(set.unit) + '</text></svg>';
  }
  // opts.size (donut), opts.top (batasi jumlah baris legenda), opts.compact
  function setHtml(set, opts) {
    opts = opts || {};
    if (!set.total) return '<div class="rz-set"><div class="rz-ttl"><b>' + esc(set.title) + '</b></div><div class="rz-empty">Tidak ada ' + esc(set.unit) + ' yang perlu alasan.</div></div>';
    var rows = set.buckets.slice(0, opts.top || 99).map(function (x) {
      var p = set.total ? x.n / set.total * 100 : 0;
      return '<li><span class="rz-dot" style="background:' + x.color + '"></span><span class="rz-lb' + (x.key === 'EMPTY' ? ' warn' : '') + '">' + esc(x.label) + '</span><span class="rz-ct">' + fmt(x.n) + '</span><span class="rz-pc">' + fmtP(p) + '</span></li>';
    }).join('');
    var pf = set.total ? set.filled / set.total * 100 : 0;
    var oth = set.others.length ? '<div class="rz-oth" title="' + esc(set.others.join(' | ')) + '">Lainnya: ' + esc(set.others.slice(0, 3).join(', ')) + (set.others.length > 3 ? ', ...' : '') + '</div>' : '';
    return '<div class="rz-set"><div class="rz-ttl"><b>' + esc(set.title) + '</b><span>' + fmt(set.filled) + ' dari ' + fmt(set.total) + ' sudah diberi alasan</span></div>' +
      '<div class="rz-prog"><i style="width:' + pf + '%"></i></div>' +
      '<div class="rz-body">' + donut(set, opts.size || 112) + '<ul class="rz-leg">' + rows + '</ul></div>' + oth + '</div>';
  }

  /* ---------- style ---------- */
  var css = '' +
    '.rz-set{--rz-track:var(--line,var(--border,#26263c));min-width:0;}' +
    '.rz-ttl{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:7px;}' +
    '.rz-ttl b{font-size:12px;font-weight:600;color:var(--txt,#e8eaf0);}' +
    '.rz-ttl span{font-size:10.5px;color:var(--txt3,#6b7280);}' +
    '.rz-prog{height:4px;border-radius:4px;background:var(--rz-track);overflow:hidden;margin-bottom:12px;}' +
    '.rz-prog i{display:block;height:100%;background:#22d3a5;border-radius:4px;transition:width .3s ease;}' +
    '.rz-body{display:flex;align-items:center;gap:16px;}' +
    '.rz-donut{flex-shrink:0;}' +
    '.rz-donut circle{transition:stroke-dasharray .35s ease;}' +
    '.rz-n{font-family:Outfit,sans-serif;font-size:19px;font-weight:600;fill:var(--txt,#e8eaf0);}' +
    '.rz-u{font-size:7.5px;fill:var(--txt3,#6b7280);}' +
    '.rz-leg{list-style:none;flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;margin:0;padding:0;}' +
    '.rz-leg li{display:grid;grid-template-columns:10px minmax(0,1fr) auto 52px;align-items:center;gap:8px;font-size:11px;color:var(--txt2,#9da3b8);}' +
    '.rz-dot{width:9px;height:9px;border-radius:3px;}' +
    '.rz-lb{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '.rz-lb.warn{color:#ffb020;}' +
    '.rz-ct{font-weight:600;color:var(--txt,#e8eaf0);font-variant-numeric:tabular-nums;}' +
    '.rz-pc{text-align:right;font-variant-numeric:tabular-nums;color:var(--txt3,#6b7280);font-size:10.5px;}' +
    '.rz-empty{font-size:11px;color:var(--txt3,#6b7280);padding:8px 0;}' +
    '.rz-oth{margin-top:9px;font-size:10px;color:var(--txt3,#6b7280);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
    '@media(max-width:520px){.rz-body{flex-direction:column;align-items:flex-start;}.rz-leg{width:100%;}}';
  if (typeof document !== 'undefined' && !document.getElementById('rz-style')) {
    var st = document.createElement('style'); st.id = 'rz-style'; st.textContent = css; (document.head || document.documentElement).appendChild(st);
  }

  root.AkurasiReasons = {
    OTHER: OTHER, LIST: LIST, keyOf: keyOf, spmKey: spmKey, needs: needs, outGroups: outGroups,
    label: label, aggregate: aggregate, setHtml: setHtml, donut: donut, esc: esc
  };
})(typeof window !== 'undefined' ? window : this);
