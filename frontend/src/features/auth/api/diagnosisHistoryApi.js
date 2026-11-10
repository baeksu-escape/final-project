import { apiGet } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/diagnosisHistoryMockHandlers.js'

// N-04-6 진단 내역 API 경로. TODO(D-20) api_spec.md가 정해지면 경로와 응답 필드를 맞춘다.
export const DIAGNOSIS_HISTORY_API = Object.freeze({
  LIST: '/api/members/me/diagnoses',
})

// N-04-6 진단 내역 조회 — → { items: [{ diagnosisId, calculatedAt, jobType, existingScore, alternativeScore, grade, alternativeScoreChange, modelVersion }] } (최신순)
export function fetchDiagnosisHistory() {
  return apiGet(DIAGNOSIS_HISTORY_API.LIST)
}
