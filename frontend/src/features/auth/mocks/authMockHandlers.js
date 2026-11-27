import { ApiError } from '../../../common/api/ApiError.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { MOCK_USERS, toMockToken } from '../../../common/mocks/mockUsers.js'
import { ROLES } from '../../../common/config/roles.js'
import {
  ACCOUNT_LOCKED_MESSAGE,
  AUTH_ERROR_CODES,
  EMAIL_PURPOSES,
  FIND_ID_METHODS,
  LOGIN_FAILED_MESSAGE,
  LOGIN_MAX_FAILURES,
  LOGIN_TEMP_BLOCK_FAILURES,
  LOGIN_TEMP_BLOCK_MINUTES,
  PHONE_PURPOSES,
  loginTemporarilyBlockedMessage,
} from '../authConstants.js'
import {
  SIGNUP_PENDING_MESSAGES,
  isValidEmail,
  isValidPassword,
  isValidPhone,
  normalizeEmail,
  normalizeLoginId,
  normalizePhone,
  validateBirthYear,
  validateName,
  validateNickname,
} from '../validation.js'
import {
  DEMO_ACCOUNT_CONTACTS,
  LOCKED_DEMO_ACCOUNT,
  MOCK_EMAIL_CODE,
  MOCK_EMAIL_CODE_TTL_SECONDS,
  MOCK_PHONE_CODE,
  MOCK_PHONE_CODE_TTL_SECONDS,
} from './authMockData.js'
import { mockLinkKeys } from './socialLoginMockData.js'
import { startAdminLoginChallenge } from '../../admin/mocks/adminLoginChallenges.js'

// N-01~N-03 mock 계정 목록 — 메모리에만 있어 새로고침하면 가입자는 사라진다. password가 null이면 비밀번호를 비교하지 않는다(데모 계정).
const accounts = [
  ...MOCK_USERS.map(({ loginId, user }) => ({ loginId, password: null, locked: false, ...DEMO_ACCOUNT_CONTACTS[loginId], user: { ...user } })),
  { ...LOCKED_DEMO_ACCOUNT, password: null, user: { ...LOCKED_DEMO_ACCOUNT.user } },
]
const sentCodes = new Map() // '목적:이메일' → 만료 시각
const verifications = new Map() // 인증 토큰 → { purpose, email, loginId }
const sentPhoneCodes = new Map() // '목적:휴대폰(숫자만)' → 만료 시각
const phoneVerifications = new Map() // 휴대폰 인증 토큰 → { purpose, phone }
let sequence = 0

// 칸 하나의 400 오류(서버와 같은 모양: data.fieldErrors [{ field, message }]).
function fieldError(field, message) {
  return new ApiError(400, message, { fieldErrors: [{ field, message }] })
}

// 휴대폰 인증 토큰이 목적·번호와 맞는지 확인한다. 틀리면 휴대폰 칸 오류. 맞으면 부르는 쪽이 가입을 마친 뒤 지운다(한 번만 사용).
function assertPhoneVerification(token, { purpose, phone }) {
  const saved = phoneVerifications.get(token)
  if (!saved || saved.purpose !== purpose || saved.phone !== phone) throw fieldError('phone', SIGNUP_PENDING_MESSAGES.phone)
}

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

// FP-80 관리자 계정 관리 mock(ADM-05~08)이 전체 계정(탈퇴 포함)을 볼 때 쓴다. 잠금처럼 값을 바꾸면 로그인 mock에도 그대로 반영된다.
export function listMockAccounts() {
  return accounts
}

// FP-80 관리자 계정 추가(ADM-07)·관리자 mock 시연 계정이 새 계정을 넣을 때 쓴다. userId는 여기서 정하고, 넣은 계정을 돌려준다.
export function addMockAccount({ user, ...rest }) {
  const account = { locked: false, ...rest, user: { ...user, userId: createMockUserId(rest.loginId) } }
  accounts.push(account)
  return account
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
  // 휴대폰으로 보낸 인증번호·인증 토큰도 지운다(서버 deleteForWithdrawal이 휴대폰 HMAC으로도 지우는 것과 같다).
  const { phone } = account
  sentPhoneCodes.forEach((_, key) => {
    if (phone && key.endsWith(`:${phone}`)) sentPhoneCodes.delete(key)
  })
  phoneVerifications.forEach((saved, key) => {
    if (phone && saved.phone === phone) phoneVerifications.delete(key)
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

// FP-258 5분 제한의 남은 분(올림). 실패가 정확히 5회이고 5회째 실패에서 5분이 안 지났을 때만 0보다 크다(서버 remainingBlockMinutes와 같음).
function remainingBlockMinutes(account) {
  if (account.loginFailCount !== LOGIN_TEMP_BLOCK_FAILURES || !account.lastLoginFailureAt) return 0
  const leftMs = account.lastLoginFailureAt + LOGIN_TEMP_BLOCK_MINUTES * 60 * 1000 - Date.now()
  return leftMs > 0 ? Math.ceil(leftMs / 60000) : 0
}

// FP-258 5분 제한 오류(429 LOGIN_TEMPORARILY_BLOCKED).
function loginBlockedError(minutes) {
  return new ApiError(429, loginTemporarilyBlockedMessage(minutes), { code: AUTH_ERROR_CODES.LOGIN_TEMPORARILY_BLOCKED })
}

// FP-258 아이디·비밀번호 찾기 본인 확인 — 입력한 이름(앞뒤 공백 제거)이 가입 이름과 같은지 본다(서버 AccountRules.nameMatches와 같음).
function nameMatches(account, name) {
  return typeof name === 'string' && name.trim() !== '' && account.user.name === name.trim()
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
  // N-01 로그인 — 아이디·비밀번호가 틀리면 같은 문구로 401, 잠긴 계정이면 비밀번호가 맞을 때만 423. 탈퇴한 계정은 없는 계정과 같게 401이다.
  // FP-258 단계적 제한(서버 AuthService.authenticate와 같은 순서): 5회째 실패부터 5분 동안 429(횟수는 그대로), 누적 10회째면 잠그고 423.
  // FP-80 관리자는 토큰 대신 2단계 인증 시작 응답 { twoFactorRequired, challengeToken, maskedEmail }을 받는다(1분 안에 다시 부르면 429).
  'POST /api/auth/login': ({ body }) => {
    if (!body?.loginId || !body?.password) throw new ApiError(400, '아이디와 비밀번호를 입력해 주세요.')
    const account = findMockAccount(normalizeLoginId(body.loginId))
    if (!account) throw new ApiError(401, LOGIN_FAILED_MESSAGE)
    const passwordMatches = account.password === null || account.password === body.password
    if (account.locked) {
      if (passwordMatches) throw new ApiError(423, ACCOUNT_LOCKED_MESSAGE, { code: AUTH_ERROR_CODES.ACCOUNT_LOCKED })
      throw new ApiError(401, LOGIN_FAILED_MESSAGE)
    }
    const blockedMinutes = remainingBlockMinutes(account)
    if (blockedMinutes > 0) throw loginBlockedError(blockedMinutes)
    if (!passwordMatches) {
      account.loginFailCount = (account.loginFailCount ?? 0) + 1
      account.lastLoginFailureAt = Date.now()
      if (account.loginFailCount >= LOGIN_MAX_FAILURES) {
        account.locked = true
        throw new ApiError(423, ACCOUNT_LOCKED_MESSAGE, { code: AUTH_ERROR_CODES.ACCOUNT_LOCKED })
      }
      if (account.loginFailCount === LOGIN_TEMP_BLOCK_FAILURES) throw loginBlockedError(LOGIN_TEMP_BLOCK_MINUTES)
      throw new ApiError(401, LOGIN_FAILED_MESSAGE)
    }
    account.loginFailCount = 0
    account.lastLoginFailureAt = null
    if (account.user.role === ROLES.ADMIN) return startAdminLoginChallenge(account)
    return { accessToken: toMockToken(account.user.userId), user: structuredClone(account.user) }
  },

  // 저장된 토큰으로 내 정보 조회(새로 가입한 계정 포함).
  'GET /api/auth/me': ({ token }) => ({ user: structuredClone(requireAccountByToken(token).user) }),

  // N-02·N-03 인증코드 발송 — 가입·이메일 변경(N-04-3) 목적이면 이미 가입된 이메일을 막는다. 재설정 목적은 계정이 있는지 알려 주지 않는다.
  // FP-258 이메일은 서버처럼 앞뒤 공백을 빼고 소문자로 바꾼 뒤 판정·저장한다(발송·확인·가입·찾기·재설정 모두 같다).
  'POST /api/auth/email/send': ({ body }) => {
    const email = normalizeEmail(body?.email)
    if (!isValidEmail(email)) throw new ApiError(400, '이메일 형식이 올바르지 않습니다.')
    const blocksUsedEmail = body.purpose === EMAIL_PURPOSES.SIGNUP || body.purpose === EMAIL_PURPOSES.CHANGE_EMAIL
    if (blocksUsedEmail && accounts.some((item) => item.email === email)) {
      throw new ApiError(409, '이미 가입된 이메일입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_EMAIL })
    }
    sentCodes.set(`${body.purpose}:${email}`, Date.now() + MOCK_EMAIL_CODE_TTL_SECONDS * 1000)
    return { expiresInSeconds: MOCK_EMAIL_CODE_TTL_SECONDS }
  },

  // N-02·N-03 인증코드 확인 — 맞으면 이후 요청에 붙일 인증 토큰을 준다. 재설정 목적이면 아이디·이메일·이름(FP-258)이 같은 계정인지도 본다.
  // FP-258 FIND_ID 목적은 계정을 보지 않고(찾기 요청이 확인), 재설정 목적은 이름 형식을 먼저 본다(틀리면 400 name 칸).
  'POST /api/auth/email/verify': ({ body }) => {
    if (body?.purpose === EMAIL_PURPOSES.RESET_PASSWORD) {
      const nameError = validateName(body.name)
      if (nameError) throw fieldError('name', nameError)
    }
    const email = normalizeEmail(body?.email)
    const loginId = body?.loginId === undefined ? undefined : normalizeLoginId(body.loginId)
    const key = `${body?.purpose}:${email}`
    const expiresAt = sentCodes.get(key)
    if (!expiresAt || expiresAt < Date.now() || body.code !== MOCK_EMAIL_CODE) {
      throw new ApiError(400, '인증코드가 올바르지 않거나 만료되었습니다.')
    }
    if (body.purpose === EMAIL_PURPOSES.RESET_PASSWORD) {
      const found = accounts.some((item) => item.loginId === loginId && item.email === email && nameMatches(item, body.name))
      if (!found) throw new ApiError(404, NO_MATCH_MESSAGE)
    }
    sentCodes.delete(key)
    sequence += 1
    const verificationToken = `mock-email-verified-${sequence}`
    verifications.set(verificationToken, { purpose: body.purpose, email, loginId })
    return { verificationToken }
  },

  // N-02-1 닉네임 중복 확인 — 형식이 틀리면 400(칸별 오류), 아니면 계정 목록(탈퇴 표시값 포함)의 닉네임과 비교한다.
  'POST /api/auth/nickname/check': ({ body }) => {
    const nicknameError = validateNickname(body?.nickname)
    if (nicknameError) throw fieldError('nickname', nicknameError)
    const nickname = body.nickname.trim()
    return { available: !accounts.some((item) => item.nickname === nickname) }
  },

  // N-02 휴대폰 인증번호 발송 — 이메일 발송 mock과 같은 구조. 실제 문자는 보내지 않고 고정 코드(MOCK_PHONE_CODE)를 쓴다.
  'POST /api/auth/phone/send': ({ body }) => {
    const phone = normalizePhone(body?.phone)
    if (!isValidPhone(phone)) throw fieldError('phone', '휴대폰 번호 형식이 올바르지 않습니다. 예) 010-1234-5678')
    if (!Object.values(PHONE_PURPOSES).includes(body.purpose)) throw fieldError('purpose', '인증 목적이 올바르지 않습니다.')
    sentPhoneCodes.set(`${body.purpose}:${phone}`, Date.now() + MOCK_PHONE_CODE_TTL_SECONDS * 1000)
    return { expiresInSeconds: MOCK_PHONE_CODE_TTL_SECONDS }
  },

  // N-02 휴대폰 인증번호 확인 — 맞으면 가입 요청에 붙일 휴대폰 인증 토큰을 준다.
  'POST /api/auth/phone/verify': ({ body }) => {
    const phone = normalizePhone(body?.phone)
    const key = `${body?.purpose}:${phone}`
    const expiresAt = sentPhoneCodes.get(key)
    if (!expiresAt || expiresAt < Date.now() || body.code !== MOCK_PHONE_CODE) {
      throw new ApiError(400, '인증번호가 올바르지 않거나 만료되었습니다.')
    }
    sentPhoneCodes.delete(key)
    sequence += 1
    const verificationToken = `mock-phone-verified-${sequence}`
    phoneVerifications.set(verificationToken, { purpose: body.purpose, phone })
    return { verificationToken }
  },

  // N-02 회원가입 — 직군은 받지 않으므로 jobType은 null로 만든다(로그인 후 직군 선택 화면으로 간다).
  'POST /api/auth/signup': ({ body }) => {
    if (body?.agreeCreditInfo !== true) throw new ApiError(400, '필수 동의 항목에 동의해 주세요.')
    if (!isValidPassword(body.password)) throw new ApiError(400, '비밀번호 규칙을 지켜 주세요.')
    // 이름은 완성형 한글 2~20자 — 화면과 같은 규칙(validateName)이다.
    const nameError = validateName(body.name)
    if (nameError) throw fieldError('name', nameError)
    // 휴대폰은 필수이고, 형식이 맞아야 한다(인증 토큰은 중복 검사 뒤에 쓴다).
    const phone = normalizePhone(body.phone)
    if (!isValidPhone(phone)) throw fieldError('phone', '휴대폰 번호 형식이 올바르지 않습니다. 예) 010-1234-5678')
    if (!body.phoneVerificationToken) throw fieldError('phone', SIGNUP_PENDING_MESSAGES.phone)
    // N-02-1 출생연도 — 화면과 같은 규칙(validateBirthYear)으로 다시 검사하고, 어기면 칸별 오류로 돌려준다.
    const birthYearError = validateBirthYear(body.birthYear)
    if (birthYearError) throw new ApiError(400, birthYearError, { fieldErrors: [{ field: 'birthYear', message: birthYearError }] })
    // N-02-1 닉네임 — 화면과 같은 규칙(validateNickname)으로 다시 검사하고, 어기면 칸별 오류로 돌려준다.
    const nicknameError = validateNickname(body.nickname)
    if (nicknameError) throw new ApiError(400, nicknameError, { fieldErrors: [{ field: 'nickname', message: nicknameError }] })
    const nickname = body.nickname.trim()
    const email = normalizeEmail(body.email)
    if (accounts.some((item) => item.loginId === body.loginId)) {
      throw new ApiError(409, '이미 사용 중인 아이디입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_LOGIN_ID })
    }
    if (accounts.some((item) => item.email === email)) {
      throw new ApiError(409, '이미 가입된 이메일입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_EMAIL })
    }
    // N-02-1 닉네임 중복 불가(DDL UK_APU_NICKNAME) — 탈퇴 회원의 표시값('탈퇴'+userId)도 계정 행에 남아 있으므로 함께 비교한다.
    if (accounts.some((item) => item.nickname === nickname)) {
      throw new ApiError(409, '이미 사용 중인 닉네임입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_NICKNAME })
    }
    // N-01-6 소셜 계정으로 가입하면 임시 연결 키가 함께 온다. 이메일 인증을 통과한 뒤에 키를 지운다.
    if (body.socialLinkKey !== undefined && !mockLinkKeys.has(body.socialLinkKey)) {
      throw new ApiError(400, '소셜 로그인을 처음부터 다시 진행해 주세요.')
    }
    // 휴대폰 토큰을 먼저 본다. 여기서 막히면 이메일 인증 토큰은 쓰지 않은 채로 남아 다시 가입할 수 있다.
    assertPhoneVerification(body.phoneVerificationToken, { purpose: PHONE_PURPOSES.SIGNUP, phone })
    consumeVerification(body.emailVerificationToken, { purpose: EMAIL_PURPOSES.SIGNUP, email })
    phoneVerifications.delete(body.phoneVerificationToken)
    mockLinkKeys.delete(body.socialLinkKey)
    const userId = createMockUserId(body.loginId)
    accounts.push({
      loginId: body.loginId,
      password: body.password,
      locked: false,
      createdAt: new Date().toISOString(), // N-04-1 마이페이지 가입일로 쓴다.
      email,
      phone,
      ageGroup: body.ageGroup,
      birthYear: Number(body.birthYear),
      nickname,
      user: { userId, name: body.name, role: ROLES.USER, jobType: null, hasScore: false },
    })
    return { userId }
  },

  // N-03-1 아이디 찾기(FP-258) — { method: PHONE | EMAIL, name, phone 또는 email, verificationToken(FIND_ID) }. 서버와 같은 순서로 본다:
  //   이름 형식(400 name) → 방법(400 method) → 토큰(휴대폰 400 phone 칸, 이메일 400) → 이름이 같은 일반 회원(없으면 404, 토큰은 남음) → 토큰 사용.
  'POST /api/auth/find-id': ({ body }) => {
    const nameError = validateName(body?.name)
    if (nameError) throw fieldError('name', nameError)
    if (body?.method !== FIND_ID_METHODS.PHONE && body?.method !== FIND_ID_METHODS.EMAIL) {
      throw fieldError('method', '아이디를 찾을 방법을 골라 주세요.')
    }
    const token = body.verificationToken
    let account
    if (body.method === FIND_ID_METHODS.PHONE) {
      const phone = normalizePhone(body.phone)
      assertPhoneVerification(token, { purpose: PHONE_PURPOSES.FIND_ID, phone })
      account = accounts.find((item) => !isWithdrawn(item) && item.user.role === ROLES.USER && item.phone === phone && nameMatches(item, body.name))
    } else {
      const email = normalizeEmail(body.email)
      const saved = verifications.get(token)
      if (!saved || saved.purpose !== EMAIL_PURPOSES.FIND_ID || saved.email !== email) {
        throw new ApiError(400, '이메일 인증을 다시 진행해 주세요.')
      }
      account = accounts.find((item) => !isWithdrawn(item) && item.user.role === ROLES.USER && item.email === email && nameMatches(item, body.name))
    }
    if (!account) throw new ApiError(404, NO_MATCH_MESSAGE)
    phoneVerifications.delete(token)
    verifications.delete(token)
    return { maskedLoginId: maskLoginId(account.loginId), loginId: account.loginId }
  },

  // N-03 비밀번호 재설정 — 이름 형식(400 name 칸) → 아이디·이메일·이름(FP-258)이 같은 계정(없으면 404, 토큰은 남음) → 이메일 인증 토큰 사용 순서로 보고
  //   새 비밀번호로 바꾼다. 서버처럼 잠금과 실패 횟수도 푼다.
  'POST /api/auth/password/reset': ({ body }) => {
    const nameError = validateName(body?.name)
    if (nameError) throw fieldError('name', nameError)
    if (!isValidPassword(body?.newPassword)) throw new ApiError(400, '비밀번호 규칙을 지켜 주세요.')
    const loginId = normalizeLoginId(body.loginId)
    const email = normalizeEmail(body.email)
    const account = accounts.find((item) => item.loginId === loginId && item.email === email && nameMatches(item, body.name))
    if (!account) throw new ApiError(404, NO_MATCH_MESSAGE)
    consumeVerification(body.emailVerificationToken, {
      purpose: EMAIL_PURPOSES.RESET_PASSWORD,
      email,
      loginId,
    })
    account.password = body.newPassword
    account.locked = false
    account.loginFailCount = 0
    account.lastLoginFailureAt = null
    return {}
  },
})
