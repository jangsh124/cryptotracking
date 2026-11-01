/* Run: node tests/test.js — acceptance tests for the math, currency and scan parser. */
global.Coins = require('../js/coins.js');
global.Prices = require('../js/prices.js');
var AvgCost = require('../js/avgcost.js');
var DCA = require('../js/dca.js');
var Scan = require('../js/scan.js');
var P = Prices;

var fails = 0, passes = 0;
function eq(name, got, want) {
  if (got === want) { passes++; console.log('  ok   ' + name + ' → ' + got); }
  else { fails++; console.log('  FAIL ' + name + ': got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want)); }
}
// fixed market: rate 1335, BTC price $70,000
var market = { rate: 1335, rateSource: 'manual', prices: { BTC: { usd: 70000, source: 'manual' }, ETH: { usd: 2000, source: 'manual' } } };

console.log('Avg Cost — BTC lots');
var lots = [
  { id: 1, sym: 'BTC', wallet: 'A', qty: 0.2, paid: { value: 12000, currency: 'USD' } },
  { id: 2, sym: 'BTC', wallet: 'B', qty: 0.3, paid: { value: 19500, currency: 'USD' } }
];
var s = AvgCost.summarize(lots, market, 'USD');
eq('total paid', P.money(s.coins[0].paid, 'USD'), '$31,500');
eq('total qty', s.coins[0].qty, 0.5);
eq('average cost', P.money(s.coins[0].avg, 'USD'), '$63,000');
eq('per-coin entry 60000×0.2', AvgCost.paidFromEntry('per', 60000, 0.2), 12000);

console.log('Currency — KRW lot ₩1,500,176 at $1 = ₩1,335');
var kl = [{ id: 3, sym: 'ETH', wallet: 'Upbit', qty: 0.5, paid: { value: 1500176, currency: 'KRW' } }];
var usdView = AvgCost.summarize(kl, market, 'USD');
var krwView = AvgCost.summarize(kl, market, 'KRW');
eq('USD mode', P.money(usdView.coins[0].paid, 'USD'), '$1,124');
eq('KRW mode', P.money(krwView.coins[0].paid, 'KRW'), '₩1,500,176');
eq('numbers change with currency', usdView.coins[0].paid !== krwView.coins[0].paid, true);
eq('total ₩4,318,604 → USD', P.money(P.convert(4318604, 'KRW', 'USD', 1335), 'USD'), '$3,235');
eq('no rate → no fake number', P.convert(4318604, 'KRW', 'USD', null), null);
eq('symbol follows currency (USD)', P.money(4318604, 'USD').charAt(0), '$');
eq('symbol follows currency (KRW)', P.money(4318604, 'KRW').charAt(0), '₩');

console.log('Mixed $ and ₩ lots in one coin');
var mixed = lots.concat([{ id: 4, sym: 'BTC', wallet: 'Upbit', qty: 0.1, paid: { value: 9345000, currency: 'KRW' } }]);
var mu = AvgCost.summarize(mixed, market, 'USD'), mk = AvgCost.summarize(mixed, market, 'KRW');
eq('USD: paid 31500 + 7000', P.money(mu.coins[0].paid, 'USD'), '$38,500');
eq('KRW: same total ×1335', P.money(mk.coins[0].paid, 'KRW'), '₩51,397,500');
eq('totals == sum of coin rows (USD)', Math.abs(mu.totals.paid - mu.coins.reduce(function (a, c) { return a + c.paid; }, 0)) < 1e-9, true);
eq('gains + losses == net', Math.abs(mu.totals.gains + mu.totals.losses - mu.totals.pl) < 1e-9, true);

console.log('Incomplete lot is not used');
eq('no paid → excluded', AvgCost.isComplete({ sym: 'SOL', qty: 3, paid: null }), false);

console.log('DCA Road');
var road = { sym: 'BTC', goalQty: 1, planDays: 100, daily: { value: 700, currency: 'USD' }, startDate: '2026-10-01', completedDays: 20, checkins: ['2026-10-31', '2026-11-01', '2026-11-02'] };
var r = DCA.compute(road, market, 'USD', '2026-11-02');
eq('invested 20×700', r.invested, 14000);
eq('have ≈ 14000/70000', r.have, 0.2);
eq('progress', r.progress.toFixed(1), '20.0');
eq('remaining 0.8 BTC × 70000', r.remaining, 56000);
eq('plan end (Oct 1 + 99 days)', r.planEnd, '2027-01-08');
eq('calendar days left (Nov 3 → Jan 8)', r.daysLeft, 67);
eq('need per day to finish on time', P.money(r.needDaily, 'USD'), '$836');
eq('finish date at $700/day (80 more buys)', r.finish, '2027-01-21');
eq('on time', r.onTime, false);
eq('streak', r.streak, 3);
var r2 = DCA.checkIn(Object.assign({}, road, { checkins: ['2026-11-01'] }), '2026-11-02');
eq('check-in adds a day', r2.completedDays, 21);
eq('double check-in ignored', DCA.checkIn(r2, '2026-11-02').completedDays, 21);
var rk = DCA.compute(road, market, 'KRW', '2026-11-02');
eq('DCA KRW invested converted', P.money(rk.invested, 'KRW'), '₩18,690,000');

console.log('Scan parser');
var upbit = [
  '비트코인 BTC', '보유수량 0.01523 BTC', '매수평균가 98,450,000 KRW', '평가금액 1,612,345 KRW', '매수금액 1,500,176 KRW', '평가손익 +112,169 KRW  +7.48%',
  '이더리움 ETH', '보유수량 0.5 ETH', '매수금액 2,818,428 KRW', '평가금액 3,001,000 KRW'
].join('\n');
var p1 = Scan.parseHoldings(upbit);
eq('rows', p1.rows.length, 2);
eq('BTC qty', p1.rows[0].qty, 0.01523);
eq('BTC paid', p1.rows[0].paid.value, 1500176);
eq('BTC currency', p1.rows[0].paid.currency, 'KRW');
eq('ETH paid', p1.rows[1].paid.value, 2818428);
var binance = ['Bitcoin', 'BTC 0.25', 'Avg cost $60,000.00', 'Value $17,500.00', 'Solana', 'SOL 12.5', 'Total cost $1,250.00'].join('\n');
var p2 = Scan.parseHoldings(binance);
eq('avg×qty fallback', p2.rows[0].paid.value, 15000);
eq('USD detected', p2.rows[0].paid.currency, 'USD');
eq('SOL paid', p2.rows[1].paid.value, 1250);
var p3 = Scan.parseHoldings('DOGE 1,000\nValue $74.82');
eq('no paid visible → null (asks user)', p3.rows[0].paid, null);
eq('OCR dots as commas', Scan.toNumber('1.500.176'), 1500176);

var p4 = Scan.parseHoldings('비 트 코인 BTC\n보 유 수량 0.01523 BTC\n매 수 평균가 98,450,000 KRW\n매 수 금 액 1,499,400 KRW');
eq('spaced Hangul labels (real OCR output)', p4.rows[0].paid.value, 1499400);
console.log('\n' + passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
