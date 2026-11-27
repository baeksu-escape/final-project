// N-10-1·N-10-2 메인(홍보) 페이지 예시 값 — 광고용 고정 시나리오다. 실제 고객·모델 결과가 아니며 서버에서 받지 않는다.
// 같은 가상 고객을 기존 모델과 대안 모델로 평가한 점수·등급과, 각 모델이 보는 영역이다(FP-226: 신용 리포트 [점수 비교] 게이지 구조).
// 영역 이름은 신용 리포트 ScoreComparisonCard의 FEATURE_GROUPS 라벨과 글자 그대로 같다. 점수 차이는 화면에서 계산한다.
export const PROMO_BEFORE = Object.freeze({
  title: '기존 모델',
  description: '금융 이력 중심 (대출·카드·연체)',
  score: 640,
  gradeBandCode: 'CAUTION',
  areas: Object.freeze(['소득·현금흐름', '대출', '카드·현금서비스', '연체', '직군·연령']),
})

export const PROMO_AFTER = Object.freeze({
  title: '대안 모델',
  description: '금융 이력 + 비금융 납부 이력',
  score: 690,
  gradeBandCode: 'STANDARD',
  areas: Object.freeze(['소득·현금흐름', '대출', '카드·현금서비스', '연체', '직군·연령']),
  // 대안 모델에서 새로 더한 비금융 영역(보라색 태그)
  alternativeAreas: Object.freeze(['통신비', '공과금', '간편결제', '국민연금', '건강보험']),
})

// DB 기준 데이터 SCORE_GRADE_BAND(CUT-0.4)·신용 리포트 mock과 같은 등급 경계 — 광고용 고정 값이며 서버에서 받지 않는다.
export const PROMO_GRADE_BANDS = Object.freeze([
  { gradeBandCode: 'CAUTION', minScore: 0, maxScore: 644 },
  { gradeBandCode: 'STANDARD', minScore: 645, maxScore: 711 },
  { gradeBandCode: 'GOOD', minScore: 712, maxScore: 1000 },
])

// 주요 기능 소개 카드 3개
export const LANDING_FEATURES = Object.freeze([
  { title: '신용 리포트', description: '기존 점수와 대안 점수를 나란히 보고, 어떤 항목이 점수를 올리고 내렸는지 확인합니다.' },
  {
    title: '재무 진단 4종',
    description: '자산·부채 건전성, 시나리오 테스트(악화·호전), 현금흐름·소득 변동성, 서울 상권 분석을 각각 봅니다.',
  },
  { title: '신용케어 시뮬레이터', description: '카드 사용액이나 연체를 바꾸면 점수와 받을 수 있는 대출이 어떻게 달라지는지 봅니다.' },
])
