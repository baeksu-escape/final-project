import { apiGet, apiPatch, apiPost, apiPut } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/communityMockHandlers.js'

// N-33·N-34 신고 API 경로 — 범영님 API 정의서 v0.2 COMM-07, ADM-11~14와 같다.
export const REPORT_API = Object.freeze({
  REPORTS: '/api/reports',
  ADMIN_REPORTS: '/api/admin/reports',
  adminReport: (reportId) => `/api/admin/reports/${reportId}`,
  SETTINGS: '/api/admin/settings',
})

// N-33-1 신고하기 — { targetType: POST|COMMENT, targetId, reasonCode, detailText } → { reportId, targetHidden }
export function submitReport(payload) {
  return apiPost(REPORT_API.REPORTS, payload)
}

// N-34-1 신고 목록(대상별 묶음) — 필터는 비우면 보내지 않는다. from·to는 'YYYY-MM-DD'.
// → { pendingCount, autoHideCount, items: [{ reportId, targetType, targetId, parentPostId, targetText, targetStatus, reportCount, reasonCounts, statusCode, lastReportedAt }] }
export function fetchAdminReports({ status, reason, from, to } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (reason) params.set('reason', reason)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return apiGet(query ? `${REPORT_API.ADMIN_REPORTS}?${query}` : REPORT_API.ADMIN_REPORTS)
}

// N-34-2 신고 상세 — → { reportId, targetType, targetId, parentPostId, targetStatus, title, content, authorNickname, reportCount, reasonCounts, reports: [...] }
export function fetchAdminReport(reportId) {
  return apiGet(REPORT_API.adminReport(reportId))
}

// N-34-3 처리 결과 저장 — { resultCode: KEEP_HIDDEN|DELETE|REJECT, memo } → { resultCode, targetStatus, handledCount }
export function processReport(reportId, payload) {
  return apiPatch(REPORT_API.adminReport(reportId), payload)
}

// N-34 자동 숨김 기준 조회(ADM-14) — → { settings: [{ settingKey, value, description, min, max }] }
export function fetchSettings() {
  return apiGet(REPORT_API.SETTINGS)
}

// N-34 자동 숨김 기준 저장(ADM-14) — { settingKey, value } → 바뀐 설정 한 개
export function updateSetting(settingKey, value) {
  return apiPut(REPORT_API.SETTINGS, { settingKey, value })
}
