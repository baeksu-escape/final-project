import { ApiError } from '../../../common/api/ApiError.js'
import { ROLES } from '../../../common/config/roles.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { requireAccountByToken } from '../../auth/mocks/authMockHandlers.js'
import { AUTO_HIDE_KEY, COMMENT_MAX, CONTENT_MAX, DETAIL_MAX, REPORT_REASONS, TITLE_MAX } from '../config/communityCodes.js'
import { mockComments, mockPosts, mockReports, mockSeq, mockSettings, nicknameOf } from './communityMockData.js'

// N-06·N-33·N-34 신용 라운지 mock — 1단계 서버(BoardService·ReportService·AdminReportService)와 같은 규칙·응답 모양으로 흉내 낸다.

const VISIBLE = 'VISIBLE'
const HIDDEN = 'HIDDEN_BY_REPORT'
const DELETED = 'DELETED'
const OPEN_STATUSES = ['RECEIVED', 'IN_REVIEW']
const REASON_CODES = REPORT_REASONS.map((reason) => reason.value)

// 지금 시각을 서버 LocalDateTime 모양(2026-11-15T10:00:00)으로
function nowText() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// 서버 GlobalExceptionHandler와 같은 오류 모양 { code, message, fieldErrors }
function fail(status, code, message, fieldErrors = []) {
  throw new ApiError(status, message, { code, message, fieldErrors })
}
function invalid(field, message) {
  fail(400, 'INVALID_INPUT', message, [{ field, message }])
}

// 서버 PiiMasking.name과 같은 규칙으로 닉네임을 가린다. 예) 신고자닉 → 신**닉
function maskName(name) {
  if (!name) return null
  if (name.length <= 2) return name.slice(0, 1) + '*'.repeat(name.length - 1)
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}

// 로그인한 mock 계정 { loginId, isAdmin }
function currentUser(token) {
  const account = requireAccountByToken(token)
  return { loginId: account.loginId, isAdmin: account.user.role === ROLES.ADMIN }
}
function requireAdmin(token) {
  if (!currentUser(token).isAdmin) fail(403, 'FORBIDDEN', '권한이 없습니다.')
}

/* ---------- 글·댓글 (COMM-01~06) ---------- */

function findPost(postId) {
  const post = mockPosts.find((item) => item.postId === postId && item.status !== DELETED)
  if (!post) fail(404, 'POST_NOT_FOUND', '글을 찾을 수 없습니다.')
  return post
}
function requireOwner(post, loginId) {
  if (post.authorId !== loginId) fail(403, 'NOT_OWNER', '내가 쓴 글만 고치거나 지울 수 있습니다.')
}
function checkPostWrite(body) {
  const title = String(body?.title ?? '').trim()
  const content = String(body?.content ?? '').trim()
  if (!title) invalid('title', '제목을 입력해 주세요.')
  if (title.length > TITLE_MAX) invalid('title', `제목은 ${TITLE_MAX}자까지 쓸 수 있습니다.`)
  if (!content) invalid('content', '내용을 입력해 주세요.')
  if (content.length > CONTENT_MAX) invalid('content', `내용은 ${CONTENT_MAX}자까지 쓸 수 있습니다.`)
  return { title, content }
}

// 댓글 한 개 응답. 숨김 댓글은 내용을 비운다. 삭제 댓글은 목록에서 뺀다.
function commentView(comment, loginId) {
  const hidden = comment.status === HIDDEN
  return {
    commentId: comment.commentId,
    content: hidden ? null : comment.content,
    nickname: nicknameOf(comment.authorId),
    createdAt: comment.createdAt,
    hidden,
    mine: comment.authorId === loginId,
  }
}
function commentsOf(postId, loginId) {
  return mockComments
    .filter((comment) => comment.postId === postId && comment.status !== DELETED)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.commentId - b.commentId)
    .map((comment) => commentView(comment, loginId))
}

// 경로에 글 번호가 들어가는 처리 함수는 글마다 등록한다(공통 mock은 경로가 정확히 같아야 찾는다).
function registerPostRoutes(postId) {
  const path = `/api/board/posts/${postId}`
  registerMockHandlers({
    // N-06-1 상세 + 댓글. 숨김 글은 제목·내용을 비운다.
    [`GET ${path}`]: ({ token }) => {
      const { loginId } = currentUser(token)
      const post = findPost(postId)
      const hidden = post.status === HIDDEN
      return {
        postId,
        title: hidden ? null : post.title,
        content: hidden ? null : post.content,
        nickname: nicknameOf(post.authorId),
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        hidden,
        mine: post.authorId === loginId,
        comments: commentsOf(postId, loginId),
      }
    },
    // N-06-5 내 글 수정 — 보이는 글만
    [`PUT ${path}`]: ({ token, body }) => {
      const { loginId } = currentUser(token)
      const post = findPost(postId)
      requireOwner(post, loginId)
      if (post.status !== VISIBLE) fail(409, 'POST_HIDDEN', '신고로 숨김 처리된 글은 수정할 수 없습니다.')
      Object.assign(post, checkPostWrite(body), { updatedAt: nowText() })
      return {}
    },
    // N-06-6 내 글 삭제 — 숨김 글도 지울 수 있다
    [`DELETE ${path}`]: ({ token }) => {
      const { loginId } = currentUser(token)
      const post = findPost(postId)
      requireOwner(post, loginId)
      post.status = DELETED
      return {}
    },
    // N-06-3 댓글 목록
    [`GET ${path}/comments`]: ({ token }) => {
      const { loginId } = currentUser(token)
      findPost(postId)
      return { comments: commentsOf(postId, loginId) }
    },
    // N-06-3 댓글 쓰기 — 숨김 글에는 못 단다
    [`POST ${path}/comments`]: ({ token, body }) => {
      const { loginId } = currentUser(token)
      const post = findPost(postId)
      if (post.status !== VISIBLE) fail(409, 'POST_HIDDEN', '신고로 숨김 처리된 글에는 댓글을 달 수 없습니다.')
      const content = String(body?.content ?? '').trim()
      if (!content) invalid('content', '댓글을 입력해 주세요.')
      if (content.length > COMMENT_MAX) invalid('content', `댓글은 ${COMMENT_MAX}자까지 쓸 수 있습니다.`)
      const commentId = ++mockSeq.comment
      mockComments.push({ commentId, postId, authorId: loginId, content, createdAt: nowText(), status: VISIBLE })
      return { commentId }
    },
  })
}

/* ---------- 신고 (COMM-07) ---------- */

// 신고 대상 { authorId, status, setStatus } — 없거나 삭제됐으면 null
function findTarget(targetType, targetId) {
  const list = targetType === 'POST' ? mockPosts : mockComments
  const key = targetType === 'POST' ? 'postId' : 'commentId'
  const item = list.find((row) => row[key] === targetId)
  return item && item.status !== DELETED ? item : null
}
const openCountOf = (targetType, targetId) =>
  mockReports.filter((r) => r.targetType === targetType && r.targetId === targetId && OPEN_STATUSES.includes(r.statusCode)).length

/* ---------- 관리자 신고 처리 (ADM-11~13) ---------- */

// 사유 5개를 늘 같은 순서로, 0건까지 담는다
function reasonCountsOf(reports) {
  return Object.fromEntries(REASON_CODES.map((code) => [code, reports.filter((r) => r.reasonCode === code).length]))
}
const targetReports = (targetType, targetId) => mockReports.filter((r) => r.targetType === targetType && r.targetId === targetId)

// 묶음 상태 — 미처리가 하나라도 있으면 검토 중·접수, 아니면 가장 최근 신고의 상태
function groupStatus(reports) {
  if (reports.some((r) => r.statusCode === 'IN_REVIEW')) return 'IN_REVIEW'
  if (reports.some((r) => r.statusCode === 'RECEIVED')) return 'RECEIVED'
  return reports[0].statusCode
}
function targetInfo(targetType, targetId) {
  if (targetType === 'POST') {
    const post = mockPosts.find((row) => row.postId === targetId)
    return { text: post.title, status: post.status, parentPostId: null, row: post }
  }
  const comment = mockComments.find((row) => row.commentId === targetId)
  return { text: comment.content.slice(0, 50), status: comment.status, parentPostId: comment.postId, row: comment }
}

function registerReportRoutes(reportId) {
  const path = `/api/admin/reports/${reportId}`
  const findReport = () => {
    const report = mockReports.find((r) => r.reportId === reportId)
    if (!report) fail(404, 'REPORT_NOT_FOUND', '신고를 찾을 수 없습니다.')
    return report
  }
  registerMockHandlers({
    // N-34-2 상세 — 원문·작성자, 사유별 건수, 신고자(가림) 목록
    [`GET ${path}`]: ({ token }) => {
      requireAdmin(token)
      const report = findReport()
      const info = targetInfo(report.targetType, report.targetId)
      const reports = targetReports(report.targetType, report.targetId).sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
      return {
        reportId,
        targetType: report.targetType,
        targetId: report.targetId,
        parentPostId: info.parentPostId,
        targetStatus: info.status,
        title: report.targetType === 'POST' ? info.row.title : null,
        content: info.row.content,
        authorNickname: nicknameOf(info.row.authorId),
        reportCount: reports.length,
        reasonCounts: reasonCountsOf(reports),
        reports: reports.map((r) => ({
          reportId: r.reportId,
          reporter: maskName(nicknameOf(r.reporterId)),
          reasonCode: r.reasonCode,
          detailText: r.detailText,
          statusCode: r.statusCode,
          resultCode: r.resultCode,
          handlerMemo: r.handlerMemo,
          reportedAt: r.reportedAt,
          handledAt: r.handledAt,
        })),
      }
    },
    // N-34-3 처리 — 같은 대상의 미처리 신고를 한 번에 닫는다
    [`PATCH ${path}`]: ({ token, body }) => {
      requireAdmin(token)
      const report = findReport()
      const resultCode = body?.resultCode
      // FP-224: 서버처럼 삭제·반려만 받는다(숨김 유지는 400)
      if (!['DELETE', 'REJECT'].includes(resultCode)) invalid('resultCode', '처리 결과는 삭제·반려 중에서 골라 주세요.')
      const open = targetReports(report.targetType, report.targetId).filter((r) => OPEN_STATUSES.includes(r.statusCode))
      if (!open.length) fail(409, 'ALREADY_HANDLED', '이미 처리된 신고입니다.')
      const { row } = targetInfo(report.targetType, report.targetId)
      if (resultCode === 'DELETE') row.status = DELETED
      if (resultCode === 'REJECT' && row.status === HIDDEN) row.status = VISIBLE
      const memo = String(body?.memo ?? '').trim() || null
      const handledAt = nowText()
      open.forEach((r) => {
        Object.assign(r, { statusCode: resultCode === 'REJECT' ? 'REJECTED' : 'DONE', resultCode, handlerMemo: memo, handledAt })
      })
      return { resultCode, targetStatus: row.status, handledCount: open.length }
    },
  })
}

registerMockHandlers({
  // N-06-1 글 목록 — 삭제 글은 빼고, 검색은 보이는 글에서만. 최신순.
  'GET /api/board/posts': ({ token, query }) => {
    const { loginId } = currentUser(token)
    const page = Math.max(1, Number(query.get('page')) || 1)
    const size = Math.min(50, Math.max(1, Number(query.get('size')) || 10))
    const keyword = (query.get('keyword') ?? '').trim()
    const rows = mockPosts
      .filter((post) => post.status !== DELETED)
      .filter((post) => !keyword || (post.status === VISIBLE && (post.title + post.content).includes(keyword)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.postId - a.postId)
    const items = rows.slice((page - 1) * size, page * size).map((post) => {
      const hidden = post.status === HIDDEN
      return {
        postId: post.postId,
        title: hidden ? null : post.title,
        nickname: nicknameOf(post.authorId),
        commentCount: mockComments.filter((c) => c.postId === post.postId && c.status !== DELETED).length,
        createdAt: post.createdAt,
        hidden,
        mine: post.authorId === loginId,
      }
    })
    return { items, page, size, totalCount: rows.length }
  },

  // N-06-2 글쓰기
  'POST /api/board/posts': ({ token, body }) => {
    const { loginId } = currentUser(token)
    const postId = ++mockSeq.post
    mockPosts.push({ postId, authorId: loginId, ...checkPostWrite(body), createdAt: nowText(), updatedAt: null, status: VISIBLE })
    registerPostRoutes(postId)
    return { postId }
  },

  // N-33-1·2 신고 접수 + 기준 건수 자동 숨김
  'POST /api/reports': ({ token, body }) => {
    const { loginId } = currentUser(token)
    const targetType = body?.targetType
    const targetId = Number(body?.targetId)
    if (!['POST', 'COMMENT'].includes(targetType)) invalid('targetType', '신고 대상이 올바르지 않습니다.')
    if (!REASON_CODES.includes(body?.reasonCode)) invalid('reasonCode', '신고 사유를 골라 주세요.')
    if (String(body?.detailText ?? '').length > DETAIL_MAX) invalid('detailText', `상세 내용은 ${DETAIL_MAX}자까지 쓸 수 있습니다.`)

    const target = findTarget(targetType, targetId)
    if (!target) fail(404, 'TARGET_NOT_FOUND', '신고할 글·댓글을 찾을 수 없습니다.')
    if (target.authorId === loginId) fail(409, 'OWN_CONTENT', '내가 쓴 글·댓글은 신고할 수 없습니다.')
    if (targetReports(targetType, targetId).some((r) => r.reporterId === loginId)) {
      fail(409, 'DUPLICATE_REPORT', '이미 신고한 글·댓글입니다.')
    }
    const today = nowText().slice(0, 10)
    const todayCount = mockReports.filter((r) => r.reporterId === loginId && r.reportedAt.startsWith(today)).length
    if (todayCount >= mockSettings.REPORT_DAILY_LIMIT) {
      fail(429, 'DAILY_LIMIT_EXCEEDED', `신고는 하루 ${mockSettings.REPORT_DAILY_LIMIT}번까지 할 수 있습니다.`)
    }

    const reportId = ++mockSeq.report
    const detail = String(body?.detailText ?? '').trim()
    mockReports.push({
      reportId,
      targetType,
      targetId,
      reporterId: loginId,
      reasonCode: body.reasonCode,
      detailText: body.reasonCode === 'OTHER' && detail ? detail : null,
      statusCode: 'RECEIVED',
      resultCode: null,
      handlerMemo: null,
      reportedAt: nowText(),
      handledAt: null,
    })
    registerReportRoutes(reportId)
    if (openCountOf(targetType, targetId) >= mockSettings.REPORT_AUTO_HIDE_COUNT && target.status === VISIBLE) {
      target.status = HIDDEN
    }
    return { reportId, targetHidden: target.status === HIDDEN }
  },

  // N-34-1 신고 목록 — 조건에 맞는 신고를 대상별로 묶고, 숨김 대상을 먼저, 그다음 최근 신고 순
  'GET /api/admin/reports': ({ token, query }) => {
    requireAdmin(token)
    const status = query.get('status')
    const reason = query.get('reason')
    const from = query.get('from')
    const to = query.get('to')
    const rows = mockReports
      .filter((r) => !status || r.statusCode === status)
      .filter((r) => !reason || r.reasonCode === reason)
      .filter((r) => !from || r.reportedAt.slice(0, 10) >= from)
      .filter((r) => !to || r.reportedAt.slice(0, 10) <= to)
      .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt) || b.reportId - a.reportId)
    const groups = new Map()
    rows.forEach((r) => {
      const key = `${r.targetType}:${r.targetId}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(r)
    })
    const items = [...groups.values()].map((reports) => {
      const latest = reports[0]
      const info = targetInfo(latest.targetType, latest.targetId)
      return {
        reportId: latest.reportId,
        targetType: latest.targetType,
        targetId: latest.targetId,
        parentPostId: info.parentPostId,
        targetText: info.text,
        targetStatus: info.status,
        reportCount: reports.length,
        reasonCounts: reasonCountsOf(reports),
        statusCode: groupStatus(reports),
        lastReportedAt: latest.reportedAt,
      }
    })
    items.sort((a, b) => (b.targetStatus === HIDDEN) - (a.targetStatus === HIDDEN) || b.lastReportedAt.localeCompare(a.lastReportedAt))
    const pendingTargets = new Set(mockReports.filter((r) => OPEN_STATUSES.includes(r.statusCode)).map((r) => `${r.targetType}:${r.targetId}`))
    return { pendingCount: pendingTargets.size, autoHideCount: mockSettings.REPORT_AUTO_HIDE_COUNT, items }
  },

  // ADM-14 설정 조회 — 화면에서 바꿀 수 있는 키만
  'GET /api/admin/settings': ({ token }) => {
    requireAdmin(token)
    return {
      settings: [
        { settingKey: AUTO_HIDE_KEY, value: mockSettings.REPORT_AUTO_HIDE_COUNT, description: '신고 자동 숨김 기준 건수 (3~10)', min: 3, max: 10 },
      ],
    }
  },
  // ADM-14 설정 변경
  'PUT /api/admin/settings': ({ token, body }) => {
    requireAdmin(token)
    if (body?.settingKey !== AUTO_HIDE_KEY) fail(400, 'UNKNOWN_SETTING', '바꿀 수 없는 설정입니다.')
    const value = Number(body?.value)
    if (!Number.isInteger(value) || value < 3 || value > 10) invalid('value', '3~10 사이로 입력해 주세요.')
    mockSettings.REPORT_AUTO_HIDE_COUNT = value
    return { settingKey: AUTO_HIDE_KEY, value, description: '신고 자동 숨김 기준 건수 (3~10)', min: 3, max: 10 }
  },
})

// 처음 들어 있는 글·신고의 번호별 경로를 등록한다
mockPosts.forEach((post) => registerPostRoutes(post.postId))
mockReports.forEach((report) => registerReportRoutes(report.reportId))
