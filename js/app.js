/* app.js — screens and events. All math lives in avgcost.js / dca.js, all money in prices.js,
   all photo reading in scan.js. This file only renders what those return. */
(function () {
  'use strict';
  var t = I18n.t, P = Prices;
  var S = Store.load();
  var live = { prices: null, priceTime: null, rate: null, priceErr: false, rateErr: false, loading: false, tried: false };
  var ui = { tab: 'avg', open: null, scanStatus: 'idle', scanProgress: 0, scanText: '', scanFile: null, scanMsg: '', claude: null, wallet: 'Photo' };

  /* ---------- example data (shown only while the visitor has none; never saved) ---------- */
  var EX_LOTS = [
    { id: 'x1', sym: 'BTC', wallet: 'Binance', qty: 0.2, paid: { value: 12000, currency: 'USD' } },
    { id: 'x2', sym: 'BTC', wallet: 'Coinbase', qty: 0.3, paid: { value: 19500, currency: 'USD' } },
    { id: 'x3', sym: 'ETH', wallet: 'Upbit', qty: 0.5, paid: { value: 1500176, currency: 'KRW' } },
    { id: 'x4', sym: 'SOL', wallet: 'Phantom', qty: 10, paid: { value: 1500, currency: 'USD' } }
  ];
  function exRoad() {
    var today = DCA.toDay(new Date());
    return { id: 'xr', sym: 'BTC', goalQty: 1, planDays: 365, daily: { value: 200, currency: 'USD' },
      startDate: DCA.addDays(today, -40), completedDays: 38, haveQty: null,
      checkins: [DCA.addDays(today, -3), DCA.addDays(today, -2), DCA.addDays(today, -1)] };
  }

  /* ---------- helpers ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { if (v == null) return NaN; var n = parseFloat(String(v).replace(/[,\s₩$]/g, '')); return n; }
  function cur() { return S.settings.cur || (I18n.get() === 'ko' ? 'KRW' : 'USD'); }
  function save() { Store.save(S); }
  function today() { return DCA.toDay(new Date()); }
  function money(v, c, o) { return P.money(v, c || cur(), o); }
  function cls(v) { return v > 0 ? 'up' : v < 0 ? 'down' : ''; }
  function arrow(v) { return v > 0 ? '▲' : v < 0 ? '▼' : ''; }
  function when(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleString(I18n.get() === 'ko' ? 'ko-KR' : undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function dayFmt(s) {
    if (!s) return '—';
    var p = s.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(I18n.get() === 'ko' ? 'ko-KR' : undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function badge(sym) {
    var h = 0; for (var i = 0; i < sym.length; i++) h = (h * 31 + sym.charCodeAt(i)) % 360;
    return '<span class="badge" style="background:hsl(' + h + ' 48% 40%)" aria-hidden="true">' + esc(sym.slice(0, 4)) + '</span>';
  }
  function coinName(sym) { var c = Coins.get(sym); return c ? (I18n.get() === 'ko' ? c.ko : c.name) : ''; }
  function srcTag(s) { return '<span class="src ' + s + '">' + t(s) + '</span>'; }
  function toast(msg) {
    var el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; el.setAttribute('role', 'status');
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 1800);
  }
  var IC = {
    plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    warn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/></svg>',
    shield: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    flame: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2 3 0-3-1-6 .5-9z"/></svg>',
    check: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    cam: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    coins: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
    flag: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
    edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>'
  };

  /* ---------- market (prices + rate) ---------- */
  function symbolsInUse() {
    var set = {};
    (S.lots.length ? S.lots : EX_LOTS).forEach(function (l) { set[l.sym] = 1; });
    (S.roads.length ? S.roads : [exRoad()]).forEach(function (r) { set[r.sym] = 1; });
    S.pending.forEach(function (r) { if (r.sym) set[r.sym] = 1; });
    return Object.keys(set);
  }
  function market() {
    return P.buildMarket(symbolsInUse(), { prices: live.prices, priceTime: live.priceTime, rate: live.rate }, S.settings);
  }

  function refreshLive() {
    if (live.loading) return;
    live.loading = true;
    var syms = symbolsInUse();
    var unknown = syms.filter(function (s) { return !Coins.get(s) && !S.settings.customIds[s]; });
    var lookups = unknown.slice(0, 5).map(function (s) {
      return P.lookupSymbol(s).then(function (hit) { if (hit) { S.settings.customIds[s] = hit.id; save(); } }).catch(function () {});
    });
    Promise.all(lookups).then(function () {
      var ids = syms.map(function (s) { var c = Coins.get(s); return c ? c.id : S.settings.customIds[s]; }).filter(Boolean);
      var pp = ids.length ? P.fetchLivePrices(ids).then(function (p) { live.prices = p; live.priceTime = new Date().toISOString(); live.priceErr = false; },
        function () { live.priceErr = true; }) : Promise.resolve();
      var rp = P.fetchLiveRate().then(function (r) { live.rate = r; live.rateErr = false; }, function () { live.rateErr = true; });
      return Promise.all([pp, rp]);
    }).then(function () { live.loading = false; live.tried = true; render(); });
  }

  /* ---------- rate strip ---------- */
  function renderRate() {
    var m = market();
    var el = $('#rateLine');
    var rateTxt = '$1 = ' + P.money(m.rate, 'KRW', { decimals: 2 });
    var bad = false, html;
    if (m.rateSource === 'manual') {
      html = t('rateLine') + ' <b>' + rateTxt + '</b> ' + srcTag('manual');
    } else if (m.rateSource === 'live') {
      html = t('rateLine') + ' <b>' + rateTxt + '</b> ' + srcTag('live') + ' · ' + t('updated') + ' ' + when(m.rateTime);
    } else {
      if (live.tried) { bad = true; html = IC.warn + '<span>' + t('rateFail') + ' <b>' + rateTxt + '</b> (' + t('rateFrom') + ' ' + when(m.rateTime) + ') · <u>' + t('rateEdit') + '</u></span>'; }
      else html = t('rateLine') + ' <b>' + rateTxt + '</b> …';
    }
    if (live.tried && live.priceErr) {
      bad = true;
      html += '<br>' + t('pricesFail') + ' ' + when(Coins.SNAPSHOT_TIME) + ' · <u>' + t('rateEdit') + '</u>';
    }
    el.className = 'rate' + (bad ? ' bad' : '');
    el.innerHTML = html;
  }

  /* ---------- Avg Cost screen ---------- */
  function renderAvg() {
    var c = cur(), m = market();
    var isEx = S.lots.length === 0;
    var sum = AvgCost.summarize(isEx ? EX_LOTS : S.lots, m, c);
    var T = sum.totals;
    var h = '';
    if (isEx) h += '<div class="notice" style="background:var(--surface-2);color:var(--ink)"><b>' + t('example') + '</b><span>' + t('emptyAvg') + '</span></div>';
    if (S.pending.length) h += '<button class="notice" data-act="goReview">' + IC.warn + '<span><b>' + S.pending.length + '</b> ' + t('needPaid') + '</span><span class="go">' + t('fix') + ' ›</span></button>';
    h += '<section class="hero" aria-label="Totals">' +
      '<div><div class="lbl">' + t('net') + '</div><div class="pl"><span class="big ' + cls(T.pl) + '">' + money(T.pl, c, { sign: true }) + '</span>' +
      '<span class="pct ' + cls(T.pl) + '">' + arrow(T.pl) + ' ' + P.pct(T.plPct, true) + '</span></div></div>' +
      '<div class="row2"><div><div class="lbl">' + t('paid') + '</div><div class="mid">' + money(T.paid, c) + '</div></div>' +
      '<div><div class="lbl">' + t('now') + '</div><div class="mid">' + money(T.value, c) + '</div></div></div>' +
      '<div class="chips"><div class="chip up"><span>▲ ' + t('gains') + '</span>' + money(T.gains, c, { sign: true }) + '</div>' +
      '<div class="chip down"><span>▼ ' + t('losses') + '</span>' + money(T.losses, c, { sign: true }) + '</div></div>' +
      '</section>';
    if (sum.rateMissing) h += '<div class="notice">' + IC.warn + t('rateFail') + '</div>';
    sum.coins.forEach(function (row) {
      var open = ui.open === row.sym;
      h += '<article class="coin">' +
        '<button type="button" data-act="toggleCoin" data-sym="' + esc(row.sym) + '" aria-expanded="' + open + '">' + badge(row.sym) +
        '<div style="min-width:0"><div class="name">' + esc(row.sym) + '</div><div class="small">' + P.qty(row.qty) + ' · ' + esc(coinName(row.sym)) + '</div></div>' +
        '<div class="right"><div class="v">' + (row.value != null ? money(row.value, c) : '—') + '</div>' +
        '<div class="small ' + cls(row.pl) + '" style="font-weight:700">' + (row.pl != null ? money(row.pl, c, { sign: true }) + ' · ' + P.pct(row.plPct, true) : t('noPrice')) + '</div></div>' +
        '</button>';
      if (open) {
        h += '<div class="detail"><div class="kv">' +
          kv(t('qty'), P.qty(row.qty)) + kv(t('paid'), money(row.paid, c)) +
          kv(t('avgCost'), money(row.avg, c)) +
          '<div><div class="k">' + t('price') + ' ' + srcTag(row.priceSource) + '</div><button class="linkbtn" data-act="price" data-sym="' + esc(row.sym) + '">' + (row.price != null ? money(row.price, c) : t('noPrice')) + ' ' + IC.edit + '</button></div>' +
          kv(t('value'), row.value != null ? money(row.value, c) : '—') +
          kv(t('net'), row.pl != null ? '<span class="' + cls(row.pl) + '">' + money(row.pl, c, { sign: true }) + ' (' + P.pct(row.plPct, true) + ')</span>' : '—') +
          '</div>' +
          '<div class="formula">' + t('avgCost') + ' = ' + money(row.paid, c) + ' ÷ ' + P.qty(row.qty) + ' = <b>' + money(row.avg, c) + '</b>' + (row.mixed ? ' · ' + t('mixedCur') : '') + '</div>' +
          '<div class="lbl">' + t('lots') + ' (' + row.lots.length + ')</div>';
        row.lots.forEach(function (x) {
          var l = x.lot;
          var orig = P.money(l.paid.value, l.paid.currency);
          var conv = l.paid.currency !== c ? ' → ' + money(x.paid, c) : '';
          h += '<div class="lot"><div><div class="w">' + esc(l.wallet || '—') + '</div><div class="small">' + P.qty(l.qty) + ' ' + esc(l.sym) + ' · ' + orig + conv + ' · ' + money(x.avg, c) + '/1</div></div>' +
            (isEx ? '' : '<button class="iconbtn" data-act="editLot" data-id="' + esc(l.id) + '" aria-label="' + t('edit') + '">' + IC.edit + '</button>') + '</div>';
        });
        h += '</div>';
      }
      h += '</article>';
    });
    h += foot();
    h += '<button class="fab" data-act="addLot">' + IC.plus + t('add') + '</button>';
    return h;
  }
  function kv(k, v) { return '<div><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }
  function foot() { return '<div class="foot"><div>' + t('privacy') + '</div><div>' + t('math') + '</div></div>'; }

  /* ---------- DCA Road screen ---------- */
  function renderRoad() {
    var c = cur(), m = market(), td = today();
    var isEx = S.roads.length === 0;
    var roads = isEx ? [exRoad()] : S.roads;
    var h = '';
    if (isEx) h += '<div class="notice" style="background:var(--surface-2);color:var(--ink)"><b>' + t('example') + '</b><span>' + t('emptyRoad') + '</span></div>';
    roads.forEach(function (r) {
      var x = DCA.compute(r, m, c, td);
      var pct = x.progress || 0, R = 40, L = 2 * Math.PI * R;
      h += '<article class="card road">' +
        '<div class="road-top"><div class="ring" aria-label="' + pct.toFixed(1) + '%"><svg width="92" height="92" viewBox="0 0 92 92"><circle class="ring-track" cx="46" cy="46" r="' + R + '" fill="none" stroke-width="9"/>' +
        '<circle class="ring-fill" cx="46" cy="46" r="' + R + '" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + L.toFixed(2) + '" stroke-dashoffset="' + (L * (1 - pct / 100)).toFixed(2) + '"/></svg>' +
        '<div class="c">' + Math.floor(pct) + '%</div></div>' +
        '<div style="min-width:0;flex:1"><div class="lbl">' + t('goal') + '</div><div class="mid">' + P.qty(r.goalQty) + ' ' + esc(r.sym) + '</div>' +
        '<div class="small">' + (x.have != null ? (x.estimated ? '≈ ' : '') + P.qty(x.have) + ' ' + esc(r.sym) : '—') + (x.estimated ? ' · ' + t('est') : '') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
        (x.reached ? '<span class="pill up">' + IC.check + t('reached') + '</span>' : '<span class="pill ' + (x.onTime ? 'up' : 'down') + '">' + (x.onTime ? t('onTrack') : t('late')) + '</span>') +
        '<span class="streak">' + IC.flame + x.streak + ' ' + t('streak') + '</span></div></div>' +
        (isEx ? '' : '<button class="iconbtn" data-act="editRoad" data-id="' + esc(r.id) + '" aria-label="' + t('edit') + '">' + IC.edit + '</button>') + '</div>' +
        (isEx ? '' : '<button class="btn block checkin ' + (x.checkedToday ? 'done' : 'primary') + '" data-act="checkin" data-id="' + esc(r.id) + '">' + (x.checkedToday ? t('boughtDone') + ' · <u>' + t('undo') + '</u>' : IC.check + t('boughtToday') + ' · ' + money(x.daily, c)) + '</button>') +
        '<div class="kv">' +
        kv(t('invested'), money(x.invested, c) + '<div class="small">' + x.done + ' / ' + r.planDays + ' ' + t('days') + ' × ' + money(x.daily, c) + '</div>') +
        kv(t('remaining'), money(x.remaining, c) + '<div class="small">' + P.qty(x.remainingQty) + ' ' + esc(r.sym) + ' × ' + money(x.price, c) + '</div>') +
        kv(t('needDaily'), x.reached ? '—' : (x.needDaily != null ? money(x.needDaily, c) + '<div class="small">' + x.daysLeft + ' ' + t('daysLeft') + '</div>' : '<span class="down">' + t('planOver') + '</span>')) +
        kv(t('finish'), x.reached ? t('reached') : dayFmt(x.finish) + '<div class="small">' + t('planEnd') + ' ' + dayFmt(x.planEnd) + '</div>') +
        kv(t('planLeft'), money(x.planLeft, c) + '<div class="small">' + money(x.planTotal, c) + ' ' + t('total').toLowerCase() + '</div>') +
        '</div></article>';
    });
    h += foot();
    h += '<button class="fab" data-act="addRoad">' + IC.plus + t('add') + '</button>';
    return h;
  }

  /* ---------- Photo screen ---------- */
  function renderPhoto() {
    var h = '';
    if (ui.scanStatus === 'reading') {
      return '<div class="card" style="display:grid;gap:12px"><div class="mid">' + t('reading') + '</div><div class="bar"><i style="width:' + Math.round(ui.scanProgress * 100) + '%"></i></div><div class="small">' + t('onDevice') + '</div></div>';
    }
    if (!S.pending.length && ui.scanStatus !== 'review') {
      h += '<label class="drop" for="photoIn">' + IC.cam + '<div class="mid">' + t('upload') + '</div><div class="muted">' + t('uploadSub') + '</div>' +
        '<span class="btn primary">' + IC.plus + t('photo') + '</span><input id="photoIn" type="file" accept="image/*"></label>' +
        '<div class="safe">' + IC.shield + '<div><b>' + t('safe') + '</b><div class="small">' + t('onDevice') + '</div></div></div>' + foot();
      return h;
    }
    var c = cur(), m = market();
    h += '<div><div class="mid">' + t('review') + '</div><div class="muted">' + t('reviewSub') + '</div></div>';
    if (ui.scanMsg) h += '<div class="notice">' + IC.warn + '<span>' + esc(ui.scanMsg) + '</span></div>';
    var missing = S.pending.filter(function (r) { return !(num(r.paidValue) > 0); }).length;
    if (missing) h += '<div class="notice">' + IC.warn + '<span><b>' + missing + '</b> ' + t('needPaid') + '. ' + t('needPaidLong') + '</span></div>';
    h += '<label class="field"><span>' + t('walletAll') + '</span><input class="input" id="scanWallet" value="' + esc(ui.wallet) + '" list="walletList"></label>';
    S.pending.forEach(function (r, i) {
      var miss = !(num(r.paidValue) > 0);
      h += '<div class="srow' + (miss ? ' missing' : '') + '" data-i="' + i + '">' +
        '<div class="inrow"><input class="input sym" data-f="sym" value="' + esc(r.sym) + '" aria-label="' + t('coin') + '" list="coinList" autocapitalize="characters">' +
        '<input class="input" data-f="qty" inputmode="decimal" value="' + esc(r.qty) + '" placeholder="' + t('qty') + '" aria-label="' + t('qty') + '">' +
        '<button class="xbtn" data-act="rmRow" data-i="' + i + '" aria-label="' + t('del') + '">' + IC.x + '</button></div>' +
        '<div class="inrow"><input class="input' + (miss ? ' err' : '') + '" data-f="paidValue" inputmode="decimal" value="' + esc(r.paidValue) + '" placeholder="' + t('amount') + '" aria-label="' + t('amount') + '">' +
        '<div class="seg sm" role="group">' + ['USD', 'KRW'].map(function (k) { return '<button type="button" data-act="rowCur" data-i="' + i + '" data-cur="' + k + '" aria-pressed="' + (r.paidCur === k) + '">' + P.SYMBOL[k] + '</button>'; }).join('') + '</div></div>' +
        '<div class="conv">' + rowConv(r, c, m) + '</div></div>';
    });
    h += '<button class="btn ghost block" data-act="addRow">' + IC.plus + t('addRow') + '</button>';
    h += '<button class="btn primary block" data-act="saveScan">' + IC.check + t('saveN') + ' (' + (S.pending.length - missing) + ')</button>';
    if (ui.claude && ui.scanFile) h += '<button class="btn ghost block" data-act="claudeRead">' + t('readAgainClaude') + '</button><div class="small" style="text-align:center">' + t('claudeNote') + '</div>';
    h += '<button class="btn danger block" data-act="discardScan">' + t('cancel') + '</button>';
    if (ui.scanText) h += '<details><summary>' + t('rawText') + '</summary><pre>' + esc(ui.scanText) + '</pre></details>';
    return h;
  }
  /* the same converted number the Avg Cost screen will use after saving */
  function rowConv(r, c, m) {
    var v = num(r.paidValue), q = num(r.qty);
    if (!(v > 0)) return '<span class="miss">' + t('needPaid') + '</span>';
    var conv = P.convert(v, r.paidCur, c, m.rate);
    var s = P.money(v, r.paidCur) + (r.paidCur !== c ? ' = <b>' + money(conv, c) + '</b>' : '');
    if (q > 0) s += ' · ' + t('avgCost') + ' <b>' + money(conv / q, c) + '</b>';
    if (r.note === 'avg×qty') s += ' · ' + t('fromAvg');
    return s;
  }

  /* ---------- render ---------- */
  function render() {
    document.body.classList.toggle('redup', S.settings.upColor === 'red' || (S.settings.upColor === 'auto' && I18n.get() === 'ko'));
    Array.prototype.forEach.call(document.querySelectorAll('#curSeg button'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.cur === cur())); });
    Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) {
      if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-t]'), function (el) { el.textContent = t(el.dataset.t); });
    renderRate();
    var html = ui.tab === 'avg' ? renderAvg() : ui.tab === 'road' ? renderRoad() : renderPhoto();
    html += lists();
    $('#view').innerHTML = html;
    var fi = $('#photoIn'); if (fi) fi.addEventListener('change', onPhoto);
  }
  function lists() {
    var wallets = {};
    S.lots.forEach(function (l) { if (l.wallet) wallets[l.wallet] = 1; });
    return '<datalist id="coinList">' + Coins.list.map(function (c) { return '<option value="' + c.symbol + '">' + esc(c.name + ' · ' + c.ko) + '</option>'; }).join('') + '</datalist>' +
      '<datalist id="walletList">' + ['Upbit', 'Bithumb', 'Binance', 'Coinbase', 'OKX', 'Bybit', 'Kraken', 'MetaMask', 'Ledger', 'Trust Wallet'].concat(Object.keys(wallets))
        .filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (w) { return '<option value="' + esc(w) + '">'; }).join('') + '</datalist>';
  }

  /* ---------- sheets (forms) ---------- */
  function openSheet(title, body, onMount) {
    var root = $('#sheetRoot');
    root.innerHTML = '<div class="sheet-bg" data-act="closeBg"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="sheet-head"><h2>' + esc(title) + '</h2><button class="iconbtn" data-act="close" aria-label="' + t('close') + '">' + IC.x + '</button></div>' + body + lists() + '</div></div>';
    if (onMount) onMount(root.querySelector('.sheet'));
  }
  function closeSheet() { $('#sheetRoot').innerHTML = ''; }
  function segHtml(name, opts, val) {
    return '<div class="seg sm" role="group" data-seg="' + name + '">' + opts.map(function (o) {
      return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (o[0] === val) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  }
  function segVal(sheet, name) { var b = sheet.querySelector('[data-seg="' + name + '"] [aria-pressed="true"]'); return b && b.dataset.v; }
  function wireSegs(sheet, onChange) {
    sheet.addEventListener('click', function (e) {
      var b = e.target.closest('[data-seg] button'); if (!b) return;
      Array.prototype.forEach.call(b.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      if (onChange) onChange();
    });
  }
  function twoTap(btn, label, fn) {
    if (btn.dataset.armed) { fn(); return; }
    btn.dataset.armed = '1'; var old = btn.innerHTML; btn.textContent = label;
    setTimeout(function () { if (btn.isConnected) { delete btn.dataset.armed; btn.innerHTML = old; } }, 3000);
  }

  function lotSheet(lot) {
    var isNew = !lot;
    lot = lot || { sym: '', wallet: '', qty: '', paid: { value: '', currency: cur() }, entry: 'total' };
    var mode = lot.entry === 'per' ? 'per' : 'total';
    var amt = mode === 'per' && lot.qty ? lot.paid.value / lot.qty : lot.paid.value;
    var body = '<label class="field"><span>' + t('coin') + '</span><input class="input" id="fSym" list="coinList" autocapitalize="characters" value="' + esc(lot.sym) + '" placeholder="BTC"></label>' +
      '<label class="field"><span>' + t('wallet') + '</span><input class="input" id="fWallet" list="walletList" value="' + esc(lot.wallet) + '" placeholder="Upbit"></label>' +
      '<label class="field"><span>' + t('qty') + '</span><input class="input" id="fQty" inputmode="decimal" value="' + esc(lot.qty) + '" placeholder="0.25"></label>' +
      '<div class="field"><span>' + t('amount') + '</span>' + segHtml('mode', [['total', t('total')], ['per', t('perCoin')]], mode).replace('seg sm', 'seg sm txt') +
      '<div class="inrow"><input class="input" id="fAmt" inputmode="decimal" value="' + esc(amt === '' ? '' : +(+amt).toFixed(8)) + '" placeholder="15,000">' +
      segHtml('cur', [['USD', '$'], ['KRW', '₩']], lot.paid.currency) + '</div></div>' +
      '<div class="calc" id="fCalc"></div><div class="err-msg" id="fErr"></div>' +
      '<button class="btn primary block" id="fSave">' + IC.check + t('save') + '</button>' +
      (isNew ? '' : '<button class="btn danger block" id="fDel">' + t('del') + '</button>');
    openSheet(isNew ? t('addLot') : t('editLot'), body, function (sh) {
      function calc() {
        var q = num($('#fQty', sh).value), a = num($('#fAmt', sh).value), cu = segVal(sh, 'cur'), md = segVal(sh, 'mode');
        var paid = AvgCost.paidFromEntry(md, a, q);
        $('#fCalc', sh).innerHTML = paid ? t('paid') + ' <b>' + P.money(paid, cu) + '</b>' + (q > 0 ? ' · ' + t('avgCost') + ' <b>' + P.money(paid / q, cu) + '</b>' : '') +
          (cu !== cur() ? ' → ' + money(P.convert(paid, cu, cur(), market().rate)) : '') : '';
        return { q: q, paid: paid, cu: cu, md: md };
      }
      wireSegs(sh, calc);
      sh.addEventListener('input', calc); calc();
      $('#fSave', sh).onclick = function () {
        var v = calc(), sym = $('#fSym', sh).value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!sym || !(v.q > 0) || !v.paid) { $('#fErr', sh).textContent = t('required'); return; }
        var rec = { id: lot.id || Store.id(), sym: sym, wallet: $('#fWallet', sh).value.trim(), qty: v.q, paid: { value: v.paid, currency: v.cu }, entry: v.md, source: lot.source || 'manual', date: lot.date || today() };
        if (isNew) S.lots.push(rec); else S.lots = S.lots.map(function (l) { return l.id === rec.id ? rec : l; });
        save(); closeSheet(); ui.open = sym; render(); toast(t('saved')); refreshLive();
      };
      if (!isNew) $('#fDel', sh).onclick = function (e) {
        twoTap(e.currentTarget, t('delSure'), function () { S.lots = S.lots.filter(function (l) { return l.id !== lot.id; }); save(); closeSheet(); render(); });
      };
      if (isNew) setTimeout(function () { $('#fSym', sh).focus(); }, 50);
    });
  }

  function roadSheet(road) {
    var isNew = !road;
    road = road || { sym: 'BTC', goalQty: 1, planDays: 365, daily: { value: '', currency: cur() }, startDate: today(), completedDays: 0, haveQty: null, checkins: [] };
    var body = '<label class="field"><span>' + t('coin') + '</span><input class="input" id="rSym" list="coinList" autocapitalize="characters" value="' + esc(road.sym) + '"></label>' +
      '<div class="row2"><label class="field"><span>' + t('goalQty') + '</span><input class="input" id="rGoal" inputmode="decimal" value="' + esc(road.goalQty) + '"></label>' +
      '<label class="field"><span>' + t('planDays') + '</span><input class="input" id="rDays" inputmode="numeric" value="' + esc(road.planDays) + '"></label></div>' +
      '<div class="field"><span>' + t('daily') + '</span><div class="inrow"><input class="input" id="rDaily" inputmode="decimal" value="' + esc(road.daily.value) + '" placeholder="10">' + segHtml('cur', [['USD', '$'], ['KRW', '₩']], road.daily.currency) + '</div></div>' +
      '<div class="row2"><label class="field"><span>' + t('start') + '</span><input class="input" id="rStart" type="date" value="' + esc(road.startDate) + '"></label>' +
      '<label class="field"><span>' + t('doneDays') + '</span><input class="input" id="rDone" inputmode="numeric" value="' + esc(road.completedDays) + '"></label></div>' +
      '<label class="field"><span>' + t('haveQty') + '</span><input class="input" id="rHave" inputmode="decimal" value="' + esc(road.haveQty == null ? '' : road.haveQty) + '" placeholder="' + t('est') + '"></label>' +
      '<div class="err-msg" id="rErr"></div>' +
      '<button class="btn primary block" id="rSave">' + IC.check + t('save') + '</button>' + (isNew ? '' : '<button class="btn danger block" id="rDel">' + t('del') + '</button>');
    openSheet(isNew ? t('newRoad') : t('editRoad'), body, function (sh) {
      wireSegs(sh);
      $('#rSave', sh).onclick = function () {
        var sym = $('#rSym', sh).value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        var goal = num($('#rGoal', sh).value), days = Math.round(num($('#rDays', sh).value)), daily = num($('#rDaily', sh).value);
        var done = Math.max(0, Math.round(num($('#rDone', sh).value) || 0)), have = $('#rHave', sh).value.trim();
        var start = $('#rStart', sh).value || today();
        if (!sym || !(goal > 0) || !(days > 0) || !(daily > 0)) { $('#rErr', sh).textContent = t('required'); return; }
        var rec = Object.assign({}, road, { id: road.id || Store.id(), sym: sym, goalQty: goal, planDays: days, daily: { value: daily, currency: segVal(sh, 'cur') },
          startDate: start, completedDays: done, haveQty: have === '' ? null : num(have) });
        if (isNew) S.roads.push(rec); else S.roads = S.roads.map(function (r) { return r.id === rec.id ? rec : r; });
        save(); closeSheet(); render(); toast(t('saved')); refreshLive();
      };
      if (!isNew) $('#rDel', sh).onclick = function (e) {
        twoTap(e.currentTarget, t('delSure'), function () { S.roads = S.roads.filter(function (r) { return r.id !== road.id; }); save(); closeSheet(); render(); });
      };
    });
  }

  function priceSheet(sym) {
    var m = market(), c = cur();
    var mp = S.settings.manualPrices[sym];
    var cp = P.priceIn(m, sym, c);
    var body = '<div class="muted">' + badge(sym) + ' <b>' + esc(sym) + '</b> · ' + t('price') + ': ' + (cp != null ? money(cp, c) : '—') + ' ' + srcTag((m.prices[sym] || {}).source || 'none') + '</div>' +
      '<div class="field"><span>' + t('enterPrice') + '</span><div class="inrow"><input class="input" id="pVal" inputmode="decimal" value="' + esc(mp ? mp.value : '') + '" placeholder="' + (cp != null ? esc(P.money(cp, c).replace(/[$₩]/, '')) : '') + '">' +
      segHtml('cur', [['USD', '$'], ['KRW', '₩']], mp ? mp.currency : c) + '</div></div>' +
      '<button class="btn primary block" id="pSave">' + IC.check + t('save') + '</button>' +
      (mp ? '<button class="btn ghost block" id="pAuto">' + t('useLive') + '</button>' : '');
    openSheet(t('price') + ' · ' + sym, body, function (sh) {
      wireSegs(sh);
      $('#pSave', sh).onclick = function () {
        var v = num($('#pVal', sh).value);
        if (v > 0) S.settings.manualPrices[sym] = { value: v, currency: segVal(sh, 'cur') };
        save(); closeSheet(); render();
      };
      var a = $('#pAuto', sh); if (a) a.onclick = function () { delete S.settings.manualPrices[sym]; save(); closeSheet(); render(); };
    });
  }

  function settingsSheet() {
    var m = market(), c = cur();
    var syms = symbolsInUse();
    var body = '<div class="set-group"><h3>' + t('language') + '</h3>' + segHtml('lang', [['auto', t('auto')], ['en', 'English'], ['ko', '한국어']], S.settings.lang).replace('seg sm', 'seg sm txt') + '</div>' +
      '<div class="set-group"><h3>' + t('upColor') + '</h3>' + segHtml('up', [['auto', t('auto')], ['green', '<span style="color:#12804a">▲</span> Green'], ['red', '<span style="color:#d2342b">▲</span> Red']], S.settings.upColor).replace('seg sm', 'seg sm txt') + '</div>' +
      '<div class="set-group"><h3>' + t('rate') + '</h3><div class="muted">$1 = ' + P.money(m.rate, 'KRW', { decimals: 2 }) + ' ' + srcTag(m.rateSource) + ' ' + when(m.rateTime) + '</div>' +
      '<div class="inrow"><input class="input" id="sRate" inputmode="decimal" placeholder="₩ ' + t('perUsd') + '" value="' + esc(S.settings.manualRate || '') + '"><button class="btn ghost" id="sRateSave">' + t('save') + '</button></div>' +
      (S.settings.manualRate ? '<button class="btn ghost block" id="sRateLive">' + t('useLive') + '</button>' : '') + '</div>' +
      '<div class="set-group"><h3>' + t('priceEdit') + '</h3>' + syms.map(function (s) {
        var p = P.priceIn(m, s, c);
        return '<button class="lot" style="border:0;text-align:left" data-act="price" data-sym="' + esc(s) + '"><div><b>' + esc(s) + '</b> ' + srcTag((m.prices[s] || {}).source || 'none') + '</div><div>' + (p != null ? money(p, c) : '—') + ' ' + IC.edit + '</div></button>';
      }).join('') +
      '<button class="btn ghost block" id="sRefresh">' + t('refresh') + '</button></div>' +
      '<div class="set-group"><h3>' + t('apiKey') + '</h3>' +
      '<div class="muted" style="font-size:13px;margin-bottom:8px">' + t('apiKeyNote') + '</div>' +
      (S.settings.apiKey ? '<div class="small" style="color:var(--up);margin-bottom:6px">' + t('apiKeySet') + '</div>' : '') +
      '<div class="inrow"><input class="input" id="sApiKey" type="password" placeholder="sk-ant-..." value="' + esc(S.settings.apiKey || '') + '"><button class="btn ghost" id="sApiSave">' + t('save') + '</button></div>' +
      (S.settings.apiKey ? '<button class="btn ghost block" id="sApiClear">' + t('apiKeyClear') + '</button>' : '') + '</div>' +
      '<div class="set-group"><h3>' + t('backup') + '</h3><button class="btn ghost block" id="sCopy">' + t('copy') + '</button>' +
      '<textarea class="input" id="sBackup" placeholder="' + t('restorePh') + '"></textarea><button class="btn ghost block" id="sRestore">' + t('restore') + '</button></div>' +
      '<div class="small">' + t('privacy') + '</div>' +
      '<button class="btn danger block" id="sWipe">' + t('wipe') + '</button>';
    openSheet(t('settings'), body, function (sh) {
      wireSegs(sh, function () {
        S.settings.lang = segVal(sh, 'lang'); S.settings.upColor = segVal(sh, 'up');
        I18n.set(S.settings.lang === 'auto' ? I18n.detect() : S.settings.lang); save(); render(); settingsSheet();
      });
      $('#sRateSave', sh).onclick = function () {
        var v = num($('#sRate', sh).value);
        S.settings.manualRate = v > 0 ? v : null; S.settings.manualRateTime = v > 0 ? new Date().toISOString() : null; save(); render(); settingsSheet();
      };
      var rl = $('#sRateLive', sh); if (rl) rl.onclick = function () { S.settings.manualRate = null; save(); render(); settingsSheet(); refreshLive(); };
      $('#sRefresh', sh).onclick = function () { refreshLive(); closeSheet(); };
      $('#sCopy', sh).onclick = function (e) {
        var txt = JSON.stringify({ lots: S.lots, roads: S.roads, settings: S.settings });
        var ta = $('#sBackup', sh);
        var done = function () { e.target.textContent = t('copied'); };
        try { navigator.clipboard.writeText(txt).then(done, function () { ta.value = txt; ta.select(); }); } catch (err) { ta.value = txt; ta.select(); }
      };
      $('#sRestore', sh).onclick = function () {
        try {
          var d = JSON.parse($('#sBackup', sh).value);
          if (!Array.isArray(d.lots)) throw 0;
          S.lots = d.lots; S.roads = Array.isArray(d.roads) ? d.roads : []; S.settings = Object.assign(Store.blank().settings, d.settings || {});
          save(); closeSheet(); render(); toast(t('saved'));
        } catch (err) { $('#sBackup', sh).classList.add('err'); }
      };
      $('#sApiSave', sh).onclick = function () {
        var v = $('#sApiKey', sh).value.trim();
        S.settings.apiKey = v; save(); toast(t('apiKeySaved')); render(); settingsSheet();
      };
      var apiClr = $('#sApiClear', sh);
      if (apiClr) apiClr.onclick = function () { S.settings.apiKey = ''; save(); render(); settingsSheet(); };
      $('#sWipe', sh).onclick = function (e) {
        twoTap(e.currentTarget, t('wipeSure'), function () { S = Store.blank(); save(); closeSheet(); render(); });
      };
    });
  }

  /* ---------- photo flow ---------- */
  function toPending(rows, defCur) {
    return rows.map(function (r) {
      return { sym: r.sym || '', qty: r.qty != null ? r.qty : '', paidValue: r.paid ? r.paid.value : '', paidCur: r.paid ? r.paid.currency : (defCur || cur()), note: r.note || '' };
    });
  }
  function onPhoto(e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    ui.scanFile = f; ui.scanStatus = 'reading'; ui.scanProgress = 0; ui.scanMsg = ''; ui.scanText = '';
    render();
    var workerUrl = (typeof STACKMATH_WORKER !== 'undefined' && STACKMATH_WORKER) ? STACKMATH_WORKER : null;
    var apiKey = S.settings.apiKey;
    var ocrRead = Scan.readWithOCR.bind(Scan, f, function (status, p) {
      ui.scanProgress = /recogn/i.test(status) ? 0.4 + p * 0.6 : Math.min(0.4, p * 0.4);
      var b = document.querySelector('.bar i'); if (b) b.style.width = Math.round(ui.scanProgress * 100) + '%';
    });
    var readPromise = workerUrl
      ? Scan.readWithWorker(f, workerUrl).then(function (workerRes) {
          // Worker found symbols/qty but no paid amounts → supplement with Tesseract
          var hasPaid = workerRes.rows && workerRes.rows.some(function (r) { return r.paid; });
          if (!hasPaid && workerRes.rows && workerRes.rows.length) {
            return ocrRead().then(function (ocrRes) {
              var ocrMap = Object.create(null);
              (ocrRes.rows || []).forEach(function (r) { if (r.sym) ocrMap[r.sym] = r; });
              // Fill missing paid/qty in worker rows from OCR
              var workerSyms = Object.create(null);
              workerRes.rows.forEach(function (r) {
                workerSyms[r.sym] = true;
                var o = ocrMap[r.sym];
                if (!r.paid && o) {
                  if (o.paid) r.paid = o.paid;
                  else if (o.avg != null && r.qty != null) r.paid = { value: o.avg * r.qty, currency: workerRes.currency || 'KRW' };
                }
                if (r.qty == null && o && o.qty != null) r.qty = o.qty;
              });
              // Add coins OCR found that worker missed entirely
              (ocrRes.rows || []).forEach(function (r) {
                if (r.sym && !workerSyms[r.sym]) workerRes.rows.push(r);
              });
              return workerRes;
            }).catch(function () { return workerRes; });
          }
          return workerRes;
        }).catch(function () { return ocrRead(); })
      : apiKey
        ? Scan.readWithAnthropicAPI(f, apiKey).catch(function () { return ocrRead(); })
        : ocrRead();
    readPromise.then(function (res) {
      ui.scanText = res.text || '';
      S.pending = toPending(res.rows, res.currency);
      if (!S.pending.length) { ui.scanMsg = t('nothing'); S.pending = [{ sym: '', qty: '', paidValue: '', paidCur: res.currency || cur(), note: '' }]; }
      ui.scanStatus = 'review'; save(); render(); refreshLive();
    }, function () {
      ui.scanMsg = t('ocrFail'); ui.scanStatus = 'review';
      S.pending = [{ sym: '', qty: '', paidValue: '', paidCur: cur(), note: '' }]; save(); render();
    });
  }
  function saveScan() {
    var wallet = (($('#scanWallet') || {}).value || ui.wallet || 'Photo').trim();
    ui.wallet = wallet;
    var keep = [], n = 0;
    S.pending.forEach(function (r) {
      var sym = String(r.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), q = num(r.qty), v = num(r.paidValue);
      if (sym && q > 0 && v > 0) {
        S.lots.push({ id: Store.id(), sym: sym, wallet: wallet, qty: q, paid: { value: v, currency: r.paidCur }, entry: 'total', source: 'photo', date: today() });
        n++;
      } else if (sym || r.qty !== '' || r.paidValue !== '') keep.push(r);      // a coin with no paid amount waits here
    });
    S.pending = keep;
    if (!keep.length) { ui.scanStatus = 'idle'; ui.scanFile = null; ui.scanText = ''; ui.scanMsg = ''; ui.tab = 'avg'; }
    save(); render(); if (n) toast(t('saved') + ' · ' + n); refreshLive();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    var tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { ui.tab = tabBtn.dataset.tab; render(); window.scrollTo(0, 0); return; }
    var cb = e.target.closest('#curSeg button');
    if (cb) { S.settings.cur = cb.dataset.cur; save(); render(); return; }
    if (e.target.closest('#gear') || e.target.closest('#rateLine')) { settingsSheet(); return; }
    if (!a) return;
    var act = a.dataset.act;
    if (act === 'closeBg' && e.target !== a) return;
    switch (act) {
      case 'close': case 'closeBg': closeSheet(); break;
      case 'toggleCoin': ui.open = ui.open === a.dataset.sym ? null : a.dataset.sym; render(); break;
      case 'addLot': lotSheet(null); break;
      case 'editLot': lotSheet(S.lots.filter(function (l) { return l.id === a.dataset.id; })[0]); break;
      case 'price': priceSheet(a.dataset.sym); break;
      case 'addRoad': roadSheet(null); break;
      case 'editRoad': roadSheet(S.roads.filter(function (r) { return r.id === a.dataset.id; })[0]); break;
      case 'checkin':
        S.roads = S.roads.map(function (r) {
          if (r.id !== a.dataset.id) return r;
          return (r.checkins || []).indexOf(today()) !== -1 ? DCA.undoCheckIn(r, today()) : DCA.checkIn(r, today());
        });
        save(); render(); break;
      case 'goReview': ui.tab = 'photo'; ui.scanStatus = 'review'; render(); break;
      case 'rmRow': S.pending.splice(+a.dataset.i, 1); if (!S.pending.length) ui.scanStatus = 'idle'; save(); render(); break;
      case 'addRow': S.pending.push({ sym: '', qty: '', paidValue: '', paidCur: cur(), note: '' }); ui.scanStatus = 'review'; save(); render(); break;
      case 'rowCur': S.pending[+a.dataset.i].paidCur = a.dataset.cur; save(); render(); break;
      case 'saveScan': saveScan(); break;
      case 'discardScan': S.pending = []; ui.scanStatus = 'idle'; ui.scanFile = null; ui.scanText = ''; ui.scanMsg = ''; save(); render(); break;
      case 'claudeRead':
        a.disabled = true; a.textContent = t('reading');
        (function () {
          var wUrl = (typeof STACKMATH_WORKER !== 'undefined' && STACKMATH_WORKER) ? STACKMATH_WORKER : null;
          if (wUrl) return Scan.readWithWorker(ui.scanFile, wUrl);
          if (S.settings.apiKey) return Scan.readWithAnthropicAPI(ui.scanFile, S.settings.apiKey);
          return Scan.readWithClaude(ui.scanFile);
        })().then(function (res) {
          if (res.rows.length) { S.pending = toPending(res.rows); ui.scanMsg = ''; }
          save(); render(); refreshLive();
        }, function () { a.disabled = false; a.textContent = S.settings.apiKey ? t('readWithApi') : t('readAgainClaude'); });
        break;
    }
  });
  // review rows: update the model as the user types; refresh only the conversion line (keeps focus)
  document.addEventListener('input', function (e) {
    var row = e.target.closest('.srow'); if (row && e.target.dataset.f) {
      var r = S.pending[+row.dataset.i]; r[e.target.dataset.f] = e.target.value; r.note = e.target.dataset.f === 'paidValue' ? '' : r.note;
      var miss = !(num(r.paidValue) > 0);
      row.classList.toggle('missing', miss);
      row.querySelector('[data-f="paidValue"]').classList.toggle('err', miss);
      row.querySelector('.conv').innerHTML = rowConv(r, cur(), market());
      var complete = S.pending.filter(function (x) { return num(x.paidValue) > 0; }).length;
      var sb = document.querySelector('[data-act="saveScan"]'); if (sb) sb.innerHTML = IC.check + t('saveN') + ' (' + complete + ')';
      save();
    }
    if (e.target.id === 'scanWallet') ui.wallet = e.target.value;
  });

  /* ---------- start ---------- */
  I18n.set(S.settings.lang === 'auto' ? I18n.detect() : S.settings.lang);
  if (S.pending.length) ui.scanStatus = 'review';
  render();
  refreshLive();
  setInterval(function () { if (!document.hidden) refreshLive(); }, 120000);
  Scan.claudeReader().then(function (s) { ui.claude = s; if (s && ui.tab === 'photo') render(); });
  window.__app = { state: function () { return S; }, market: market, render: render };   // for tests
})();
