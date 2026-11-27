import { apiGet, apiPatch } from '../../../common/api/client.js'
import '../mocks/notificationMockHandlers.js'

export const NOTIFICATION_API = Object.freeze({
  LIST: '/api/members/me/notifications',
  READ_ALL: '/api/members/me/notifications/read-all',
  read: (id) => `/api/members/me/notifications/${encodeURIComponent(id)}/read`,
})

// D-23 알림 목록 조회와 읽음 처리 API를 기존 공통 client로 호출한다.
// D-23 목록 쿼리는 요청된 조건만 추가해 기존 경로와 응답 모양을 유지한다.
export function fetchNotifications({ unreadOnly = false, type, before, size } = {}) {
  const query = new URLSearchParams()
  if (unreadOnly) query.set('unreadOnly', 'true')
  if (type) query.set('type', type)
  if (before != null) query.set('before', String(before))
  if (size != null) query.set('size', String(size))
  const queryText = query.toString()
  return apiGet(queryText ? `${NOTIFICATION_API.LIST}?${queryText}` : NOTIFICATION_API.LIST)
}
export const markNotificationRead = (id) => apiPatch(NOTIFICATION_API.read(id))
export const markAllNotificationsRead = () => apiPatch(NOTIFICATION_API.READ_ALL)
