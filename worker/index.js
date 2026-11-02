/**
 * Cloudflare Worker — Google Gemini API proxy for StackMath photo scan.
 * Free tier: 1,500 requests/day, no credit card needed.
 * Deploy: wrangler deploy
 * Set secret: echo "YOUR_KEY" | wrangler secret put GEMINI_API_KEY
 */

const PROMPT =
  'This is a crypto exchange or wallet holdings screenshot. Extract ALL coin rows.\n\n' +
  'For each coin row return:\n' +
  '- symbol: coin ticker (BTC, ETH, XRP, etc.)\n' +
  '- quantity: amount held (보유수량/수량/balance)\n' +
  '- totalPaid: TOTAL purchase cost/amount invested. Korean labels: 매수금액, 매입금액, 투자금액, 구매금액, 원금, 총매수금액. English: total cost, cost basis, amount invested, total paid. NEVER use 평가금액(current value) or 손익/수익(profit). Use null if not visible.\n' +
  '- avgPrice: average buy price per coin. Korean: 매수평균가, 평균단가, 평단가, 평단. English: avg buy price, average cost. Use ONLY when totalPaid is not visible.\n' +
  '- currency: "KRW" for ₩/원/KRW, "USD" for $, "JPY" for ¥/엔, "CNY" for 위안, else "USD"\n\n' +
  'Important: totalPaid is what you PAID to buy the coins, not the current value.\n' +
  'Use null for fields not visible. Reply with JSON only, no markdown:\n' +
  '{"defaultCurrency":"KRW","rows":[{"symbol":"BTC","quantity":0.5,"totalPaid":45000000,"avgPrice":null,"currency":"KRW"}]}';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return corsWrap(new Response(null, { status: 204 }));
    }
    if (request.method !== 'POST') {
      return corsWrap(new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: json() }));
    }

    let body;
    try { body = await request.json(); } catch {
      return corsWrap(new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: json() }));
    }

    const { image, mediaType } = body;
    if (!image || !mediaType) {
      return corsWrap(new Response(JSON.stringify({ error: 'Missing image or mediaType' }), { status: 400, headers: json() }));
    }

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mt = allowed.includes(mediaType) ? mediaType : 'image/jpeg';

    let res;
    try {
      res = await fetch(`${GEMINI_URL}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mt, data: image } },
              { text: PROMPT }
            ]
          }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0 }
        })
      });
    } catch (e) {
      return corsWrap(new Response(JSON.stringify({ error: 'Upstream error' }), { status: 502, headers: json() }));
    }

    const data = await res.json();
    if (!res.ok) {
      const msg = data.error && data.error.message ? data.error.message : 'API error';
      return corsWrap(new Response(JSON.stringify({ error: msg }), { status: res.status, headers: json() }));
    }

    const text = (data.candidates && data.candidates[0] &&
                  data.candidates[0].content && data.candidates[0].content.parts &&
                  data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return corsWrap(new Response(JSON.stringify({ rows: [], defaultCurrency: 'USD' }), { headers: json() }));
    }

    try { JSON.parse(match[0]); } catch {
      return corsWrap(new Response(JSON.stringify({ rows: [], defaultCurrency: 'USD' }), { headers: json() }));
    }

    return corsWrap(new Response(match[0], { headers: json() }));
  }
};

function json() { return { 'Content-Type': 'application/json' }; }

function corsWrap(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return new Response(response.body, { status: response.status, headers });
}
