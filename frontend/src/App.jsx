import { BrowserRouter } from 'react-router-dom'
import AuthProvider from './common/auth/AuthProvider.jsx'
import AppRoutes from './common/routes/AppRoutes.jsx'

// 앱 진입점 — 라우터와 로그인 상태를 감싸고, 실제 라우트는 common/routes/AppRoutes.jsx에 모은다.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
