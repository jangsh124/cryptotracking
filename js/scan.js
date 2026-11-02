/* scan.js — read a holdings screenshot into rows for the review screen.
   Nothing here saves anything: it only returns rows. The UI shows them for review first.
   Row = { sym, qty, paid: {value, currency} | null, avg, note }
   Two readers:
     1. On-device OCR (Tesseract, files shipped with the site, image never leaves the phone)
     2. Optional: Claude vision via the artifact `sample` capability, when the viewer has it. */
(function (root) {
  var Coins = root.Coins || (typeof require !== 'undefined' ? require('./coins.js') : null);

  /* ---------- text → rows (pure, testable) ---------- */
  var RE_NUM = /[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)|[-+]?\d{1,3}(?:\.\d{3}){2,}(?![\d.])|[-+]?\d*\.\d+|[-+]?\d+/g;
  var LBL = {
    value: /평가\s*금액|평가\s*손익|평가|손익|수익률|市值|現在価値|当前\s*价值|时价|market\s*value|current\s*value|portfolio\s*value|value|profit|p\s*\/\s*l|pnl|return|change/i,
    avg: /매수\s*평균가|평균\s*단가|평균|평단|买入\s*均价|平均\s*取得\s*価格|取得\s*単価|平均\s*成本|avg\.?\s*buy|average\s*buy|avg\.?\s*price|avg\.?\s*cost|average\s*cost|avg|average|entry\s*price|unit\s*cost|cost\s*per|break[\s-]*even/i,
    paid: /매수\s*금액|매입\s*금액|투자\s*금액|구매\s*금액|원금|持仓\s*成本|买入\s*金额|投入\s*金额|投入|購入\s*金額|取得\s*金額|total\s*cost|cost\s*basis|total\s*invested|amount\s*invested|net\s*cost|book\s*value|invested|total\s*paid|amount\s*paid|paid|cost/i,
    qty: /보유\s*수량|보유량|수량|保有\s*数量|持仓\s*数量|保有量|quantity|qty|balance|holdings?|amount/i
  };
  var STOP = { KRW: 1, USD: 1, USDC: 0, BUY: 1, SELL: 1, ALL: 1, MAX: 1, TOTAL: 1, AVG: 1, PNL: 1, ROI: 1 };

  function toNumber(s) {
    s = String(s).replace(/\s/g, '');
    if (/^\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '');      // 1.500.176 (OCR read commas as dots)
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else if (/^\d+,\d+$/.test(s)) s = s.replace(',', '.');               // 0,25 decimal comma
    var n = parseFloat(s.replace(/,/g, ''));
    return isNaN(n) ? null : n;
  }

  /* numbers in a line, skipping percentages */
  function numbersIn(line) {
    var out = [], m;
    RE_NUM.lastIndex = 0;
    while ((m = RE_NUM.exec(line))) {
      var after = line.slice(m.index + m[0].length, m.index + m[0].length + 2);
      if (/^\s?%/.test(after)) continue;
      var n = toNumber(m[0]);
      if (n != null) out.push({ n: n, raw: m[0], at: m.index });
    }
    return out;
  }

  function lineCurrency(line) {
    if (/₩|원|KRW|\bW\s?\d/i.test(line)) return 'KRW';
    if (/\$|USD|USDT/i.test(line)) return 'USD';
    if (/¥|円|JPY/i.test(line)) return 'JPY';
    if (/元|人民币|CNY|RMB/i.test(line)) return 'CNY';
    return null;
  }

  var KO = Coins.list.slice().sort(function (a, b) { return b.ko.length - a.ko.length; });
  var EN = Coins.list.filter(function (c) { return c.name.length >= 4; })
    .sort(function (a, b) { return b.name.length - a.name.length; });

  function findCoin(line) {
    var compact = line.replace(/\s/g, '');
    for (var i = 0; i < KO.length; i++) if (compact.indexOf(KO[i].ko) !== -1) return KO[i].symbol;
    var toks = line.match(/\b[A-Z]{2,6}\b/g) || [];
    for (var j = 0; j < toks.length; j++) if (!STOP[toks[j]] && Coins.get(toks[j])) return toks[j];
    var low = line.toLowerCase();
    for (var k = 0; k < EN.length; k++) {
      var nm = EN[k].name.toLowerCase();
      var idx = low.indexOf(nm);
      if (idx !== -1 && !/[a-z]/.test(low.charAt(idx + nm.length) || '')) return EN[k].symbol;
    }
    return null;
  }

  function labelOf(line) {
    // order matters: "avg cost" is an average, "평가금액" is value, not paid
    if (LBL.avg.test(line)) return 'avg';
    if (LBL.value.test(line)) return 'value';
    if (LBL.paid.test(line)) return 'paid';
    if (LBL.qty.test(line)) return 'qty';
    return null;
  }

  function parseHoldings(text) {
    var lines = String(text || '').split(/\r?\n/)
      .map(function (l) { return l.trim().replace(/([\uac00-\ud7a3])\s+(?=[\uac00-\ud7a3])/g, '$1'); })  // OCR spaces out Hangul: 매 수 금 액 → 매수금액
      .filter(Boolean);
    var krw = 0, usd = 0;
    lines.forEach(function (l) { var c = lineCurrency(l); if (c === 'KRW') krw++; if (c === 'USD') usd++; });
    var defaultCur = krw > usd ? 'KRW' : 'USD';

    var anchors = [];
    lines.forEach(function (l, i) { var s = findCoin(l); if (s) anchors.push({ i: i, sym: s }); });

    var rows = {};
    anchors.forEach(function (a, k) {
      var end = Math.min(lines.length, k + 1 < anchors.length ? anchors[k + 1].i : a.i + 8, a.i + 8);
      var row = { sym: a.sym, qty: null, paid: null, avg: null, note: '' };
      var paidCur = null, avgCur = null;
      for (var i = a.i; i < end; i++) {
        var line = lines[i];
        var lab = labelOf(line);
        var nums = numbersIn(line);
        if (!nums.length && lab && i + 1 < end) { nums = numbersIn(lines[i + 1]); }  // label on one line, number below
        if (!nums.length) continue;
        if (lab === 'qty' && row.qty == null) row.qty = nums[0].n;
        else if (lab === 'paid' && row.paid == null) { row.paid = nums[nums.length - 1].n; paidCur = lineCurrency(line) || lineCurrency(lines[i + 1] || ''); }
        else if (lab === 'avg' && row.avg == null) { row.avg = nums[nums.length - 1].n; avgCur = lineCurrency(line) || lineCurrency(lines[i + 1] || ''); }
        else if (!lab && row.qty == null) {
          // "0.5 BTC" or "BTC 0.5": a number right next to the symbol is the quantity
          var re = new RegExp('([\\d.,]+)\\s*' + a.sym + '\\b|\\b' + a.sym + '\\s+([\\d.,]+)');
          var m = line.match(re);
          if (m) row.qty = toNumber(m[1] || m[2]);
        }
      }
      var cur = paidCur || defaultCur;
      if (row.paid != null) row.paid = { value: row.paid, currency: cur };
      else if (row.avg != null && row.qty != null) {
        row.paid = { value: row.avg * row.qty, currency: avgCur || defaultCur };
        row.note = 'avg×qty';
      }
      var prev = rows[a.sym];
      var score = function (r) { return (r.qty != null ? 1 : 0) + (r.paid ? 2 : 0); };
      if (!prev || score(row) > score(prev)) rows[a.sym] = row;
    });
    return { rows: Object.keys(rows).map(function (k) { return rows[k]; }), currency: defaultCur };
  }

  /* ---------- image → canvas (upscale, grayscale, invert dark mode) ---------- */
  function prepareImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(2.5, Math.max(1, 1600 / img.width));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        var g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, c.width, c.height);
        var d = g.getImageData(0, 0, c.width, c.height), px = d.data, sum = 0;
        for (var i = 0; i < px.length; i += 4) {
          var y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          px[i] = px[i + 1] = px[i + 2] = y; sum += y;
        }
        var dark = sum / (px.length / 4) < 115;
        for (var j = 0; j < px.length; j += 4) {
          var v = dark ? 255 - px[j] : px[j];
          v = Math.max(0, Math.min(255, (v - 128) * 1.35 + 128));          // a little more contrast
          px[j] = px[j + 1] = px[j + 2] = v;
        }
        g.putImageData(d, 0, 0);
        URL.revokeObjectURL(url);
        resolve(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });
  }

  /* ---------- on-device OCR ---------- */
  var workerPromise = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (root.Tesseract) return res();
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('ocr-load')); };
      document.head.appendChild(s);
    });
  }
  function getWorker(onProgress) {
    if (workerPromise) return workerPromise;
    var base = new URL('vendor/', document.baseURI).href;
    // Language files ship as base64 text (the host serves .txt, not .gz); Tesseract un-gzips them itself.
    function lang(code) {
      return fetch(base + 'lang/' + code + '.traineddata.txt').then(function (r) {
        if (!r.ok) throw new Error('lang'); return r.text();
      }).then(function (b64) {
        var bin = atob(b64.trim()), u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return { code: code, data: u8 };
      });
    }
    workerPromise = Promise.all([loadScript(base + 'tesseract.min.js'), lang('eng'), lang('kor')]).then(function (r) {
      return root.Tesseract.createWorker([r[1], r[2]], 1, {
        workerPath: base + 'worker.min.js', corePath: base + 'core', langPath: base + 'lang',
        workerBlobURL: false, cacheMethod: 'none',
        logger: function (m) { if (onProgress && m && typeof m.progress === 'number') onProgress(m.status, m.progress); }
      });
    }).catch(function (e) { workerPromise = null; throw e; });
    return workerPromise;
  }
  function readWithOCR(file, onProgress) {
    return Promise.all([prepareImage(file), getWorker(onProgress)]).then(function (r) {
      return r[1].recognize(r[0]).then(function (res) {
        var text = res.data.text;
        var parsed = parseHoldings(text);
        parsed.text = text;
        return parsed;
      });
    });
  }

  /* ---------- optional: Claude vision (artifact `sample` capability) ---------- */
  var samplePromise = null;
  function claudeReader() {
    if (!samplePromise) {
      samplePromise = (root.claude && root.claude.use ? root.claude.use('sample') : Promise.resolve(null))
        .then(function (s) {
          if (!s) return null;
          return s.limits().then(function (l) { return l && l.images ? s : null; }, function () { return null; });
        }).catch(function () { return null; });
    }
    return samplePromise;
  }
  function readWithClaude(file) {
    return claudeReader().then(function (sample) {
      if (!sample) throw { code: 'unavailable' };
      var prompt = 'This image is a screenshot of a crypto holdings list from a wallet or exchange app. ' +
        'Read every coin row. For each coin return its ticker symbol (e.g. BTC), the quantity held, and the TOTAL amount paid ' +
        '(purchase cost / 매수금액 / cost basis) only if it is visible. If only an average buy price is visible, return it as avgPrice. ' +
        'Do not use current value or profit as the paid amount. currency is "KRW" for won (₩, 원, KRW) or "USD" for dollars. ' +
        'Use null for anything not visible. Answer with JSON only: {"rows":[{"symbol":"BTC","quantity":0.5,"totalPaid":31500,"avgPrice":null,"currency":"USD"}]}';
      return sample.json(prompt, { images: [file], modelTier: 'default' }).then(function (j) {
        var rows = ((j && j.rows) || []).map(function (r) {
          var cur = r.currency === 'KRW' ? 'KRW' : 'USD';
          var q = Number(r.quantity) > 0 ? Number(r.quantity) : null;
          var paid = Number(r.totalPaid) > 0 ? { value: Number(r.totalPaid), currency: cur } : null;
          var note = '';
          if (!paid && Number(r.avgPrice) > 0 && q) { paid = { value: Number(r.avgPrice) * q, currency: cur }; note = 'avg×qty'; }
          return { sym: String(r.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), qty: q, paid: paid, note: note };
        }).filter(function (r) { return r.sym; });
        return { rows: rows };
      });
    });
  }

  /* ---------- direct Anthropic API (user's own key, stored in localStorage) ---------- */
  function readWithAnthropicAPI(file, apiKey) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var b64 = e.target.result.split(',')[1];
        var mt = (file.type || 'image/jpeg');
        if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].indexOf(mt) === -1) mt = 'image/jpeg';
        var prompt = 'This is a crypto wallet or exchange holdings screenshot. ' +
          'Extract every coin row visible. For each return: ' +
          'symbol (ticker like BTC), quantity (decimal), ' +
          'totalPaid (TOTAL purchase cost/cost basis/invested — NOT current value or profit), ' +
          'avgPrice (avg buy price per coin if totalPaid not shown), ' +
          'currency ("KRW" for ₩/원/KRW, "USD" for $, "JPY" for ¥, else "USD"). ' +
          'Works in any language (Korean, English, Japanese, Chinese, etc.). ' +
          'Use null for unseen fields. ' +
          'Reply with JSON only: {"defaultCurrency":"KRW","rows":[{"symbol":"BTC","quantity":0.5,"totalPaid":45000000,"avgPrice":null,"currency":"KRW"}]}';
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5', max_tokens: 1024,
            messages: [{ role: 'user', content: [
              { type: 'image', source: { type: 'base64', media_type: mt, data: b64 } },
              { type: 'text', text: prompt }
            ]}]
          })
        }).then(function (r) {
          if (!r.ok) return r.json().then(function (e) { throw new Error((e.error && e.error.message) || 'api-' + r.status); });
          return r.json();
        }).then(function (data) {
          var text = (data.content && data.content[0] && data.content[0].text) || '';
          var m = text.match(/\{[\s\S]*\}/);
          if (!m) throw new Error('no-json');
          var j = JSON.parse(m[0]);
          var defCur = j.defaultCurrency || 'USD';
          var rows = ((j && j.rows) || []).map(function (r) {
            var cur = r.currency || defCur;
            var q = Number(r.quantity) > 0 ? Number(r.quantity) : null;
            var paid = Number(r.totalPaid) > 0 ? { value: Number(r.totalPaid), currency: cur } : null;
            var note = '';
            if (!paid && Number(r.avgPrice) > 0 && q) { paid = { value: Number(r.avgPrice) * q, currency: cur }; note = 'avg×qty'; }
            return { sym: String(r.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), qty: q, paid: paid, note: note };
          }).filter(function (r) { return r.sym; });
          resolve({ rows: rows, currency: defCur });
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error('file-read')); };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Cloudflare Worker proxy (site owner's API key, no user setup needed) ---------- */
  function sliceImageForWorker(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var maxW = 900, maxSectionH = 1100;
        var scaleW = img.width > maxW ? maxW / img.width : 1;
        var scaledW = Math.round(img.width * scaleW);
        var scaledH = Math.round(img.height * scaleW);
        var numSections = Math.ceil(scaledH / maxSectionH);
        var sectionH = Math.ceil(scaledH / numSections);
        var overlap = Math.round(sectionH * 0.08);
        var sections = [];
        for (var i = 0; i < numSections; i++) {
          var sy = Math.max(0, i * sectionH - overlap);
          var ey = Math.min(scaledH, (i + 1) * sectionH + overlap);
          var sh = ey - sy;
          var c = document.createElement('canvas');
          c.width = scaledW; c.height = sh;
          c.getContext('2d').drawImage(img,
            0, sy / scaleW, img.width, sh / scaleW,
            0, 0, scaledW, sh);
          sections.push({ b64: c.toDataURL('image/jpeg', 0.85).split(',')[1], mt: 'image/jpeg' });
        }
        URL.revokeObjectURL(url);
        resolve(sections);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  }
  function parseWorkerRows(j, defCurFallback) {
    var defCur = (j && j.defaultCurrency) || defCurFallback || 'KRW';
    return ((j && j.rows) || []).map(function (r) {
      var cur = r.currency || defCur;
      var q = Number(r.quantity) > 0 ? Number(r.quantity) : null;
      var paid = Number(r.totalPaid) > 0 ? { value: Number(r.totalPaid), currency: cur } : null;
      var note = '';
      if (!paid && Number(r.avgPrice) > 0 && q) { paid = { value: Number(r.avgPrice) * q, currency: cur }; note = 'avg×qty'; }
      return { sym: String(r.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), qty: q, paid: paid, note: note };
    }).filter(function (r) { return r.sym; });
  }
  function readWithWorker(file, workerUrl) {
    return sliceImageForWorker(file).then(function (sections) {
      return Promise.all(sections.map(function (img) {
        return fetch(workerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: img.b64, mediaType: img.mt })
        }).then(function (r) {
          if (!r.ok) return r.json().then(function (e) { throw new Error((e && e.error) || 'worker-' + r.status); });
          return r.json();
        });
      }));
    }).then(function (results) {
      var defCur = (results[0] && results[0].defaultCurrency) || 'KRW';
      var seen = Object.create(null);
      results.forEach(function (j) {
        parseWorkerRows(j, defCur).forEach(function (row) {
          if (!seen[row.sym] || (!seen[row.sym].paid && row.paid) || (!seen[row.sym].qty && row.qty)) {
            seen[row.sym] = row;
          }
        });
      });
      return { rows: Object.values(seen), currency: defCur };
    });
  }

  var api = { parseHoldings: parseHoldings, numbersIn: numbersIn, toNumber: toNumber,
              readWithOCR: readWithOCR, readWithClaude: readWithClaude, claudeReader: claudeReader,
              readWithAnthropicAPI: readWithAnthropicAPI, readWithWorker: readWithWorker };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Scan = api;
})(this);
