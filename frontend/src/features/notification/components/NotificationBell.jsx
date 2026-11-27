import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNotifications } from './useNotifications.js'
import { PATHS } from '../../../common/config/navigation.js'
import '../styles/notification.css'

// D-23 헤더 알림 버튼의 종 모양 — 글자색(currentColor)을 따라가는 선 아이콘.
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
)

const relativeTime = (value) => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

// D-23 헤더 알림 패널은 안 읽은 알림을 최근 5건까지만 보여 주고(나머지는 전체 보기), 읽음 처리 후 내부 화면으로 이동하며 바깥 클릭·Esc로 닫는다.
const PANEL_LIMIT = 5

export default function NotificationBell({ enabled = true }) {
  const [open, setOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const rootRef = useRef(null)
  const navigate = useNavigate()
  const notifications = useNotifications(enabled)

  useEffect(() => {
    const closeOutside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false) }
    const closeEscape = (event) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [])

  const selectItem = async (item) => {
    try {
      if (!item.read) await notifications.markRead(item.notificationId)
      setOpen(false)
      if (item.linkUrl) navigate(item.linkUrl)
    } catch { setActionError('읽음 처리에 실패했어요.') }
  }
  const readAll = async () => {
    try { await notifications.markAllRead(); setActionError('') }
    catch { setActionError('읽음 처리에 실패했어요.') }
  }

  return (
    <div className="nt-root" ref={rootRef}>
      <button type="button" className="app-header__text-btn" aria-expanded={open} aria-controls="notification-panel" aria-label={notifications.unreadCount > 0 ? `알림, 안 읽은 알림 ${notifications.unreadCount}개` : '알림'} onClick={() => { setOpen((value) => !value); setActionError('') }}>
        <span className="nt-bell"><BellIcon />{notifications.unreadCount > 0 && <span className="nt-badge">{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}</span>}</span>
      </button>
      {open && <section className="nt-panel" id="notification-panel" aria-label="안 읽은 알림 목록">
        <header className="nt-panel__head"><strong>알림</strong><span className="nt-panel__actions"><button type="button" className="nt-read-all" disabled={notifications.unreadCount === 0} onClick={readAll}>모두 읽음</button><Link className="text-link nt-all-link" to={PATHS.NOTIFICATIONS} onClick={() => setOpen(false)}>전체 보기</Link></span></header>
        {notifications.loading ? <p className="hint">알림을 불러오는 중이에요.</p>
          : notifications.error ? <p className="hint" role="status">{notifications.error}</p>
            : notifications.items.length === 0 ? <p className="hint">새 알림이 없어요.</p>
              : <ul className="nt-list">{notifications.items.slice(0, PANEL_LIMIT).map((item) => <li key={item.notificationId}>
                <button type="button" className={item.read ? 'nt-item' : 'nt-item nt-item--unread'} onClick={() => selectItem(item)}>
                  <span className="nt-item__heading">
                    <strong className="nt-item__title">{item.title}</strong>
                  </span>
                  <span className="nt-item__content">{item.content}</span>
                  <time className="nt-item__time" dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
                </button>
              </li>)}</ul>}
        {actionError && <p className="hint" role="status">{actionError}</p>}
      </section>}
    </div>
  )
}
