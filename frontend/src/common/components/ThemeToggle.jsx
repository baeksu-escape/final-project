import { useState } from 'react'
import { applyTheme, readTheme } from '../utils/theme.js'

const SUN = 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
const MOON = 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'

// 화이트·블랙 테마 전환 버튼. 고른 값은 이 브라우저에만 저장된다.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme)
  const dark = theme === 'dark'

  // 버튼을 누르면 반대 테마로 바꾸고 html의 data-theme에 반영한다.
  const toggle = () => {
    const next = dark ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  return (
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`화면 테마 바꾸기, 지금 ${dark ? '다크' : '라이트'}`}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={dark ? MOON : SUN} />
      </svg>
      <span>{dark ? '다크' : '라이트'}</span>
    </button>
  )
}
