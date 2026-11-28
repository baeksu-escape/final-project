import { useLayoutEffect, useState } from 'react'
import { markAllNotificationsRead } from '../api/notificationApi.js'

const COLLECT_UNREAD = 'avenue:collect-unread-notifications'

const READ_ALL_FINISHED = 'avenue:read-all-finished'
let pendingWrites = 0
let writeVersion = 0

// D-23 더보기의 시작과 완료 사이에 전체 읽음이 끼었는지 확인한다.
export function paginationVersion() {
  return pendingWrites ? null : writeVersion
}

// D-23 PATCH를 보내기 직전 헤더와 기록 페이지에서 확인한 미읽음 번호를 모은다.
export function useReadAllSnapshot(items) {
  const [pending, setPending] = useState(pendingWrites > 0)
  useLayoutEffect(() => {
    const collect = (event) => {
      setPending(true)
      event.detail.initialLists.add(items)
      for (const item of items) {
        if (!item.read) event.detail.readIds.add(item.notificationId)
      }
    }
    window.addEventListener(COLLECT_UNREAD, collect)
    const finished = () => setPending(pendingWrites > 0)
    window.addEventListener(READ_ALL_FINISHED, finished)
    return () => {
      window.removeEventListener(COLLECT_UNREAD, collect)
      window.removeEventListener(READ_ALL_FINISHED, finished)
    }
  }, [items])

  const markAll = async () => {
    const snapshot = { readAll: true, readIds: new Set(), initialLists: new Set() }
    pendingWrites += 1
    writeVersion += 1
    try {
      window.dispatchEvent(new CustomEvent(COLLECT_UNREAD, { detail: snapshot }))
      await markAllNotificationsRead()
      return snapshot
    } finally {
      pendingWrites -= 1
      window.dispatchEvent(new CustomEvent(READ_ALL_FINISHED))
    }
  }
  return [markAll, pending]
}

// D-23 전체 읽음의 확인된 범위만 먼저 반영한다. 요청 도중 새로 확인한 미읽음은 후속 조회까지 유지한다.
export function applyReadAll(current, { readIds, initialLists }, unreadOnly) {
  const items = unreadOnly
    ? current.items.filter((item) => !readIds.has(item.notificationId))
    : current.items.map((item) => readIds.has(item.notificationId) ? { ...item, read: true } : item)
  if (initialLists.has(current.items)) return { ...current, items, unreadCount: 0 }

  // 요청 중 교체된 목록은 마지막 서버 조회 기준으로 유지한다. 읽음이 섞인 부분 목록에서는 전체 수를 추정하지 않는다.
  const previouslyUnread = current.items.filter((item) => !item.read)
  const confirmedRead = previouslyUnread.filter((item) => readIds.has(item.notificationId)).length
  let unreadCount = current.unreadCount
  if (confirmedRead > 0) {
    unreadCount = previouslyUnread.length === current.unreadCount ? current.unreadCount - confirmedRead : null
  }
  return { ...current, items, unreadCount, lastSnapshot: true, countPending: confirmedRead > 0 }
}
