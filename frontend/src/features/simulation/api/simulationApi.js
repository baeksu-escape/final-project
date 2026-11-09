import { apiGet, apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다 (VITE_USE_MOCK=false면 등록돼도 무시됨)
import '../mocks/simulationMockHandlers.js'

// N-18 신용케어 시뮬레이터 API 경로 정의
export const SIMULATION_API = Object.freeze({
  RECOMMEND_LOANS: '/api/simulation/loans/recommend',
  RECALCULATE_CREDIT_CARE: '/api/simulation/credit-care/recalculate',
})

// N-18-7 같은 점수대 금리·한도·추천 대출상품 3종 조회
export function recommendLoans(score, jobType) {
  return apiGet(`${SIMULATION_API.RECOMMEND_LOANS}?score=${score}&jobType=${jobType}`)
}

// N-18-5 시뮬레이터 9개 행동값 기반 예상 대안 점수 및 감점 요인 재계산
export function recalculateCreditCare(payload) {
  return apiPost(SIMULATION_API.RECALCULATE_CREDIT_CARE, payload)
}

