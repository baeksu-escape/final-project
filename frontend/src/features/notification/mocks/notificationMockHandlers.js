import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { requireMockUser } from '../../../common/mocks/mockHandlers.js'

const now = Date.now()
const ago = (minutes) => new Date(now - minutes * 60000).toISOString()
const seeded = [
  { notificationId: 28401, typeCode: 'SCORE_NEW', title: '새 신용 점수가 나왔어요', content: '내 신용에서 새 평가 결과를 확인해 보세요.', linkUrl: '/report', read: false, createdAt: ago(3) },
  { notificationId: 28402, typeCode: 'COMMENT_NEW', title: '내 글에 새 댓글이 달렸어요', content: '시나리오 공유 글에 댓글이 달렸어요.', linkUrl: '/lounge', read: false, createdAt: ago(47) },
  { notificationId: 28403, typeCode: 'REPORT_RESULT', title: '신고 처리 결과가 있어요', content: '접수한 신고의 처리 결과를 확인해 주세요.', linkUrl: '/lounge', read: true, createdAt: ago(1500) },
  { notificationId: 28404, typeCode: 'WELCOME', title: 'Avenue에 오신 것을 환영해요', content: '내 정보를 입력하고 재무 진단을 시작해 보세요.', linkUrl: '/data-input', read: true, createdAt: ago(4200) },
]
const stores = new Map()
const storeFor = (token) => {
  const user = requireMockUser(token)
  if (!stores.has(user.userId)) stores.set(user.userId, structuredClone(seeded))
  return stores.get(user.userId)
}
const snapshot = (items) => ({ unreadCount: items.filter((item) => !item.read).length, items: structuredClone(items).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)) })
const ids = seeded.map((item) => item.notificationId)
const handlers = {
  'GET /api/members/me/notifications': ({ token }) => snapshot(storeFor(token)),
  'PATCH /api/members/me/notifications/read-all': ({ token }) => {
    storeFor(token).forEach((item) => { item.read = true })
    return snapshot(storeFor(token))
  },
}
ids.forEach((id) => {
  handlers[`PATCH /api/members/me/notifications/${id}/read`] = ({ token }) => {
    const item = storeFor(token).find((row) => row.notificationId === id)
    if (item) item.read = true
    return snapshot(storeFor(token))
  }
})

// D-23 mock 알림은 사용자별 읽음 상태를 보관하고 API 응답 모양을 그대로 돌려준다.
registerMockHandlers(handlers)
