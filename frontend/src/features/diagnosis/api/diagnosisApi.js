import { apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다
import '../mocks/diagnosisMockHandlers.js'

// N-20 DSR 및 N-17 시나리오 테스트 API 경로 정의
export const DIAGNOSIS_API = Object.freeze({
  CALCULATE_DSR: '/api/diagnosis/dsr/calculate',
  RECALCULATE_SCENARIO: '/api/diagnosis/scenario/recalculate',
})

// N-20-4 연소득 및 연원리금 상환액 기반 DSR 비율 및 위험 단계 계산
export function calculateDsr(payload) {
  return apiPost(DIAGNOSIS_API.CALCULATE_DSR, payload)
}

// N-17-4 금리·소득·지출 변화에 따른 월 잉여금 및 상환 여력 재계산 (N-17-3, N-21-4 공통)
export function recalculateScenario(payload) {
  return apiPost(DIAGNOSIS_API.RECALCULATE_SCENARIO, payload)
}

