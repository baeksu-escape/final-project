import { useContext } from 'react'
import { AuthContext } from './AuthContext.js'

// N-01 로그인 상태 훅 — { status, user, notice, login, logout, updateUser, clearNotice }를 돌려준다.
// 사용 예: const { user, logout } = useAuth()
//   status: 'loading'(토큰 확인 중) | 'authenticated' | 'anonymous'
//   login(loginId, password): 성공하면 user를 돌려주고, 실패하면 ApiError를 던진다.
//   logout({ notice }): notice는 생략할 수 있다. 주면 다음 로그인 화면에 한 번 띄울 알림으로 맡겨 둔다(N-04-7 탈퇴 뒤 알림).
//   notice·clearNotice(): 맡아 둔 알림과 그 알림을 비우는 함수. 로그인 화면이 꺼내 쓴 뒤 비운다.
//   updateUser({ jobType }): 직군 선택처럼 서버 저장 후 화면의 사용자 정보만 바꿀 때 쓴다.
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth는 AuthProvider 안에서만 쓸 수 있습니다.')
  return value
}
