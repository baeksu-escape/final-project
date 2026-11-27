const TYPES = new Set(['SCORE_NEW', 'COMMENT_NEW', 'REPORT_RESULT', 'WELCOME'])

// D-23 응답에서 내부 경로만 허용하고 화면에 필요한 알림 필드를 확인한다.
export function adaptNotifications(data) {
  if (!data || !Array.isArray(data.items) || !Number.isSafeInteger(data.unreadCount)) throw new Error('알림 정보를 불러오지 못했습니다.')
  const items = data.items.map((item) => {
    if (!Number.isSafeInteger(item.notificationId) || !TYPES.has(item.typeCode) || typeof item.title !== 'string' || typeof item.content !== 'string') {
      throw new Error('알림 정보를 불러오지 못했습니다.')
    }
    const linkUrl = typeof item.linkUrl === 'string' && item.linkUrl.startsWith('/') && !item.linkUrl.startsWith('//') ? item.linkUrl : null
    return { ...item, linkUrl, read: Boolean(item.read) }
  })
  return { unreadCount: data.unreadCount, items, hasMore: Boolean(data.hasMore) }
}
