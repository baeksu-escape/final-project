import { useCallback, useEffect, useRef, useState } from 'react'
import { API_BASE_URL, USE_MOCK } from '../../../common/config/env.js'
import { tokenStorage } from '../../../common/auth/tokenStorage.js'
import { UNAUTHORIZED_EVENT } from '../../../common/api/client.js'
import { adaptNotifications } from '../adapters/notificationAdapter.js'
import { readNotificationEvents } from '../adapters/sseReader.js'
import { fetchNotifications, markNotificationRead } from '../api/notificationApi.js'

import { useReadAllSnapshot, applyReadAll } from './readAllSnapshot.js'

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

// D-23 목록 조회에 실패하면 잠시 뒤 한 번 더 확인한다.
const RETRY_MS = 1000
// D-23 이 시간(ms) 이상 유지된 연결만 정상 연결로 보고 재연결 대기를 초기화한다.
const STABLE_CONNECTION_MS = 10000

// D-23 알림 목록·읽음 상태를 관리하고 SSE 연결 시 새 항목을 추가할 수 있는 함수를 제공한다.
export function useNotifications(enabled = true) {
  const [state, setState] = useState({ items: [], unreadCount: 0, loading: true, error: '' })
  const [markAll, readingAll] = useReadAllSnapshot(state.items)
  const sequence = useRef(0)
  const firstListRequest = useRef(null)
  const recheckTimer = useRef(null)
  const actions = useRef(new Set())
  // D-23 화면 생명주기 번호. 조회는 시작할 때의 번호와 지금 번호가 같을 때만 결과를 반영한다(언마운트·StrictMode 재실행 뒤 늦게 끝난 조회는 버림).
  const generation = useRef(0)

  // D-23 가장 최근 신호 이후의 서버 응답만 반영하고, 실패하면 기존 읽음 상태를 유지한다.
  const load = useCallback(async function loadUnread(retry = true) {
    const request = ++sequence.current
    window.clearTimeout(recheckTimer.current)
    const data = await fetchNotifications({ unreadOnly: true }).then(adaptNotifications).catch(() => null)
    if (sequence.current !== request) return
    if (data) {
      setState({ ...data, loading: false, error: '' })
    } else {
      setState((current) => ({ ...current, loading: false, error: '알림을 불러오지 못했어요.' }))
      if (retry) recheckTimer.current = window.setTimeout(() => loadUnread(false), RETRY_MS)
    }
  }, [])
  // D-23 밖에서 부르는 목록 다시 불러오기(인자 없이 처음부터 조회한다).
  const refresh = useCallback(() => load(), [load])

  useEffect(() => {
    if (!enabled) return undefined
    generation.current += 1
    const initialRequest = { promise: null, settled: false }
    initialRequest.promise = load().finally(() => { initialRequest.settled = true })
    firstListRequest.current = initialRequest
    return () => {
      generation.current += 1
      sequence.current += 1
      window.clearTimeout(recheckTimer.current)
    }
  }, [enabled, load])

  useEffect(() => {
    if (!enabled) return undefined
    const refreshFromPage = (event) => {
      if (event.detail?.readAll) {
        setState((current) => applyReadAll(current, event.detail, true))
      } else if (event.detail?.source !== 'page') return
      refresh()
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshFromPage)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshFromPage)
  }, [enabled, refresh])

  const addNotification = useCallback((item) => {
    const notificationId = item.notificationId ?? Number(item.id)
    if (!Number.isSafeInteger(notificationId)) return
    // SSE에는 현재 읽음 여부가 없으므로 목록과 배지를 서버에서 확인한다.
    refresh()
    emitNotificationsChanged('bell')
  }, [refresh])

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
                  if (!stopped) await refresh()
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

  // D-23 중복 요청을 막고 성공한 쓰기는 기록 페이지에도 알린다. 전체 읽음은 DB 반영 뒤 생긴 알림까지 서버에서 다시 확인한다.
  const read = useCallback(async (id) => {
    const gen = generation.current
    if (actions.current.has(id)) return false
    actions.current.add(id)
    try {
      if (id == null) {
        emitNotificationsChanged('bell', await markAll())
        return gen === generation.current
      }
      await markNotificationRead(id)
      emitNotificationsChanged('bell', { notificationId: id })
      if (gen !== generation.current) return false
      setState((current) => {
        const items = current.items.filter((item) => item.notificationId !== id)
        return { ...current, items, unreadCount: Math.max(0, current.unreadCount - (current.items.length - items.length)) }
      })
      await load()
      return gen === generation.current
    } catch (error) {
      if (gen !== generation.current) return false
      throw error
    } finally { actions.current.delete(id) }
  }, [load, markAll])
  const markRead = read
  const markAllRead = useCallback(() => read(), [read])

  return { ...state, readingAll, refresh, addNotification, markRead, markAllRead }
}
