import { useCallback, useEffect, useMemo, useState } from 'react'
import { requestLogin, requestLogout, requestMe } from '../api/authApi.js'
import { UNAUTHORIZED_EVENT } from '../api/client.js'
import { AuthContext } from './AuthContext.js'
import { tokenStorage } from './tokenStorage.js'

const ANONYMOUS = { status: 'anonymous', user: null }

// N-01 로그인 상태 제공자 — 토큰 보관·삭제와 현재 사용자 정보를 관리한다. 새로고침하면 저장된 토큰으로 사용자를 다시 불러온다.
export default function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => (tokenStorage.get() ? { status: 'loading', user: null } : ANONYMOUS))

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

  const login = useCallback(async (loginId, password) => {
    const { accessToken, user } = await requestLogin(loginId, password)
    tokenStorage.set(accessToken)
    setAuth({ status: 'authenticated', user })
    return user
  }, [])

  const logout = useCallback(async () => {
    try {
      await requestLogout()
    } catch {
      // 서버 로그아웃이 실패해도 화면에서는 토큰을 지운다.
    }
    tokenStorage.clear()
    setAuth(ANONYMOUS)
  }, [])

  const updateUser = useCallback((patch) => {
    setAuth((prev) => (prev.user ? { ...prev, user: { ...prev.user, ...patch } } : prev))
  }, [])

  const value = useMemo(() => ({ ...auth, login, logout, updateUser }), [auth, login, logout, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
