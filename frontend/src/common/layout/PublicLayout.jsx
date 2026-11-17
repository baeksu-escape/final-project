import { Link, NavLink, Outlet } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { PATHS } from '../config/navigation.js'
import AppFooter from './AppFooter.jsx'
import { AUTH_PATHS } from '../../features/auth/authPaths.js'

// N-01~N-03 로그인 전 화면의 공통 틀 — 로고와 [로그인]·[회원가입] 링크, 본문(Outlet), 푸터를 둔다(데모 v2 로그인·가입 화면 상단).
export default function PublicLayout() {
  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to={PATHS.HOME} className="app-header__brand">
          <span className="app-header__logo" aria-hidden="true">AV</span>
          <span>
            <span className="app-header__name">Avenue</span>
            <span className="app-header__tagline">ALTERNATIVE CREDIT</span>
          </span>
        </Link>
        <div className="app-header__user">
          <NavLink to={AUTH_PATHS.LOGIN} className="app-header__link">
            로그인
          </NavLink>
          <NavLink to={AUTH_PATHS.SIGNUP} className="app-header__link app-header__link--primary">
            회원가입
          </NavLink>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <AppFooter />
      <ThemeToggle />
    </div>
  )
}
