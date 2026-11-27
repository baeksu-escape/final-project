import { ApiError } from '../../../common/api/ApiError.js'
import { ROLES } from '../../../common/config/roles.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { findMockAccount, requireAccountByToken } from '../../auth/mocks/authMockHandlers.js'
import { CONTENT_MAX, MESSAGE_PAGE_SIZE, ROOM_PAGE_SIZE, SENDER } from '../chatConstants.js'

// N-07 1:1 채팅 mock — 서버(ChatService)와 같은 규칙·응답 모양으로 흉내 낸다. 값은 브라우저 메모리에만 있어
// 새로고침하면 처음으로 돌아가고, 다른 창과 함께 쓰지 않는다.

const rooms = []
let nextRoomId = 1
let nextMessageId = 1

// 서버 GlobalExceptionHandler와 같은 오류 모양 { code, message, fieldErrors }
function fail(status, code, message, fieldErrors = []) {
  throw new ApiError(status, message, { code, message, fieldErrors })
}

// 지금 시각을 서버 LocalDateTime 모양(2026-11-28T10:00:00)으로
function nowText() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function requireRole(token, role) {
  const account = requireAccountByToken(token)
  if (account.user.role !== role) fail(403, 'FORBIDDEN', '접근 권한이 없습니다.')
  return account
}

function addMessage(room, senderType, rawContent) {
  const content = String(rawContent ?? '').trim()
  const invalid = !content ? '메시지를 입력해 주세요.' : content.length > CONTENT_MAX ? `메시지는 ${CONTENT_MAX}자까지 쓸 수 있습니다.` : ''
  if (invalid) fail(400, 'INVALID_INPUT', invalid, [{ field: 'content', message: invalid }])
  const message = { messageId: nextMessageId++, senderType, content, createdAt: nowText() }
  room.messages.push(message)
  return { ...message }
}

function pageOf(room, query) {
  const afterId = query.get('afterId')
  const beforeId = query.get('beforeId')
  if (afterId != null) {
    const newer = room.messages.filter((item) => item.messageId > Number(afterId))
    return { roomId: room.roomId, messages: structuredClone(newer.slice(0, MESSAGE_PAGE_SIZE)), hasMore: newer.length > MESSAGE_PAGE_SIZE }
  }
  const older = room.messages.filter((item) => beforeId == null || item.messageId < Number(beforeId))
  return { roomId: room.roomId, messages: structuredClone(older.slice(-MESSAGE_PAGE_SIZE)), hasMore: older.length > MESSAGE_PAGE_SIZE }
}

// 읽은 위치는 방에 있는 번호까지만, 앞으로만 옮긴다.
function markRead(room, key, lastMessageId) {
  const found = room.messages.filter((item) => item.messageId <= Number(lastMessageId)).at(-1)
  if (found && found.messageId > room[key]) room[key] = found.messageId
  return {}
}

const unreadOf = (room, key, senderType) =>
  room.messages.filter((item) => item.senderType === senderType && item.messageId > room[key]).length

function findRoom(roomId) {
  const room = rooms.find((item) => item.roomId === roomId)
  if (!room) fail(404, 'CHAT_ROOM_NOT_FOUND', '문의를 찾을 수 없습니다.')
  return room
}

// 방을 만들고, 그 방의 관리자 경로(CHAT-06~08)를 등록한다. mock은 경로가 정확히 같아야 해서 방마다 등록한다.
function createRoom(account) {
  const room = { roomId: nextRoomId++, userId: account.user.userId, nickname: account.nickname ?? account.user.name, userRead: 0, adminRead: 0, messages: [] }
  rooms.push(room)
  const base = `/api/admin/chat/rooms/${room.roomId}`
  registerMockHandlers({
    [`GET ${base}/messages`]: ({ token, query }) => {
      requireRole(token, ROLES.ADMIN)
      return pageOf(findRoom(room.roomId), query)
    },
    [`POST ${base}/messages`]: ({ token, body }) => {
      requireRole(token, ROLES.ADMIN)
      return addMessage(findRoom(room.roomId), SENDER.ADMIN, body?.content)
    },
    [`POST ${base}/read`]: ({ token, body }) => {
      requireRole(token, ROLES.ADMIN)
      return markRead(findRoom(room.roomId), 'adminRead', body?.lastMessageId)
    },
  })
  return room
}

const roomOf = (account) => rooms.find((item) => item.userId === account.user.userId)

// 관리자 화면 확인용 시연 문의 한 건
const demoAccount = findMockAccount('self')
if (demoAccount) addMessage(createRoom(demoAccount), SENDER.USER, '점수가 산출되지 않는 이유가 궁금합니다.')

registerMockHandlers({
  'GET /api/members/me/chat/messages': ({ token, query }) => {
    const room = roomOf(requireRole(token, ROLES.USER))
    return room ? pageOf(room, query) : { roomId: null, messages: [], hasMore: false }
  },
  'POST /api/members/me/chat/messages': ({ token, body }) => {
    const account = requireRole(token, ROLES.USER)
    return addMessage(roomOf(account) ?? createRoom(account), SENDER.USER, body?.content)
  },
  'POST /api/members/me/chat/read': ({ token, body }) => {
    const room = roomOf(requireRole(token, ROLES.USER))
    return room ? markRead(room, 'userRead', body?.lastMessageId) : {}
  },
  'GET /api/members/me/chat/unread-count': ({ token }) => {
    const room = roomOf(requireRole(token, ROLES.USER))
    return { unreadCount: room ? unreadOf(room, 'userRead', SENDER.ADMIN) : 0 }
  },
  'GET /api/admin/chat/rooms': ({ token, query }) => {
    requireRole(token, ROLES.ADMIN)
    const page = Number(query.get('page')) || 1
    const size = Number(query.get('size')) || ROOM_PAGE_SIZE
    const sorted = rooms
      .filter((room) => room.messages.length > 0)
      .sort((a, b) => b.messages.at(-1).messageId - a.messages.at(-1).messageId)
    const items = sorted.slice((page - 1) * size, page * size).map((room) => ({
      roomId: room.roomId,
      nickname: room.nickname,
      lastMessage: room.messages.at(-1).content,
      lastMessageAt: room.messages.at(-1).createdAt,
      unreadCount: unreadOf(room, 'adminRead', SENDER.USER),
    }))
    return { items, page, size, totalCount: sorted.length }
  },
  'GET /api/admin/chat/unread-count': ({ token }) => {
    requireRole(token, ROLES.ADMIN)
    return { unreadCount: rooms.reduce((sum, room) => sum + unreadOf(room, 'adminRead', SENDER.USER), 0) }
  },
})
