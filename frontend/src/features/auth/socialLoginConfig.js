import { ACCOUNT_LOCKED_MESSAGE, AUTH_ERROR_CODES } from './authConstants.js'

// N-01-6 소셜 로그인 설정 — 제공자를 빼거나 더할 때, 백엔드 경로가 정해질 때 이 파일만 고친다.

// 로그인 화면에 버튼으로 보여 줄 제공자. key는 시작 주소에 들어간다.
export const SOCIAL_PROVIDERS = Object.freeze([
  { key: 'google', name: 'Google' },
  { key: 'kakao', name: '카카오' },
  { key: 'naver', name: '네이버' },
])

// N-01-6 프론트 화면 경로. CALLBACK은 백엔드가 인증을 마치고 돌려보낼 주소다.
// TODO(팀 결정) 콜백 주소를 백엔드·제공자 설정과 맞춘다.
export const SOCIAL_PATHS = Object.freeze({
  CALLBACK: '/oauth/callback',
  LINK: '/oauth/link',
})

// N-01-6 백엔드 경로(API_BASE_URL 뒤에 붙는다).
// TODO(D-20) 백엔드 API 명세가 나오면 시작 주소·교환 API·연결 API를 맞춘다.
export const SOCIAL_API = Object.freeze({
  authorizationPath: (providerKey) => `/oauth2/authorization/${providerKey}`,
  EXCHANGE: '/api/auth/social/exchange',
  LINK: '/api/auth/social/link',
})

// 교환 API 성공 응답의 result 값.
export const SOCIAL_EXCHANGE_RESULTS = Object.freeze({
  LINKED: 'LINKED',
  LINK_REQUIRED: 'LINK_REQUIRED',
})

// 서버가 소셜 로그인 오류 종류를 알려 줄 때 쓰는 코드(error.data.code).
export const SOCIAL_ERROR_CODES = Object.freeze({
  ADMIN_NOT_ALLOWED: 'SOCIAL_ADMIN_NOT_ALLOWED',
  INVALID_CODE: 'INVALID_SOCIAL_CODE',
  LINK_EXPIRED: 'SOCIAL_LINK_EXPIRED',
})

// 사용자가 제공자 화면에서 취소했을 때 콜백 주소의 error 값.
export const SOCIAL_CANCEL_ERROR = 'access_denied'

export const SOCIAL_ADMIN_BLOCKED_MESSAGE = '관리자 계정은 소셜 로그인을 쓸 수 없습니다.'
export const SOCIAL_CANCELLED_MESSAGE = '소셜 로그인을 취소했습니다.'
export const SOCIAL_FAILED_MESSAGE = '소셜 로그인을 완료하지 못했습니다. 다시 시도해 주세요.'

// N-01-6 소셜 로그인 실패 응답을 화면 문구로 바꾼다. 알 수 없는 오류는 fallback 문구를 쓴다.
export function toSocialErrorMessage(error, fallback) {
  const code = error?.data?.code
  if (code === SOCIAL_ERROR_CODES.ADMIN_NOT_ALLOWED) return SOCIAL_ADMIN_BLOCKED_MESSAGE
  if (code === AUTH_ERROR_CODES.ACCOUNT_LOCKED) return ACCOUNT_LOCKED_MESSAGE
  if (code === SOCIAL_ERROR_CODES.LINK_EXPIRED) return SOCIAL_FAILED_MESSAGE
  if (error?.status === 0) return error.message
  return fallback
}
