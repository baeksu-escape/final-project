// FP-287 N-07 1:1 채팅 공통 값. 화면 경로는 공통 navigation.js 대신 여기에 둔다(관리자 탭 5개는 바꾸지 않는다).
export const CHAT_PATHS = Object.freeze({
  INQUIRY: '/inquiry',
  ADMIN_INQUIRY: '/admin/inquiries',
})

// 메시지 한 건의 최대 글자 수 — 서버 ChatDtos.CONTENT_MAX, DDL CHAT_MESSAGE.CONTENT와 같다.
export const CONTENT_MAX = 500

export const SENDER = Object.freeze({ USER: 'USER', ADMIN: 'ADMIN' })

// 한 번에 받는 메시지 수(서버와 같음)와 관리자 문의 목록 한 쪽의 방 수
export const MESSAGE_PAGE_SIZE = 50
export const ROOM_PAGE_SIZE = 20

// 웹소켓이 끊겼을 때 다시 연결하기까지 기다리는 시간(밀리초). 마지막 값을 계속 쓴다.
export const RECONNECT_DELAYS = Object.freeze([1000, 2000, 5000, 10000])
// 웹소켓이 끊겨 있는 동안 새 메시지를 확인하는 간격
export const FALLBACK_POLL_MS = 5000
// 헤더의 안 읽은 개수를 다시 확인하는 간격
export const UNREAD_POLL_MS = 30000
// 서버가 인증 실패로 닫을 때의 코드. 이 코드면 다시 연결하지 않는다.
export const AUTH_FAILED_CODE = 4401

// 화면에서 읽음 처리한 뒤 헤더·목록의 안 읽은 개수를 다시 불러오게 하는 이벤트 이름
export const CHAT_READ_EVENT = 'avenue:chat-read'

// 서버 시각('2026-11-28T10:05:00')을 '11/28 10:05'로 보여 준다.
export function formatChatTime(value) {
  if (!value) return ''
  return `${value.slice(5, 7)}/${value.slice(8, 10)} ${value.slice(11, 16)}`
}
