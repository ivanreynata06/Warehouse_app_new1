/*! so-loader.js — indikator loading bertahap (ring + progress bar + daftar tahap).
 *  SOLoader.mount(el,{title,steps:[..]}) -> {step(i,pct?), done(), fail(msg,retryFn), remove()}
 *  Progres naik halus menuju batas tahap berjalan, lompat saat tahap selesai. */
(function (w) {
  var css = '.sol{display:flex;align-items:center;justify-content:center;padding:34px 16px;width:100%;transition:opacity .35s,transform .35s}' +
  '.sol.out{opacity:0;transform:translateY(-6px)}' +
  '.sol-card{width:min(420px,100%);background:linear-gradient(180deg,#1a1a2e,#151526);border:1px solid #2e2e48;border-radius:16px;padding:24px 26px;box-shadow:0 18px 50px rgba(0,0,0,.35);text-align:center}' +
  '.sol-ring{position:relative;width:78px;height:78px;margin:0 auto 14px}' +
  '.sol-ring svg{width:100%;height:100%;transform:rotate(-90deg)}' +
  '.sol-ring .tr{stroke:#252538}.sol-ring .pg{stroke:url(#solg);stroke-linecap:round;transition:stroke-dashoffset .35s ease}' +
  '.sol-ring:after{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px solid transparent;border-top-color:rgba(6,182,212,.55);animation:solspin 1.1s linear infinite}' +
  '.sol-pct{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 16px "Outfit",sans-serif;color:#e8eaf0}' +
  '.sol-title{font:700 14px "Outfit",sans-serif;color:#e8eaf0}.sol-sub{font-size:11px;color:#9da3b8;margin:3px 0 14px;min-height:15px}' +
  '.sol-bar{height:6px;background:#252538;border-radius:6px;overflow:hidden;position:relative}' +
  '.sol-bar i{display:block;height:100%;width:0;border-radius:6px;background:linear-gradient(90deg,#10b981,#06b6d4);transition:width .35s ease;position:relative;overflow:hidden}' +
  '.sol-bar i:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);transform:translateX(-100%);animation:solshine 1.3s infinite}' +
  '.sol-steps{margin:16px 0 0;display:flex;flex-direction:column;gap:7px;text-align:left}' +
  '.sol-st{display:flex;align-items:center;gap:9px;font-size:11.5px;color:#6b7280;transition:color .25s}' +
  '.sol-dot{width:16px;height:16px;border-radius:50%;border:1.5px solid #3a3a58;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff}' +
  '.sol-st.on{color:#e8eaf0}.sol-st.on .sol-dot{border-color:#06b6d4;border-top-color:transparent;animation:solspin .8s linear infinite}' +
  '.sol-st.ok{color:#9da3b8}.sol-st.ok .sol-dot{background:#10b981;border-color:#10b981;animation:none}.sol-st.ok .sol-dot:after{content:"\\2713"}' +
  '.sol.err .sol-ring:after{display:none}.sol.err .sol-bar i{background:#ef4444}.sol.err .sol-title{color:#ff8a8a}' +
  '.sol-btn{margin-top:14px;padding:7px 18px;border-radius:7px;border:none;background:#10b981;color:#fff;font:600 11.5px "Inter",sans-serif;cursor:pointer}' +
  '@keyframes solspin{to{transform:rotate(360deg)}}@keyframes solshine{to{transform:translateX(100%)}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var C = 2 * Math.PI * 34;
  w.SOLoader = {
    mount: function (el, o) {
      o = o || {}; var steps = o.steps || ['Memuat data'], pct = 0, cur = 0, cap = 0, dead = false, t0 = Date.now();
      var box = document.createElement('div'); box.className = 'sol';
      box.innerHTML = '<div class="sol-card"><div class="sol-ring"><svg viewBox="0 0 80 80"><defs><linearGradient id="solg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#10b981"/><stop offset="1" stop-color="#06b6d4"/></linearGradient></defs><circle class="tr" cx="40" cy="40" r="34" fill="none" stroke-width="6"/><circle class="pg" cx="40" cy="40" r="34" fill="none" stroke-width="6" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"/></svg><div class="sol-pct">0%</div></div>' +
        '<div class="sol-title">' + (o.title || 'Memuat') + '</div><div class="sol-sub"></div><div class="sol-bar"><i></i></div>' +
        '<div class="sol-steps">' + steps.map(function (s) { return '<div class="sol-st"><span class="sol-dot"></span><span>' + s + '</span></div>'; }).join('') + '</div></div>';
      el.innerHTML = ''; el.appendChild(box);
      var $ = function (q) { return box.querySelector(q); }, items = box.querySelectorAll('.sol-st');
      function paint() {
        var p = Math.min(100, Math.round(pct));
        $('.sol-pct').textContent = p + '%'; $('.sol-bar i').style.width = p + '%';
        $('.pg').style.strokeDashoffset = C * (1 - p / 100);
      }
      function mark() {
        for (var i = 0; i < items.length; i++) items[i].className = 'sol-st' + (i < cur ? ' ok' : i === cur ? ' on' : '');
        cap = Math.min(94, ((cur + 1) / steps.length) * 100 - 6); $('.sol-sub').textContent = steps[Math.min(cur, steps.length - 1)] + '…';
      }
      var tick = setInterval(function () { if (dead) return; if (pct < cap) { pct += (cap - pct) * 0.08 + 0.15; paint(); } }, 120);
      mark(); paint();
      var ctl = {
        step: function (i) { if (dead) return; cur = i; mark(); var floor = (i / steps.length) * 100; if (pct < floor) { pct = floor; paint(); } },
        done: function () { if (dead) return; dead = true; clearInterval(tick); cur = steps.length; mark(); pct = 100; paint(); $('.sol-sub').textContent = 'Selesai (' + ((Date.now() - t0) / 1000).toFixed(1) + ' dtk)'; setTimeout(function () { box.classList.add('out'); setTimeout(function () { if (box.parentNode) box.parentNode.removeChild(box); }, 380); }, 380); },
        fail: function (msg, retry) { dead = true; clearInterval(tick); box.classList.add('err'); $('.sol-title').textContent = 'Gagal memuat data'; $('.sol-sub').textContent = msg || 'Terjadi kesalahan';
          if (retry) { var b = document.createElement('button'); b.className = 'sol-btn'; b.textContent = 'Coba lagi'; b.onclick = retry; $('.sol-card').appendChild(b); } },
        remove: function () { dead = true; clearInterval(tick); if (box.parentNode) box.parentNode.removeChild(box); }
      };
      return ctl;
    }
  };
})(window);
