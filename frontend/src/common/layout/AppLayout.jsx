import { Outlet, useLocation } from 'react-router-dom'
import AppFooter from './AppFooter.jsx'
import AppHeader from './AppHeader.jsx'

// 로그인 후 화면의 공통 틀 — 위쪽 바(AppHeader) + 본문(Outlet) + 푸터.
// 경로가 바뀔 때마다 본문을 흐릿 → 선명하게 들어오게 한다(page-enter).
export default function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <div key={pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <AppFooter />
    </div>
  )
}
