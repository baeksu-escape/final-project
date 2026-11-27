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

// D-23 조회 중 SSE로 받은 항목 중 응답에 없는 것을 목록에 보탠다. 서버는 목록과 안 읽은 개수를 한 문장(같은 시점)으로 세므로,
// 그 시점에 있었다면 목록(최신순)에 들어갔어야 할 항목 — 목록이 전부(hasMore 아님)이거나 목록의 가장 작은 번호보다 큰 항목 — 은
// 아직 개수에 없던 알림이라 배지에 더한다.
function mergePendingNotifications(response, pendingItems) {
  const items = [...response.items]
  const minResponseId = response.items.reduce((min, item) => Math.min(min, item.notificationId), Infinity)
  let notCounted = 0
  let uncertain = 0
  pendingItems.forEach((item, id) => {
    if (items.some((row) => row.notificationId === id)) return
    items.push(item.notification)
    if (!response.hasMore || id > minResponseId) notCounted += 1
    else uncertain += 1
  })
  items.sort((a, b) => b.notificationId - a.notificationId)
  // uncertain: 안 읽은 게 많아 목록이 잘렸고 번호가 목록보다 작은 항목. 번호와 커밋 순서가 다르면 개수에 없을 수 있어 호출한 쪽이 한 번 다시 조회한다.
  return { response: { ...response, items, unreadCount: response.unreadCount + notCounted }, uncertain }
}

// D-23 커밋 순서가 뒤바뀌었을 수 있는 알림이 있을 때 다시 조회하기까지 기다리는 시간(ms).
const UNCERTAIN_RECHECK_MS = 1000
// D-23 이 시간(ms) 이상 유지된 연결만 정상 연결로 보고 재연결 대기를 초기화한다.
const STABLE_CONNECTION_MS = 10000

// D-23 알림 목록·읽음 상태를 관리하고 SSE 연결 시 새 항목을 추가할 수 있는 함수를 제공한다.
export function useNotifications(enabled = true) {
  const [state, setState] = useState({ items: [], unreadCount: 0, loading: true, error: '' })
  const pendingSse = useRef(new Map())
  const seenIds = useRef(new Set())
  const firstListRequest = useRef(null)
  // D-23 진행 중인 목록 조회 수. 조회 중에 온 SSE만 pendingSse에 잠시 보관하고, 조회가 모두 끝나면 비운다.
  const inFlight = useRef(0)
  // D-23 조회마다 번호를 매겨, 늦게 도착한 오래된 응답이 더 최신 응답을 덮지 않게 한다.
  const requestSeq = useRef(0)
  const appliedSeq = useRef(0)
  // D-23 화면 생명주기 번호. 조회는 시작할 때의 번호와 지금 번호가 같을 때만 결과를 반영한다(언마운트·StrictMode 재실행 뒤 늦게 끝난 조회는 버림).
  const generation = useRef(0)
  // D-23 읽음 처리 뒤 다시 조회할 때 최신 load 함수를 부르기 위한 참조.
  const loadRef = useRef(null)

  // D-23 안 읽은 목록을 불러와 조회 중 받은 SSE를 합친다. 오류는 밖으로 던지지 않는다.
  const load = useCallback(async () => {
    const seq = ++requestSeq.current
    const gen = generation.current
    inFlight.current += 1
    let merged
    try {
      merged = mergePendingNotifications(adaptNotifications(await fetchNotifications({ unreadOnly: true })), pendingSse.current)
    } catch {
      merged = null
    }
    inFlight.current -= 1
    if (inFlight.current === 0) pendingSse.current.clear()
    if (gen !== generation.current || seq <= appliedSeq.current) return
    appliedSeq.current = seq
    if (!merged) {
      setState((current) => ({ ...current, loading: false, error: '알림을 불러오지 못했어요.' }))
      return
    }
    const { response, uncertain } = merged
    response.items.forEach((item) => seenIds.current.add(item.notificationId))
    setState({ ...response, loading: false, error: '' })
    // 드문 경우(목록이 잘렸고 커밋 순서가 뒤바뀐 알림)만 1초 뒤 한 번 다시 조회해 서버 개수로 맞춘다. 다시 조회할 땐 보관 SSE가 비어 반복되지 않는다.
    if (uncertain > 0) window.setTimeout(() => loadRef.current?.(), UNCERTAIN_RECHECK_MS)
  }, [])
  // D-23 밖에서 부르는 목록 다시 불러오기(인자 없이 처음부터 조회한다).
  const refresh = useCallback(() => load(), [load])

  useEffect(() => { loadRef.current = load }, [load])

  useEffect(() => {
    if (!enabled) return undefined
    generation.current += 1
    const initialRequest = { promise: null, settled: false }
    initialRequest.promise = load().finally(() => { initialRequest.settled = true })
    firstListRequest.current = initialRequest
    return () => { generation.current += 1 }
  }, [enabled, load])

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
    if (inFlight.current > 0) pendingSse.current.set(notificationId, { notification })
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
        let connectedAt = null
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
          // D-23 연결이 일정 시간 이상 유지됐을 때만 재연결 대기를 1초로 되돌린다(연결 직후 끊기면 대기를 늘려 반복 접속 방지).
          connectedAt = Date.now()
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
        if (connectedAt && Date.now() - connectedAt >= STABLE_CONNECTION_MS) retryDelay = 1000
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
    // 읽음 전에 시작한 조회 응답이 늦게 와서 읽은 알림을 되살리지 않도록 그 조회들을 무효로 하고,
    // 무효로 한 조회가 있었으면(첫 연결 보충 조회일 수 있음) 읽음 반영 뒤 한 번 다시 조회한다.
    const hadInFlight = inFlight.current > 0
    appliedSeq.current = requestSeq.current
    if (hadInFlight) loadRef.current?.()
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
    const hadInFlight = inFlight.current > 0
    appliedSeq.current = requestSeq.current
    if (hadInFlight) loadRef.current?.()
    pendingSse.current.clear()
    setState((current) => ({ ...current, items: [], unreadCount: 0 }))
    emitNotificationsChanged('bell', { readAll: true })
  }, [])

  return { ...state, refresh, addNotification, markRead, markAllRead }
}
