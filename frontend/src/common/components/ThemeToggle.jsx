import { useState } from 'react'
import { applyTheme, readTheme } from '../utils/theme.js'

// 화이트·블랙 테마 전환 버튼 — 화면 오른쪽 아래에 고정한다(데모 v2의 테마 버튼). 고른 값은 이 브라우저에만 저장된다.
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
    <button type="button" className="theme-toggle" onClick={toggle} aria-label={`화면 테마 바꾸기, 지금 ${dark ? '블랙' : '화이트'}`}>
      {dark ? '☾ 블랙' : '☀ 화이트'}
    </button>
  )
}
