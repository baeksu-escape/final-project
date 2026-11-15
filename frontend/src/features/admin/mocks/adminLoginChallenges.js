import { ApiError } from '../../../common/api/ApiError.js'
import { MOCK_EMAIL_CODE } from '../../auth/mocks/authMockData.js'
import { RESEND_WAIT_SECONDS } from '../adminConstants.js'
import { maskEmail } from './adminMockMasking.js'

// FP-80 N-01-1 관리자 로그인 2단계 인증 mock 저장소 — 로그인 mock(AUTH-01)이 번호를 "보내고", AUTH-11 mock이 확인한다.
// 메일은 보내지 않는다. 번호는 늘 이메일 인증 mock과 같은 고정 번호(MOCK_EMAIL_CODE, 실제 서버의 FIXED 모드 코드와 같은 역할)다.
const CODE_TTL_MS = 5 * 60 * 1000
const challenges = new Map() // challengeToken → { account, expiresAt }
const lastSentAt = new Map() // 아이디 → 마지막으로 보낸 시각
let sequence = 0

// 관리자 비밀번호가 맞았을 때 부른다. 1분 안에 다시 부르면 429, 아니면 새 challengeToken을 만들고 이전 것은 버린다.
export function startAdminLoginChallenge(account) {
  const now = Date.now()
  const last = lastSentAt.get(account.loginId)
  if (last && now - last < RESEND_WAIT_SECONDS * 1000) {
    throw new ApiError(429, '인증번호는 1분에 한 번만 보낼 수 있습니다. 잠시 뒤에 다시 시도해 주세요.', { code: 'TOO_MANY_REQUESTS' })
  }
  lastSentAt.set(account.loginId, now)
  challenges.forEach((saved, key) => {
    if (saved.account === account) challenges.delete(key)
  })
  sequence += 1
  const challengeToken = `mock-admin-challenge-${sequence}`
  challenges.set(challengeToken, { account, expiresAt: now + CODE_TTL_MS })
  return { twoFactorRequired: true, challengeToken, maskedEmail: maskEmail(account.email) }
}

// AUTH-11 — 번호가 맞으면 challengeToken을 지우고(한 번만 사용) 계정을 돌려준다. 틀리거나 만료되면 400.
export function consumeAdminLoginChallenge(challengeToken, code) {
  const saved = challenges.get(challengeToken)
  if (!saved || saved.expiresAt < Date.now() || code !== MOCK_EMAIL_CODE) {
    throw new ApiError(400, '인증번호가 올바르지 않거나 만료되었습니다.', { code: 'INVALID_VERIFICATION_CODE' })
  }
  challenges.delete(challengeToken)
  return saved.account
}
