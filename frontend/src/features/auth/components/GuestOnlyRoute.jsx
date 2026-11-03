import { Navigate, Outlet } from 'react-router-dom'
import { getHomePath } from '../../../common/auth/accessRules.js'
import { useAuth } from '../../../common/auth/useAuth.js'

// N-01 로그인 전 화면 감싸개 — 이미 로그인한 사용자는 역할에 맞는 첫 화면으로 보낸다.
// 로그인에 성공하면 로그인 상태가 바뀌면서 이 컴포넌트가 사용자는 신용 리포트, 관리자는 모형 성능 비교로 이동시킨다.
export default function GuestOnlyRoute() {
  const { status, user } = useAuth()
  if (status === 'loading') {
    return <p className="route-guard__loading">로그인 정보를 확인하는 중입니다.</p>
  }
  if (status === 'authenticated') {
    return <Navigate to={getHomePath(user)} replace />
  }
  return <Outlet />
}
