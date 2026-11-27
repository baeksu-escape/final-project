import { useEffect, useState } from 'react'
import { API_BASE_URL, USE_MOCK } from '../../common/config/env.js'
import { tokenStorage } from '../../common/auth/tokenStorage.js'
import { AUTH_FAILED_CODE, FALLBACK_POLL_MS, RECONNECT_DELAYS } from './chatConstants.js'

// API 주소(비어 있으면 지금 화면 주소)의 http를 ws로 바꾼 웹소켓 주소
function socketUrl() {
  return `${(API_BASE_URL || window.location.origin).replace(/^http/, 'ws')}/ws/chat`
}

// N-07-6 새 메시지 신호 — 값(tick)이 바뀌면 대화·목록을 다시 불러오면 된다.
// 웹소켓으로 신호를 받고, 연결될 때마다 한 번 올려 끊긴 사이의 메시지를 채운다. 끊기면 다시 연결하며,
// 연결되지 않은 동안(mock 모드 포함)에는 5초마다 올린다. 메시지 본문은 소켓으로 받지 않는다.
export function useChatSignal() {
  const [tick, setTick] = useState(0)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (USE_MOCK) return undefined
    let socket = null
    let timer = null
    let attempt = 0
    let closed = false

    const connect = () => {
      socket = new WebSocket(socketUrl())
      socket.onopen = () => socket.send(JSON.stringify({ type: 'AUTH', token: tokenStorage.get() }))
      socket.onmessage = (event) => {
        let type
        try {
          type = JSON.parse(event.data).type
        } catch {
          return
        }
        if (type === 'AUTH_OK') {
          attempt = 0
          setConnected(true)
        }
        if (type === 'AUTH_OK' || type === 'MESSAGE') setTick((value) => value + 1)
      }
      socket.onclose = (event) => {
        if (closed) return
        setConnected(false)
        // 인증 실패는 다시 해도 같다. 폴링 요청이 401을 받으면 공통 처리로 로그아웃된다.
        if (event.code === AUTH_FAILED_CODE) return
        timer = window.setTimeout(connect, RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)])
        attempt += 1
      }
    }

    connect()
    return () => {
      closed = true
      window.clearTimeout(timer)
      socket.close()
    }
  }, [])

  useEffect(() => {
    if (connected) return undefined
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick((value) => value + 1)
    }, FALLBACK_POLL_MS)
    return () => window.clearInterval(timer)
  }, [connected])

  return tick
}
