/* dca.js — DCA Road math (steady daily buying toward a coin goal). Pure functions, no DOM.
   road = { id, sym, goalQty, planDays, daily: {value, currency}, startDate: 'YYYY-MM-DD',
            completedDays, haveQty (optional: coins actually bought so far), checkins: ['YYYY-MM-DD'] } */
(function (root) {
  var P = root.Prices || (typeof require !== 'undefined' ? require('./prices.js') : null);

  function toDay(d) { // Date → 'YYYY-MM-DD' in local time
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function parseDay(s) { var p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) {
    var d = new Date(parseDay(s) + n * 86400000);
    var m = d.getUTCMonth() + 1, day = d.getUTCDate();
    return d.getUTCFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function diffDays(a, b) { return Math.round((parseDay(b) - parseDay(a)) / 86400000); }

  /* consecutive check-in days ending today (or yesterday, if today isn't checked yet) */
  function streak(checkins, today) {
    var set = {};
    (checkins || []).forEach(function (d) { set[d] = true; });
    var day = set[today] ? today : addDays(today, -1);
    var n = 0;
    while (set[day]) { n++; day = addDays(day, -1); }
    return n;
  }

  function checkIn(road, today) {
    var list = (road.checkins || []).slice();
    if (list.indexOf(today) !== -1) return road;
    list.push(today);
    return Object.assign({}, road, { checkins: list, completedDays: (road.completedDays || 0) + 1 });
  }
  function undoCheckIn(road, today) {
    var list = (road.checkins || []).filter(function (d) { return d !== today; });
    if (list.length === (road.checkins || []).length) return road;
    return Object.assign({}, road, { checkins: list, completedDays: Math.max(0, (road.completedDays || 0) - 1) });
  }

  /* All amounts returned in display currency `cur`. */
  function compute(road, market, cur, today) {
    var daily = P.convert(road.daily.value, road.daily.currency, cur, market.rate);
    var price = P.priceIn(market, road.sym, cur);
    var done = Math.max(0, road.completedDays || 0);
    var invested = daily != null ? done * daily : null;
    var planTotal = daily != null ? road.planDays * daily : null;
    var estimated = !(road.haveQty >= 0 && road.haveQty !== null && road.haveQty !== '');
    var have = !estimated ? Number(road.haveQty) : (invested != null && price ? invested / price : null);
    var progress = have != null && road.goalQty > 0 ? Math.min(100, (have / road.goalQty) * 100) : null;
    var reached = have != null && have >= road.goalQty;
    var remainingQty = have != null ? Math.max(0, road.goalQty - have) : null;
    var remaining = remainingQty != null && price != null ? remainingQty * price : null;
    var checkedToday = (road.checkins || []).indexOf(today) !== -1;
    var nextBuy = checkedToday ? addDays(today, 1) : today;               // first day still open for buying
    var planEnd = addDays(road.startDate, road.planDays - 1);              // last planned buying day
    var daysLeft = Math.max(0, diffDays(nextBuy, planEnd) + 1);            // calendar days left in the plan
    var needDaily = remaining == null || reached ? 0 : (daysLeft > 0 ? remaining / daysLeft : null);
    var daysToFinish = reached ? 0 : (remaining != null && daily > 0 ? Math.ceil(remaining / daily) : null);
    var finish = reached ? null : (daysToFinish != null ? addDays(nextBuy, daysToFinish - 1) : null);
    return {
      daily: daily, price: price, invested: invested, planTotal: planTotal,
      planLeft: planTotal != null ? Math.max(0, planTotal - invested) : null,
      have: have, estimated: estimated, progress: progress, reached: reached,
      remainingQty: remainingQty, remaining: remaining, daysLeft: daysLeft, needDaily: needDaily,
      daysToFinish: daysToFinish, finish: finish, planEnd: planEnd,
      onTime: reached || (finish != null && diffDays(finish, planEnd) >= 0),
      streak: streak(road.checkins, today),
      checkedToday: checkedToday, done: done
    };
  }

  var api = { compute: compute, checkIn: checkIn, undoCheckIn: undoCheckIn, streak: streak,
              toDay: toDay, addDays: addDays, diffDays: diffDays };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DCA = api;
})(this);
