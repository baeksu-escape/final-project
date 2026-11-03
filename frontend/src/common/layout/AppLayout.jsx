import { Outlet } from 'react-router-dom'
import AppHeader from './AppHeader.jsx'

// 로그인 후 화면의 공통 틀 — 헤더 아래 main에 각 화면(Outlet)을 넣는다.
export default function AppLayout() {
  return (
    <div className="app-layout">
      <AppHeader />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
