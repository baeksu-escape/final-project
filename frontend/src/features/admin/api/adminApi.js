import { apiGet, apiPatch, apiPost } from '../../../common/api/client.js'
import { STEP_UP_HEADER } from '../adminConstants.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/adminMockHandlers.js'

// FP-80 관리자 API 경로(ADM-05~10). 🟡 API 정의서 v0.2 제안 경로 — 작업 7(관리자 백엔드)과 맞춘 계약이다.
export const ADMIN_API = Object.freeze({
  USERS: '/api/admin/users',
  userLock: (userId) => `/api/admin/users/${encodeURIComponent(userId)}/lock`,
  userCreditData: (userId) => `/api/admin/users/${encodeURIComponent(userId)}/credit-data`,
  ADMINS: '/api/admin/admins',
  ACCESS_LOGS: '/api/admin/access-logs',
  SYSTEM_LOGS: '/api/admin/system-logs',
})

// 값이 있는 조건만 골라 '?q=..&page=..' 문자열을 만든다. 빈 문자열·null 조건은 빼서 '전체'로 부른다.
function toQuery(params) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) search.set(key, String(value))
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

// N-27-1 계정 목록 조회·검색(ADM-05) — { q, role, status, page(0부터), size } →
//   { items: [{ userId, loginId, maskedName, role, workerTypeCode, latestAltScore, status, reportedPostCount, createdAt, lastLoginAt }], page, size, totalCount }
//   maskedName은 "(복호화 불가)"일 수 있다.
export function fetchAdminUsers({ q, role, status, page, size }) {
  return apiGet(`${ADMIN_API.USERS}${toQuery({ q, role, status, page, size })}`)
}

// N-27-3 회원 계정 잠금·해제(ADM-06) — { locked, reason } → 바뀐 행(목록 items 한 줄 모양). 본인·탈퇴 계정은 409.
export function setUserLock(userId, { locked, reason }) {
  return apiPatch(ADMIN_API.userLock(userId), { locked, reason })
}

// N-27-4 관리자 계정 추가(ADM-07) — { loginId, name, workEmail } + 재확인 토큰 → { userId, loginId, temporaryPassword }. 중복 409.
//   임시 비밀번호는 응답을 받은 화면에서 한 번만 보여 주고 어디에도 저장하지 않는다.
export function createAdminAccount({ loginId, name, workEmail }, stepUpToken) {
  return apiPost(ADMIN_API.ADMINS, { loginId, name, workEmail }, { headers: { [STEP_UP_HEADER]: stepUpToken } })
}

// N-35-1·N-35-2 회원 신용정보 열람(ADM-08) — { reason } → { profile, latestAssessment|null, creditProfile|null, altDataSummary }
//   서버가 사유를 검사하고 열람 감사 로그(ACCESS_AUDIT_LOG)를 남긴 뒤 돌려준다. 사유가 없으면 400.
export function openMemberCreditData(userId, reason) {
  return apiPost(ADMIN_API.userCreditData(userId), { reason })
}

// N-35-2 열람 감사 로그 조회(ADM-09) — { page, size } → { items: [{ accessedAt, viewerLoginId, targetLabel, reason, resource }], page, size, totalCount } (최신순)
export function fetchAccessLogs({ page, size }) {
  return apiGet(`${ADMIN_API.ACCESS_LOGS}${toQuery({ page, size })}`)
}

// N-28-2 시스템 로그 조회(ADM-10) — { type(AUTH·INFO·WARN, ''=전체), page, size } → { items: [{ createdAt, type, source, message }], page, size, totalCount } (최신순)
export function fetchSystemLogs({ type, page, size }) {
  return apiGet(`${ADMIN_API.SYSTEM_LOGS}${toQuery({ type, page, size })}`)
}
