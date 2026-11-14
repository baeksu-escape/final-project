import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getAccessRedirect } from './accessRules.js'
import { useAuth } from './useAuth.js'

// N-08-1 라우트 가드 — 안쪽 라우트를 감싸서 로그인·역할·직군 선택·점수 산출 여부를 확인하고, 조건이 안 맞으면 다른 경로로 보낸다.
// 사용 예: <Route element={<RouteGuard requiredRole={ROLES.ADMIN} />}> ...관리자 라우트... </Route>
//   requireScore: 점수가 있어야 볼 수 있는 화면(신용 리포트 등)을 감쌀 때 준다.
export default function RouteGuard({ requiredRole, requireJobType = false, requireScore = false }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <p className="route-guard__loading">로그인 정보를 확인하는 중입니다.</p>
  }

  const redirectTo = getAccessRedirect(user, { requiredRole, requireJobType, requireScore })
  if (redirectTo) {
    // 로그인 화면은 state.from을 보고 로그인 뒤 원래 가려던 화면으로 돌려보낼 수 있다.
    return <Navigate to={redirectTo} replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}
