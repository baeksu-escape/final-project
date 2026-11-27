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

// D-23 replaced 연결은 탭이 숨겨졌다가 다시 보일 때까지 재연결을 미룬다.
function waitUntilVisible(signal) {
  return new Promise((resolve) => {
    let hiddenBefore = document.visibilityState !== 'visible'
    const finish = (visible) => {
      document.removeEventListener('visibilitychange', handleVisibility)
      signal.removeEventListener('abort', handleAbort)
      resolve(visible)
    }
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') hiddenBefore = true
      else if (hiddenBefore) finish(true)
    }
    const handleAbort = () => finish(false)
    if (signal.aborted) { finish(false); return }
    document.addEventListener('visibilitychange', handleVisibility)
    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

// D-23 응답에 없는 SSE 항목은 목록에 보태고, 서버 응답 뒤 도착한 더 큰 ID만 배지에 보수적으로 더한다.
function mergePendingNotifications(response, pendingItems, responseReceivedAt) {
  const items = [...response.items]
  const maxResponseId = response.items.reduce((max, item) => Math.max(max, item.notificationId), 0)
  let confirmedAfterResponse = 0
  pendingItems.forEach((item, id) => {
    if (items.some((row) => row.notificationId === id)) return
    items.push(item.notification)
    if (id > maxResponseId && item.receivedAt > responseReceivedAt) confirmedAfterResponse += 1
  })
  items.sort((a, b) => b.notificationId - a.notificationId)
  return { ...response, items, unreadCount: response.unreadCount + confirmedAfterResponse }
}

// D-23 알림 목록·읽음 상태를 관리하고 SSE 연결 시 새 항목을 추가할 수 있는 함수를 제공한다.
export function useNotifications(enabled = true) {
  const [state, setState] = useState({ items: [], unreadCount: 0, loading: true, error: '' })
  const pendingSse = useRef(new Map())
  const seenIds = useRef(new Set())
  const firstListRequest = useRef(null)
  // D-23 최초 목록 응답 시점을 SSE 연결 완료와 비교해 누락 보충 조회를 보장한다.
  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, error: '' }))
    try {
      const data = await fetchNotifications({ unreadOnly: true })
      const receivedAt = Date.now()
      const response = mergePendingNotifications(adaptNotifications(data), pendingSse.current, receivedAt)
      response.items.forEach((item) => seenIds.current.add(item.notificationId))
      response.items.forEach((item) => pendingSse.current.delete(item.notificationId))
      setState({ ...response, loading: false, error: '' })
    }
    catch { setState((current) => ({ ...current, loading: false, error: '알림을 불러오지 못했어요.' })) }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    const request = fetchNotifications({ unreadOnly: true })
    const initialRequest = { promise: request, settled: false }
    firstListRequest.current = initialRequest
    request.then(() => { initialRequest.settled = true }, () => { initialRequest.settled = true })
    request.then((data) => {
      if (active) {
        const receivedAt = Date.now()
        const response = mergePendingNotifications(adaptNotifications(data), pendingSse.current, receivedAt)
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
    pendingSse.current.set(notificationId, { notification, receivedAt: Date.now() })
    setState((current) => current.items.some((row) => row.notificationId === notificationId)
      ? current : { ...current, items: [notification, ...current.items], unreadCount: current.unreadCount + 1 })
    emitNotificationsChanged('bell')
  }, [])

  useEffect(() => {
    if (!enabled || USE_MOCK || !tokenStorage.get()) return undefined
    const controller = new AbortController()
    let stopped = false
    let retryDelay = 1000
    let firstConnection = true
    let waitingForVisible = false
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
          let connectedRefresh = null
          let replaced = false
          await readNotificationEvents(response, addNotification, controller.signal, (eventName) => {
            if (eventName === 'connected') {
              if (firstConnection) {
                firstConnection = false
                const initialRequest = firstListRequest.current
                connectedRefresh = (async () => {
                  if (initialRequest && !initialRequest.settled) await initialRequest.promise.catch(() => undefined)
                  await refresh()
                })()
              } else connectedRefresh = refresh()
            }
            if (eventName === 'replaced') replaced = true
            // expired 이벤트 뒤에는 서버가 스트림을 닫고 다음 요청에서 401을 돌려 로그아웃 흐름을 탄다.
          })
          if (connectedRefresh) await connectedRefresh
          if (replaced) {
            waitingForVisible = true
            const visible = await waitUntilVisible(controller.signal)
            waitingForVisible = false
            if (!visible) break
            retryDelay = 1000
            await refresh()
          }
        } catch {
          if (stopped || controller.signal.aborted) break
        }
        if (stopped || controller.signal.aborted) break
        await waitForReconnect(controller.signal, retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30000)
      }
    }

    connect()
    const refreshOnVisible = () => { if (document.visibilityState === 'visible' && !stopped && !waitingForVisible) refresh() }
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
