// N-20-4 DSR 위험 단계 기준 및 시나리오 재계산 기본 데이터
// decisions.md: DSR 30% 주의 / 40% 위험 (N-16-1 상환 부담률과 계산식 공유)

export const DSR_RISK_LEVELS = Object.freeze({
  SAFE: {
    level: 'SAFE',
    label: '안전',
    maxRatio: 30.0,
    description: '연소득 대비 원리금 상환 부담이 안정적인 수준입니다.',
  },
  CAUTION: {
    level: 'CAUTION',
    label: '주의',
    minRatio: 30.0,
    maxRatio: 40.0,
    description: '상환 부담률이 30%를 초과하여 추가 대출 시 주의가 필요합니다.',
  },
  DANGER: {
    level: 'DANGER',
    label: '위험',
    minRatio: 40.0,
    description: '상환 부담률이 40%를 초과하여 연체 위험이 높은 위험 단계입니다.',
  },
})

// N-16-2 건전성 비율별 위험 단계 기준(%) — 백엔드 FinancialHealthCalculator 상수와 같다. 기준 이상이면 그 단계다.
export const HEALTH_RISK_THRESHOLDS = Object.freeze({
  repaymentBurden: { caution: 30, danger: 40 },
  debtToAsset: { caution: 40, danger: 60 },
  debtToNetAsset: { caution: 70, danger: 100 },
})

// N-16-2 비율과 기준으로 위험 단계 이름을 돌려준다. 비율이 null(계산 불가)이면 null이다.
export function evaluateHealthLevel(ratio, { caution, danger }) {
  if (ratio === null) return null
  if (ratio >= danger) return 'DANGER'
  if (ratio >= caution) return 'CAUTION'
  return 'SAFE'
}

// N-22·N-21 저장 데이터 기반 응답 예시 — 더미 시드 회원 2번(프리랜서)의 최근 12개월 소득(2025-09 ~ 2026-08)과 월 지출로 백엔드와 같은 방식으로 계산한 값이다.
export const SAMPLE_MONTHLY_INCOMES = Object.freeze([
  { yearMonth: '2025-09', income: 1933611 },
  { yearMonth: '2025-10', income: 1341079 },
  { yearMonth: '2025-11', income: 3884117 },
  { yearMonth: '2025-12', income: 1873023 },
  { yearMonth: '2026-01', income: 2330585 },
  { yearMonth: '2026-02', income: 2804640 },
  { yearMonth: '2026-03', income: 1619240 },
  { yearMonth: '2026-04', income: 2715365 },
  { yearMonth: '2026-05', income: 1616535 },
  { yearMonth: '2026-06', income: 1327643 },
  { yearMonth: '2026-07', income: 1686835 },
  { yearMonth: '2026-08', income: 2061303 },
])

// N-21-5 전망 기준값 (12개월 평균 소득, 최신 월 지출 합계, 최신 월 원리금)
export const SAMPLE_CASH_FLOW_BASE = Object.freeze({
  baseMonthlyIncome: 2099498,
  monthlyTotalExpense: 1315514,
  monthlyFixedExpense: 1315514, // 저장된 고정지출(FIXED 합계). 회원 2번은 지출이 모두 고정지출이다
  monthlyLoanPayment: 0,
})

// N-22 GET /api/diagnosis/income-volatility 응답 예시. 불리언은 실제 응답처럼 is 없이 highVolatility로 쓴다.
export const SAMPLE_INCOME_VOLATILITY = Object.freeze({
  meanIncome: 2099498,
  medianIncome: 1903317,
  incomeCv: 33.68,
  standardDeviation: 707118.75,
  highVolatility: true,
  fixedExpenseToLowestIncomeRatio: 99.09,
  zeroIncomeMonthsCount: 0,
  recent3MonthsAverageIncome: 1691927,
  recent3MonthsDiff: -407571,
  peakMonth: '2025-11',
  peakIncome: 3884117,
  offPeakMonth: '2026-06',
  offPeakIncome: 1327643,
  peakOffPeakGap: 2556474,
  hasDeficitWarning: false,
  deficitMonths: [],
  nearestDeficitMonth: null,
  monthsUntilNearest: null,
  recommendedReserveAmount: 0,
})

// DSR 비율에 따른 위험 단계 판정 함수 (N-16-2, N-20-4 공통)
export function evaluateDsrRisk(dsrRatio = 0) {
  if (dsrRatio >= 40.0) return DSR_RISK_LEVELS.DANGER
  if (dsrRatio >= 30.0) return DSR_RISK_LEVELS.CAUTION
  return DSR_RISK_LEVELS.SAFE
}

