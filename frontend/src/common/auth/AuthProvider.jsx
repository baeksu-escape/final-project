import { useCallback, useEffect, useMemo, useState } from 'react'
import { requestLogin, requestLogout, requestMe } from '../api/authApi.js'
import { UNAUTHORIZED_EVENT } from '../api/client.js'
import { AuthContext } from './AuthContext.js'
import { tokenStorage } from './tokenStorage.js'

// 로그인하지 않은 상태의 기본값.
const ANONYMOUS = { status: 'anonymous', user: null }

// N-01 로그인 상태 제공자 — 토큰 보관·삭제와 현재 사용자 정보를 관리한다. 새로고침하면 저장된 토큰으로 사용자를 다시 불러온다.
export default function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => (tokenStorage.get() ? { status: 'loading', user: null } : ANONYMOUS))

  // 새로고침 시 저장된 토큰이 있으면 내 정보를 다시 불러와 로그인 상태를 복원한다. 실패하면 로그아웃 상태로 둔다.
  useEffect(() => {
    if (!tokenStorage.get()) return undefined
    let cancelled = false
    requestMe()
      .then(({ user }) => {
        if (!cancelled) setAuth({ status: 'authenticated', user })
      })
      .catch(() => {
        if (!cancelled) setAuth(ANONYMOUS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // API 모듈이 401을 받으면 로그아웃 상태로 바꾼다. 화면 이동은 라우트 가드가 한다.
  useEffect(() => {
    const handleUnauthorized = () => setAuth(ANONYMOUS)
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized)
  }, [])

  // 로그인 API를 호출하고, 성공하면 토큰을 저장한 뒤 사용자 정보를 돌려준다. 실패하면 ApiError를 그대로 던진다.
  const login = useCallback(async (loginId, password) => {
    const { accessToken, user } = await requestLogin(loginId, password)
    tokenStorage.set(accessToken)
    setAuth({ status: 'authenticated', user })
    return user
  }, [])

  // N-01-6 소셜 로그인처럼 이미 받은 토큰과 사용자 정보로 로그인 상태를 만든다.
  const loginWithToken = useCallback((accessToken, user) => {
    tokenStorage.set(accessToken)
    setAuth({ status: 'authenticated', user })
  }, [])

  // 서버에 로그아웃을 알린 뒤 토큰을 지우고 로그아웃 상태로 바꾼다.
  const logout = useCallback(async () => {
    try {
      await requestLogout()
    } catch {
      // 서버 로그아웃이 실패해도 화면에서는 토큰을 지운다.
    }
    tokenStorage.clear()
    setAuth(ANONYMOUS)
  }, [])

  // 화면에 들고 있는 사용자 정보의 일부만 바꾼다(예: 직군 선택 저장 후 { jobType }). 서버 저장은 호출하는 쪽에서 한다.
  const updateUser = useCallback((patch) => {
    setAuth((prev) => (prev.user ? { ...prev, user: { ...prev.user, ...patch } } : prev))
  }, [])

  const value = useMemo(
    () => ({ ...auth, login, loginWithToken, logout, updateUser }),
    [auth, login, loginWithToken, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
