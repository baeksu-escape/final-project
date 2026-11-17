import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { canSeeMainMenu } from '../auth/accessRules.js'
import { useAuth } from '../auth/useAuth.js'
import Toast from '../components/Toast.jsx'
import { ADMIN_TABS, PATHS, USER_TABS } from '../config/navigation.js'
import { ROLE_LABELS, isAdmin } from '../config/roles.js'
import TabMenu from './TabMenu.jsx'
import { ADMIN_PATHS } from '../../features/admin/adminConstants.js'

// TODO(D-23) 알림 범위가 정해지기 전까지 [알림]을 누르면 이 안내만 보여 준다.
const NOTIFICATION_PENDING_MESSAGE = '알림 기능은 준비 중입니다.'

// N-08-1 공통 헤더 (11/06 확정 UI) — 사용자: [알림]·[마이 페이지]·[로그아웃], 관리자: '관리자' 칩·[로그아웃]. 이름·직군 배지는 두지 않는다.
// 사용자 주 메뉴 9개는 점수가 나온 뒤에만 보이고(canSeeMainMenu), 관리자 탭 5개는 늘 보인다. 로고는 첫 화면('/')으로 간다.
export default function AppHeader() {
  const { user, logout } = useAuth()
  const [toastMessage, setToastMessage] = useState('')
  const admin = isAdmin(user)

  // 로그인 상태를 지운 뒤 메인(홍보) 첫 화면으로 보낸다(N-10, 데모 v2).
  // 라우터 이동(navigate)으로는 로그아웃 순간 RouteGuard가 로그인 화면으로 덮어써서, 페이지를 '/'로 새로 연다(11/17 확인).
  // RouteGuard 기본 이동(/login)은 바꾸지 않는다 — 탈퇴 알림, 세션 만료(401), 로그인 없이 주소로 바로 들어온 경우는 로그인 화면이 맞다.
  const handleLogout = async () => {
    await logout()
    window.location.replace(PATHS.HOME)
  }

  return (
    <header className={admin ? 'app-header app-header--admin' : 'app-header'}>
      {/* N-10-3 로고 — '/'로 가지만 로그인 상태면 GuestOnlyRoute가 자기 첫 화면으로 다시 보낸다(11/17 사용자 결정). */}
      <Link to={PATHS.HOME} className="app-header__brand">
        <span className="app-header__logo" aria-hidden="true">AV</span>
        <span>
          <span className="app-header__name">{admin ? 'Avenue Admin' : 'Avenue'}</span>
          <span className="app-header__tagline">{admin ? 'RISK CONSOLE' : 'ALTERNATIVE CREDIT'}</span>
        </span>
      </Link>
      {canSeeMainMenu(user) && <TabMenu tabs={admin ? ADMIN_TABS : USER_TABS} label={admin ? '관리자 메뉴' : '주 메뉴'} />}
      <div className="app-header__user">
        {admin && <span className="app-header__badge">{ROLE_LABELS[user.role]}</span>}
        {/* FP-80 관리자 비밀번호 변경 링크 — 새 스타일 없이 [마이 페이지] 링크와 같은 클래스를 쓴다. */}
        {admin && (
          <NavLink to={ADMIN_PATHS.PASSWORD} className="app-header__mypage">
            비밀번호 변경
          </NavLink>
        )}
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
