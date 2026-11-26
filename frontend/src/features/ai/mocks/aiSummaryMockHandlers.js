// N-31-2 AI 요약 mock 핸들러 — 응답 모양은 실제 RPT-04(POST /api/report/{requestId}/ai-summary)와 같다.
// mock 리포트(credit/mocks/creditMockData.js scoredReport) 한 건에만 등록한다. 문장은 AI가 아니라 고정 예시다.
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'
import { scoredReport } from '../../credit/mocks/creditMockData.js'

// 처음 요청은 새로 만든 것처럼(generated true), 그다음부터는 저장된 요약처럼(false) 답한다. 새로고침하면 처음으로 돌아간다.
let mockSaved = false

function handleAiSummary({ token }) {
  requireMockUser(token)
  const generated = !mockSaved
  mockSaved = true
  return {
    requestId: scoredReport.requestId,
    aiSummary:
      '(예시 요약) 대안 신용 점수가 기존 점수보다 높게 계산됐어요. 통신비·공과금을 제때 낸 기록이 점수에 가장 크게 작용했어요. 시연용 계산이라 실제 대출 심사 결과는 아니에요.',
    generated,
  }
}

registerMockHandlers({
  [`POST /api/report/${scoredReport.requestId}/ai-summary`]: handleAiSummary,
})
