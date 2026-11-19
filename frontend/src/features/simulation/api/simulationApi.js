import { USE_MOCK } from '../../../common/config/env.js'
import { simulationExample } from '../mocks/simulationMock.js'
import { INPUT_KEYS, toSimulationChanges, validateInputs } from '../adapters/simulationAdapter.js'

// 현재 입력값 조회 API는 아직 구현되지 않아 실제 모드에서는 오류를 낸다.

// N-18-1 회원의 시뮬레이터 입력 10개 현재값, 현재 대안 점수, 감점 상위 3개를 불러온다.
export async function getSimulationInputs(userId) {
  if (!USE_MOCK) throw new Error('시뮬레이터 현재값 조회 API가 아직 연결되지 않았습니다. 현재 화면은 mock 모드에서 확인할 수 있습니다.')
  if (userId == null) throw new Error('로그인 정보가 없어 값을 불러올 수 없습니다.')
  await new Promise((resolve) => setTimeout(resolve, 200))
  return structuredClone(simulationExample)
}

// N-18-5 바꾼 값 10개로 예상 점수를 다시 구한다. 결과는 저장하지 않고 기존 평가를 덮어쓰지 않는다.
export async function recalculateSimulation({ userId, currentScore, baseline, values }) {
  if (!USE_MOCK) throw new Error('시뮬레이터 재계산 API가 아직 연결되지 않았습니다. 현재 화면은 mock 모드에서 확인할 수 있습니다.')
  if (userId == null) throw new Error('로그인 정보가 없어 계산할 수 없습니다.')
  // mock 요청 처리에서도 화면과 같은 규칙으로 막는다(음수·NULL·소수·범위 밖 거부). 브라우저 안의 시연 검사이며 서버 검증이 아니다.
  if (!(Number.isInteger(currentScore) && currentScore >= 0 && currentScore <= 1000)) throw new Error('현재 점수는 0~1000 정수여야 합니다.')
  if (!hasExactInputKeys(values)) throw new Error('계산 입력은 정해진 10개 항목이어야 합니다(누락·추가 항목 거부).')
  const valuesError = validateInputs(values)
  if (valuesError) throw new Error(valuesError)
  if (!hasExactInputKeys(baseline) || validateInputs(baseline)) throw new Error('저장된 내 실제 값이 비었거나 올바르지 않아 시연 계산을 할 수 없습니다.')
  const response = await recalculateCreditCare({ changes: toSimulationChanges(values, baseline) })
  const [beforeOffer, afterOffer] = await Promise.all([
    getScoreBandOfferInfo(response.before.score),
    getScoreBandOfferInfo(response.after.score),
  ])
  const side = (score, offer) => ({
    score: score.score,
    gradeCode: score.gradeBandCode,
    defaultProbability: score.defaultProb,
    interestRatePct: offer.expectedAvgRate,
    limitAmount: offer.expectedLimitAmount,
  })
  return {
    current: side(response.before, beforeOffer),
    changed: side(response.after, afterOffer),
    financialImpact: response.delta.financialEffect,
    alternativeImpact: response.delta.alternativeEffect,
    source: response.modelVersion,
  }
}

// 입력 묶음이 정해진 10개 키만 정확히 가졌는지 본다.
function hasExactInputKeys(input) {
  if (!input || typeof input !== 'object') return false
  const keys = Object.keys(input)
  return keys.length === INPUT_KEYS.length && INPUT_KEYS.every((key) => Object.hasOwn(input, key))
}

import { apiGet, apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다 (VITE_USE_MOCK=false면 등록돼도 무시됨)
import '../mocks/simulationMockHandlers.js'

// N-18 신용케어 시뮬레이터 API 경로 정의
export const SIMULATION_API = Object.freeze({
  RECOMMEND_LOANS: '/api/simulation/loans/recommend',
  RECALCULATE_CREDIT_CARE: '/api/simulation/credit-care/recalculate',
  CREDIT_CARE_BASE: '/api/simulation/credit-care/base',
  SCORE_BAND_OFFER: '/api/simulation/score-band-offer',
})

// N-18-7 점수(0~1000)에 맞는 점수대의 참고 금리 범위·평균·한도와 등급을 조회한다. 더미 데이터라 dummyNotice가 항상 true다.
export function getScoreBandOfferInfo(score) {
  return apiGet(`${SIMULATION_API.SCORE_BAND_OFFER}?score=${score}`)
}

// N-18-7 같은 점수대 금리·한도·추천 대출상품 3종 조회
export function recommendLoans(score, jobType) {
  return apiGet(`${SIMULATION_API.RECOMMEND_LOANS}?score=${score}&jobType=${jobType}`)
}

// N-18-1·10 입력 10개의 내 실제 값과 출발 점수(SIM-01). [내 실제 값으로 되돌리기]도 이 값을 쓴다.
// 응답: { baseRequestId, assessedAt, score, gradeBandCode, values: { TELECOM_ON_TIME_MONTHS: 8, ... } } — 값이 없으면 null.
export function getCreditCareBase() {
  return apiGet(SIMULATION_API.CREDIT_CARE_BASE)
}

// N-18-5·8 바꾼 값으로 예상 대안 점수·금융/대안 영향·감점 요인 3개를 다시 구한다(SIM-02, FastAPI ML-04 호출, 저장 안 함).
// payload: { changes: { TELECOM_ON_TIME_MONTHS: 12, ... } } — ML-04 키 10개 중 바꾼 것만. 카드 한도·월 사용액은 함께 보낸다.
export function recalculateCreditCare(payload) {
  return apiPost(SIMULATION_API.RECALCULATE_CREDIT_CARE, payload)
}
