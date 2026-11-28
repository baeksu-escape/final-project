import { apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다 (VITE_USE_MOCK=false면 등록돼도 무시됨)
import '../mocks/aiSummaryMockHandlers.js'

// N-31-2 AI 요약 API 경로 (FP-181). 경로는 리포트(RPT-04)지만 담당은 광희다.
export const AI_SUMMARY_API = Object.freeze({
  SUMMARY: (requestId) => `/api/report/${encodeURIComponent(requestId)}/ai-summary`,
})

// N-31-2 RPT-04 내 평가 한 건을 AI로 3문장 이내 요약한다. 처음 한 번만 AI를 부르고 저장하며, 그다음부터는 저장된 요약을 바로 준다.
// AI에는 점수·등급·영향 요인 이름과 작용 점수만 간다(개인정보·피처 원래 값 없음).
// 응답: { requestId: '…', aiSummary: '…', generated: true }  — generated는 이번에 새로 만들었으면 true
// 오류: 404 ASSESSMENT_NOT_FOUND(없는·남의 평가), 409 NOT_SCORED(산출 안 된 평가), 502 AI_FAILED(잠시 후 다시), 503 AI_UNAVAILABLE(서버에 AI 키 없음)
export function requestAiSummary(requestId) {
  return apiPost(AI_SUMMARY_API.SUMMARY(requestId))
}
