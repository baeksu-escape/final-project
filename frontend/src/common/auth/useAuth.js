import { useContext } from 'react'
import { AuthContext } from './AuthContext.js'

// N-01 로그인 상태 훅 — { status, user, login, logout, updateUser }를 돌려준다.
// 사용 예: const { user, logout } = useAuth()
//   status: 'loading'(토큰 확인 중) | 'authenticated' | 'anonymous'
//   login(loginId, password): 성공하면 user를 돌려주고, 실패하면 ApiError를 던진다.
//   updateUser({ jobType }): 직군 선택처럼 서버 저장 후 화면의 사용자 정보만 바꿀 때 쓴다.
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다.')
  return value
}
