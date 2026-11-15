import { apiPost, apiPut } from '../../../common/api/client.js'
import { STEP_UP_HEADER } from '../adminConstants.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/adminAuthMockHandlers.js'

// FP-80 관리자 인증 API 경로 — 로그인 2단계 인증(AUTH-11), 첫 비밀번호 설정, 재확인(step-up), 비밀번호 변경.
// 🟡 작업 7(관리자 백엔드)과 맞춘 계약. 1회용 토큰(challengeToken·passwordSetupToken·stepUpToken)은 화면 상태에만 두고 저장하지 않는다.
export const ADMIN_AUTH_API = Object.freeze({
  VERIFY_CODE: '/api/auth/admin/verify-code',
  PASSWORD_SETUP: '/api/auth/admin/password-setup',
  STEP_UP_SEND: '/api/admin/me/step-up/send',
  STEP_UP_VERIFY: '/api/admin/me/step-up/verify',
  MY_PASSWORD: '/api/admin/me/password',
})

// N-01-1 관리자 2단계 인증(AUTH-11) — { challengeToken, code } →
//   { accessToken(또는 token), user, passwordChangeRequired: false } 또는 { passwordChangeRequired: true, passwordSetupToken }
//   400: 번호가 틀렸거나 만료·사용된 challengeToken.
export function verifyAdminLoginCode(challengeToken, code) {
  return apiPost(ADMIN_AUTH_API.VERIFY_CODE, { challengeToken, code })
}

// N-27-4 첫 비밀번호 설정 — { passwordSetupToken, newPassword } → { accessToken(또는 token), user }
//   400 INVALID_INPUT: 비밀번호 규칙 위반(fieldErrors). 그 밖의 400·401: 설정 토큰이 만료·사용됨 → 처음부터 다시 로그인.
export function setupAdminPassword(passwordSetupToken, newPassword) {
  return apiPost(ADMIN_AUTH_API.PASSWORD_SETUP, { passwordSetupToken, newPassword })
}

// 재확인 번호를 관리자 업무 이메일로 보낸다 — → 200 {}
export function sendStepUpCode() {
  return apiPost(ADMIN_AUTH_API.STEP_UP_SEND)
}

// 재확인 번호 확인 — { code } → { stepUpToken, expiresIn(초) }. 400: 번호가 틀렸거나 만료됨.
export function verifyStepUpCode(code) {
  return apiPost(ADMIN_AUTH_API.STEP_UP_VERIFY, { code })
}

// 관리자 비밀번호 변경 — { currentPassword, newPassword } + 재확인 토큰 헤더 → 200
//   400 INVALID_PASSWORD: 현재 비밀번호가 틀림. 401 STEP_UP_REQUIRED: 재확인 토큰이 없거나 만료됨.
export function changeAdminPassword({ currentPassword, newPassword }, stepUpToken) {
  return apiPut(ADMIN_AUTH_API.MY_PASSWORD, { currentPassword, newPassword }, { headers: { [STEP_UP_HEADER]: stepUpToken } })
}

// 로그인 응답에서 액세스 토큰을 꺼낸다. AUTH-01은 accessToken을 쓰고, AUTH-11 계약 문서는 token으로 적혀 있어 둘 다 받는다.
// TODO(D-20) 작업 7 응답 필드가 하나로 정해지면 그 이름만 남긴다.
export function pickAccessToken(response) {
  return response?.accessToken ?? response?.token
}
