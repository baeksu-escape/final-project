import { Link, useLocation } from 'react-router-dom'
import { AUTH_PATHS } from '../authPaths.js'

// 로그인 전 화면 링크 목록(보여 줄 순서대로).
const LINKS = [
  { path: AUTH_PATHS.LOGIN, label: '로그인' },
  { path: AUTH_PATHS.SIGNUP, label: '회원가입' },
  { path: AUTH_PATHS.FIND_ID, label: '아이디 찾기' },
  { path: AUTH_PATHS.FIND_PASSWORD, label: '비밀번호 찾기' },
]

// 로그인 전 화면들 사이를 오가는 링크 묶음. 지금 보고 있는 화면의 링크는 빼고 보여 준다.
export default function AuthLinks() {
  const { pathname } = useLocation()
  return (
    <nav className="auth-links" aria-label="계정 메뉴">
      <ul className="auth-links__list">
        {LINKS.filter((link) => link.path !== pathname).map((link) => (
          <li key={link.path} className="auth-links__item">
            <Link to={link.path} className="auth-links__link">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
