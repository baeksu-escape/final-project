import { apiGet, apiPatch, apiPost, apiPut, apiRequest } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/myPageMockHandlers.js'

// N-04 마이페이지 API 경로. TODO(D-20) docs/spec/api/api_spec_a.md가 정해지면 경로와 요청·응답 필드를 맞춘다.
export const MY_PAGE_API = Object.freeze({
  PROFILE: '/api/members/me/profile',
  PROFILE_UNMASK: '/api/members/me/profile/unmask',
  EMAIL: '/api/members/me/email',
  PASSWORD: '/api/members/me/password',
  // FP-222 MEM-08 닉네임 변경
  NICKNAME: '/api/members/me/nickname',
  // N-04-7 회원 탈퇴(MEM-07). 🟡 제안 경로 — 확정되면 이 줄만 바꾼다.
  WITHDRAW: '/api/members/me',
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

// FP-222 MEM-08 N-04-3 닉네임 변경 — PATCH { nickname } → {}. 같은 값이면 400 SAME_NICKNAME, 다른 회원이 쓰면 409 DUPLICATE_NICKNAME.
export function requestNicknameChange(nickname) {
  return apiPatch(MY_PAGE_API.NICKNAME, { nickname })
}

// N-04-7 회원 탈퇴 — DELETE { password } → {}. 비밀번호가 틀리면 400 fieldErrors [{ field: 'password', message }].
// 공통 apiDelete는 본문을 받지 않아서, 본문을 보낼 수 있는 apiRequest를 그대로 쓴다.
export function requestWithdrawal(password) {
  return apiRequest('DELETE', MY_PAGE_API.WITHDRAW, { password })
}
