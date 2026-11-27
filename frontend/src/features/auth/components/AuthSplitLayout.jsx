import { Link, Outlet, useLocation } from 'react-router-dom'
import { JourneySteps } from '../../../common/components/index.js'
import { AUTH_PATHS } from '../authPaths.js'

// N-01~N-03 로그인·회원가입·아이디/비밀번호 찾기 공통 틀 — 흰 바탕 가운데에 폼 하나(최대 420px).
// 로그인·회원가입은 위쪽 탭으로 서로 오가고, 회원가입은 가입 여정 1단계 진행률을 함께 보여 준다. 화면 컴포넌트는 그대로 Outlet에 그린다.

const TABS = [
  { path: AUTH_PATHS.LOGIN, label: '로그인' },
  { path: AUTH_PATHS.SIGNUP, label: '회원가입' },
]

export default function AuthSplitLayout() {
  const { pathname } = useLocation()
  const showTabs = TABS.some((tab) => tab.path === pathname)
  return (
    <div className="auth-split fin-form">
      <div className="auth-split__main">
        <Link to="/" className="auth-split__logo" aria-label="Avenue 메인으로">
          <span aria-hidden="true">A</span>Avenue
        </Link>
        <div className="auth-split__inner">
          {showTabs && (
            <nav className="auth-split__tabs" aria-label="로그인·회원가입 전환">
              {TABS.map((tab) => (
                <Link key={tab.path} to={tab.path} aria-current={tab.path === pathname ? 'page' : undefined}>
                  {tab.label}
                </Link>
              ))}
            </nav>
          )}
          {pathname === AUTH_PATHS.SIGNUP && <JourneySteps current={0} />}
          <Outlet />
        </div>
      </div>
    </div>
  )
}
