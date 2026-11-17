import { apiGet, apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다 (VITE_USE_MOCK=false면 등록돼도 무시됨)
import '../mocks/simulationMockHandlers.js'

// N-18 신용케어 시뮬레이터 API 경로 정의
export const SIMULATION_API = Object.freeze({
  RECOMMEND_LOANS: '/api/simulation/loans/recommend',
  RECALCULATE_CREDIT_CARE: '/api/simulation/credit-care/recalculate',
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

// N-18-5·8 바꾼 값으로 예상 대안 점수·금융/대안 영향·감점 요인 3개를 다시 구한다(SIM-02, Spring 미구현이라 지금은 mock).
// payload: { changes: { TELECOM_ON_TIME_MONTHS: 12, ... } } — ML-04 키 10개 중 바꾼 것만. 카드 한도·월 사용액은 함께 보낸다.
export function recalculateCreditCare(payload) {
  return apiPost(SIMULATION_API.RECALCULATE_CREDIT_CARE, payload)
}

