import { apiGet, apiPatch } from '../../../common/api/client.js'
import '../mocks/notificationMockHandlers.js'

export const NOTIFICATION_API = Object.freeze({
  LIST: '/api/members/me/notifications',
  READ_ALL: '/api/members/me/notifications/read-all',
  read: (id) => `/api/members/me/notifications/${encodeURIComponent(id)}/read`,
})

// D-23 알림 목록 조회와 읽음 처리 API를 기존 공통 client로 호출한다.
export const fetchNotifications = () => apiGet(NOTIFICATION_API.LIST)
export const markNotificationRead = (id) => apiPatch(NOTIFICATION_API.read(id))
export const markAllNotificationsRead = () => apiPatch(NOTIFICATION_API.READ_ALL)
