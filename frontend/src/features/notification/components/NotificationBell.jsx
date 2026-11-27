import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNotifications } from './useNotifications.js'
import { PATHS } from '../../../common/config/navigation.js'
import '../styles/notification.css'

const relativeTime = (value) => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  return `${days}일 전`
}

// D-23 헤더 알림 패널은 읽음 처리 후 내부 화면으로 이동하고 바깥 클릭·Esc로 닫는다.
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
      <button type="button" className="app-header__text-btn" aria-expanded={open} aria-controls="notification-panel" onClick={() => { setOpen((value) => !value); setActionError('') }}>
        알림{notifications.unreadCount > 0 && <span className="nt-badge">{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}</span>}
      </button>
      {open && <section className="nt-panel" id="notification-panel" aria-label="안 읽은 알림 목록">
        <header className="nt-panel__head"><strong>알림</strong><button type="button" className="nt-read-all" disabled={notifications.unreadCount === 0} onClick={readAll}>모두 읽음</button></header>
        {notifications.loading ? <p className="hint">알림을 불러오는 중이에요.</p>
          : notifications.error ? <p className="hint" role="status">{notifications.error}</p>
            : notifications.items.length === 0 ? <p className="hint">새 알림이 없어요.</p>
              : <ul className="nt-list">{notifications.items.map((item) => <li key={item.notificationId}>
                <button type="button" className={item.read ? 'nt-item' : 'nt-item nt-item--unread'} onClick={() => selectItem(item)}>
                  <span className="nt-item__heading">
                    <strong className="nt-item__title">{item.title}</strong>
                    <span className={item.read ? 'nt-dot' : 'nt-dot nt-dot--unread'} aria-hidden="true" />
                    {!item.read && <span className="sr-only">안 읽음</span>}
                  </span>
                  <span className="nt-item__content">{item.content}</span>
                  <time className="nt-item__time" dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
                </button>
              </li>)}</ul>}
        {actionError && <p className="hint" role="status">{actionError}</p>}
        <Link className="text-link nt-all-link" to={PATHS.NOTIFICATIONS} onClick={() => setOpen(false)}>전체 보기</Link>
      </section>}
    </div>
  )
}
