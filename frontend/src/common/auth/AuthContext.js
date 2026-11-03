import { createContext } from 'react'

// 로그인 상태를 앱 전체에 나눠 주는 Context. 값은 AuthProvider가 채우고, 화면에서는 useAuth()로 읽는다.
export const AuthContext = createContext(null)
