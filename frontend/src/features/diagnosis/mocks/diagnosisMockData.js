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

// N-21-8 DIAG-09 예상 점수 mock의 현재 점수(점수가 나온 최근 평가 예시, 시뮬레이터 mock과 같은 588점).
// 등급 경계는 CUT-0.3(654·727). 예상 점수는 mock 규칙으로만 계산하며 진짜 모델 점수가 아니다.
export const SAMPLE_EXPECTED_SCORE_BASE = Object.freeze({
  baseRequestId: '00000000-0000-4000-8000-000000000588',
  modelVersion: 'DEV-DUMMY',
  score: 588,
  gradeCutoffs: Object.freeze({ standard: 654, good: 727 }),
  incomePointPerPercent: 1, // 평균 소득이 1% 늘 때 +1점
  expensePointPerPercent: 0.5, // 월 지출이 1% 늘 때 −0.5점
  storedDelinquencyCount: 0, // 저장된 최근 1년 30일 이상 연체 건수 예시(밀림이면 +1)
  delayedPointPenalty: 15, // mock 전용: 밀림이면 −15점(실제 감점은 모델이 정한다)
})

// FP-239 N-16 DIAG-03-1 자산·부채 저장값 mock. 연소득은 위 현금흐름 예시(시드 회원 2번)의 월 평균 × 12에 가깝게 둔 예시값이고,
// 총자산·대출은 아래 시나리오 기준값 예시와 같다(변동금리 1,200만 원 월 20만 원 + 고정금리 월 15만 원 = 월 35만 원). 실제 저장 데이터 아님.
export const SAMPLE_MEMBER_FINANCIAL_HEALTH = Object.freeze({
  baseMonth: '2026-08',
  totalAssetAmount: 30000000,
  annualIncomeAmount: 25193976,
  totalDebtAmount: 15000000,
  annualPaymentAmount: 4200000,
  loans: Object.freeze([
    Object.freeze({ loanId: 101, loanTypeCode: 'CREDIT', loanTypeName: '신용대출', balanceAmount: 12000000, annualRatePct: 5, rateTypeCode: 'VARIABLE', remainingMonths: 36, monthlyPaymentAmount: 200000 }),
    Object.freeze({ loanId: 102, loanTypeCode: 'CARD_LOAN', loanTypeName: '카드론', balanceAmount: 3000000, annualRatePct: 7.2, rateTypeCode: 'FIXED', remainingMonths: 24, monthlyPaymentAmount: 150000 }),
  ]),
})

// N-17-1 DIAG-04 시나리오 기준값 mock. 소득·지출은 위 현금흐름 예시(시드 회원 2번)와 같고,
// 상환액·변동금리 대출·총자산은 금리 변화를 화면에서 볼 수 있게 넣은 예시값이다(실제 저장 데이터 아님).
// 정책금리는 develop의 한국은행 기준금리 적재 SQL의 가장 최근 값이다. 버틸 개월 수는 D-33에 따라 총자산 15%를 쓴다.
export const SAMPLE_SCENARIO_BASE = Object.freeze({
  monthlyIncomeAmount: 2099498,
  monthlyExpenseAmount: 1315514,
  monthlyPaymentAmount: 350000,
  variableLoanBalanceAmount: 12000000,
  totalAssetAmount: 30000000,
  policyRate: Object.freeze({ baseDate: '2026-10-31', ratePct: 3 }),
  survivableAssetRatioPct: 15,
  // mock 계산용 변동금리 대출 행(응답에는 넣지 않음). 전체 상환액 35만 중 변동 20만, 나머지 15만은 고정금리로 본다.
  variableLoans: Object.freeze([
    Object.freeze({ balanceAmount: 12000000, annualRatePct: 5, monthlyPaymentAmount: 200000 }),
  ]),
  assumptions: Object.freeze([
    '금리 변화는 변동금리 대출에만 반영하고, 고정금리·금리 방식을 모르는 대출의 상환액은 바꾸지 않습니다.',
    '월 이자 변화는 변동금리 대출 잔액 × 금리 변화 ÷ 12로 간단히 어림한 값이며, 대출마다 금리는 0% 아래로 내려가지 않는 것으로 봅니다.',
    '총자산의 15%(가구 금융자산 중 현금·예금 수준)를 부족액에 쓸 수 있다고 가정합니다.',
    '월 소득은 최근 12개월 평균입니다.',
  ]),
})

// N-22 GET /api/members/me/income-volatility 응답 예시. 불리언은 실제 응답처럼 is 없이 highVolatility로 쓴다.
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

