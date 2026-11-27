import { useCallback, useEffect, useRef, useState } from 'react'
import { CHAT_READ_EVENT } from './chatConstants.js'

// 두 메시지 묶음을 번호로 합친다(같은 번호는 하나만, 오래된 것부터).
function mergeMessages(current, incoming) {
  const byId = new Map([...current, ...incoming].map((item) => [item.messageId, item]))
  return [...byId.values()].sort((a, b) => a.messageId - b.messageId)
}

const EMPTY = Object.freeze({ messages: [], hasOlder: false, loading: true, error: '' })

// N-07-2 대화 하나의 상태 — 처음 불러오기, 새 메시지 이어 받기(tick이 바뀔 때), 이전 메시지, 보내기, 읽음 처리.
// api는 chatApi의 대화 묶음이며 바뀌지 않는 값이어야 한다. 다른 대화로 바꿀 때는 컴포넌트를 key로 새로 만든다.
export function useConversation(api, tick) {
  const [state, setState] = useState(EMPTY)
  // 지금까지 받은 가장 큰 번호. 아직 받은 메시지가 없으면 null
  const latestId = useRef(null)
  // 서버에 읽었다고 알린 가장 큰 번호
  const readId = useRef(0)

  const sync = useCallback(async () => {
    try {
      let more = true
      while (more) {
        const first = latestId.current == null
        const page = await api.fetch(first ? {} : { afterId: latestId.current })
        const last = page.messages.at(-1)?.messageId
        if (last != null) latestId.current = Math.max(latestId.current ?? 0, last)
        setState((prev) => ({
          messages: mergeMessages(prev.messages, page.messages),
          hasOlder: first ? page.hasMore : prev.hasOlder,
          loading: false,
          error: '',
        }))
        // 처음 조회의 hasMore는 '이전 메시지가 있음'이라 이어 받지 않는다.
        more = !first && page.hasMore && last != null
      }
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, error: err.message }))
    }
  }, [api])

  useEffect(() => {
    sync()
  }, [sync, tick])

  const loadOlder = async () => {
    const oldest = state.messages[0]?.messageId
    if (oldest == null) return
    try {
      const page = await api.fetch({ beforeId: oldest })
      setState((prev) => ({ ...prev, messages: mergeMessages(prev.messages, page.messages), hasOlder: page.hasMore, error: '' }))
    } catch (err) {
      setState((prev) => ({ ...prev, error: err.message }))
    }
  }

  // 보낸 글을 바로 붙이지 않고 이어 받는다. 그 사이 상대가 보낸 더 작은 번호를 건너뛰지 않게 한다. 실패하면 오류를 던진다.
  const send = async (content) => {
    await api.send(content)
    await sync()
  }

  // N-07-5 화면이 보일 때 마지막 메시지까지 읽음 처리하고 안 읽은 개수를 다시 불러오게 한다.
  useEffect(() => {
    const report = () => {
      const last = state.messages.at(-1)?.messageId
      if (last == null || last <= readId.current || document.visibilityState !== 'visible') return
      readId.current = last
      api.read(last)
        .then(() => window.dispatchEvent(new Event(CHAT_READ_EVENT)))
        .catch(() => {
          readId.current = 0
        })
    }
    report()
    document.addEventListener('visibilitychange', report)
    return () => document.removeEventListener('visibilitychange', report)
  }, [api, state.messages])

  return { ...state, loadOlder, send }
}
