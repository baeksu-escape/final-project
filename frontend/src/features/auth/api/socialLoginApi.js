import { apiPost } from '../../../common/api/client.js'
import { API_BASE_URL, USE_MOCK } from '../../../common/config/env.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import { createMockCallbackUrl } from '../mocks/socialLoginMockHandlers.js'
import { SOCIAL_API } from '../socialLoginConfig.js'

// N-01-6 소셜 로그인 시작 — 실제 모드는 백엔드 시작 주소로 이동하고, mock 모드는 백엔드 없이 콜백 화면으로 바로 이동한다.
export function startSocialLogin(providerKey, navigate) {
  if (USE_MOCK) {
    navigate(createMockCallbackUrl(providerKey))
    return
  }
  window.location.assign(`${API_BASE_URL}${SOCIAL_API.authorizationPath(providerKey)}`)
}

// N-01-6 일회용 코드 교환 — { code } → { result: 'LINKED', accessToken, user } | { result: 'LINK_REQUIRED', linkKey, provider, profile: { name, email } }
export function exchangeSocialCode(code) {
  return apiPost(SOCIAL_API.EXCHANGE, { code })
}

// N-01-6 기존 계정에 연결 — { linkKey, loginId, password } → { accessToken, user }
export function linkSocialAccount(payload) {
  return apiPost(SOCIAL_API.LINK, payload)
}
