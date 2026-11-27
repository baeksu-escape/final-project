import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Button, Card } from '../../../common/components/index.js'
import { PATHS } from '../../../common/config/navigation.js'
import { adaptNotifications } from '../adapters/notificationAdapter.js'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notificationApi.js'
import '../styles/notification.css'

const PAGE_SIZE = 20
const TABS = [
  { code: 'ALL', label: '전체', empty: '새 알림이 없어요.' },
  { code: 'SCORE_NEW', label: '점수', empty: '새 점수 알림이 없어요.' },
  { code: 'COMMENT_NEW', label: '댓글', empty: '새 댓글 알림이 없어요.' },
  { code: 'REPORT_RESULT', label: '신고 결과', empty: '신고 결과 알림이 없어요.' },
  { code: 'WELCOME', label: '안내', empty: '안내 알림이 없어요.' },
]

const relativeTime = (value) => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000))
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}
const dateTime = (value) => {
  const date = new Date(value)
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// D-23 알림 기록은 종류별 목록과 before 커서를 이 페이지 안에서 관리한다.
export default function NotificationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const requestedType = searchParams.get('type')
  const type = TABS.some((tab) => tab.code === requestedType) ? requestedType : 'ALL'
  const [history, setHistory] = useState({ type: null, items: [], unreadCount: 0, hasMore: false, loading: true, error: '' })
  const [loadingMore, setLoadingMore] = useState(false)
  const [actionError, setActionError] = useState('')
  const sequence = useRef(0)

  useEffect(() => {
    const requestId = ++sequence.current
    fetchNotifications({ type: type === 'ALL' ? undefined : type, size: PAGE_SIZE }).then((data) => {
      if (sequence.current === requestId) setHistory({ type, ...adaptNotifications(data), loading: false, error: '' })
    }).catch(() => {
      if (sequence.current === requestId) setHistory({ type, items: [], unreadCount: 0, hasMore: false, loading: false, error: '알림을 불러오지 못했어요.' })
    })
    return () => { sequence.current += 1 }
  }, [type])

  const visible = history.type === type ? history : { items: [], unreadCount: 0, hasMore: false, loading: true, error: '' }
  const selectTab = (code) => {
    const next = new URLSearchParams(searchParams)
    if (code === 'ALL') next.delete('type')
    else next.set('type', code)
    setSearchParams(next)
    setActionError('')
  }
  const selectItem = async (item) => {
    try {
      if (!item.read) await markNotificationRead(item.notificationId)
      setHistory((current) => current.type === type
        ? { ...current, items: current.items.map((row) => row.notificationId === item.notificationId ? { ...row, read: true } : row), unreadCount: Math.max(0, current.unreadCount - Number(!item.read)) }
        : current)
      if (item.linkUrl) navigate(item.linkUrl)
    } catch { setActionError('읽음 처리에 실패했어요.') }
  }
  const readAll = async () => {
    try {
      await markAllNotificationsRead()
      setHistory((current) => ({ ...current, items: current.items.map((item) => ({ ...item, read: true })), unreadCount: 0 }))
      setActionError('')
    } catch { setActionError('읽음 처리에 실패했어요.') }
  }
  const loadMore = async () => {
    const before = visible.items.at(-1)?.notificationId
    if (before == null || !visible.hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const page = adaptNotifications(await fetchNotifications({ type: type === 'ALL' ? undefined : type, before, size: PAGE_SIZE }))
      setHistory((current) => current.type === type
        ? { ...current, items: [...current.items, ...page.items.filter((item) => !current.items.some((row) => row.notificationId === item.notificationId))], unreadCount: page.unreadCount, hasMore: page.hasMore }
        : current)
      setActionError('')
    } catch { setActionError('알림을 더 불러오지 못했어요.') }
    finally { setLoadingMore(false) }
  }
  const selectedTab = TABS.find((tab) => tab.code === type)

  return (
    <main className="nt-page">
      <div className="page-head">
        <div>
          <span className="page-head__tag">D-23</span>
          <h1 className="page-head__title">알림</h1>
          <p className="page-head__lead">새 점수와 댓글, 처리 안내를 모아 봅니다.</p>
        </div>
        <Button variant="weak" size="sm" disabled={visible.unreadCount === 0} onClick={readAll}>모두 읽음</Button>
      </div>
      <nav className="sub-tab-menu" aria-label="알림 종류">
        <ul className="sub-tab-menu__list">
          {TABS.map((tab) => <li key={tab.code} className="sub-tab-menu__item">
            <Link className="sub-tab-menu__link" aria-current={type === tab.code ? 'page' : undefined}
              to={tab.code === 'ALL' ? PATHS.NOTIFICATIONS : `${PATHS.NOTIFICATIONS}?type=${tab.code}`} onClick={(event) => { event.preventDefault(); selectTab(tab.code) }}>
              {tab.label}
            </Link>
          </li>)}
        </ul>
      </nav>
      <Card title="알림 기록">
        {visible.loading ? <p className="hint" role="status">알림을 불러오는 중이에요.</p>
          : visible.error ? <p className="hint" role="status">{visible.error}</p>
            : visible.items.length === 0 ? <p className="hint">{selectedTab.empty}</p>
              : <ul className="nt-list">{visible.items.map((item) => <li key={item.notificationId}>
                <button type="button" className={item.read ? 'nt-item' : 'nt-item nt-item--unread'} onClick={() => selectItem(item)}>
                  <span className="nt-item__heading">
                    <strong className="nt-item__title">{item.title}</strong>
                    <span className={item.read ? 'nt-dot' : 'nt-dot nt-dot--unread'} aria-hidden="true" />
                    {!item.read && <span className="sr-only">안 읽음</span>}
                  </span>
                  <span className="nt-item__content">{item.content}</span>
                  <span className="nt-item__time"><time dateTime={item.createdAt}>{dateTime(item.createdAt)}</time> · {relativeTime(item.createdAt)}</span>
                </button>
              </li>)}</ul>}
        {actionError && <p className="hint" role="status">{actionError}</p>}
        {visible.hasMore && <div className="nt-more"><Button variant="weak" size="sm" disabled={loadingMore} onClick={loadMore}>{loadingMore ? '불러오는 중…' : '더 보기'}</Button></div>}
      </Card>
    </main>
  )
}
