// N-18-7 GET /api/simulation/score-band-offer mock용 점수대 자료 — 더미 시드(21_seed_score_band_offer.sql)·등급 구간(CUT-0.4)과 같은 값이다.
export const SCORE_BAND_OFFER_ROWS = Object.freeze([
  { minScore: 0, maxScore: 644, gradeBand: 'CAUTION', rateMin: 6.4, rateMax: 19.64, rateAvg: 13.02, limit: 47000000 },
  { minScore: 645, maxScore: 711, gradeBand: 'STANDARD', rateMin: 5.28, rateMax: 19.64, rateAvg: 12.46, limit: 47000000 },
  { minScore: 712, maxScore: 1000, gradeBand: 'GOOD', rateMin: 3.75, rateMax: 19.64, rateAvg: 11.695, limit: 128000000 },
])
export const SCORE_BAND_OFFER_BASE_DATE = '2026-09-18'

// N-18-5·8 시뮬레이터 점수 재계산 mock용 출발 평가 예시 — B조 ML-04 예시처럼 588점(CAUTION)에서 시작한다.
// 버전 이름은 FastAPI mock(feature_catalog.py)과 같다. 진짜 모델 점수가 아니다.
export const SIMULATION_BASE_ASSESSMENT = Object.freeze({
  modelVersion: 'DEV-DUMMY',
  cutoffVersion: 'CUT-0.4',
  score: 588,
})

// 등급별 부도 확률 예시 (N-18-6 화면 표시 여부는 미정 D2, 값만 내려준다)
export const SIMULATION_DEFAULT_PROB = Object.freeze({ CAUTION: 0.21, STANDARD: 0.075, GOOD: 0.021 })

// ML-04 changes 키 10개(B팀 명세서 4-4) → 피처. 이 밖의 키는 오류로 돌려준다.
// featureCode·featureName은 FastAPI feature_catalog.py와 같고, alternative는 대안 데이터 피처 여부(Y/N)다.
// base: 출발 평가의 현재 값, best: 시뮬레이터 범위 안 가장 좋은 값(simulation.py BEST_VALUES), pointPerUnit: 한 단위가 좋아질 때 mock 점수.
// featureScale: 화면 입력 단위를 피처 단위로 바꾸는 배수(없으면 1).
export const SIMULATION_FEATURES = Object.freeze([
  { key: 'TELECOM_ON_TIME_MONTHS', featureCode: 'telecom_on_time_streak', featureName: '통신비 정시 납부 기간', alternative: true, base: 6, best: 12, pointPerUnit: 2 },
  { key: 'UTILITY_LATE_MONTHS', featureCode: 'utility_late_months', featureName: '공과금 미납 개월', alternative: true, base: 2, best: 0, pointPerUnit: 4 }, // 10번째 키 확정(11/17, 피처 정의서 C21)
  { key: 'EASYPAY_MONTHLY_COUNT', featureCode: 'dp_payment_count_12m', featureName: '간편결제 이용 건수(12개월)', alternative: true, base: 5, best: 50, pointPerUnit: 0.2, featureScale: 12 }, // 월 건수 × 12 — FastAPI ML-04가 하는 변환을 mock이 흉내 낸다(화면·Spring은 월 횟수 그대로 보냄)
  { key: 'DELINQ_COUNT_12M', featureCode: 'DQ1200001', featureName: '최근 1년 30일 이상 연체 횟수', alternative: false, base: 1, best: 0, pointPerUnit: 15 },
  { key: 'CASH_ADVANCE_MONTHS', featureCode: 'CF1231605', featureName: '현금서비스 이용 기간', alternative: false, base: 3, best: 0, pointPerUnit: 3 },
  { key: 'NEW_LOAN_COUNT_3M', featureCode: 'L22000900', featureName: '최근 3개월 신규 대출(상환 중)', alternative: false, base: 1, best: 0, pointPerUnit: 6 },
  { key: 'LOAN_BALANCE_AMT', featureCode: 'debt_balance_krw', featureName: '대출 잔액', alternative: false, base: 30000000, best: 0, pointPerUnit: 0.0000003 },
  { key: 'PRIVATE_LENDER_LOAN_BALANCE_AMT', featureCode: 'LA0099212', featureName: '대부업 대출 잔액', alternative: false, base: 0, best: 0, pointPerUnit: 0.000002 },
])

// SIM-02 입력 상한 — FastAPI(ML-04)는 범위를 검사하지 않아 Spring이 먼저 막는다(B조 11/17). 모든 키는 0 이상 정수여야 하고, 여기 없는 키는 상한이 없다.
// TODO(정의서 8-2) 통신비 상한 0–12 대 18·24개월은 팀 확인 중이라 12를 임시로 쓴다. 나머지 키의 상한은 UI 슬라이더 범위가 정해지면 추가한다.
export const SIMULATION_MAX_VALUES = Object.freeze({
  TELECOM_ON_TIME_MONTHS: 12,
  UTILITY_LATE_MONTHS: 12,
})

// 카드 한도·월 사용액은 함께 보내야 하고, 둘로 카드 한도 사용률(%)을 다시 계산한다. 한도가 0 이하면 사용률은 결측이다.
export const SIMULATION_CARD = Object.freeze({
  limitKey: 'CARD_LIMIT_AMT',
  spendKey: 'CARD_MONTHLY_SPEND_AMT',
  featureCode: 'CL0631905',
  featureName: '카드 한도 사용률',
  baseLimit: 5000000,
  baseSpend: 3000000,
  best: 0,
  pointPerUnit: 0.2,
})
