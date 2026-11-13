import { apiGet } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/diagnosisHistoryMockHandlers.js'

// N-04-6 진단 내역 API 경로. TODO(D-20) api_spec.md가 정해지면 경로와 응답 필드를 맞춘다.
export const DIAGNOSIS_HISTORY_API = Object.freeze({
  LIST: '/api/members/me/diagnoses',
  // 진단 한 건의 리포트 상세(RPT-03). 상세로 넘길 때 diagnosisId(= 점수 산출 requestId)를 그대로 쓴다.
  // 🟡 Avenue API 명세서 B팀 v0.2 제안 경로 — 확정되면 이 줄만 바꾼다. 진단 내역 표에는 아직 상세 링크가 없다(N-04-6 출력에 없음).
  reportDetail: (requestId) => `/api/report/${requestId}`,
})

// N-04-6 진단 내역 조회(MEM-06, B팀 명세서 v0.2 3-4) — → { items: [{ diagnosisId, calculatedAt, jobType, existingScore, alternativeScore, grade,
//   alternativeScoreChange, modelVersion, gradeStatusCode, notScorableReasonCode }] } (최신순)
//   diagnosisId: 점수 산출 요청의 requestId(소문자 UUID). gradeStatusCode: SCORED | NOT_SCORABLE(점수·등급·변화가 null이고 사유 코드가 온다)
export function fetchDiagnosisHistory() {
  return apiGet(DIAGNOSIS_HISTORY_API.LIST)
}
