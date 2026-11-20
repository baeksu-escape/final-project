import { apiGet, apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다
import '../mocks/diagnosisMockHandlers.js'

// N-20 DSR 및 N-17 시나리오 테스트 API 경로 정의
export const DIAGNOSIS_API = Object.freeze({
  CALCULATE_DSR: '/api/diagnosis/dsr/calculate',
  RECALCULATE_SCENARIO: '/api/diagnosis/scenario/recalculate',
  CALCULATE_FINANCIAL_HEALTH: '/api/diagnosis/financial-health/calculate',
  // 로그인 회원의 저장 데이터로 계산하는 API는 팀 공통 규칙대로 /api/members/me 아래에 있다(FP-170 11/19 이동).
  INCOME_VOLATILITY: '/api/members/me/income-volatility',
  CASH_FLOW_FORECAST: '/api/members/me/cash-flow-forecast',
  EXPECTED_SCORE: '/api/members/me/cash-flow-expected-score',
  SCENARIO_BASE: '/api/members/me/scenario-base',
  MEMBER_SCENARIO_RECALCULATE: '/api/members/me/scenario-recalculate',
  MEMBER_FINANCIAL_HEALTH: '/api/members/me/financial-health',
})

// N-22 로그인한 회원의 저장된 최근 12개월 소득으로 변동성 지표·성수기·비수기 격차·소득 부족 달을 조회한다.
// 회원은 서버가 로그인 토큰으로 찾는다(회원 번호를 보내지 않는다). 로그인하지 않았으면 401이다.
export function getIncomeVolatility() {
  return apiGet(DIAGNOSIS_API.INCOME_VOLATILITY)
}

// N-21 로그인한 회원의 저장 데이터에 전망 조건(소득·지출·원리금 변화율 %, 예측 기간 3·6·12개월)을 적용한 현금흐름 전망을 조회한다.
// 회원은 서버가 로그인 토큰으로 찾는다. 로그인하지 않았으면 401이다.
export function getCashFlowForecast(condition = {}) {
  const params = new URLSearchParams()
  Object.entries(condition).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const query = params.toString()
  return apiGet(query ? `${DIAGNOSIS_API.CASH_FLOW_FORECAST}?${query}` : DIAGNOSIS_API.CASH_FLOW_FORECAST)
}

// N-21-8 전망 조건(소득 변동 폭·소득 변화율·월 고정 지출·지출 변화율)으로 예상 대안 점수를 다시 구한다(DIAG-09, 저장 안 함).
// condition은 getCashFlowForecast와 같은 이름의 숫자 값이다. 납부 상태는 아직 점수에 반영되지 않는다(paymentStatusApplied: false).
// 응답: { currentScore, currentGradeBandCode, expectedScore, expectedGradeBandCode, scoreDiff, modelVersion, baseModelVersion, baseRequestId, paymentStatusApplied }
// modelVersion(예상 점수 모델)과 baseModelVersion(현재 점수 모델)이 다르면 scoreDiff에 모델 차이도 섞인다.
export function getExpectedScore(condition = {}) {
  return apiPost(DIAGNOSIS_API.EXPECTED_SCORE, condition)
}

// N-20-4 연소득 및 연원리금 상환액 기반 DSR 비율 및 위험 단계 계산
export function calculateDsr(payload) {
  return apiPost(DIAGNOSIS_API.CALCULATE_DSR, payload)
}

// N-16-1·2·3 총자산·연소득·총부채·연간 원리금으로 순자산, 상환 부담률, 자산 대비 부채, 순자산 대비 부채와 위험 단계를 계산한다.
// 값 바꿔 보기에서 바꾼 값을 보낼 때도 같은 함수를 쓴다. 비율이 null이면 계산 불가(나누는 값이 0 이하)다.
export function calculateFinancialHealth(payload) {
  return apiPost(DIAGNOSIS_API.CALCULATE_FINANCIAL_HEALTH, payload)
}

// N-17-4 금리·소득·지출 변화에 따른 월 잉여금 및 상환 여력 재계산 (N-17-3, N-21-4 공통)
// 옛 mock 전용 함수다(서버에는 이 경로가 없다). 저장 데이터로 계산하는 실제 API는 아래 recalculateMemberScenario를 쓴다.
export function recalculateScenario(payload) {
  return apiPost(DIAGNOSIS_API.RECALCULATE_SCENARIO, payload)
}

// FP-239 N-16-1·2·4 DIAG-03-1 로그인 회원의 자산·부채 저장값(기준월 = 가장 늦은 소득월). 비율·위험 단계는 이 값으로 calculateFinancialHealth를 부른다.
// 응답: { baseMonth, totalAssetAmount, annualIncomeAmount, totalDebtAmount, annualPaymentAmount,
//         loans: [{ loanId, loanTypeCode, loanTypeName, balanceAmount, annualRatePct, rateTypeCode, remainingMonths, monthlyPaymentAmount }] }
// 미입력은 0이 아니라 null이다(총자산 미입력, 대출 미입력. 대출 "해당 없음"은 0). 자영업자·프리랜서가 최근 12개월을 다 채우지 않았으면 연소득이 null. 저장된 소득이 없으면 404.
export function getMemberFinancialHealth() {
  return apiGet(DIAGNOSIS_API.MEMBER_FINANCIAL_HEALTH)
}

// N-17-1 DIAG-04 로그인 회원의 시나리오 기준값(월 소득 12개월 평균·지출·상환액, 변동금리 대출 잔액, 총자산, 현재 정책금리, 계산 가정).
// 응답: { monthlyIncomeAmount, monthlyExpenseAmount, monthlyPaymentAmount, variableLoanBalanceAmount, totalAssetAmount, policyRate: { baseDate, ratePct }, assumptions }
// 총자산 미입력이면 totalAssetAmount, 정책금리 데이터가 없으면 policyRate가 null이다. 저장된 소득이 없으면 404.
export function getScenarioBase() {
  return apiGet(DIAGNOSIS_API.SCENARIO_BASE)
}

// N-17-2~5 DIAG-04 금리·소득·지출 변화를 반영한 상환 여력(지금·조건 반영 후 나란히). 점수는 구하지 않고 저장하지 않는다.
// condition: { ratePctPoint(-5~10 %p), incomePct(-100~100 %), expensePct(-50~100 %) } — 생략하면 0(변화 없음).
// 응답: { current, changed, monthlyInterestChangeAmount, surplusDiffAmount, survivableMonths, verdict, assumptions }
export function recalculateMemberScenario(condition = {}) {
  return apiPost(DIAGNOSIS_API.MEMBER_SCENARIO_RECALCULATE, condition)
}

