// N-18-7 더미 대출 상품 및 점수대별 추천 기준 데이터
// decisions.md D-12: 실제 상품 참고한 더미 상품, "더미 상품 · 실제 상품 아님" 표시

export const DUMMY_LOAN_PRODUCTS = [
  {
    productId: 1,
    productName: '청년 햇살론 유스',
    institutionName: '서민금융진흥원',
    minRate: 3.5,
    maxRate: 4.5,
    maxLimitAmount: 12000000,
    targetJobTypes: ['EMPLOYEE', 'FREELANCER'],
    description: '청년층·프리랜서의 금융 안정을 지원하는 정부지원 저금리 대출 상품',
    minScore: 550,
  },
  {
    productId: 2,
    productName: '소상공인 희망 대출',
    institutionName: '소상공인시장진흥공단',
    minRate: 2.8,
    maxRate: 4.0,
    maxLimitAmount: 30000000,
    targetJobTypes: ['SELF_EMPLOYED'],
    description: '성실 경영 자영업자를 위한 긴급 운영자금 특별 지원 상품',
    minScore: 580,
  },
  {
    productId: 3,
    productName: '안심 디딤돌 신용대출',
    institutionName: '가상 서민은행',
    minRate: 5.2,
    maxRate: 7.8,
    maxLimitAmount: 25000000,
    targetJobTypes: ['EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER'],
    description: '대안 신용평가를 통해 성실 납부자에게 우대금리를 제공하는 중금리 신용대출',
    minScore: 650,
  },
  {
    productId: 4,
    productName: '프리랜서 비상금 플러스',
    institutionName: '가상 협동조합',
    minRate: 6.0,
    maxRate: 8.5,
    maxLimitAmount: 10000000,
    targetJobTypes: ['FREELANCER'],
    description: '프로젝트 기반 정기 소득자를 위한 유연한 비상금 소액 대출',
    minScore: 620,
  },
  {
    productId: 5,
    productName: '성실상환자 환승 대출',
    institutionName: '가상 신용금융',
    minRate: 6.8,
    maxRate: 9.9,
    maxLimitAmount: 40000000,
    targetJobTypes: ['EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER'],
    description: '고금리 부채를 저금리로 통합하여 월 원리금 상환 부담을 줄여주는 대환 대출',
    minScore: 665,
  },
  {
    productId: 6,
    productName: '우량 직장인 맞춤 신용대출',
    institutionName: '가상 제1금융은행',
    minRate: 4.5,
    maxRate: 6.2,
    maxLimitAmount: 60000000,
    targetJobTypes: ['EMPLOYEE'],
    description: '우량 신용평점 보유 직장인을 위한 넉넉한 한도의 신용대출 상품',
    minScore: 780,
  },
]

// N-18-7 GET /api/simulation/score-band-offer mock용 점수대 자료 — 더미 시드(21_seed_score_band_offer.sql)·등급 구간(CUT-0.1)과 같은 값이다.
export const SCORE_BAND_OFFER_ROWS = Object.freeze([
  { minScore: 0, maxScore: 664, gradeBand: 'CAUTION', rateMin: 6.4, rateMax: 19.64, rateAvg: 13.02, limit: 47000000 },
  { minScore: 665, maxScore: 779, gradeBand: 'STANDARD', rateMin: 5.28, rateMax: 19.64, rateAvg: 12.46, limit: 47000000 },
  { minScore: 780, maxScore: 1000, gradeBand: 'GOOD', rateMin: 3.75, rateMax: 19.64, rateAvg: 11.695, limit: 128000000 },
])
export const SCORE_BAND_OFFER_BASE_DATE = '2026-09-18'

// 점수대에 따른 기본 금리 및 한도 가이드 (Good: >=780, Standard: 665~779, Caution: <=664)
export function getScoreBandOffer(score = 680) {
  if (score >= 780) {
    return {
      gradeBand: 'GOOD',
      expectedMinRate: 4.2,
      expectedMaxRate: 6.5,
      expectedLimitAmount: 50000000,
    }
  }
  if (score >= 665) {
    return {
      gradeBand: 'STANDARD',
      expectedMinRate: 5.5,
      expectedMaxRate: 8.8,
      expectedLimitAmount: 30000000,
    }
  }
  return {
    gradeBand: 'CAUTION',
    expectedMinRate: 8.5,
    expectedMaxRate: 14.0,
    expectedLimitAmount: 15000000,
  }
}


// N-18-5·8 시뮬레이터 점수 재계산 mock용 출발 평가 예시 — B조 ML-04 예시처럼 588점(CAUTION)에서 시작한다.
// 버전 이름은 FastAPI mock(feature_catalog.py)과 같다. 진짜 모델 점수가 아니다.
export const SIMULATION_BASE_ASSESSMENT = Object.freeze({
  modelVersion: 'DEV-DUMMY',
  cutoffVersion: 'CUT-0.1',
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
  { key: 'EASYPAY_MONTHLY_COUNT', featureCode: 'dp_payment_count_12m', featureName: '간편결제 이용 건수(12개월)', alternative: true, base: 5, best: 50, pointPerUnit: 0.2, featureScale: 12 }, // 월 건수 × 12 (ML-04 TODO 정의서 9장)
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
