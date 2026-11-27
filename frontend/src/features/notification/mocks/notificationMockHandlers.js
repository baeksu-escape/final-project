import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'
import { ApiError } from '../../../common/api/ApiError.js'

const now = Date.now()
const ago = (minutes) => new Date(now - minutes * 60000).toISOString()
const seeded = [
  { notificationId: 28404, typeCode: 'SCORE_NEW', title: '새 신용 점수가 나왔어요', content: '내 신용에서 새 평가 결과를 확인해 보세요.', linkUrl: '/report', read: false, createdAt: ago(3) },
  { notificationId: 28403, typeCode: 'COMMENT_NEW', title: '내 글에 새 댓글이 달렸어요', content: '시나리오 공유 글에 댓글이 달렸어요.', linkUrl: '/lounge', read: false, createdAt: ago(47) },
  { notificationId: 28402, typeCode: 'REPORT_RESULT', title: '신고 처리 결과가 있어요', content: '접수한 신고의 처리 결과를 확인해 주세요.', linkUrl: '/lounge', read: true, createdAt: ago(1500) },
  { notificationId: 28401, typeCode: 'WELCOME', title: 'Avenue에 오신 것을 환영해요', content: '내 정보를 입력하고 재무 진단을 시작해 보세요.', linkUrl: '/data-input', read: true, createdAt: ago(4200) },
]
const stores = new Map()
const storeFor = (token) => {
  const user = requireMockUser(token)
  if (!stores.has(user.userId)) stores.set(user.userId, structuredClone(seeded))
  return stores.get(user.userId)
}
// D-23 서버와 같은 조건 검증을 거쳐 최신순 목록·전체 미읽음 수·다음 페이지 여부를 돌려준다.
function snapshot(items, { unreadOnly = false, type, before, size = 20 } = {}) {
  if (!Number.isInteger(size) || size < 1 || size > 50
      || (before != null && (!Number.isSafeInteger(Number(before)) || Number(before) < 1))
      || (type != null && !['SCORE_NEW', 'COMMENT_NEW', 'REPORT_RESULT', 'WELCOME'].includes(type))) {
    const message = '알림 목록 조건을 확인해 주세요.'
    throw new ApiError(400, message, { code: 'INVALID_INPUT', message })
  }
  const sorted = structuredClone(items).sort((a, b) => b.notificationId - a.notificationId)
  const filtered = sorted.filter((item) => (!unreadOnly || !item.read)
    && (!type || item.typeCode === type)
    && (before == null || item.notificationId < Number(before)))
  return { unreadCount: items.filter((item) => !item.read).length, items: filtered.slice(0, size), hasMore: filtered.length > size }
}
const handlers = {
  'GET /api/members/me/notifications': ({ token, query }) => {
    const rawSize = query?.get('size')
    const rawBefore = query?.get('before')
    const rawUnreadOnly = query?.get('unreadOnly')
    if (rawUnreadOnly != null && !['true', 'false'].includes(rawUnreadOnly.toLowerCase())) {
      const message = '알림 목록 조건을 확인해 주세요.'
      throw new ApiError(400, message, { code: 'INVALID_INPUT', message })
    }
    const unreadOnly = rawUnreadOnly?.toLowerCase() === 'true'
    const size = rawSize == null ? 20 : Number(rawSize)
    const before = rawBefore == null ? null : Number(rawBefore)
    return snapshot(storeFor(token), { unreadOnly, type: query?.get('type') ?? undefined, before, size })
  },
  // D-23 모두 읽음 처리는 실제로 변경한 건수를 반환한다.
  'PATCH /api/members/me/notifications/read-all': ({ token }) => {
    const items = storeFor(token)
    const updatedCount = items.filter((item) => !item.read).length
    items.forEach((item) => { item.read = true })
    return { updatedCount }
  },
}

// D-23 동적 알림 ID 경로를 등록하고, 본인 기록이 없으면 서버와 같은 NOT_FOUND 오류를 낸다.
export function registerNotificationReadMock(id) {
  const notificationId = Number(id)
  registerMockHandlers({
    [`PATCH /api/members/me/notifications/${encodeURIComponent(id)}/read`]: ({ token }) => {
      const item = storeFor(token).find((row) => row.notificationId === notificationId)
      if (!item) {
        const message = '알림을 찾을 수 없습니다.'
        throw new ApiError(404, message, { code: 'NOT_FOUND', message })
      }
      item.read = true
      return {}
    },
  })
}

// D-23 mock 알림은 사용자별 읽음 상태를 보관하고 API 응답 모양을 그대로 돌려준다.
registerMockHandlers(handlers)
