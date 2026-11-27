import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { getHomePath } from '../auth/accessRules.js'
import { useAuth } from '../auth/useAuth.js'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { NAV_GROUPS, PATHS, findNavGroup } from '../config/navigation.js'
import AppFooter from './AppFooter.jsx'
import MegaNav from './MegaNav.jsx'
import { AUTH_PATHS } from '../../features/auth/authPaths.js'

// N-01~N-03·N-10 로그인 전 화면의 공통 틀 — 위쪽 바(로고·서비스 메뉴·테마·로그인/회원가입), 본문(Outlet), 푸터.
// 로그인한 사람이 메인 페이지를 볼 때는 메뉴가 실제 화면으로 가고, 오른쪽 버튼이 [내 홈으로]가 된다.
// 회원가입은 로그인 화면의 [회원가입] 버튼으로 들어간다(11/18 1차 시연 후속).
export default function PublicLayout() {
  const { status, user } = useAuth()
  const { pathname } = useLocation()
  // 경로가 바뀌면 화면 맨 위부터 보여 준다
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  const signedIn = status === 'authenticated'
  const hrefFor = signedIn ? (entry) => entry.path : () => AUTH_PATHS.LOGIN
  return (
    <div className="public-shell">
      <header className="public-bar">
        <div className="public-bar__inner">
          <Link to={PATHS.HOME} className="app-header__brand">
            <span className="app-header__logo" aria-hidden="true">A</span>
            <span className="app-header__name">Avenue</span>
          </Link>
          <MegaNav groups={NAV_GROUPS} label="서비스 메뉴" hrefFor={hrefFor} isActive={(group) => findNavGroup(pathname)?.key === group.key} />
          <div className="public-bar__actions">
            <ThemeToggle />
            {signedIn
              ? <Link to={getHomePath(user)} className="public-bar__cta public-bar__cta--blue">내 홈으로</Link>
              : <Link to={AUTH_PATHS.LOGIN} className="public-bar__cta">로그인/회원가입</Link>}
          </div>
        </div>
      </header>
      <main className="app-main public-shell__main">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <AppFooter />
    </div>
  )
}
