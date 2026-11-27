import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AppFooter from './AppFooter.jsx'
import AppHeader from './AppHeader.jsx'

// 로그인 후 화면의 공통 틀 — 위쪽 바(AppHeader) + 본문(Outlet) + 푸터.
// 경로가 바뀔 때마다 본문을 흐릿 → 선명하게 들어오게 하고(page-enter), 화면 맨 위부터 보여 준다(메뉴·탭을 눌러 이동해도 이전 스크롤 위치에 남지 않게).
export default function AppLayout() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
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
