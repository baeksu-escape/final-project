import { ApiError } from '../../../common/api/ApiError.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { MOCK_USERS, toMockToken } from '../../../common/mocks/mockUsers.js'
import { ROLES } from '../../../common/config/roles.js'
import { ACCOUNT_LOCKED_MESSAGE, AUTH_ERROR_CODES, EMAIL_PURPOSES, LOGIN_FAILED_MESSAGE } from '../authConstants.js'
import { isValidEmail, isValidPassword, normalizePhone } from '../validation.js'
import {
  DEMO_ACCOUNT_CONTACTS,
  LOCKED_DEMO_ACCOUNT,
  MOCK_EMAIL_CODE,
  MOCK_EMAIL_CODE_TTL_SECONDS,
} from './authMockData.js'

// N-01~N-03 mock 계정 목록 — 메모리에만 있어 새로고침하면 가입자는 사라진다. password가 null이면 비밀번호를 비교하지 않는다(데모 계정).
const accounts = [
  ...MOCK_USERS.map(({ loginId, user }) => ({ loginId, password: null, locked: false, ...DEMO_ACCOUNT_CONTACTS[loginId], user: { ...user } })),
  { ...LOCKED_DEMO_ACCOUNT, password: null, user: { ...LOCKED_DEMO_ACCOUNT.user } },
]
const sentCodes = new Map() // '목적:이메일' → 만료 시각
const verifications = new Map() // 인증 토큰 → { purpose, email, loginId }
let sequence = 0

// 아이디·비밀번호 찾기에서 계정이 없을 때 쓰는 문구. 어느 항목이 틀렸는지는 알려 주지 않는다.
const NO_MATCH_MESSAGE = '입력한 정보와 일치하는 계정이 없습니다.'

// 토큰으로 계정을 찾는다. 없으면 401.
function requireAccountByToken(token) {
  const account = accounts.find((item) => toMockToken(item.user.userId) === token)
  if (!account) throw new ApiError(401, '로그인이 필요합니다.')
  return account
}

// FP-85 등 다른 기능의 mock이 토큰 주인의 사용자 정보를 바꿀 때 쓴다(예: 직군 저장). patch를 비우면 조회만 한다.
// 바뀐 사용자 정보의 복사본을 돌려주고, 잘못된 토큰이면 401을 던진다.
export function patchMockAccountUser(token, patch = {}) {
  const account = requireAccountByToken(token)
  Object.assign(account.user, patch)
  return structuredClone(account.user)
}

// 아이디 앞부분만 남기고 나머지를 *로 가린다. 예) jwc1226 → jwc****
function maskLoginId(loginId) {
  const visible = Math.min(3, Math.max(1, loginId.length - 2))
  return loginId.slice(0, visible) + '*'.repeat(loginId.length - visible)
}

// 이메일 인증 토큰이 목적·이메일(재설정이면 아이디까지)과 맞는지 확인하고 맞으면 꺼내서 지운다(한 번만 사용).
function consumeVerification(token, { purpose, email, loginId }) {
  const saved = verifications.get(token)
  const matches = saved && saved.purpose === purpose && saved.email === email && (loginId === undefined || saved.loginId === loginId)
  if (!matches) throw new ApiError(400, '이메일 인증을 다시 진행해 주세요.')
  verifications.delete(token)
}

registerMockHandlers({
  // N-01 로그인 — 아이디·비밀번호가 틀리면 같은 문구로 401, 잠긴 계정이면 423.
  'POST /api/auth/login': ({ body }) => {
    if (!body?.loginId || !body?.password) throw new ApiError(400, '아이디와 비밀번호를 입력해 주세요.')
    const account = accounts.find((item) => item.loginId === body.loginId)
    if (!account || (account.password !== null && account.password !== body.password)) {
      throw new ApiError(401, LOGIN_FAILED_MESSAGE)
    }
    if (account.locked) throw new ApiError(423, ACCOUNT_LOCKED_MESSAGE, { code: AUTH_ERROR_CODES.ACCOUNT_LOCKED })
    return { accessToken: toMockToken(account.user.userId), user: structuredClone(account.user) }
  },

  // 저장된 토큰으로 내 정보 조회(새로 가입한 계정 포함).
  'GET /api/auth/me': ({ token }) => ({ user: structuredClone(requireAccountByToken(token).user) }),

  // N-02·N-03 인증코드 발송 — 가입 목적이면 이미 가입된 이메일을 막는다. 재설정 목적은 계정이 있는지 알려 주지 않는다.
  'POST /api/auth/email/send': ({ body }) => {
    if (!isValidEmail(body?.email)) throw new ApiError(400, '이메일 형식이 올바르지 않습니다.')
    if (body.purpose === EMAIL_PURPOSES.SIGNUP && accounts.some((item) => item.email === body.email)) {
      throw new ApiError(409, '이미 가입된 이메일입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_EMAIL })
    }
    sentCodes.set(`${body.purpose}:${body.email}`, Date.now() + MOCK_EMAIL_CODE_TTL_SECONDS * 1000)
    return { expiresInSeconds: MOCK_EMAIL_CODE_TTL_SECONDS }
  },

  // N-02·N-03 인증코드 확인 — 맞으면 이후 요청에 붙일 인증 토큰을 준다. 재설정 목적이면 아이디·이메일이 같은 계정인지도 본다.
  'POST /api/auth/email/verify': ({ body }) => {
    const key = `${body?.purpose}:${body?.email}`
    const expiresAt = sentCodes.get(key)
    if (!expiresAt || expiresAt < Date.now() || body.code !== MOCK_EMAIL_CODE) {
      throw new ApiError(400, '인증코드가 올바르지 않거나 만료되었습니다.')
    }
    if (body.purpose === EMAIL_PURPOSES.RESET_PASSWORD) {
      const found = accounts.some((item) => item.loginId === body.loginId && item.email === body.email)
      if (!found) throw new ApiError(404, NO_MATCH_MESSAGE)
    }
    sentCodes.delete(key)
    sequence += 1
    const verificationToken = `mock-email-verified-${sequence}`
    verifications.set(verificationToken, { purpose: body.purpose, email: body.email, loginId: body.loginId })
    return { verificationToken }
  },

  // N-02 회원가입 — 직군은 받지 않으므로 jobType은 null로 만든다(로그인 후 직군 선택 화면으로 간다).
  'POST /api/auth/signup': ({ body }) => {
    if (body?.agreeCreditInfo !== true) throw new ApiError(400, '필수 동의 항목에 동의해 주세요.')
    if (!isValidPassword(body.password)) throw new ApiError(400, '비밀번호 규칙을 지켜 주세요.')
    if (accounts.some((item) => item.loginId === body.loginId)) {
      throw new ApiError(409, '이미 사용 중인 아이디입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_LOGIN_ID })
    }
    if (accounts.some((item) => item.email === body.email)) {
      throw new ApiError(409, '이미 가입된 이메일입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_EMAIL })
    }
    consumeVerification(body.emailVerificationToken, { purpose: EMAIL_PURPOSES.SIGNUP, email: body.email })
    const userId = `u-${body.loginId}`
    accounts.push({
      loginId: body.loginId,
      password: body.password,
      locked: false,
      email: body.email,
      phone: normalizePhone(body.phone),
      ageGroup: body.ageGroup,
      user: { userId, name: body.name, role: ROLES.USER, jobType: null },
    })
    return { userId }
  },

  // N-03 아이디 찾기 — 이름·휴대폰이 맞는 계정의 아이디를 가려서 돌려준다.
  'POST /api/auth/find-id': ({ body }) => {
    const phone = normalizePhone(body?.phone)
    const account = accounts.find((item) => item.user.name === body?.name && item.phone === phone)
    if (!account) throw new ApiError(404, NO_MATCH_MESSAGE)
    return { maskedLoginId: maskLoginId(account.loginId) }
  },

  // N-03 비밀번호 재설정 — 이메일 인증 토큰을 확인한 뒤 새 비밀번호로 바꾼다.
  'POST /api/auth/password/reset': ({ body }) => {
    if (!isValidPassword(body?.newPassword)) throw new ApiError(400, '비밀번호 규칙을 지켜 주세요.')
    consumeVerification(body.emailVerificationToken, {
      purpose: EMAIL_PURPOSES.RESET_PASSWORD,
      email: body.email,
      loginId: body.loginId,
    })
    const account = accounts.find((item) => item.loginId === body.loginId && item.email === body.email)
    if (!account) throw new ApiError(404, NO_MATCH_MESSAGE)
    account.password = body.newPassword
    return {}
  },
})
