import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL, USE_MOCK } from '../../../common/config/env.js'
import { tokenStorage } from '../../../common/auth/tokenStorage.js'
import { UNAUTHORIZED_EVENT } from '../../../common/api/client.js'
import { adaptNotifications } from '../adapters/notificationAdapter.js'
import { readNotificationEvents } from '../adapters/sseReader.js'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notificationApi.js'

const waitForReconnect = (signal, delay) => new Promise((resolve) => {
  const finish = () => { window.clearTimeout(timer); signal.removeEventListener('abort', finish); resolve() }
  const timer = window.setTimeout(finish, delay)
  signal.addEventListener('abort', finish, { once: true })
})

// D-23 알림 목록·읽음 상태를 관리하고 SSE 연결 시 새 항목을 추가할 수 있는 함수를 제공한다.
export function useNotifications(enabled = true) {
  const [state, setState] = useState({ items: [], unreadCount: 0, loading: true, error: '' })
  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, error: '', loading: true }))
    try { setState({ ...adaptNotifications(await fetchNotifications({ unreadOnly: true })), loading: false, error: '' }) }
    catch { setState((current) => ({ ...current, loading: false, error: '알림을 불러오지 못했어요.' })) }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    fetchNotifications({ unreadOnly: true }).then((data) => { if (active) setState({ ...adaptNotifications(data), loading: false, error: '' }) })
      .catch(() => { if (active) setState((current) => ({ ...current, loading: false, error: '알림을 불러오지 못했어요.' })) })
    return () => { active = false }
  }, [enabled])

  const addNotification = useCallback((item) => {
    setState((current) => {
      const notificationId = item.notificationId ?? Number(item.id)
      if (!Number.isSafeInteger(notificationId) || current.items.some((row) => row.notificationId === notificationId)) return current
      const notification = {
        notificationId,
        typeCode: item.typeCode ?? item.type,
        title: item.title,
        content: item.content ?? '',
        linkUrl: typeof item.linkUrl === 'string' && item.linkUrl.startsWith('/') && !item.linkUrl.startsWith('//') ? item.linkUrl : null,
        read: false,
        createdAt: item.createdAt ?? new Date().toISOString(),
      }
      return { ...current, items: [notification, ...current.items], unreadCount: current.unreadCount + 1 }
    })
  }, [])

  useEffect(() => {
    if (!enabled || USE_MOCK || !tokenStorage.get()) return undefined
    const controller = new AbortController()
    let stopped = false
    let connectedBefore = false
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
          if (connectedBefore) await refresh()
          connectedBefore = true
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
    setState((current) => {
      const wasUnread = current.items.some((item) => item.notificationId === id && !item.read)
      const items = current.items.filter((item) => item.notificationId !== id)
      return { ...current, items, unreadCount: Math.max(0, current.unreadCount - Number(wasUnread)) }
    })
  }, [])
  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    setState((current) => ({ ...current, items: [], unreadCount: 0 }))
  }, [])

  return { ...state, refresh, addNotification, markRead, markAllRead }
}
