import { ApiError } from '../../../common/api/ApiError.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { ROLES } from '../../../common/config/roles.js'
import { addMockAccount, listMockAccounts } from '../../auth/mocks/authMockHandlers.js'
import { isValidEmail } from '../../auth/validation.js'
import { ACCOUNT_STATUS, ADMIN_ERROR_CODES, ADMIN_LOGIN_ID_PATTERN, ADMIN_LOGIN_ID_RULE_TEXT } from '../adminConstants.js'
import { ADMIN_VIEW_EXTRAS, EMPTY_ALT_DATA_SUMMARY } from './adminMockData.js'
import { maskEmail, maskLoginId, maskPhone } from './adminMockMasking.js'
import {
  addAccessLog,
  addSystemLog,
  consumeStepUpToken,
  listAccessLogs,
  listSystemLogs,
  nowText,
  paginate,
  requireMockAdmin,
  toAdminRow,
  toMaskedName,
  toStatus,
} from './adminMockShared.js'

// FP-80 관리자 계정·로그 mock(ADM-05~10) — 응답 모양은 작업 7과 맞춘 계약 그대로다. 회원 정보는 가린 값만 내보낸다.
const registeredUserIds = new Set()

// 칸별 오류 400(INVALID_INPUT)을 만든다.
function invalidInput(field, message) {
  return new ApiError(400, message, { code: ADMIN_ERROR_CODES.INVALID_INPUT, fieldErrors: [{ field, message }] })
}

// userId로 계정을 찾는다(탈퇴 계정 포함). 없으면 404.
function findAccount(userId) {
  const account = listMockAccounts().find((item) => item.user.userId === userId)
  if (!account) throw new ApiError(404, '계정을 찾을 수 없습니다.', { code: 'NOT_FOUND' })
  return account
}

// mock은 경로를 글자 그대로 찾으므로, 목록에 나온 회원마다 잠금(ADM-06)·열람(ADM-08) 경로를 한 번씩 등록한다.
function registerUserHandlers(userId) {
  if (registeredUserIds.has(userId)) return
  registeredUserIds.add(userId)
  const encoded = encodeURIComponent(userId)
  registerMockHandlers({
    // N-27-3 ADM-06 잠금·해제 — 본인·탈퇴 계정은 409, 잠글 때 사유가 없으면 400.
    [`PATCH /api/admin/users/${encoded}/lock`]: ({ token, body }) => {
      const admin = requireMockAdmin(token)
      const account = findAccount(userId)
      if (account === admin) throw new ApiError(409, '본인 계정은 잠글 수 없습니다.', { code: 'CONFLICT' })
      if (toStatus(account) === ACCOUNT_STATUS.WITHDRAWN) throw new ApiError(409, '탈퇴한 계정은 잠그거나 풀 수 없습니다.', { code: 'CONFLICT' })
      const locked = body?.locked === true
      if (locked && !String(body?.reason ?? '').trim()) throw invalidInput('reason', '잠금 사유를 넣어 주세요.')
      account.locked = locked
      addSystemLog('AUTH', 'admin', `관리자 ${admin.loginId} · ${account.loginId} 계정 ${locked ? '잠금' : '잠금 해제'}`)
      return toAdminRow(account)
    },

    // N-35-1·N-35-2 ADM-08 신용정보 열람 — 사유가 없으면 400. 열면 열람 감사 로그를 남긴다.
    [`POST /api/admin/users/${encoded}/credit-data`]: ({ token, body }) => {
      const admin = requireMockAdmin(token)
      const reason = String(body?.reason ?? '').trim()
      if (!reason) throw invalidInput('reason', '열람 사유를 넣어 주세요.')
      const account = findAccount(userId)
      const extras = ADMIN_VIEW_EXTRAS[account.loginId] ?? {}
      const maskedName = toMaskedName(account)
      addAccessLog({ viewerLoginId: admin.loginId, targetLabel: `${maskedName} (${maskLoginId(account.loginId)})`, reason, resource: 'CREDIT_DATA' })
      const withdrawn = toStatus(account) === ACCOUNT_STATUS.WITHDRAWN
      return {
        profile: {
          loginId: account.loginId,
          maskedName,
          maskedEmail: withdrawn ? null : maskEmail(account.email),
          maskedPhone: maskPhone(account.phone),
          workerTypeCode: account.user.jobType ?? null,
          status: toStatus(account),
          createdAt: toAdminRow(account).createdAt,
        },
        latestAssessment: extras.assessment ? { ...extras.assessment } : null,
        creditProfile: extras.creditProfile ? { ...extras.creditProfile } : null,
        altDataSummary: { ...(extras.altDataSummary ?? EMPTY_ALT_DATA_SUMMARY) },
      }
    },
  })
}

registerMockHandlers({
  // N-27-1 ADM-05 계정 목록 — q(아이디·닉네임 일부), role, status로 거르고 가입일 최신순으로 쪽을 나눈다.
  'GET /api/admin/users': ({ token, query }) => {
    requireMockAdmin(token)
    const q = (query.get('q') ?? '').trim().toLowerCase()
    const role = query.get('role') ?? ''
    const status = query.get('status') ?? ''
    const rows = listMockAccounts()
      .filter((account) => !q || account.loginId.toLowerCase().includes(q) || String(account.nickname ?? '').toLowerCase().includes(q))
      .map(toAdminRow)
      .filter((row) => (!role || row.role === role) && (!status || row.status === status))
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
    rows.forEach((row) => registerUserHandlers(row.userId))
    return paginate(rows, query)
  },

  // N-27-4 ADM-07 관리자 계정 추가 — 재확인 토큰을 확인한 뒤 임시 비밀번호를 발급한다. 첫 로그인 때 새 비밀번호를 정해야 한다. 중복이면 409.
  'POST /api/admin/admins': ({ token, headers, body }) => {
    const admin = requireMockAdmin(token)
    consumeStepUpToken(headers, admin)
    const loginId = String(body?.loginId ?? '').trim()
    const name = String(body?.name ?? '').trim()
    const workEmail = String(body?.workEmail ?? '').trim()
    if (!ADMIN_LOGIN_ID_PATTERN.test(loginId)) throw invalidInput('loginId', `아이디는 ${ADMIN_LOGIN_ID_RULE_TEXT}로 넣어 주세요.`)
    if (!name) throw invalidInput('name', '이름을 넣어 주세요.')
    if (!isValidEmail(workEmail)) throw invalidInput('workEmail', '업무 이메일 형식이 올바르지 않습니다.')
    if (listMockAccounts().some((account) => account.loginId === loginId)) {
      throw new ApiError(409, '이미 사용 중인 아이디입니다.', { code: 'DUPLICATE_LOGIN_ID' })
    }
    if (listMockAccounts().some((account) => account.email === workEmail)) {
      throw new ApiError(409, '이미 등록된 이메일입니다.', { code: 'DUPLICATE_EMAIL' })
    }
    // 영문·숫자가 섞인 9자 임시 비밀번호(N-02 비밀번호 규칙을 지킨다).
    const temporaryPassword = `Av${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}k`
    const account = addMockAccount({
      loginId,
      password: temporaryPassword,
      email: workEmail,
      phone: null,
      createdAt: nowText(),
      passwordChangeRequired: true,
      user: { name, role: ROLES.ADMIN, jobType: null },
    })
    addSystemLog('AUTH', 'admin', `관리자 ${admin.loginId} · 관리자 계정 생성 ${loginId}`)
    return { userId: account.user.userId, loginId, temporaryPassword }
  },

  // N-35-2 ADM-09 열람 감사 로그(최신순).
  'GET /api/admin/access-logs': ({ token, query }) => {
    requireMockAdmin(token)
    return paginate(listAccessLogs(), query)
  },

  // N-28-2 ADM-10 시스템 로그(최신순) — type이 있으면 그 구분만.
  'GET /api/admin/system-logs': ({ token, query }) => {
    requireMockAdmin(token)
    const type = query.get('type') ?? ''
    return paginate(listSystemLogs().filter((log) => !type || log.type === type), query)
  },
})
