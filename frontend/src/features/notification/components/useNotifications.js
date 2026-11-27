import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL, USE_MOCK } from '../../../common/config/env.js'
import { tokenStorage } from '../../../common/auth/tokenStorage.js'
import { UNAUTHORIZED_EVENT } from '../../../common/api/client.js'
import { adaptNotifications } from '../adapters/notificationAdapter.js'
import { readNotificationEvents } from '../adapters/sseReader.js'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notificationApi.js'

// D-23 알림 페이지에서 읽음 처리하면 이 이벤트로 헤더 드롭다운·배지를 다시 불러오게 한다.
export const NOTIFICATIONS_CHANGED_EVENT = 'avenue:notifications-changed'

// D-23 변경 주체를 이벤트에 넣어 헤더와 기록 페이지 사이의 상호 갱신 반복을 막는다.
export function emitNotificationsChanged(source, change = {}) {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { source, ...change } }))
}

// D-23 재연결 대기 중 화면이 닫히면 타이머와 취소 리스너를 함께 정리한다.
const waitForReconnect = (signal, delay) => new Promise((resolve) => {
  const finish = () => { window.clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
  const timer = window.setTimeout(finish, delay)
  signal.addEventListener('abort', finish, { once: true })
})

// D-23 서버 목록과 조회 도중 도착한 SSE를 ID로 합치고 새 항목 수를 전체 배지에 더한다.
function mergePendingNotifications(response, pendingItems, pendingAtStart) {
  const items = [...response.items]
  let arrivedDuringRequest = 0
  pendingItems.forEach((item, id) => {
    if (items.some((row) => row.notificationId === id)) return
    items.push(item)
    if (!pendingAtStart.has(id)) arrivedDuringRequest += 1
  })
  items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return { ...response, items, unreadCount: response.unreadCount + arrivedDuringRequest }
}

// D-23 알림 목록·읽음 상태를 관리하고 SSE 연결 시 새 항목을 추가할 수 있는 함수를 제공한다.
export function useNotifications(enabled = true) {
  const [state, setState] = useState({ items: [], unreadCount: 0, loading: true, error: '' })
  const pendingSse = useRef(new Map())
  const seenIds = useRef(new Set())
  const refresh = useCallback(async () => {
    const pendingAtStart = new Set(pendingSse.current.keys())
    setState((current) => ({ ...current, error: '', loading: current.items.length === 0 ? true : current.loading }))
    try {
      const response = mergePendingNotifications(adaptNotifications(await fetchNotifications({ unreadOnly: true })), pendingSse.current, pendingAtStart)
      response.items.forEach((item) => seenIds.current.add(item.notificationId))
      response.items.forEach((item) => pendingSse.current.delete(item.notificationId))
      setState({ ...response, loading: false, error: '' })
    }
    catch { setState((current) => ({ ...current, loading: false, error: '알림을 불러오지 못했어요.' })) }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    const pendingAtStart = new Set(pendingSse.current.keys())
    fetchNotifications({ unreadOnly: true }).then((data) => {
      if (active) {
        const response = mergePendingNotifications(adaptNotifications(data), pendingSse.current, pendingAtStart)
        response.items.forEach((item) => seenIds.current.add(item.notificationId))
        response.items.forEach((item) => pendingSse.current.delete(item.notificationId))
        setState({ ...response, loading: false, error: '' })
      }
    })
      .catch(() => { if (active) setState((current) => ({ ...current, loading: false, error: '알림을 불러오지 못했어요.' })) })
    return () => { active = false }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return undefined
    const refreshFromPage = (event) => {
      if (event.detail?.source !== 'page') return
      pendingSse.current.clear()
      refresh()
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshFromPage)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshFromPage)
  }, [enabled, refresh])

  const addNotification = useCallback((item) => {
    const notificationId = item.notificationId ?? Number(item.id)
    if (!Number.isSafeInteger(notificationId) || seenIds.current.has(notificationId)) return
    const notification = {
      notificationId,
      typeCode: item.typeCode ?? item.type,
      title: item.title,
      content: item.content ?? '',
      linkUrl: typeof item.linkUrl === 'string' && item.linkUrl.startsWith('/') && !item.linkUrl.startsWith('//') ? item.linkUrl : null,
      read: false,
      createdAt: item.createdAt ?? new Date().toISOString(),
    }
    seenIds.current.add(notificationId)
    pendingSse.current.set(notificationId, notification)
    setState((current) => current.items.some((row) => row.notificationId === notificationId)
      ? current : { ...current, items: [notification, ...current.items], unreadCount: current.unreadCount + 1 })
    emitNotificationsChanged('bell')
  }, [])

  useEffect(() => {
    if (!enabled || USE_MOCK || !tokenStorage.get()) return undefined
    const controller = new AbortController()
    let stopped = false
    let retryDelay = 1000
    const stopForUnauthorized = () => { stopped = true; controller.abort() }
    window.addEventListener(UNAUTHORIZED_EVENT, stopForUnauthorized)

    const connect = async () => {
      while (!stopped && !controller.signal.aborted) {
        const token = tokenStorage.get()
        if (!token) break
        try {
          const response = await fetch(`${API_BASE_URL}/api/members/me/notifications/stream`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
            signal: controller.signal,
          })
          if (response.status === 401) {
            tokenStorage.clear()
            window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
            break
          }
          if (!response.ok) throw new Error('알림 스트림 연결 실패')
          retryDelay = 1000
          await refresh()
          await readNotificationEvents(response, addNotification, controller.signal)
        } catch {
          if (stopped || controller.signal.aborted) break
        }
        if (stopped || controller.signal.aborted) break
        await waitForReconnect(controller.signal, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30000)
      }
    }

    connect()
    const refreshOnVisible = () => { if (document.visibilityState === 'visible' && !stopped) refresh() }
    document.addEventListener('visibilitychange', refreshOnVisible)
    return () => {
      stopped = true
      controller.abort()
      window.removeEventListener(UNAUTHORIZED_EVENT, stopForUnauthorized)
      document.removeEventListener('visibilitychange', refreshOnVisible)
    }
  }, [enabled, refresh, addNotification])

  const markRead = useCallback(async (id) => {
    await markNotificationRead(id)
    pendingSse.current.delete(id)
    setState((current) => {
      const wasUnread = current.items.some((item) => item.notificationId === id && !item.read)
      const items = current.items.filter((item) => item.notificationId !== id)
      return { ...current, items, unreadCount: Math.max(0, current.unreadCount - Number(wasUnread)) }
    })
    emitNotificationsChanged('bell', { notificationId: id })
  }, [])
  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    pendingSse.current.clear()
    setState((current) => ({ ...current, items: [], unreadCount: 0 }))
    emitNotificationsChanged('bell', { readAll: true })
  }, [])

  return { ...state, refresh, addNotification, markRead, markAllRead }
}
