import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { canSeeMainMenu } from '../auth/accessRules.js'
import { useAuth } from '../auth/useAuth.js'
import Toast from '../components/Toast.jsx'
import { ADMIN_TABS, PATHS, USER_TABS } from '../config/navigation.js'
import { ROLE_LABELS, isAdmin } from '../config/roles.js'
import TabMenu from './TabMenu.jsx'

// TODO(D-23) 알림 범위가 정해지기 전까지 [알림]을 누르면 이 안내만 보여 준다.
const NOTIFICATION_PENDING_MESSAGE = '알림 기능은 준비 중입니다.'

// N-08-1 공통 헤더 (11/06 확정 UI) — 사용자: [알림]·[마이 페이지]·[로그아웃], 관리자: '관리자' 칩·[로그아웃]. 이름·직군 배지는 두지 않는다.
// 사용자 주 메뉴 9개는 점수가 나온 뒤에만 보이고(canSeeMainMenu), 관리자 탭 5개는 늘 보인다. 로고는 첫 화면('/')으로 간다.
export default function AppHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [toastMessage, setToastMessage] = useState('')
  const admin = isAdmin(user)

  // 로그인 상태를 지운 뒤 로그인 화면으로 보낸다.
  const handleLogout = async () => {
    await logout()
    navigate(PATHS.LOGIN, { replace: true })
  }

  return (
    <header className="app-header">
      {/* TODO(2차) 로고로 메인(홍보) 페이지 이동(N-10-3) — 메인 페이지(N-10, P3)를 만들 때 바꾼다. */}
      <Link to={PATHS.HOME} className="app-header__brand">
        {admin ? 'Avenue Admin' : 'Avenue'}
      </Link>
      {canSeeMainMenu(user) && <TabMenu tabs={admin ? ADMIN_TABS : USER_TABS} label={admin ? '관리자 메뉴' : '주 메뉴'} />}
      <div className="app-header__user">
        {admin && <span className="app-header__badge">{ROLE_LABELS[user.role]}</span>}
        {!admin && (
          <>
            {/* TODO(D-23) 알림 자리 — 알림 내용과 범위는 팀 결정 전이라 안내만 띄운다. */}
            <button type="button" className="app-header__notification" onClick={() => setToastMessage(NOTIFICATION_PENDING_MESSAGE)}>
              알림
            </button>
            <NavLink to={PATHS.MY_PAGE} className="app-header__mypage">
              마이 페이지
            </NavLink>
          </>
        )}
        <button type="button" className="app-header__logout" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </header>
  )
}
