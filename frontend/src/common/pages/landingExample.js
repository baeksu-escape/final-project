// N-10-1·N-10-2 메인(홍보) 페이지 예시 값 — 데모 v2의 광고용 고정 시나리오다. 실제 고객·모델 결과가 아니며 서버에서 받지 않는다.

// 12개월 추이(가입 달 포함 13개 값). 그래프 세로축은 600~800점이다.
export const PROMO_BEFORE = Object.freeze({
  label: 'Before · 앱 사용 전',
  title: '기존 방식으로만 평가',
  score: 640,
  grade: 'Caution',
  note: '대출·카드 이력이 짧아 12개월째 제자리',
  values: [640, 642, 638, 641, 643, 639, 641, 640, 642, 639, 641, 640, 640],
})

export const PROMO_AFTER = Object.freeze({
  label: 'After · 앱 사용 후',
  title: '대안 신용평가 적용',
  score: 778,
  grade: 'Standard',
  note: '통신비·간편결제 이력을 반영하자 12개월 만에 +137점',
  values: [640, 646, 655, 668, 684, 699, 713, 726, 738, 749, 760, 770, 778],
  // 'Standard 진입'을 표시할 달(0 = 가입 달)
  markIndex: 3,
})

// 그래프 눈금과 Standard 기준선(점선)
export const PROMO_AXIS = Object.freeze({ min: 600, max: 800, ticks: [600, 665, 735, 800], standardLine: 665 })

// 주요 기능 소개 카드 3개
export const LANDING_FEATURES = Object.freeze([
  { title: '신용 리포트', description: '기존 점수와 대안 점수를 나란히 보고, 어떤 항목이 점수를 올리고 내렸는지 확인합니다.' },
  {
    title: '재무 진단 4종',
    description: '자산·부채 건전성, 시나리오 테스트(악화·호전), 현금흐름·소득 변동성, 서울 상권 분석을 각각 봅니다.',
  },
  { title: '신용케어 시뮬레이터', description: '카드 사용액이나 연체를 바꾸면 점수와 받을 수 있는 대출이 어떻게 달라지는지 봅니다.' },
])
