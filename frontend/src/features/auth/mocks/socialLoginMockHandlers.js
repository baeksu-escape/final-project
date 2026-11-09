import { ApiError } from '../../../common/api/ApiError.js'
import { ROLES } from '../../../common/config/roles.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { toMockToken } from '../../../common/mocks/mockUsers.js'
import { ACCOUNT_LOCKED_MESSAGE, AUTH_ERROR_CODES, LOGIN_FAILED_MESSAGE } from '../authConstants.js'
import {
  SOCIAL_ADMIN_BLOCKED_MESSAGE,
  SOCIAL_CANCEL_ERROR,
  SOCIAL_ERROR_CODES,
  SOCIAL_EXCHANGE_RESULTS,
  SOCIAL_PATHS,
} from '../socialLoginConfig.js'
import { findMockAccount } from './authMockHandlers.js'
import { MOCK_LINKED_LOGIN_ID, MOCK_SOCIAL_PROFILE, mockLinkKeys, mockSocialSettings } from './socialLoginMockData.js'

// 내준 일회용 코드 → 제공자 key. 교환하면 지운다.
const issuedCodes = new Map()
let sequence = 0

// N-01-6 관리자 차단·잠금 오류를 만든다. 교환과 연결이 같은 응답을 쓴다.
const adminBlockedError = () => new ApiError(403, SOCIAL_ADMIN_BLOCKED_MESSAGE, { code: SOCIAL_ERROR_CODES.ADMIN_NOT_ALLOWED })
const lockedError = () => new ApiError(423, ACCOUNT_LOCKED_MESSAGE, { code: AUTH_ERROR_CODES.ACCOUNT_LOCKED })

// 계정으로 로그인 응답을 만든다.
function toLoginResponse(account) {
  return { accessToken: toMockToken(account.user.userId), user: structuredClone(account.user) }
}

// N-01-6 백엔드 대신 콜백 주소를 만든다 — 취소·오류 시나리오는 error를, 나머지는 일회용 코드를 싣는다.
export function createMockCallbackUrl(providerKey) {
  if (mockSocialSettings.scenario === 'FAILED') return `${SOCIAL_PATHS.CALLBACK}?error=${SOCIAL_CANCEL_ERROR}`
  sequence += 1
  const code = `mock-code-${sequence}`
  issuedCodes.set(code, providerKey)
  return `${SOCIAL_PATHS.CALLBACK}?code=${code}`
}

registerMockHandlers({
  // N-01-6 일회용 코드 교환 — 코드는 한 번만 쓸 수 있고, 결과는 mockSocialSettings.scenario로 정한다.
  'POST /api/auth/social/exchange': ({ body }) => {
    const provider = issuedCodes.get(body?.code)
    if (!provider) throw new ApiError(400, '소셜 로그인 코드를 확인할 수 없습니다.', { code: SOCIAL_ERROR_CODES.INVALID_CODE })
    issuedCodes.delete(body.code)

    switch (mockSocialSettings.scenario) {
      case 'NEW_ACCOUNT': {
        sequence += 1
        const linkKey = `mock-link-${sequence}`
        mockLinkKeys.add(linkKey)
        return { result: SOCIAL_EXCHANGE_RESULTS.LINK_REQUIRED, linkKey, provider, profile: { ...MOCK_SOCIAL_PROFILE } }
      }
      case 'ADMIN':
        throw adminBlockedError()
      case 'LOCKED':
        throw lockedError()
      default:
        return { result: SOCIAL_EXCHANGE_RESULTS.LINKED, ...toLoginResponse(findMockAccount(MOCK_LINKED_LOGIN_ID)) }
    }
  },

  // N-01-6 기존 계정에 연결 — 아이디·비밀번호가 틀리면 일반 로그인과 같은 문구로 401을 돌려준다.
  'POST /api/auth/social/link': ({ body }) => {
    if (!mockLinkKeys.has(body?.linkKey)) {
      throw new ApiError(400, '소셜 로그인을 처음부터 다시 진행해 주세요.', { code: SOCIAL_ERROR_CODES.LINK_EXPIRED })
    }
    const account = findMockAccount(body.loginId)
    if (!account || (account.password !== null && account.password !== body.password)) {
      throw new ApiError(401, LOGIN_FAILED_MESSAGE)
    }
    if (account.locked) throw lockedError()
    if (account.user.role === ROLES.ADMIN) throw adminBlockedError()
    mockLinkKeys.delete(body.linkKey)
    return toLoginResponse(account)
  },
})
