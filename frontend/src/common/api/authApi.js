import { apiGet, apiPost } from './client.js'

// N-01 인증 API 경로. TODO(D-20) api_spec.md가 정해지면 경로와 응답 모양을 맞춘다.
export const AUTH_API = Object.freeze({
  LOGIN: '/api/auth/login',
  ME: '/api/auth/me',
  LOGOUT: '/api/auth/logout',
})

// 로그인 — { accessToken, user }를 돌려준다.
export function requestLogin(loginId, password) {
  return apiPost(AUTH_API.LOGIN, { loginId, password })
}

// 저장된 토큰으로 내 정보를 다시 불러온다 — { user }를 돌려준다.
export function requestMe() {
  return apiGet(AUTH_API.ME)
}

// 서버 쪽 로그아웃 처리. 토큰 방식이라 실패해도 화면에서는 토큰을 지운다.
export function requestLogout() {
  return apiPost(AUTH_API.LOGOUT)
}
