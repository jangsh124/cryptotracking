/**
 * Cloudflare Worker — Cloudflare Workers AI proxy for StackMath photo scan.
 * Completely FREE — uses Cloudflare's built-in AI (no external API key needed).
 * Deploy: wrangler deploy
 */

const PROMPT =
  'This is a Korean crypto exchange (업비트/빗썸/코인원) holdings screenshot. Extract ALL coin rows.\n\n' +
  'CRITICAL — Korean field labels:\n' +
  '  보유수량 = quantity held ✓\n' +
  '  매수금액 = TOTAL amount PAID to buy (USE THIS for totalPaid) ✓\n' +
  '  매입금액 = same as 매수금액 ✓\n' +
  '  매수평균가 / 평단가 = average buy price per coin (USE for avgPrice) ✓\n' +
  '  평가금액 = current market value — DO NOT USE ✗\n' +
  '  평가손익 / 수익률 = profit/loss — DO NOT USE ✗\n\n' +
  'For each coin row return:\n' +
  '- symbol: coin ticker (BTC, ETH, XRP, USDC, ZETA, etc.)\n' +
  '- quantity: number next to 보유수량\n' +
  '- totalPaid: number next to 매수금액 or 매입금액 (NOT 평가금액)\n' +
  '- avgPrice: number next to 매수평균가 or 평단가 (only if totalPaid not visible)\n' +
  '- currency: "KRW" for 원/KRW/₩, "USD" for $, else "USD"\n\n' +
  'Use null for fields not visible. Reply with JSON only, no markdown:\n' +
  '{"defaultCurrency":"KRW","rows":[{"symbol":"BTC","quantity":0.01191111,"totalPaid":1500176,"avgPrice":null,"currency":"KRW"}]}';

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
    const dataUrl = `data:${mt};base64,${image}`;

    let aiResult;
    try {
      aiResult = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: PROMPT }
          ]
        }],
        max_tokens: 1024,
      });
    } catch (e) {
      // Fallback to LLaVA if llama vision not available
      try {
        const imageBytes = Array.from(Uint8Array.from(atob(image), c => c.charCodeAt(0)));
        aiResult = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
          image: imageBytes,
          prompt: PROMPT,
          max_tokens: 1024,
        });
        aiResult = { response: aiResult.description };
      } catch (e2) {
        return corsWrap(new Response(JSON.stringify({ error: 'AI error: ' + e2.message }), { status: 502, headers: json() }));
      }
    }

    const text = (aiResult && aiResult.response) ? aiResult.response : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return corsWrap(new Response(JSON.stringify({ rows: [], defaultCurrency: 'KRW' }), { headers: json() }));
    }

    try { JSON.parse(match[0]); } catch {
      return corsWrap(new Response(JSON.stringify({ rows: [], defaultCurrency: 'KRW' }), { headers: json() }));
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
