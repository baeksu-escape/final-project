const TOKEN_KEY = 'avenue.accessToken'

// N-01 액세스 토큰 보관소 — localStorage를 쓸 수 없는 환경(사생활 보호 모드 등)에서도 오류 없이 동작한다.
export const tokenStorage = {
  get() {
    try {
      return window.localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // 저장할 수 없으면 이번 화면에서만 로그인 상태가 유지된다.
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY)
    } catch {
      // 지울 수 없으면 무시한다.
    }
  },
}
