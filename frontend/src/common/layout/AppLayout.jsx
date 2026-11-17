import { Outlet } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle.jsx'
import AppFooter from './AppFooter.jsx'
import AppHeader from './AppHeader.jsx'

// 로그인 후 화면의 공통 틀 — 헤더 아래 main에 각 화면(Outlet)을 넣고, 아래에 푸터와 테마 전환 버튼을 둔다.
export default function AppLayout() {
  return (
    <div className="app-layout">
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
      <AppFooter />
      <ThemeToggle />
    </div>
  )
}
