import { apiGet, apiPatch, apiPut } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
// 관리자 처리와 사용자 신고(자동 숨김 건수)가 같은 신고 데이터를 쓰므로 mock은 community에 함께 둔다.
import '../../community/mocks/communityMockHandlers.js'

// N-34 관리자 신고 접수 API 경로 — 범영님 API 정의서 v0.2 ADM-11~14와 같다. 사용자 신고하기(COMM-07)는 community/api/reportApi.js에 있다.
export const ADMIN_REPORT_API = Object.freeze({
  ADMIN_REPORTS: '/api/admin/reports',
  adminReport: (reportId) => `/api/admin/reports/${reportId}`,
  SETTINGS: '/api/admin/settings',
})

// N-34-1 신고 목록(대상별 묶음) — 필터는 비우면 보내지 않는다. from·to는 'YYYY-MM-DD'.
// → { pendingCount, autoHideCount, items: [{ reportId, targetType, targetId, parentPostId, targetText, targetStatus, reportCount, reasonCounts, statusCode, lastReportedAt }] }
export function fetchAdminReports({ status, reason, from, to } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (reason) params.set('reason', reason)
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return apiGet(query ? `${ADMIN_REPORT_API.ADMIN_REPORTS}?${query}` : ADMIN_REPORT_API.ADMIN_REPORTS)
}

// N-34-2 신고 상세 — → { reportId, targetType, targetId, parentPostId, targetStatus, title, content, authorNickname, reportCount, reasonCounts, reports: [...] }
export function fetchAdminReport(reportId) {
  return apiGet(ADMIN_REPORT_API.adminReport(reportId))
}

// N-34-3 처리 결과 저장 — { resultCode: DELETE|REJECT, memo } → { resultCode, targetStatus, handledCount } (FP-224: KEEP_HIDDEN은 400)
export function processReport(reportId, payload) {
  return apiPatch(ADMIN_REPORT_API.adminReport(reportId), payload)
}

// N-34 자동 숨김 기준 조회(ADM-14) — → { settings: [{ settingKey, value, description, min, max }] }
export function fetchSettings() {
  return apiGet(ADMIN_REPORT_API.SETTINGS)
}

// N-34 자동 숨김 기준 저장(ADM-14) — { settingKey, value } → 바뀐 설정 한 개
export function updateSetting(settingKey, value) {
  return apiPut(ADMIN_REPORT_API.SETTINGS, { settingKey, value })
}
