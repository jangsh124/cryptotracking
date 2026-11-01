/* coins.js — known coins + dated price snapshot (fallback when live prices can't load).
   Snapshot source: CoinGecko /coins/markets (USD) and open.er-api.com (USD→KRW).
   [symbol, CoinGecko id, English name, Korean name, snapshot USD price] */
(function (root) {
  var SNAPSHOT_TIME = '2026-11-01T22:24:00Z';
  var SNAPSHOT_RATE = { krwPerUsd: 1334.80, time: '2026-11-01T00:02:00Z' };
  var LIST = [
    ['BTC', 'bitcoin', 'Bitcoin', '비트코인', 77656],
    ['ETH', 'ethereum', 'Ethereum', '이더리움', 2252.3],
    ['USDT', 'tether', 'Tether', '테더', 1.0],
    ['BNB', 'binancecoin', 'BNB', '비앤비', 704.82],
    ['XRP', 'ripple', 'XRP', '엑스알피', 1.24],
    ['SOL', 'solana', 'Solana', '솔라나', 93.33],
    ['TRX', 'tron', 'TRON', '트론', 0.312697],
    ['HYPE', 'hyperliquid', 'Hyperliquid', '하이퍼리퀴드', 86.93],
    ['ZEC', 'zcash', 'Zcash', '지캐시', 1215.66],
    ['DOGE', 'dogecoin', 'Dogecoin', '도지코인', 0.07482],
    ['XMR', 'monero', 'Monero', '모네로', 593.81],
    ['LEO', 'leo-token', 'LEO Token', '레오', 9.39],
    ['LINK', 'chainlink', 'Chainlink', '체인링크', 11.25],
    ['ADA', 'cardano', 'Cardano', '에이다', 0.191058],
    ['XLM', 'stellar', 'Stellar', '스텔라루멘', 0.167177],
    ['BCH', 'bitcoin-cash', 'Bitcoin Cash', '비트코인캐시', 282.11],
    ['NEAR', 'near', 'NEAR Protocol', '니어프로토콜', 4.25],
    ['UNI', 'uniswap', 'Uniswap', '유니스왑', 7.11],
    ['LTC', 'litecoin', 'Litecoin', '라이트코인', 55.15],
    ['AVAX', 'avalanche-2', 'Avalanche', '아발란체', 8.61],
    ['SUI', 'sui', 'Sui', '수이', 0.889196],
    ['GRAM', 'the-open-network', 'Gram (Toncoin)', '톤코인', 1.21],
    ['HBAR', 'hedera-hashgraph', 'Hedera', '헤데라', 0.070913],
    ['QNT', 'quant-network', 'Quant', '퀀텀', 199.73],
    ['SHIB', 'shiba-inu', 'Shiba Inu', '시바이누', 0.00000467],
    ['TAO', 'bittensor', 'Bittensor', '비트텐서', 231.71],
    ['CRO', 'crypto-com-chain', 'Cronos', '크로노스', 0.050873],
    ['ENA', 'ethena', 'Ethena', '에테나', 0.180868],
    ['OKB', 'okb', 'OKB', '오케이비', 113.02],
    ['AAVE', 'aave', 'Aave', '에이브', 133.61],
    ['PEPE', 'pepe', 'Pepe', '페페', 0.00000484],
    ['ONDO', 'ondo-finance', 'Ondo', '온도파이낸스', 0.400637],
    ['PUMP', 'pump-fun', 'Pump.fun', '펌프펀', 0.00409699],
    ['ASTER', 'aster-2', 'Aster', '아스터', 0.694572],
    ['DOT', 'polkadot', 'Polkadot', '폴카닷', 0.942506],
    ['WLFI', 'world-liberty-financial', 'World Liberty Financial', '월드리버티파이낸셜', 0.050092],
    ['MORPHO', 'morpho', 'Morpho', '모포', 2.24],
    ['SKY', 'sky', 'Sky', '스카이', 0.067147],
    ['MNT', 'mantle', 'Mantle', '맨틀', 0.471893],
    ['WLD', 'worldcoin-wld', 'Worldcoin', '월드코인', 0.389305],
    ['ICP', 'internet-computer', 'Internet Computer', '인터넷컴퓨터', 2.5],
    ['BGB', 'bitget-token', 'Bitget Token', '비트겟토큰', 1.77],
    ['ETC', 'ethereum-classic', 'Ethereum Classic', '이더리움클래식', 7.08],
    ['ARB', 'arbitrum', 'Arbitrum', '아비트럼', 0.162619],
    ['VVV', 'venice-token', 'Venice Token', '베니스토큰', 22.8],
    ['JST', 'just', 'JUST', '저스트', 0.13796],
    ['GT', 'gatechain-token', 'Gate', '게이트토큰', 9.59],
    ['KCS', 'kucoin-shares', 'KuCoin', '쿠코인', 7.07],
    ['POL', 'polygon-ecosystem-token', 'POL (ex-MATIC)', '폴리곤', 0.090457]
  ];

  var bySymbol = {};
  LIST.forEach(function (r) {
    bySymbol[r[0]] = { symbol: r[0], id: r[1], name: r[2], ko: r[3], snapshotUsd: r[4] };
  });

  var api = {
    SNAPSHOT_TIME: SNAPSHOT_TIME,
    SNAPSHOT_RATE: SNAPSHOT_RATE,
    list: LIST.map(function (r) { return bySymbol[r[0]]; }),
    get: function (sym) { return bySymbol[String(sym || '').toUpperCase()] || null; }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Coins = api;
})(this);
