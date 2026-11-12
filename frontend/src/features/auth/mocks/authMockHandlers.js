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
import { mockLinkKeys } from './socialLoginMockData.js'

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

// N-04-7 탈퇴 계정 상태 값(DDL v0.3.2 APP_USER.ACCOUNT_STATUS_CODE)과, 탈퇴 계정 토큰으로 부를 때의 401 코드.
const WITHDRAWN_STATUS = 'WITHDRAWN'
const UNAUTHORIZED_CODE = 'UNAUTHORIZED'

// 탈퇴한 계정인지 본다. 탈퇴해도 계정 행은 남으므로(W1) 로그인·토큰 확인·소셜 연결에서 따로 걸러 낸다.
function isWithdrawn(account) {
  return account.accountStatus === WITHDRAWN_STATUS
}

// 토큰으로 계정을 찾는다. 없거나 탈퇴한 계정이면 401 { code: 'UNAUTHORIZED' }(client.js가 받아서 로그아웃시킨다).
// N-04 마이페이지·N-05 데이터 입력 등 /api/members/me/** mock도 이 함수를 거친다.
export function requireAccountByToken(token) {
  const account = accounts.find((item) => !isWithdrawn(item) && toMockToken(item.user.userId) === token)
  if (!account) throw new ApiError(401, '로그인이 필요합니다.', { code: UNAUTHORIZED_CODE })
  return account
}

// N-01-6 소셜 로그인 mock이 아이디로 계정을 찾을 때 쓴다. 없거나 탈퇴한 계정이면 undefined.
export function findMockAccount(loginId) {
  return accounts.find((item) => !isWithdrawn(item) && item.loginId === loginId)
}

// N-01-6 소셜 연결 기록(제공자 → userId)으로 계정을 찾을 때 쓴다. 없거나 탈퇴한 계정이면 undefined.
export function findMockAccountByUserId(userId) {
  return accounts.find((item) => !isWithdrawn(item) && item.user.userId === userId)
}

// N-04-3 이메일 변경 mock이 다른 계정이 이미 쓰는 이메일인지 볼 때 쓴다.
export function isMockEmailInUse(email) {
  return accounts.some((item) => item.email === email)
}

// FP-85 등 다른 기능의 mock이 토큰 주인의 사용자 정보를 바꿀 때 쓴다(예: 직군 저장). patch를 비우면 조회만 한다.
// 바뀐 사용자 정보의 복사본을 돌려주고, 잘못된 토큰이면 401을 던진다.
export function patchMockAccountUser(token, patch = {}) {
  const account = requireAccountByToken(token)
  Object.assign(account.user, patch)
  return structuredClone(account.user)
}

// N-04-7 회원 탈퇴 — 계정 행은 지우지 않고 상태를 WITHDRAWN으로 바꾼 뒤 개인정보 칸을 표시값으로 덮어쓴다(DDL v0.3.2 W1, CK_APU_PII_BY_STATUS).
// 원래 아이디·이메일은 비게 되므로 바로 다시 가입할 수 있다. 그 이메일로 보낸 인증코드·인증 토큰도 지운다(N-04-7 인증 기록 삭제).
// 동의로 불러온 대안 데이터·간편 로그인 연결은 부르는 쪽(myPageMockHandlers.js)이 따로 지운다.
export function withdrawMockAccount(account) {
  const { userId } = account.user
  const { email } = account
  sentCodes.forEach((_, key) => {
    if (key.endsWith(`:${email}`)) sentCodes.delete(key)
  })
  verifications.forEach((saved, key) => {
    if (saved.email === email) verifications.delete(key)
  })
  Object.assign(account, {
    accountStatus: WITHDRAWN_STATUS,
    withdrawnAt: new Date().toISOString(),
    loginId: `wd_${userId}`,
    nickname: `탈퇴${userId}`,
    email: 'WITHDRAWN',
    phone: null,
    password: null,
  })
  account.user.name = 'WITHDRAWN'
}

// 새 가입자의 mock userId — 'u-아이디'. 탈퇴한 계정이 그 값을 이미 쓰고 있으면 뒤에 번호를 붙인다.
// 탈퇴해도 계정 행과 userId는 남으므로, 같은 아이디로 다시 가입한 계정이 옛 토큰·mock 데이터와 섞이지 않게 한다.
function createMockUserId(loginId) {
  const base = `u-${loginId}`
  let userId = base
  for (let number = 2; accounts.some((item) => item.user.userId === userId); number += 1) userId = `${base}-${number}`
  return userId
}

// 아이디 앞부분만 남기고 나머지를 *로 가린다. 예) jwc1226 → jwc****
function maskLoginId(loginId) {
  const visible = Math.min(3, Math.max(1, loginId.length - 2))
  return loginId.slice(0, visible) + '*'.repeat(loginId.length - visible)
}

// 이메일 인증 토큰이 목적·이메일(재설정이면 아이디까지)과 맞는지 확인하고 맞으면 꺼내서 지운다(한 번만 사용).
// N-04-3 이메일 변경 mock도 이 함수로 인증 토큰을 확인한다.
export function consumeVerification(token, { purpose, email, loginId }) {
  const saved = verifications.get(token)
  const matches = saved && saved.purpose === purpose && saved.email === email && (loginId === undefined || saved.loginId === loginId)
  if (!matches) throw new ApiError(400, '이메일 인증을 다시 진행해 주세요.')
  verifications.delete(token)
}

registerMockHandlers({
  // N-01 로그인 — 아이디·비밀번호가 틀리면 같은 문구로 401, 잠긴 계정이면 423. 탈퇴한 계정은 없는 계정과 같게 401이다.
  'POST /api/auth/login': ({ body }) => {
    if (!body?.loginId || !body?.password) throw new ApiError(400, '아이디와 비밀번호를 입력해 주세요.')
    const account = findMockAccount(body.loginId)
    if (!account || (account.password !== null && account.password !== body.password)) {
      throw new ApiError(401, LOGIN_FAILED_MESSAGE)
    }
    if (account.locked) throw new ApiError(423, ACCOUNT_LOCKED_MESSAGE, { code: AUTH_ERROR_CODES.ACCOUNT_LOCKED })
    return { accessToken: toMockToken(account.user.userId), user: structuredClone(account.user) }
  },

  // 저장된 토큰으로 내 정보 조회(새로 가입한 계정 포함).
  'GET /api/auth/me': ({ token }) => ({ user: structuredClone(requireAccountByToken(token).user) }),

  // N-02·N-03 인증코드 발송 — 가입·이메일 변경(N-04-3) 목적이면 이미 가입된 이메일을 막는다. 재설정 목적은 계정이 있는지 알려 주지 않는다.
  'POST /api/auth/email/send': ({ body }) => {
    if (!isValidEmail(body?.email)) throw new ApiError(400, '이메일 형식이 올바르지 않습니다.')
    const blocksUsedEmail = body.purpose === EMAIL_PURPOSES.SIGNUP || body.purpose === EMAIL_PURPOSES.CHANGE_EMAIL
    if (blocksUsedEmail && accounts.some((item) => item.email === body.email)) {
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
    // N-01-6 소셜 계정으로 가입하면 임시 연결 키가 함께 온다. 이메일 인증을 통과한 뒤에 키를 지운다.
    if (body.socialLinkKey !== undefined && !mockLinkKeys.has(body.socialLinkKey)) {
      throw new ApiError(400, '소셜 로그인을 처음부터 다시 진행해 주세요.')
    }
    consumeVerification(body.emailVerificationToken, { purpose: EMAIL_PURPOSES.SIGNUP, email: body.email })
    mockLinkKeys.delete(body.socialLinkKey)
    const userId = createMockUserId(body.loginId)
    accounts.push({
      loginId: body.loginId,
      password: body.password,
      locked: false,
      email: body.email,
      phone: normalizePhone(body.phone),
      ageGroup: body.ageGroup,
      user: { userId, name: body.name, role: ROLES.USER, jobType: null, hasScore: false },
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
