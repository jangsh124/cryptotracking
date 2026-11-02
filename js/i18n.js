/* i18n.js — short UI words. Icons carry most meaning; words stay few. */
(function (root) {
  var T = {
    en: {
      avg: 'Avg Cost', road: 'DCA Road', photo: 'Photo',
      paid: 'Paid', now: 'Now', net: 'Profit / Loss', gains: 'Up coins', losses: 'Down coins',
      qty: 'Quantity', avgCost: 'Avg cost', price: 'Price', value: 'Value', lots: 'Lots',
      coin: 'Coin', wallet: 'Wallet / exchange', amount: 'Amount paid', total: 'Total', perCoin: 'Per coin',
      save: 'Save', cancel: 'Cancel', del: 'Delete', delSure: 'Tap again to delete', edit: 'Edit', add: 'Add',
      addLot: 'Add a purchase', editLot: 'Edit purchase', emptyAvg: 'Add each purchase. Same coin in many wallets is fine — they combine into one average.',
      example: 'Example', tryExample: 'Load example', clearExample: 'Remove example',
      needPaid: 'need a paid amount', needPaidLong: 'These coins have no paid amount, so they are not in Avg Cost yet. Add what you paid.',
      fix: 'Fix', noPrice: 'No price — tap to enter', live: 'live', snapshot: 'saved', manual: 'yours', none: 'none',
      rateLine: 'Rate', rateFail: 'Live rate did not load. Using', rateFrom: 'from', rateEdit: 'Edit',
      pricesFail: 'Live prices did not load. Using saved prices from', pricesLive: 'Live prices', updated: 'updated',
      goal: 'Goal', goalQty: 'Goal quantity', planDays: 'Plan days', daily: 'Daily buy', start: 'Start date',
      doneDays: 'Days done', haveQty: 'Coins bought so far (optional)', newRoad: 'New road', editRoad: 'Edit road',
      boughtToday: 'I bought today', boughtDone: 'Bought today ✓', undo: 'Undo', streak: 'day streak',
      invested: 'Invested', remaining: 'Still needed', needDaily: 'Per day to finish on time', finish: 'Expected finish',
      planEnd: 'Plan ends', reached: 'Goal reached', onTrack: 'On time', late: 'Late', est: '≈ at today\'s price',
      planLeft: 'Plan money left', days: 'days', daysLeft: 'days left', emptyRoad: 'Set a goal, for example 1 BTC, and check in each day you buy.',
      planOver: 'Plan end passed',
      upload: 'Upload a screenshot of your holdings', uploadSub: 'Coin, quantity and paid amount are read from the picture. You check everything before saving.',
      safe: 'Holdings list only. Never a seed phrase, private key or password.', onDevice: 'Read on this phone — the picture is not uploaded.',
      reading: 'Reading…', review: 'Check before saving', reviewSub: 'Fix any number, remove wrong coins, add missing ones.',
      addRow: 'Add coin', saveN: 'Save', nothing: 'No coins found. Add them by hand below.', readAgainClaude: 'Read again with Claude',
      claudeNote: 'Sends the picture to Claude using your Claude account.', ocrFail: 'Could not read this picture. Add coins by hand.',
      rawText: 'Text read', fromAvg: 'from avg price × qty', walletAll: 'Wallet for these coins', saved: 'Saved',
      settings: 'Settings', language: 'Language', auto: 'Auto', upColor: 'Up color', rate: 'Exchange rate', useLive: 'Use live',
      priceEdit: 'Prices', refresh: 'Refresh', backup: 'Backup', copy: 'Copy data', copied: 'Copied', restore: 'Restore',
      restorePh: 'Paste backup here', wipe: 'Delete all my data', wipeSure: 'Tap again — this cannot be undone',
      privacy: 'Your data stays in this browser on this device. Nobody else can see it. No sign-up.',
      math: 'Math only. No buy or sell advice.', perUsd: 'per $1', coinsHeld: 'Your coins', enterPrice: 'Price per coin',
      required: 'Fill the coin, quantity and amount.', close: 'Close', mixedCur: '$ and ₩ lots combined',
      apiKey: 'Claude API key', apiKeyNote: 'Optional. Enter your Anthropic API key for accurate photo reading in any language (Korean, English, Japanese, Chinese…).', apiKeySaved: 'Key saved', apiKeyClear: 'Remove key', apiKeySet: 'Claude API key set ✓', readWithApi: 'Read with Claude API'
    },
    ko: {
      avg: '평균단가', road: '적립 로드', photo: '사진',
      paid: '매수금액', now: '평가금액', net: '손익', gains: '오른 코인', losses: '내린 코인',
      qty: '수량', avgCost: '평균단가', price: '현재가', value: '평가금액', lots: '매수 기록',
      coin: '코인', wallet: '지갑 / 거래소', amount: '매수금액', total: '총액', perCoin: '개당 가격',
      save: '저장', cancel: '취소', del: '삭제', delSure: '한 번 더 누르면 삭제', edit: '수정', add: '추가',
      addLot: '매수 추가', editLot: '매수 수정', emptyAvg: '매수할 때마다 하나씩 추가하세요. 같은 코인이 여러 지갑에 있어도 하나의 평균으로 합쳐집니다.',
      example: '예시', tryExample: '예시 보기', clearExample: '예시 지우기',
      needPaid: '매수금액 필요', needPaidLong: '매수금액이 없어 아직 평균단가에 포함되지 않았습니다. 매수금액을 입력하세요.',
      fix: '입력', noPrice: '가격 없음 — 눌러서 입력', live: '실시간', snapshot: '저장값', manual: '직접입력', none: '없음',
      rateLine: '환율', rateFail: '실시간 환율을 불러오지 못했습니다. 사용 중:', rateFrom: '기준', rateEdit: '수정',
      pricesFail: '실시간 가격을 불러오지 못했습니다. 저장된 가격 기준:', pricesLive: '실시간 가격', updated: '갱신',
      goal: '목표', goalQty: '목표 수량', planDays: '계획 일수', daily: '하루 매수액', start: '시작일',
      doneDays: '완료한 날', haveQty: '지금까지 산 코인 (선택)', newRoad: '새 목표', editRoad: '목표 수정',
      boughtToday: '오늘 샀어요', boughtDone: '오늘 완료 ✓', undo: '취소', streak: '일 연속',
      invested: '투자한 금액', remaining: '남은 금액', needDaily: '제때 끝내려면 하루', finish: '예상 완료일',
      planEnd: '계획 종료일', reached: '목표 달성', onTrack: '일정 내', late: '늦어짐', est: '≈ 오늘 가격 기준',
      planLeft: '계획상 남은 돈', days: '일', daysLeft: '일 남음', emptyRoad: '예: 1 BTC 같은 목표를 정하고, 산 날마다 체크하세요.',
      planOver: '계획 기간 종료',
      upload: '보유 코인 화면을 올리세요', uploadSub: '사진에서 코인, 수량, 매수금액을 읽습니다. 저장 전에 모두 확인합니다.',
      safe: '보유 목록만. 시드 문구, 개인키, 비밀번호는 절대 올리지 마세요.', onDevice: '이 휴대폰에서 읽습니다 — 사진은 업로드되지 않습니다.',
      reading: '읽는 중…', review: '저장 전 확인', reviewSub: '숫자를 고치고, 잘못된 코인은 지우고, 빠진 코인은 추가하세요.',
      addRow: '코인 추가', saveN: '저장', nothing: '코인을 찾지 못했습니다. 아래에서 직접 추가하세요.', readAgainClaude: 'Claude로 다시 읽기',
      claudeNote: '내 Claude 계정으로 사진을 Claude에게 보냅니다.', ocrFail: '사진을 읽지 못했습니다. 직접 추가하세요.',
      rawText: '읽은 글자', fromAvg: '평균가 × 수량으로 계산', walletAll: '이 코인들의 지갑', saved: '저장됨',
      settings: '설정', language: '언어', auto: '자동', upColor: '상승 색', rate: '환율', useLive: '실시간 사용',
      priceEdit: '가격', refresh: '새로고침', backup: '백업', copy: '데이터 복사', copied: '복사됨', restore: '복원',
      restorePh: '백업을 여기에 붙여넣기', wipe: '내 데이터 모두 삭제', wipeSure: '한 번 더 — 되돌릴 수 없습니다',
      privacy: '데이터는 이 기기의 브라우저에만 저장됩니다. 다른 사람은 볼 수 없습니다. 가입 없음.',
      math: '계산만 보여줍니다. 매수·매도 조언 없음.', perUsd: '/ $1', coinsHeld: '내 코인', enterPrice: '개당 가격',
      required: '코인, 수량, 금액을 입력하세요.', close: '닫기', mixedCur: '$·₩ 기록 합산',
      apiKey: 'Claude API 키', apiKeyNote: '선택사항. Anthropic API 키를 입력하면 한국어·영어·일본어·중국어 등 어떤 언어 화면이든 정확하게 읽습니다.', apiKeySaved: '키 저장됨', apiKeyClear: '키 삭제', apiKeySet: 'Claude API 키 설정됨 ✓', readWithApi: 'Claude API로 읽기'
    }
  };
  var lang = 'en';
  var api = {
    set: function (l) { lang = T[l] ? l : 'en'; document.documentElement.lang = lang; },
    get: function () { return lang; },
    detect: function () { return /^ko/i.test((navigator.language || '')) ? 'ko' : 'en'; },
    t: function (k) { return (T[lang] && T[lang][k]) || T.en[k] || k; }
  };
  root.I18n = api;
})(this);
