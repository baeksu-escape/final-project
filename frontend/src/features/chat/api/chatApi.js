import { apiGet, apiPost } from '../../../common/api/client.js'
import { ROOM_PAGE_SIZE } from '../chatConstants.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/chatMockHandlers.js'

// N-07 1:1 채팅 API 경로 — API 정의서 CHAT-01~09와 같다.
const MEMBER = '/api/members/me/chat'
const ADMIN = '/api/admin/chat'

// 값이 있는 것만 주소 뒤에 붙인다.
function withQuery(path, params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) query.set(key, String(value))
  })
  const text = query.toString()
  return text ? `${path}?${text}` : path
}

// 대화 하나를 다루는 API 묶음. 회원 화면과 관리자 화면이 같은 모양으로 써서 대화 컴포넌트를 함께 쓴다.
//   fetch({ afterId, beforeId }) → { roomId, messages: [{ messageId, senderType, content, createdAt }], hasMore }
function conversation(base) {
  return Object.freeze({
    fetch: (params = {}) => apiGet(withQuery(`${base}/messages`, params)),
    send: (content) => apiPost(`${base}/messages`, { content }),
    read: (lastMessageId) => apiPost(`${base}/read`, { lastMessageId }),
  })
}

// CHAT-01~03 N-07-1·2 회원의 내 문의
export const memberConversation = conversation(MEMBER)

// CHAT-06~08 N-07-2·4 관리자가 고른 문의
export function adminConversation(roomId) {
  return conversation(`${ADMIN}/rooms/${roomId}`)
}

// CHAT-05 N-07-3 문의 목록 → { items: [{ roomId, nickname, lastMessage, lastMessageAt, unreadCount }], page, size, totalCount }
export function fetchRooms(page = 1) {
  return apiGet(withQuery(`${ADMIN}/rooms`, { page, size: ROOM_PAGE_SIZE }))
}

// CHAT-04·09 N-07-5 안 읽은 메시지 수 → { unreadCount }
export function fetchUnreadCount(admin) {
  return apiGet(`${admin ? ADMIN : MEMBER}/unread-count`)
}
