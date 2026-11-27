import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { fetchUnreadCount } from '../api/chatApi.js'
import { CHAT_PATHS, CHAT_READ_EVENT, UNREAD_POLL_MS } from '../chatConstants.js'
import '../chat.css'

// N-07-5 위쪽 바의 [1:1 문의] — 안 읽은 메시지 수를 함께 보여 준다. 회원은 문의 화면, 관리자는 문의 목록으로 간다.
// 화면을 옮길 때, 30초마다(화면이 보일 때만), 읽음 처리 직후에 다시 확인한다. 확인에 실패하면 이전 값을 둔다.
export default function InquiryHeaderLink({ admin }) {
  const { pathname } = useLocation()
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      fetchUnreadCount(admin)
        .then((data) => alive && setCount(data?.unreadCount ?? 0))
        .catch(() => {})
    }
    refresh()
    const timer = window.setInterval(refresh, UNREAD_POLL_MS)
    window.addEventListener(CHAT_READ_EVENT, refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      alive = false
      window.clearInterval(timer)
      window.removeEventListener(CHAT_READ_EVENT, refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [admin, pathname])

  return (
    <NavLink to={admin ? CHAT_PATHS.ADMIN_INQUIRY : CHAT_PATHS.INQUIRY} className="app-header__text-btn">
      1:1 문의
      {count > 0 && <span className="chat-badge num" aria-label={`안 읽은 메시지 ${count}개`}>{count > 99 ? '99+' : count}</span>}
    </NavLink>
  )
}
