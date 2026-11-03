import { Link } from 'react-router-dom'
import { PATHS } from '../config/navigation.js'

// 없는 경로에 들어왔을 때 보여 준다.
export default function NotFoundPage() {
  return (
    <section className="not-found-page">
      <h1 className="not-found-page__title">페이지를 찾을 수 없습니다</h1>
      <Link to={PATHS.HOME} className="not-found-page__home-link">
        처음 화면으로 이동
      </Link>
    </section>
  )
}
