/* store.js — this visitor's data, kept only in this browser (localStorage). Never sent anywhere. */
(function (root) {
  var KEY = 'stackmath.v1';
  var mem = null; // fallback when storage is blocked (private mode etc.)

  function blank() {
    return {
      lots: [], roads: [], pending: [],
      settings: { cur: null, lang: 'auto', upColor: 'auto', manualRate: null, manualRateTime: null, manualPrices: {}, customIds: {}, apiKey: '' },
      example: false
    };
  }
  function load() {
    var data = null;
    try { var raw = localStorage.getItem(KEY); if (raw) data = JSON.parse(raw); } catch (e) { data = mem; }
    var b = blank();
    if (!data || typeof data !== 'object') return b;
    data.settings = Object.assign(b.settings, data.settings || {});
    ['lots', 'roads', 'pending'].forEach(function (k) { if (!Array.isArray(data[k])) data[k] = []; });
    return data;
  }
  function save(data) {
    mem = data;
    try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
  }
  function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  root.Store = { load: load, save: save, blank: blank, id: id };
})(this);
