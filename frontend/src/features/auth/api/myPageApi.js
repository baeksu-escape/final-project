import { apiGet, apiPost, apiPut } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/myPageMockHandlers.js'

// N-04 마이페이지 API 경로. TODO(D-20) api_spec.md가 정해지면 경로와 요청·응답 필드를 맞춘다.
export const MY_PAGE_API = Object.freeze({
  PROFILE: '/api/members/me/profile',
  PROFILE_UNMASK: '/api/members/me/profile/unmask',
  EMAIL: '/api/members/me/email',
  PASSWORD: '/api/members/me/password',
})

// N-04-1 내 정보 조회 — → { profile: { loginId, nickname, name, phone, email, joinedAt, jobType } } (이름·휴대폰·이메일은 가린 값)
export function fetchMyProfile() {
  return apiGet(MY_PAGE_API.PROFILE)
}

// N-04-2 가림 해제 — { password } → { profile: { name, phone, email } }
export function requestUnmaskProfile(password) {
  return apiPost(MY_PAGE_API.PROFILE_UNMASK, { password })
}

// N-04-3 이메일 변경 — { email, emailVerificationToken } → {}
export function requestEmailChange(payload) {
  return apiPut(MY_PAGE_API.EMAIL, payload)
}

// N-04-3 비밀번호 변경 — { currentPassword, newPassword } → {}
export function requestPasswordChange(payload) {
  return apiPut(MY_PAGE_API.PASSWORD, payload)
}
