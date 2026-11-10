import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import Toast from '../components/Toast.jsx'
import { JOB_TYPE_LABELS } from '../config/jobTypes.js'
import { ADMIN_TABS, PATHS, USER_TABS } from '../config/navigation.js'
import { ROLE_LABELS, isAdmin } from '../config/roles.js'
import TabMenu from './TabMenu.jsx'

// TODO(D-23) 알림 범위가 정해지기 전까지 [알림]을 누르면 이 안내만 보여 준다.
const NOTIFICATION_PENDING_MESSAGE = '알림 기능은 준비 중입니다.'

// N-08-1 공통 헤더 — 계정 유형에 맞는 메뉴(사용자 9개·관리자 5개), 이름과 직군(관리자는 역할) 배지를 보여 준다.
// 사용자 헤더 버튼은 [알림]·[마이 페이지]·[로그아웃] 순서이고, 관리자는 [로그아웃]만 있다(관리자는 마이 페이지가 없다).
export default function AppHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [toastMessage, setToastMessage] = useState('')
  const admin = isAdmin(user)
  const badge = admin ? ROLE_LABELS[user.role] : (JOB_TYPE_LABELS[user?.jobType] ?? '직군 미선택')

  // 로그인 상태를 지운 뒤 로그인 화면으로 보낸다.
  const handleLogout = async () => {
    await logout()
    navigate(PATHS.LOGIN, { replace: true })
  }

  return (
    <header className="app-header">
      <Link to={PATHS.HOME} className="app-header__brand">
        Avenue
      </Link>
      <TabMenu tabs={admin ? ADMIN_TABS : USER_TABS} />
      <div className="app-header__user">
        <span className="app-header__user-name">{user?.name}</span>
        <span className="app-header__badge">{badge}</span>
        {!admin && (
          <>
            {/* TODO(D-23) 알림 자리 — 알림 내용과 범위는 팀 결정 전이라 안내만 띄운다. */}
            <button type="button" className="app-header__notification" onClick={() => setToastMessage(NOTIFICATION_PENDING_MESSAGE)}>
              알림
            </button>
            <Link to={PATHS.MY_PAGE} className="app-header__mypage">
              마이 페이지
            </Link>
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
