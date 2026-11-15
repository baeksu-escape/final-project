import { ApiError } from '../../../common/api/ApiError.js'
import { ROLES } from '../../../common/config/roles.js'
import { addMockAccount, listMockAccounts, requireAccountByToken } from '../../auth/mocks/authMockHandlers.js'
import { ACCOUNT_STATUS, ADMIN_ERROR_CODES, ADMIN_FIRST_PAGE, ADMIN_PAGE_SIZE, STEP_UP_HEADER } from '../adminConstants.js'
import {
  ADMIN_VIEW_EXTRAS,
  DECRYPT_FAILED_NAME,
  EXTRA_ACCOUNTS,
  SEED_ACCESS_LOGS,
  SEED_SYSTEM_LOGS,
} from './adminMockData.js'
import { maskName } from './adminMockMasking.js'

// FP-80 관리자 mock 공통 — 관리자 확인, 재확인(step-up) 토큰, 로그 저장, 목록 한 줄 만들기를 두 mock 파일이 함께 쓴다.
// 모두 메모리에만 있어 새로고침하면 처음 상태로 돌아간다.

// 목록을 채울 합성 계정을 로그인 mock 계정에 한 번만 넣는다(그래서 잠그면 로그인도 막힌다).
EXTRA_ACCOUNTS.forEach((extra) => {
  if (!listMockAccounts().some((account) => account.loginId === extra.loginId)) {
    addMockAccount({ password: null, ...structuredClone(extra) })
  }
})

const systemLogs = SEED_SYSTEM_LOGS.map((log) => ({ ...log }))
const accessLogs = SEED_ACCESS_LOGS.map((log) => ({ ...log }))
const stepUpTokens = new Map() // stepUpToken → { userId, expiresAt }
let sequence = 0

// 지금 시각을 서버 응답처럼 'YYYY-MM-DDTHH:mm:ss'(로컬 시각)로 만든다.
export function nowText() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

// mock 1회용 토큰 문자열을 만든다.
export function nextMockToken(prefix) {
  sequence += 1
  return `${prefix}-${sequence}`
}

// /api/admin/** 공통 확인 — 로그인(401), 관리자 역할(403 FORBIDDEN), 첫 비밀번호 설정 완료(403 PASSWORD_CHANGE_REQUIRED) 순서로 본다.
export function requireMockAdmin(token) {
  const account = requireAccountByToken(token)
  if (account.user.role !== ROLES.ADMIN) throw new ApiError(403, '접근 권한이 없습니다.', { code: 'FORBIDDEN' })
  if (account.passwordChangeRequired) {
    throw new ApiError(403, '비밀번호를 바꾼 뒤 다시 로그인해 주세요.', { code: ADMIN_ERROR_CODES.PASSWORD_CHANGE_REQUIRED })
  }
  return account
}

// 재확인 번호를 맞힌 관리자에게 줄 1회용 토큰을 만든다.
export function issueStepUpToken(account, expiresInSeconds) {
  const stepUpToken = nextMockToken('mock-step-up')
  stepUpTokens.set(stepUpToken, { userId: account.user.userId, expiresAt: Date.now() + expiresInSeconds * 1000 })
  return stepUpToken
}

// 요청 헤더의 재확인 토큰을 확인하고 지운다(한 번만 사용). 없거나 만료·남의 토큰이면 401 STEP_UP_REQUIRED.
export function consumeStepUpToken(headers, account) {
  const stepUpToken = headers?.[STEP_UP_HEADER]
  const saved = stepUpTokens.get(stepUpToken)
  if (!saved || saved.userId !== account.user.userId || saved.expiresAt < Date.now()) {
    throw new ApiError(401, '보안을 위해 인증번호를 다시 확인해 주세요.', { code: ADMIN_ERROR_CODES.STEP_UP_REQUIRED })
  }
  stepUpTokens.delete(stepUpToken)
}

// 시스템 로그 1건을 남긴다(N-28-1).
export function addSystemLog(type, source, message) {
  systemLogs.push({ createdAt: nowText(), type, source, message })
}

// 열람 감사 로그 1건을 남긴다(N-35-2). 고치거나 지우는 함수는 두지 않는다.
export function addAccessLog(entry) {
  accessLogs.push({ accessedAt: nowText(), ...entry })
}

// 로그 목록 복사본(최신순).
export function listSystemLogs() {
  return [...systemLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
export function listAccessLogs() {
  return [...accessLogs].sort((a, b) => b.accessedAt.localeCompare(a.accessedAt))
}

// 계정 상태 코드 — 탈퇴 > 잠김 > 정상.
export function toStatus(account) {
  if (account.accountStatus === ACCOUNT_STATUS.WITHDRAWN) return ACCOUNT_STATUS.WITHDRAWN
  return account.locked ? ACCOUNT_STATUS.LOCKED : ACCOUNT_STATUS.ACTIVE
}

// 가린 이름. 복호화에 실패한 계정은 계약대로 "(복호화 불가)"를 준다.
export function toMaskedName(account) {
  return account.decryptFailed ? DECRYPT_FAILED_NAME : maskName(account.user.name)
}

// ADM-05 목록 한 줄(ADM-06 응답도 같은 모양).
export function toAdminRow(account) {
  const extras = ADMIN_VIEW_EXTRAS[account.loginId] ?? {}
  return {
    userId: account.user.userId,
    loginId: account.loginId,
    maskedName: toMaskedName(account),
    role: account.user.role,
    workerTypeCode: account.user.jobType ?? null,
    latestAltScore: extras.assessment?.altScore ?? null,
    status: toStatus(account),
    reportedPostCount: extras.reportedPostCount ?? 0,
    createdAt: account.createdAt ?? extras.createdAt ?? null,
    lastLoginAt: extras.lastLoginAt ?? null,
  }
}

// 쪽 번호(query page·size)에 맞게 잘라 { items, page, size, totalCount }로 돌려준다.
export function paginate(rows, query) {
  const page = Number(query.get('page') ?? ADMIN_FIRST_PAGE)
  const size = Number(query.get('size') ?? ADMIN_PAGE_SIZE)
  const start = (page - ADMIN_FIRST_PAGE) * size
  return { items: rows.slice(start, start + size), page, size, totalCount: rows.length }
}
