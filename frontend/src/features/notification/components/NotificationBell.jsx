import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useNotifications } from './useNotifications.js'
import { PATHS } from '../../../common/config/navigation.js'
import { relativeTime } from '../adapters/notificationTime.js'
import '../styles/notification.css'

// D-23 헤더 알림 버튼의 종 모양 — 글자색(currentColor)을 따라가는 선 아이콘.
const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
)

// D-23 드롭다운 알림의 읽음 처리(X) 아이콘.
const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

// D-23 헤더 알림 패널은 안 읽은 알림을 최근 5건까지만 보여 주고(나머지는 전체 보기), 읽음 처리 후 내부 화면으로 이동하며 바깥 클릭·Esc로 닫는다.
const PANEL_LIMIT = 5

export default function NotificationBell({ enabled = true }) {
  const [open, setOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const navigate = useNavigate()
  const notifications = useNotifications(enabled)

  const showBadge = !notifications.countPending && notifications.unreadCount > 0
  const badgeLabel = notifications.lastSnapshot ? '마지막 조회 기준 안 읽은 알림' : '안 읽은 알림'

  useEffect(() => {
    if (!open) return undefined
    // D-23 패널 바깥 클릭은 닫고 종 버튼으로 포커스를 돌린다.
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        window.requestAnimationFrame(() => triggerRef.current?.focus())
      }
    }
    // D-23 Esc는 알림 패널을 닫고 다시 연 종 버튼에 포커스를 둔다.
    const closeEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeEscape)
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape) }
  }, [open])

  useEffect(() => { if (open) panelRef.current?.focus() }, [open])

  const selectItem = async (item) => {
    try {
      if (!item.read && !(await notifications.markRead(item.notificationId))) return
      setOpen(false)
      if (item.linkUrl) navigate(item.linkUrl)
    } catch { setActionError('읽음 처리에 실패했어요.') }
  }
  // D-23 X 버튼 — 이동하지 않고 읽음 처리만 해서 드롭다운에서 뺀다(알림 페이지에는 읽음으로 남음).
  const dismissItem = async (item) => {
    try { if (await notifications.markRead(item.notificationId)) setActionError('') }
    catch { setActionError('읽음 처리에 실패했어요.') }
  }
  const readAll = async () => {
    try { if (await notifications.markAllRead()) setActionError('') }
    catch { setActionError('읽음 처리에 실패했어요.') }
  }

  return (
    <div className="nt-root" ref={rootRef}>
      <button ref={triggerRef} type="button" className="app-header__text-btn" aria-expanded={open} aria-controls={open ? 'notification-panel' : undefined} aria-label={showBadge ? `알림, ${badgeLabel} ${notifications.unreadCount}개` : '알림'} onClick={() => { setOpen((value) => !value); setActionError('') }}>
        <span className="nt-bell"><BellIcon />{showBadge && <span className="nt-badge">{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}</span>}</span>
      </button>
      {open && <section ref={panelRef} className="nt-panel" id="notification-panel" role="region" aria-labelledby="notification-panel-title" tabIndex={-1}>
        <header className="nt-panel__head"><strong id="notification-panel-title">안 읽은 알림</strong><span className="nt-panel__actions"><button type="button" className="nt-read-all" disabled={notifications.readingAll || notifications.countPending || notifications.unreadCount === 0} onClick={readAll}>모두 읽음</button><Link className="text-link nt-all-link" to={PATHS.NOTIFICATIONS} onClick={() => setOpen(false)}>전체 보기</Link></span></header>
        {notifications.lastSnapshot && <p className="hint" role="status">마지막 조회 목록입니다. 현재 읽음 상태는 갱신 후 확인할 수 있어요.</p>}
        {notifications.error && <p className="hint" role="status">{notifications.error} <button type="button" className="nt-read-all" onClick={notifications.refresh}>다시 조회</button></p>}
        {notifications.loading ? <p className="hint">알림을 불러오는 중이에요.</p>
          : notifications.items.length === 0 ? (notifications.error ? null : <p className="hint">새 알림이 없어요.</p>)
              : <ul className="nt-list">{notifications.items.slice(0, PANEL_LIMIT).map((item) => <li key={item.notificationId} className="nt-li">
                <button type="button" className={item.read ? 'nt-item' : 'nt-item nt-item--unread'} onClick={() => selectItem(item)}>
                  <span className="nt-item__heading">
                    <strong className="nt-item__title">{item.title}</strong>
                  </span>
                  <span className="nt-item__content">{item.content}</span>
                  <time className="nt-item__time" dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
                </button>
                <button type="button" className="nt-dismiss" aria-label={`${item.title} 읽음 처리`} title="읽음 처리" onClick={() => dismissItem(item)}><CloseIcon /></button>
              </li>)}</ul>}
        {actionError && <p className="hint" role="status">{actionError}</p>}
      </section>}
    </div>
  )
}
