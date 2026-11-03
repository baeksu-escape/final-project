import { apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/authMockHandlers.js'

// N-01~N-03 인증 화면 API 경로. 로그인·내 정보는 공통 common/api/authApi.js를 쓴다.
// TODO(D-20) api_spec.md가 정해지면 경로와 요청·응답 필드를 맞춘다.
export const AUTH_FEATURE_API = Object.freeze({
  SIGNUP: '/api/auth/signup',
  EMAIL_SEND: '/api/auth/email/send',
  EMAIL_VERIFY: '/api/auth/email/verify',
  FIND_ID: '/api/auth/find-id',
  PASSWORD_RESET: '/api/auth/password/reset',
})

// N-02 회원가입 — { loginId, name, phone, email, password, ageGroup, agreeCreditInfo, emailVerificationToken } → { userId }
export function requestSignup(payload) {
  return apiPost(AUTH_FEATURE_API.SIGNUP, payload)
}

// 이메일 인증코드 발송 — { email, purpose, loginId? } → { expiresInSeconds }
export function requestEmailCode(payload) {
  return apiPost(AUTH_FEATURE_API.EMAIL_SEND, payload)
}

// 이메일 인증코드 확인 — { email, code, purpose, loginId? } → { verificationToken }
export function verifyEmailCode(payload) {
  return apiPost(AUTH_FEATURE_API.EMAIL_VERIFY, payload)
}

// N-03 아이디 찾기 — { name, phone } → { maskedLoginId }
export function requestFindId(payload) {
  return apiPost(AUTH_FEATURE_API.FIND_ID, payload)
}

// N-03 비밀번호 재설정 — { loginId, email, emailVerificationToken, newPassword } → {}
export function requestPasswordReset(payload) {
  return apiPost(AUTH_FEATURE_API.PASSWORD_RESET, payload)
}
