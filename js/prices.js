/* prices.js — coin prices, USD/KRW exchange rate, currency conversion and money formatting.
   Rule: every amount is a pair {value, currency}. Converting always goes through convert();
   formatting always goes through money(value, currency) so the symbol always matches the currency. */
(function (root) {
  var Coins = root.Coins || (typeof require !== 'undefined' ? require('./coins.js') : null);

  var SYMBOL = { USD: '$', KRW: '₩' };

  /* rate = how many KRW one USD buys (e.g. 1335). */
  function convert(value, from, to, rate) {
    if (value == null || isNaN(value)) return null;
    if (from === to) return value;
    if (!rate || !(rate > 0)) return null;           // no rate → no silent fake number
    if (from === 'KRW' && to === 'USD') return value / rate;
    if (from === 'USD' && to === 'KRW') return value * rate;
    return null;
  }

  function decimalsFor(abs, currency) {
    if (abs === 0) return 0;
    if (currency === 'KRW') {
      if (abs >= 100) return 0;
      if (abs >= 1) return 2;
    } else {
      if (abs >= 100) return 0;
      if (abs >= 1) return 2;
    }
    // tiny prices (SHIB, PEPE): keep 3 significant digits
    return Math.min(10, Math.max(2, 2 - Math.floor(Math.log10(abs))));
  }

  /* money(1123.73,'USD') → "$1,124"   money(-5,'KRW',{sign:true}) → "-₩5" */
  function money(value, currency, opts) {
    opts = opts || {};
    if (value == null || isNaN(value)) return '—';
    var abs = Math.abs(value);
    var d = opts.decimals != null ? opts.decimals : decimalsFor(abs, currency);
    var s = abs.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    var sign = value < 0 ? '-' : (opts.sign && value > 0 ? '+' : '');
    return sign + SYMBOL[currency] + s;
  }

  function qty(v) {
    if (v == null || isNaN(v)) return '—';
    var abs = Math.abs(v);
    var d = abs >= 1000 ? 2 : abs >= 1 ? 4 : 8;
    return v.toLocaleString('en-US', { maximumFractionDigits: d });
  }

  function pct(v, sign) {
    if (v == null || isNaN(v) || !isFinite(v)) return '—';
    return (sign && v > 0 ? '+' : '') + v.toFixed(2) + '%';
  }

  /* ---- live data ---- */
  function withTimeout(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) {
      clearTimeout(t);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }, function (e) { clearTimeout(t); throw e; });
  }

  /* ids: CoinGecko ids → resolves {id: usdPrice} */
  function fetchLivePrices(ids) {
    var url = 'https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=' + encodeURIComponent(ids.join(','));
    return withTimeout(url, 9000).then(function (j) {
      var out = {};
      Object.keys(j).forEach(function (id) { if (j[id] && j[id].usd != null) out[id] = j[id].usd; });
      return out;
    });
  }

  /* Find a CoinGecko id for a symbol we don't know yet. */
  function lookupSymbol(sym) {
    return withTimeout('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(sym), 8000)
      .then(function (j) {
        var hit = (j.coins || []).find(function (c) { return String(c.symbol).toUpperCase() === sym.toUpperCase(); });
        return hit ? { id: hit.id, name: hit.name } : null;
      });
  }

  function fetchLiveRate() {
    return withTimeout('https://open.er-api.com/v6/latest/USD', 8000).then(function (j) {
      if (!j.rates || !j.rates.KRW) throw new Error('no KRW');
      return { krwPerUsd: j.rates.KRW, time: new Date((j.time_last_update_unix || Date.now() / 1000) * 1000).toISOString() };
    }).catch(function () {
      return withTimeout('https://api.frankfurter.app/latest?from=USD&to=KRW', 8000).then(function (j) {
        return { krwPerUsd: j.rates.KRW, time: new Date(j.date + 'T16:00:00Z').toISOString() };
      });
    });
  }

  /* Build the price table used everywhere.
     settings.manualPrices: {SYM: {value, currency}}   settings.manualRate: number|null
     live: {prices:{id:usd}, priceTime, rate:{krwPerUsd,time}} (any part may be missing) */
  function buildMarket(symbols, live, settings) {
    live = live || {};
    settings = settings || {};
    var rateInfo;
    if (settings.manualRate > 0) rateInfo = { rate: settings.manualRate, source: 'manual', time: settings.manualRateTime || null };
    else if (live.rate) rateInfo = { rate: live.rate.krwPerUsd, source: 'live', time: live.rate.time };
    else rateInfo = { rate: Coins.SNAPSHOT_RATE.krwPerUsd, source: 'snapshot', time: Coins.SNAPSHOT_RATE.time };

    var custom = settings.customIds || {};
    var prices = {};   // SYM → {usd, source, time}
    symbols.forEach(function (sym) {
      var mp = (settings.manualPrices || {})[sym];
      if (mp && mp.value > 0) {
        var usd = convert(mp.value, mp.currency, 'USD', rateInfo.rate);
        prices[sym] = { usd: usd, source: 'manual', entered: mp };
        return;
      }
      var c = Coins.get(sym);
      var id = c ? c.id : custom[sym];
      if (id && live.prices && live.prices[id] != null) {
        prices[sym] = { usd: live.prices[id], source: 'live', time: live.priceTime };
      } else if (c) {
        prices[sym] = { usd: c.snapshotUsd, source: 'snapshot', time: Coins.SNAPSHOT_TIME };
      } else {
        prices[sym] = { usd: null, source: 'none' };
      }
    });
    return { rate: rateInfo.rate, rateSource: rateInfo.source, rateTime: rateInfo.time, prices: prices };
  }

  /* price of one coin in the display currency */
  function priceIn(market, sym, currency) {
    var p = market.prices[sym];
    if (!p || p.usd == null) return null;
    return convert(p.usd, 'USD', currency, market.rate);
  }

  var api = {
    SYMBOL: SYMBOL, convert: convert, money: money, qty: qty, pct: pct,
    fetchLivePrices: fetchLivePrices, fetchLiveRate: fetchLiveRate, lookupSymbol: lookupSymbol,
    buildMarket: buildMarket, priceIn: priceIn
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Prices = api;
})(this);
