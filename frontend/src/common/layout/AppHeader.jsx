import { Link, NavLink, useLocation } from 'react-router-dom'
import { canSeeMainMenu } from '../auth/accessRules.js'
import { useAuth } from '../auth/useAuth.js'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { ADMIN_TABS, NAV_GROUPS, PATHS, findNavGroup } from '../config/navigation.js'
import { ROLE_LABELS, isAdmin } from '../config/roles.js'
import MegaNav from './MegaNav.jsx'
import { ADMIN_PATHS } from '../../features/admin/adminConstants.js'
import NotificationBell from '../../features/notification/components/NotificationBell.jsx'

// N-08-1 로그인 후 공통 위쪽 바 — 로고(메인 페이지로), 큰 분류 메뉴(마우스를 올리면 세부 메뉴 판), 계정 버튼, 분류 안 세부 기능 줄.
// 사용자 메뉴는 점수가 나온 뒤에만 보이고(canSeeMainMenu), 관리자 메뉴 5개는 늘 보인다.
export default function AppHeader() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const admin = isAdmin(user)
  const showMenu = canSeeMainMenu(user)
  // 관리자는 분류 없이 메뉴 5개를 그대로 쓴다
  const groups = admin ? ADMIN_TABS.map((tab) => ({ ...tab, items: [] })) : NAV_GROUPS
  const currentGroup = admin ? null : findNavGroup(pathname)
  const subItems = currentGroup?.items.length > 1 ? currentGroup.items : []

  // 로그인 상태를 지운 뒤 메인(홍보) 첫 화면으로 보낸다(N-10). 라우터 이동 대신 페이지를 '/'로 새로 연다(11/17 확인).
  const handleLogout = async () => {
    await logout()
    window.location.replace(PATHS.HOME)
  }

  const isActive = (group) => (admin ? pathname.startsWith(group.path) : currentGroup?.key === group.key)

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          {/* 로고는 로그인한 뒤에도 메인(홍보) 페이지로 간다 */}
          <Link to={PATHS.HOME} className="app-header__brand">
            <span className="app-header__logo" aria-hidden="true">A</span>
            <span className="app-header__name">Avenue{admin && <small> 관리자</small>}</span>
          </Link>
          {showMenu && <MegaNav groups={groups} label={admin ? '관리자 메뉴' : '주 메뉴'} isActive={isActive} />}
          <div className="app-header__user">
            {admin && <span className="app-header__badge">{ROLE_LABELS[user.role]}</span>}
            {admin && <NavLink to={ADMIN_PATHS.PASSWORD} className="app-header__text-btn">비밀번호 변경</NavLink>}
            {!admin && (
              <>
                {/* D-23 헤더 알림은 읽지 않은 개수와 최근 알림 목록을 보여 준다. */}
                <NotificationBell enabled={Boolean(user)} />
                <NavLink to={PATHS.MY_PAGE} className="app-header__text-btn">마이페이지</NavLink>
              </>
            )}
            <ThemeToggle />
            <button type="button" className="app-header__text-btn app-header__text-btn--line" onClick={handleLogout}>로그아웃</button>
          </div>
        </div>
        {showMenu && subItems.length > 0 && (
          <nav className="app-subnav" aria-label={`${currentGroup.label} 세부 메뉴`}>
            <div className="app-subnav__inner">
              {subItems.map((tab) => (
                <NavLink key={tab.key} to={tab.path} className="app-subnav__link">{tab.label}</NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
