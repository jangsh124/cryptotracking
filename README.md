# Stack Math

Free crypto tools anyone can open and use. No sign-up, no subscription, no limits.
Phone-first, English + 한국어, $ and ₩.

- **Avg Cost** — add each purchase (coin, wallet/exchange, quantity, amount paid in $ or ₩).
  Lots of the same coin combine into one weighted average: total paid ÷ total quantity.
- **DCA Road** — a goal like 1 BTC: progress, invested, still needed, per-day needed, expected finish, daily check-in streak.
- **Photo** — upload a holdings screenshot; coins are read on the phone and shown for review before anything is saved.
  Never asks for a seed phrase, private key or password.

Each visitor's data stays in their own browser (localStorage). Nothing is sent to a server.
Math only — no buy, sell or hold advice.

## Live site
Every push to `main` runs the tests and publishes to GitHub Pages
(`https://<your-username>.github.io/stack-math/`). Turn it on once:
**Settings → Pages → Source: GitHub Actions**.

## Edit and run
```
node scripts/build.js      # builds dist/
npx serve dist             # open http://localhost:3000
node tests/test.js         # math + currency + photo-parser tests
npm install && npm run e2e # full browser test (Playwright)
```

## Code map
| File | What it does |
|---|---|
| `js/prices.js`  | Live prices (CoinGecko), live USD/KRW (open.er-api.com, Frankfurter fallback), `convert()`, `money()` |
| `js/avgcost.js` | Weighted average cost; every lot converted to one display currency first |
| `js/dca.js`     | DCA Road math, check-ins, streak |
| `js/scan.js`    | Screenshot → rows (on-device Tesseract OCR, optional Claude vision inside claude.ai) |
| `js/coins.js`   | Coin list + dated price/FX snapshot used when live data can't load |
| `js/app.js`     | Screens and events (renders only what the modules above return) |
| `js/i18n.js`, `js/store.js`, `index.html` | Words, local storage, layout and styles |
| `vendor/`       | Tesseract OCR engine + English/Korean data (see `vendor/PATCHES.txt`) |

## Currency rule
Every amount is `{value, currency}`. Switching $/₩ recomputes every number with the exchange rate
(₩1,500,176 at $1 = ₩1,335 → $1,124). The rate used and its time are always shown; if it can't load, the page says so.
