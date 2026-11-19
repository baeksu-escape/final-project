import { apiGet, apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다
import '../mocks/diagnosisMockHandlers.js'

// N-20 DSR 및 N-17 시나리오 테스트 API 경로 정의
export const DIAGNOSIS_API = Object.freeze({
  CALCULATE_DSR: '/api/diagnosis/dsr/calculate',
  RECALCULATE_SCENARIO: '/api/diagnosis/scenario/recalculate',
  CALCULATE_FINANCIAL_HEALTH: '/api/diagnosis/financial-health/calculate',
  INCOME_VOLATILITY: '/api/diagnosis/income-volatility',
  CASH_FLOW_FORECAST: '/api/diagnosis/cash-flow/forecast',
  EXPECTED_SCORE: '/api/diagnosis/cash-flow/expected-score',
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
export function recalculateScenario(payload) {
  return apiPost(DIAGNOSIS_API.RECALCULATE_SCENARIO, payload)
}

