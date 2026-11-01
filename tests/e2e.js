// End-to-end: node tests/e2e.js  (serves dist/ on :8765)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.gz': 'application/gzip' };
http.createServer((q, s) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); s.end(d); }); }).listen(8765);
const out = p => path.join(__dirname, 'out', p); fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
let fails = 0; const check = (n, ok, info) => { console.log((ok ? '  ok   ' : '  FAIL ') + n + (info ? ' → ' + info : '')); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  // 1. make the screenshot to upload
  const sp = await b.newPage({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 2 });
  await sp.goto('file://' + path.join(__dirname, 'fake_holdings.html')); await sp.screenshot({ path: out('holdings.png'), fullPage: true });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-US' });
  const pg = await ctx.newPage(); pg.on('pageerror', e => console.log('PAGEERROR', e.message));
  await pg.goto('http://localhost:8765/'); await pg.waitForTimeout(2500);
  await pg.screenshot({ path: out('1-example.png') });
  check('rate warning shown when live fails', await pg.locator('#rateLine.bad').count() === 1, (await pg.locator('#rateLine').innerText()).slice(0, 90));
  // set manual rate 1335
  await pg.click('#gear'); await pg.fill('#sRate', '1335'); await pg.click('#sRateSave'); await pg.click('[data-act="close"]');
  check('manual rate shown', (await pg.locator('#rateLine').innerText()).includes('₩1,335.00'));
  // add two BTC lots
  for (const [w, q, a] of [['Binance', '0.2', '12000'], ['Coinbase', '0.3', '19500']]) {
    await pg.click('[data-act="addLot"]'); await pg.fill('#fSym', 'btc'); await pg.fill('#fWallet', w); await pg.fill('#fQty', q);
    await pg.click('[data-seg="cur"] [data-v="USD"]'); await pg.fill('#fAmt', a); await pg.click('#fSave');
  }
  const det = await pg.locator('.coin .detail').innerText();
  check('BTC average $63,000', det.includes('$63,000'), det.split('\n').slice(0, 8).join(' | '));
  check('BTC paid $31,500', det.includes('$31,500'));
  // photo flow
  await pg.click('[data-tab="photo"]'); await pg.setInputFiles('#photoIn', out('holdings.png'));
  await pg.waitForSelector('.srow', { timeout: 120000 });
  const rows = await pg.$$eval('.srow', rs => rs.map(r => [...r.querySelectorAll('input')].map(i => i.value).join(' / ') + ' :: ' + r.querySelector('.conv').innerText));
  console.log('  scanned rows:\n    ' + rows.join('\n    '));
  await pg.screenshot({ path: out('2-review.png'), fullPage: true });
  // edit ETH paid → 1,500,176
  const ethIdx = await pg.$$eval('.srow', rs => rs.findIndex(r => r.querySelector('[data-f="sym"]').value === 'ETH'));
  check('ETH found in scan', ethIdx >= 0);
  const eth = pg.locator('.srow').nth(ethIdx);
  await eth.locator('[data-f="paidValue"]').fill('1,500,176');
  await eth.locator('[data-act="rowCur"][data-cur="KRW"]').click();
  const conv = await pg.locator('.srow').nth(ethIdx).locator('.conv').innerText();
  check('review row shows converted $1,124', conv.includes('$1,124'), conv);
  const solMissing = await pg.$$eval('.srow.missing', rs => rs.map(r => r.querySelector('[data-f="sym"]').value));
  check('SOL (no paid amount) flagged', solMissing.includes('SOL'), JSON.stringify(solMissing));
  await pg.click('[data-act="saveScan"]');
  check('incomplete SOL stays for review', await pg.locator('.srow').count() === 1);
  await pg.screenshot({ path: out('3-after-save.png'), fullPage: true });
  await pg.click('[data-tab="avg"]');
  check('notice asks for paid amount', (await pg.locator('[data-act="goReview"]').count()) === 1);
  await pg.click('[data-act="toggleCoin"][data-sym="ETH"]');
  let d = await pg.locator('.coin .detail').innerText();
  check('ETH uses edited number: $1,124 in USD', d.includes('$1,124'), d.split('\n').slice(0, 6).join(' | '));
  const usdTotal = await pg.locator('.hero').innerText();
  await pg.screenshot({ path: out('4-avg-usd.png'), fullPage: true });
  await pg.click('#curSeg [data-cur="KRW"]');
  d = await pg.locator('.coin .detail').innerText();
  check('ETH in KRW mode: ₩1,500,176', d.includes('₩1,500,176'), d.split('\n').slice(0, 6).join(' | '));
  const krwTotal = await pg.locator('.hero').innerText();
  check('totals change with currency', usdTotal !== krwTotal, usdTotal.replace(/\n/g, ' ') + '  ||  ' + krwTotal.replace(/\n/g, ' '));
  const body = await pg.locator('#view').innerText();
  check('KRW mode shows no $ amounts', !/\$\d/.test(body.replace(/\$1 =/g, '')));
  // consistency: hero paid == sum of coin paid
  const st = await pg.evaluate(() => { const S = __app.state(), m = __app.market(); const s = AvgCost.summarize(S.lots, m, 'KRW'); return [s.totals.paid, s.coins.reduce((a, c) => a + c.paid, 0)]; });
  check('totals == per-coin sum', Math.abs(st[0] - st[1]) < 1e-6, st.join(' vs '));
  await pg.screenshot({ path: out('5-avg-krw.png'), fullPage: true });
  // DCA
  await pg.click('[data-tab="road"]'); await pg.click('[data-act="addRoad"]');
  await pg.fill('#rDaily', '200'); await pg.click('#rSheet, [data-seg="cur"] [data-v="USD"]'); await pg.fill('#rDone', '10'); await pg.click('#rSave');
  await pg.click('[data-act="checkin"]');
  const rd = await pg.locator('.road').innerText();
  check('check-in streak 1', /1\s*day streak/.test(rd), rd.replace(/\n/g, ' | ').slice(0, 200));
  await pg.screenshot({ path: out('6-road.png'), fullPage: true });
  await pg.emulateMedia({ colorScheme: 'dark' }); await pg.click('[data-tab="avg"]'); await pg.screenshot({ path: out('7-dark.png'), fullPage: true });
  console.log('\n' + (fails ? fails + ' FAILED' : 'all e2e checks passed'));
  await b.close(); process.exit(fails ? 1 : 0);
})();
