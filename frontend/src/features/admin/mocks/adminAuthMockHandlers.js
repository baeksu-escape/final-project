import { ApiError } from '../../../common/api/ApiError.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { toMockToken } from '../../../common/mocks/mockUsers.js'
import { MOCK_EMAIL_CODE } from '../../auth/mocks/authMockData.js'
import { isValidPassword } from '../../auth/validation.js'
import { ADMIN_ERROR_CODES } from '../adminConstants.js'
import { consumeAdminLoginChallenge } from './adminLoginChallenges.js'
import {
  addSystemLog,
  consumeStepUpToken,
  issueStepUpToken,
  nextMockToken,
  requireMockAdmin,
} from './adminMockShared.js'

// FP-80 관리자 인증 mock — AUTH-11 2단계 인증, 첫 비밀번호 설정, 재확인(step-up), 비밀번호 변경.
// 번호는 늘 MOCK_EMAIL_CODE(실제 서버 FIXED 모드 코드와 같은 역할)다. 토큰은 모두 한 번 쓰면 지운다.
const PASSWORD_SETUP_TTL_MS = 10 * 60 * 1000
const STEP_UP_CODE_TTL_MS = 5 * 60 * 1000
const STEP_UP_TOKEN_TTL_SECONDS = 5 * 60
const setupTokens = new Map() // passwordSetupToken → { account, expiresAt }
const stepUpCodes = new Map() // userId → 번호 만료 시각

// 로그인 성공 응답 — AUTH-01과 같은 accessToken 이름을 쓴다.
function toLoginResponse(account) {
  return { accessToken: toMockToken(account.user.userId), user: structuredClone(account.user) }
}

// 새 비밀번호 규칙 위반을 칸별 오류(400 INVALID_INPUT)로 던진다.
function assertNewPassword(newPassword) {
  if (isValidPassword(newPassword)) return
  const message = '비밀번호 규칙을 지켜 주세요.'
  throw new ApiError(400, message, { code: ADMIN_ERROR_CODES.INVALID_INPUT, fieldErrors: [{ field: 'newPassword', message }] })
}

registerMockHandlers({
  // N-01-1 AUTH-11 — 번호가 맞으면 로그인, 첫 비밀번호를 정해야 하는 관리자면 설정 토큰을 준다.
  'POST /api/auth/admin/verify-code': ({ body }) => {
    const account = consumeAdminLoginChallenge(body?.challengeToken, body?.code)
    if (account.passwordChangeRequired) {
      const passwordSetupToken = nextMockToken('mock-password-setup')
      setupTokens.set(passwordSetupToken, { account, expiresAt: Date.now() + PASSWORD_SETUP_TTL_MS })
      return { passwordChangeRequired: true, passwordSetupToken }
    }
    addSystemLog('AUTH', 'auth-service', `관리자 ${account.loginId} 로그인 · 2단계 인증 통과`)
    return { ...toLoginResponse(account), passwordChangeRequired: false }
  },

  // N-27-4 첫 비밀번호 설정 — 설정 토큰이 만료·사용됐으면 400(처음부터 다시 로그인), 규칙 위반이면 400 INVALID_INPUT.
  'POST /api/auth/admin/password-setup': ({ body }) => {
    const saved = setupTokens.get(body?.passwordSetupToken)
    if (!saved || saved.expiresAt < Date.now()) {
      throw new ApiError(400, '비밀번호 설정 시간이 지났습니다. 처음부터 다시 로그인해 주세요.', { code: 'PASSWORD_SETUP_EXPIRED' })
    }
    assertNewPassword(body.newPassword)
    setupTokens.delete(body.passwordSetupToken)
    Object.assign(saved.account, { password: body.newPassword, passwordChangeRequired: false })
    addSystemLog('AUTH', 'auth-service', `관리자 ${saved.account.loginId} 첫 비밀번호 설정 · 로그인`)
    return toLoginResponse(saved.account)
  },

  // 재확인 번호 보내기 — 메일은 보내지 않고 만료 시각만 적어 둔다.
  'POST /api/admin/me/step-up/send': ({ token }) => {
    const admin = requireMockAdmin(token)
    stepUpCodes.set(admin.user.userId, Date.now() + STEP_UP_CODE_TTL_MS)
    return {}
  },

  // 재확인 번호 확인 — 맞으면 1회용 stepUpToken을 준다. 틀리거나 만료되면 400.
  'POST /api/admin/me/step-up/verify': ({ token, body }) => {
    const admin = requireMockAdmin(token)
    const expiresAt = stepUpCodes.get(admin.user.userId)
    if (!expiresAt || expiresAt < Date.now() || body?.code !== MOCK_EMAIL_CODE) {
      throw new ApiError(400, '인증번호가 올바르지 않거나 만료되었습니다.', { code: 'INVALID_VERIFICATION_CODE' })
    }
    stepUpCodes.delete(admin.user.userId)
    return { stepUpToken: issueStepUpToken(admin, STEP_UP_TOKEN_TTL_SECONDS), expiresIn: STEP_UP_TOKEN_TTL_SECONDS }
  },

  // 관리자 비밀번호 변경 — 재확인 토큰(401 STEP_UP_REQUIRED) → 현재 비밀번호(400 INVALID_PASSWORD) → 새 비밀번호 규칙 순서로 본다.
  // 비밀번호가 null인 시연 계정은 현재 비밀번호를 비교하지 않는다.
  'PUT /api/admin/me/password': ({ token, headers, body }) => {
    const admin = requireMockAdmin(token)
    consumeStepUpToken(headers, admin)
    if (admin.password !== null && admin.password !== body?.currentPassword) {
      throw new ApiError(400, '현재 비밀번호가 올바르지 않습니다.', { code: 'INVALID_PASSWORD' })
    }
    assertNewPassword(body?.newPassword)
    admin.password = body.newPassword
    addSystemLog('AUTH', 'auth-service', `관리자 ${admin.loginId} 비밀번호 변경`)
    return {}
  },
})
