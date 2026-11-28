import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Button, Card } from '../../../common/components/index.js'
import { PATHS } from '../../../common/config/navigation.js'
import { adaptNotifications } from '../adapters/notificationAdapter.js'
import { fetchNotifications, markNotificationRead } from '../api/notificationApi.js'
import '../styles/notification.css'
import { emitNotificationsChanged, NOTIFICATIONS_CHANGED_EVENT } from '../components/useNotifications.js'
import { relativeTime } from '../adapters/notificationTime.js'

import { useReadAllSnapshot, applyReadAll, paginationVersion } from '../components/readAllSnapshot.js'

const PAGE_SIZE = 20
const TABS = [
  { code: 'ALL', label: '전체', empty: '새 알림이 없어요.' },
  { code: 'SCORE_NEW', label: '점수', empty: '새 점수 알림이 없어요.' },
  { code: 'COMMENT_NEW', label: '댓글', empty: '새 댓글 알림이 없어요.' },
  { code: 'REPORT_RESULT', label: '신고 결과', empty: '신고 결과 알림이 없어요.' },
  { code: 'WELCOME', label: '안내', empty: '안내 알림이 없어요.' },
]

// D-23 알림 기록의 날짜를 화면에서 읽기 쉬운 연-월-일 시:분으로 표시한다.
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
  const [markAll, readingAll] = useReadAllSnapshot(history.items)
  const view = useRef(null)
  const actions = useRef(new Set())

  useEffect(() => {
    let retryTimer
    const scope = { sequence: 0, oldest: null, busy: false }
    view.current = scope
    const query = { type: type === 'ALL' ? undefined : type, size: PAGE_SIZE }

    // D-23 기존 마지막 행까지 서버 커서를 따라가 갱신한다. 새 첫 페이지와 겹치지 않아도 중간 기록을 건너뛰지 않는다.
    const refresh = async (retry = true) => {
      window.clearTimeout(retryTimer)
      const request = ++scope.sequence
      scope.busy = true
      try {
        let page = adaptNotifications(await fetchNotifications(query))
        const unreadCount = page.unreadCount
        const items = [...page.items]
        while (request === scope.sequence && scope.oldest != null && page.hasMore && page.items.at(-1)?.notificationId > scope.oldest) {
          page = adaptNotifications(await fetchNotifications({ ...query, before: page.items.at(-1).notificationId }))
          items.push(...page.items)
        }
        if (request !== scope.sequence) return
        const retained = scope.oldest == null ? items : items.filter((item) => item.notificationId >= scope.oldest)
        scope.oldest = retained.at(-1)?.notificationId
        setHistory({ type, items: retained, unreadCount, hasMore: page.hasMore || retained.length < items.length, loading: false, error: '' })
      } catch {
        if (request !== scope.sequence) return
        if (retry) retryTimer = window.setTimeout(() => refresh(false), 1000)
        setHistory((current) => current.type === type
          ? { ...current, loading: false, error: '알림을 불러오지 못했어요.' }
          : { type, items: [], unreadCount: 0, hasMore: false, loading: false, error: '알림을 불러오지 못했어요.' })
      } finally {
        if (request === scope.sequence) {
          scope.busy = false
          setLoadingMore(false)
        }
      }
    }
    const onChange = (event) => {
      if (view.current !== scope) return
      const id = event?.detail?.notificationId
      if (event.detail?.readAll) {
        setHistory((current) => applyReadAll(current, event.detail, false))
      } else if (id != null) setHistory((current) => {
        if (!current.items.some((item) => item.notificationId === id && !item.read)) return current
        return { ...current, items: current.items.map((item) => item.notificationId === id ? { ...item, read: true } : item), unreadCount: Math.max(0, current.unreadCount - 1) }
      })
      setLoadingMore(true)
      refresh()
    }
    scope.refresh = refresh
    refresh()
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange)
    return () => {
      scope.sequence += 1
      window.clearTimeout(retryTimer)
      view.current = null
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChange)
    }
  }, [type])

  const visible = history.type === type ? history : { items: [], unreadCount: 0, hasMore: false, loading: true, error: '' }
  const selectTab = (code) => {
    if (code !== type && view.current) {
      view.current.sequence += 1
      view.current = null
    }
    const next = new URLSearchParams(searchParams)
    if (code === 'ALL') next.delete('type')
    else next.set('type', code)
    setSearchParams(next)
    setActionError('')
  }
  // D-23 같은 동작은 한 번만 보내고, 탭을 떠난 뒤 완료되면 현재 목록에 변경만 알린다.
  const read = async (item) => {
    const scope = view.current
    const id = item?.notificationId
    if (!scope || actions.current.has(id)) return
    actions.current.add(id)
    try {
      if (!item || !item.read) {
        if (item) {
          await markNotificationRead(id)
          emitNotificationsChanged('page', { notificationId: id })
        } else {
          emitNotificationsChanged('page', await markAll())
        }
      }
      if (scope !== view.current) return
      setActionError('')
      if (item?.linkUrl) navigate(item.linkUrl)
    } catch {
      if (scope === view.current) setActionError('읽음 처리에 실패했어요.')
    } finally { actions.current.delete(id) }
  }
  const selectItem = (item) => read(item)
  const readAll = () => read()

  // D-23 더보기 도중 갱신이나 탭 전환이 시작되면 이전 응답과 오류를 버린다.
  const loadMore = async () => {
    const scope = view.current
    const version = paginationVersion()
    const before = visible.items.at(-1)?.notificationId
    if (version == null || !scope || scope.busy || before == null || !visible.hasMore) return
    const request = scope.sequence
    scope.busy = true
    setLoadingMore(true)
    try {
      const page = adaptNotifications(await fetchNotifications({ type: type === 'ALL' ? undefined : type, before, size: PAGE_SIZE }))
      if (request !== scope.sequence || version !== paginationVersion()) return
      scope.oldest = page.items.at(-1)?.notificationId ?? before
      setHistory((current) => ({ ...current, items: [...current.items, ...page.items], unreadCount: page.unreadCount, hasMore: page.hasMore }))
      setActionError('')
    } catch {
      if (request === scope.sequence && version === paginationVersion()) setActionError('알림을 더 불러오지 못했어요.')
    } finally {
      if (request === scope.sequence) {
        scope.busy = false
        setLoadingMore(false)
      }
    }
  }
  const selectedTab = TABS.find((tab) => tab.code === type)

  return (
    <div className="nt-page">
      <div className="page-head">
        <div>
          <span className="page-head__tag">내 알림</span>
          <h1 className="page-head__title">알림</h1>
          <p className="page-head__lead">새 점수와 댓글, 처리 안내를 모아 봅니다.</p>
        </div>
        <Button variant="weak" size="sm" disabled={readingAll || visible.countPending || visible.unreadCount === 0} onClick={readAll}>모두 읽음</Button>
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
        {visible.loading ? <p className="hint" role="status">알림을 불러오는 중이에요.</p> : <>
          {visible.lastSnapshot && <p className="hint" role="status">마지막 조회 목록입니다. 현재 읽음 상태는 갱신 후 확인할 수 있어요.</p>}
          {visible.error && <p className="hint" role="status">{visible.error} <Button variant="weak" size="sm" onClick={() => view.current?.refresh()}>다시 조회</Button></p>}
          {visible.items.length === 0 ? (visible.error ? null : <p className="hint">{selectedTab.empty}</p>)
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
        </>}
        {actionError && <p className="hint" role="status">{actionError}</p>}
        {visible.hasMore && <div className="nt-more"><Button variant="weak" size="sm" disabled={readingAll || loadingMore} onClick={loadMore}>{loadingMore ? '불러오는 중…' : '더 보기'}</Button></div>}
      </Card>
    </div>
  )
}
