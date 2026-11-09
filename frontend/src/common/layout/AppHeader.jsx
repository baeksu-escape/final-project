import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import { JOB_TYPE_LABELS } from '../config/jobTypes.js'
import { ADMIN_TABS, PATHS, USER_TABS } from '../config/navigation.js'
import { ROLE_LABELS, isAdmin } from '../config/roles.js'
import TabMenu from './TabMenu.jsx'

// N-08 공통 헤더 — 역할에 맞는 탭 메뉴, 사용자 이름과 직군(관리자는 역할) 배지, 로그아웃 버튼을 보여 준다.
export default function AppHeader() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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
        <button type="button" className="app-header__logout" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
    </header>
  )
}
