import { Link } from 'react-router-dom'
import { getHomePath } from '../auth/accessRules.js'
import { useAuth } from '../auth/useAuth.js'

// N-08 접근 제한 안내 — 내 역할로 볼 수 없는 화면에 들어왔을 때 보여 준다.
export default function ForbiddenPage() {
  const { user } = useAuth()
  return (
    <section className="forbidden-page">
      <h1 className="forbidden-page__title">접근할 수 없는 화면입니다</h1>
      <p className="forbidden-page__message">현재 계정의 권한으로는 이 화면을 볼 수 없습니다.</p>
      <Link to={getHomePath(user)} className="forbidden-page__home-link">
        내 첫 화면으로 이동
      </Link>
    </section>
  )
}
