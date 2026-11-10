import { ApiError } from '../../../common/api/ApiError.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { AUTH_ERROR_CODES, EMAIL_PURPOSES } from '../authConstants.js'
import { isValidEmail, isValidPassword } from '../validation.js'
import { consumeVerification, isMockEmailInUse, requireAccountByToken } from './authMockHandlers.js'
import { MY_PAGE_DEMO_PROFILES } from './myPageMockData.js'

// 이름은 첫 글자(세 글자 이상이면 마지막 글자도)만 남기고 가린다. 예) 홍길동 → 홍*동
function maskName(name) {
  if (name.length <= 2) return name.slice(0, 1) + '*'.repeat(name.length - 1)
  return name.slice(0, 1) + '*'.repeat(name.length - 2) + name.slice(-1)
}

// 숫자만 있는 휴대폰 번호에 하이픈을 넣는다. 예) 01012345678 → 010-1234-5678
function formatPhone(phone) {
  return phone.length === 11 ? `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}` : `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`
}

// 휴대폰 가운데 자리를 가린다. 예) 010-1234-5678 → 010-****-5678
function maskPhone(phone) {
  const [head, middle, tail] = formatPhone(phone).split('-')
  return `${head}-${'*'.repeat(middle.length)}-${tail}`
}

// 이메일 아이디 부분의 앞 두 글자만 남기고 가린다. 예) employee@example.com → em******@example.com
function maskEmail(email) {
  const [local, domain] = email.split('@')
  const visible = Math.min(2, local.length - 1)
  return `${local.slice(0, visible)}${'*'.repeat(local.length - visible)}@${domain}`
}

// 비밀번호 확인 — 데모 계정은 비밀번호가 없어(null) 비어 있지 않은 값이면 통과한다. 마이페이지에서 바꾼 뒤에는 새 비밀번호만 통과한다.
function matchesPassword(account, password) {
  if (!password) return false
  return account.password === null || account.password === password
}

registerMockHandlers({
  // N-04-1 내 정보 조회 — 이름·휴대폰·이메일은 서버가 가린 값으로 보낸다.
  'GET /api/members/me/profile': ({ token }) => {
    const account = requireAccountByToken(token)
    const extra = MY_PAGE_DEMO_PROFILES[account.loginId]
    return {
      profile: {
        loginId: account.loginId,
        nickname: extra?.nickname ?? null,
        name: maskName(account.user.name),
        phone: maskPhone(account.phone),
        email: maskEmail(account.email),
        joinedAt: extra?.joinedAt ?? null,
        jobType: account.user.jobType,
      },
    }
  },

  // N-04-2 가림 해제 — 비밀번호가 맞을 때만 원래 값을 돌려준다. 401은 로그아웃을 일으키므로 400을 쓴다.
  'POST /api/members/me/profile/unmask': ({ body, token }) => {
    const account = requireAccountByToken(token)
    if (!matchesPassword(account, body?.password)) throw new ApiError(400, '비밀번호가 올바르지 않습니다.')
    return { profile: { name: account.user.name, phone: formatPhone(account.phone), email: account.email } }
  },

  // N-04-3 이메일 변경 — 새 이메일의 인증 토큰(목적 CHANGE_EMAIL)을 한 번 쓰고 저장한다.
  'PUT /api/members/me/email': ({ body, token }) => {
    const account = requireAccountByToken(token)
    if (!isValidEmail(body?.email)) throw new ApiError(400, '이메일 형식이 올바르지 않습니다.')
    if (body.email === account.email) throw new ApiError(400, '지금 쓰는 이메일과 같습니다.')
    if (isMockEmailInUse(body.email)) {
      throw new ApiError(409, '이미 가입된 이메일입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_EMAIL })
    }
    consumeVerification(body.emailVerificationToken, { purpose: EMAIL_PURPOSES.CHANGE_EMAIL, email: body.email })
    account.email = body.email
    return {}
  },

  // N-04-3 비밀번호 변경 — 현재 비밀번호를 확인하고 새 비밀번호 규칙을 검사한 뒤 바꾼다.
  'PUT /api/members/me/password': ({ body, token }) => {
    const account = requireAccountByToken(token)
    if (!matchesPassword(account, body?.currentPassword)) throw new ApiError(400, '현재 비밀번호가 올바르지 않습니다.')
    if (!isValidPassword(body.newPassword)) throw new ApiError(400, '비밀번호 규칙을 지켜 주세요.')
    account.password = body.newPassword
    return {}
  },
})
