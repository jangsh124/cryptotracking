/* avgcost.js — weighted average cost math. Pure functions, no DOM.
   A lot = { id, sym, wallet, qty, paid: {value, currency} }   currency ∈ 'USD' | 'KRW'
   Average cost = total paid / total quantity, with every lot converted to ONE display currency first. */
(function (root) {
  var P = root.Prices || (typeof require !== 'undefined' ? require('./prices.js') : null);

  /* Paid amount from the entry form: either a total, or a price per coin × quantity. */
  function paidFromEntry(mode, amount, quantity) {
    amount = Number(amount); quantity = Number(quantity);
    if (!(amount > 0)) return null;
    if (mode === 'per') return quantity > 0 ? amount * quantity : null;
    return amount;
  }

  /* A lot can enter Avg Cost only with a coin, a quantity and a paid amount. */
  function isComplete(lot) {
    return !!(lot && lot.sym && lot.qty > 0 && lot.paid && lot.paid.value > 0 && P.SYMBOL[lot.paid.currency]);
  }

  /* market from Prices.buildMarket; cur = display currency.
     Returns every number already converted to `cur`, so all screens read the same values. */
  function summarize(lots, market, cur) {
    var groups = {};
    var order = [];
    var rateMissing = false;
    lots.filter(isComplete).forEach(function (lot) {
      if (!groups[lot.sym]) { groups[lot.sym] = { sym: lot.sym, qty: 0, paid: 0, lots: [], currencies: {} }; order.push(lot.sym); }
      var g = groups[lot.sym];
      var paidCur = P.convert(lot.paid.value, lot.paid.currency, cur, market.rate);
      if (paidCur == null) rateMissing = true;
      g.qty += lot.qty;
      g.paid += paidCur || 0;
      g.currencies[lot.paid.currency] = true;
      g.lots.push({ lot: lot, paid: paidCur, avg: paidCur != null ? paidCur / lot.qty : null });
    });

    var totals = { paid: 0, value: 0, pl: 0, gains: 0, losses: 0, unpriced: 0, paidPriced: 0 };
    var coins = order.map(function (sym) {
      var g = groups[sym];
      var price = P.priceIn(market, sym, cur);
      var value = price != null ? price * g.qty : null;
      var pl = value != null ? value - g.paid : null;
      var row = {
        sym: sym, qty: g.qty, paid: g.paid, avg: g.qty > 0 ? g.paid / g.qty : null,
        price: price, priceSource: (market.prices[sym] || {}).source || 'none',
        value: value, pl: pl, plPct: pl != null && g.paid > 0 ? (pl / g.paid) * 100 : null,
        lots: g.lots, mixed: Object.keys(g.currencies).length > 1
      };
      totals.paid += g.paid;
      if (value != null) {
        totals.value += value;
        totals.paidPriced += g.paid;
        totals.pl += pl;
        if (pl > 0) totals.gains += pl; else totals.losses += pl;
      } else totals.unpriced++;
      return row;
    });
    totals.plPct = totals.paidPriced > 0 ? (totals.pl / totals.paidPriced) * 100 : null;
    coins.sort(function (a, b) { return (b.value || b.paid) - (a.value || a.paid); });
    return { coins: coins, totals: totals, currency: cur, rateMissing: rateMissing };
  }

  var api = { paidFromEntry: paidFromEntry, isComplete: isComplete, summarize: summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AvgCost = api;
})(this);
