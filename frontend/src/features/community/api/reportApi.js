import { apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/communityMockHandlers.js'

// N-33 신고 API 경로 — 범영님 API 정의서 v0.2 COMM-07과 같다. 관리자 신고 접수(ADM-11~14)는 admin/api/adminReportApi.js에 있다.
export const REPORT_API = Object.freeze({
  REPORTS: '/api/reports',
})

// N-33-1 신고하기 — { targetType: POST|COMMENT, targetId, reasonCode, detailText } → { reportId, targetHidden }
export function submitReport(payload) {
  return apiPost(REPORT_API.REPORTS, payload)
}
