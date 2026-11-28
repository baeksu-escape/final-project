import { ApiError } from '../../../common/api/ApiError.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { AUTH_ERROR_CODES, EMAIL_PURPOSES, SAME_NICKNAME_MESSAGE, SAME_PASSWORD_MESSAGE } from '../authConstants.js'
import { isValidEmail, isValidPassword, normalizeEmail, validateNickname } from '../validation.js'
import { withdrawAllAltDataOfUser } from '../../dataInput/mocks/altDataMockStore.js'
import { consumeVerification, isMockEmailInUse, listMockAccounts, requireAccountByToken, withdrawMockAccount } from './authMockHandlers.js'
import { MY_PAGE_DEMO_PROFILES } from './myPageMockData.js'
import { deleteMockSocialLinksOfUser } from './socialLoginMockData.js'

// 아래 네 함수는 값이 없으면(null·빈 값) 오류 없이 null을 돌려준다. 휴대폰은 DDL에서 null일 수 있다(PHONE_ENC nullable).

// 이름은 첫 글자(세 글자 이상이면 마지막 글자도)만 남기고 가린다. 예) 홍길동 → 홍*동
function maskName(name) {
  if (!name) return null
  if (name.length <= 2) return name.slice(0, 1) + '*'.repeat(name.length - 1)
  return name.slice(0, 1) + '*'.repeat(name.length - 2) + name.slice(-1)
}

// 숫자만 있는 휴대폰 번호에 하이픈을 넣는다. 예) 01012345678 → 010-1234-5678
function formatPhone(phone) {
  if (!phone) return null
  return phone.length === 11 ? `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}` : `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`
}

// 휴대폰 가운데 자리를 가린다. 예) 010-1234-5678 → 010-****-5678
function maskPhone(phone) {
  if (!phone) return null
  const [head, middle, tail] = formatPhone(phone).split('-')
  return `${head}-${'*'.repeat(middle.length)}-${tail}`
}

// 이메일 아이디 부분의 앞 두 글자만 남기고 가린다. 예) employee@example.com → em******@example.com
function maskEmail(email) {
  if (!email) return null
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
  // N-04-1 내 정보 조회 — 이름·휴대폰·이메일은 서버가 가린 값으로 보낸다. 휴대폰이 없으면 null이다.
  // 닉네임·가입일은 계정에 저장된 값(nickname, createdAt)을 먼저 쓰고, 없을 때만 데모 값을 쓴다.
  'GET /api/members/me/profile': ({ token }) => {
    const account = requireAccountByToken(token)
    const extra = MY_PAGE_DEMO_PROFILES[account.loginId]
    return {
      profile: {
        loginId: account.loginId,
        nickname: account.nickname ?? extra?.nickname ?? null,
        name: maskName(account.user.name),
        phone: maskPhone(account.phone),
        email: maskEmail(account.email),
        joinedAt: account.createdAt?.slice(0, 10) ?? extra?.joinedAt ?? null,
        jobType: account.user.jobType,
      },
    }
  },

  // N-04-2 가림 해제 — 비밀번호가 맞을 때만 원래 값을 돌려준다. 401은 로그아웃을 일으키므로 400을 쓴다. 휴대폰이 없으면 null이다.
  'POST /api/members/me/profile/unmask': ({ body, token }) => {
    const account = requireAccountByToken(token)
    if (!matchesPassword(account, body?.password)) throw new ApiError(400, '비밀번호가 올바르지 않습니다.')
    return { profile: { name: account.user.name, phone: formatPhone(account.phone), email: account.email } }
  },

  // N-04-3 이메일 변경 — 새 이메일의 인증 토큰(목적 CHANGE_EMAIL)을 한 번 쓰고 저장한다.
  // FP-258 서버처럼 앞뒤 공백을 빼고 소문자로 바꾼 이메일로 판정·저장한다.
  'PUT /api/members/me/email': ({ body, token }) => {
    const account = requireAccountByToken(token)
    const email = normalizeEmail(body?.email)
    if (!isValidEmail(email)) throw new ApiError(400, '이메일 형식이 올바르지 않습니다.')
    if (email === account.email) throw new ApiError(400, '지금 쓰는 이메일과 같습니다.')
    if (isMockEmailInUse(email)) {
      throw new ApiError(409, '이미 가입된 이메일입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_EMAIL })
    }
    consumeVerification(body.emailVerificationToken, { purpose: EMAIL_PURPOSES.CHANGE_EMAIL, email })
    account.email = email
    return {}
  },

  // FP-222 MEM-08 닉네임 변경 — 서버와 같은 순서: 형식(가입과 같은 validateNickname) → 지금 닉네임과 같음 400 → 다른 회원이 씀 409 → 저장.
  'PATCH /api/members/me/nickname': ({ body, token }) => {
    const account = requireAccountByToken(token)
    const nicknameError = validateNickname(body?.nickname)
    if (nicknameError) throw new ApiError(400, nicknameError, { fieldErrors: [{ field: 'nickname', message: nicknameError }] })
    const nickname = body.nickname.trim()
    const current = account.nickname ?? MY_PAGE_DEMO_PROFILES[account.loginId]?.nickname ?? null
    if (nickname === current) {
      throw new ApiError(400, SAME_NICKNAME_MESSAGE, { code: AUTH_ERROR_CODES.SAME_NICKNAME, fieldErrors: [{ field: 'nickname', message: SAME_NICKNAME_MESSAGE }] })
    }
    if (listMockAccounts().some((item) => item !== account && item.nickname === nickname)) {
      throw new ApiError(409, '이미 사용 중인 닉네임입니다.', { code: AUTH_ERROR_CODES.DUPLICATE_NICKNAME })
    }
    account.nickname = nickname
    return {}
  },

  // N-04-3 비밀번호 변경 — 현재 비밀번호를 확인하고 새 비밀번호 규칙을 검사한 뒤 바꾼다. 지금 비밀번호와 같으면 400 SAME_PASSWORD(FP-222, 서버와 같은 순서).
  'PUT /api/members/me/password': ({ body, token }) => {
    const account = requireAccountByToken(token)
    if (!matchesPassword(account, body?.currentPassword)) throw new ApiError(400, '현재 비밀번호가 올바르지 않습니다.')
    if (!isValidPassword(body.newPassword)) throw new ApiError(400, '비밀번호 규칙을 지켜 주세요.')
    if (matchesPassword(account, body.newPassword)) {
      throw new ApiError(400, SAME_PASSWORD_MESSAGE, { code: AUTH_ERROR_CODES.SAME_PASSWORD })
    }
    account.password = body.newPassword
    return {}
  },

  // N-04-7 회원 탈퇴(MEM-07, 🟡 제안 경로) — 비밀번호를 확인한 뒤 계정 행은 남기고 상태만 탈퇴로 바꾼다(DDL v0.3.2 W1).
  // 동의로 불러온 대안 데이터를 지우고 동의 이력에 철회 시각을 채운다(FP-85 저장소). 간편 로그인 연결도 지운다.
  // 진단 내역은 서비스 기록으로 보관한다(탈퇴한 토큰으로는 401이라 조회만 막힌다). 401은 로그아웃을 일으키므로 비밀번호 오류는 400을 쓴다.
  'DELETE /api/members/me': ({ body, token }) => {
    const account = requireAccountByToken(token)
    if (!matchesPassword(account, body?.password)) {
      const message = '비밀번호가 올바르지 않습니다.'
      throw new ApiError(400, message, { fieldErrors: [{ field: 'password', message }] })
    }
    withdrawAllAltDataOfUser(account.user.userId)
    deleteMockSocialLinksOfUser(account.user.userId)
    withdrawMockAccount(account)
    return {}
  },
})
