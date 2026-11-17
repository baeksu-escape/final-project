import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 공통 CSS를 App보다 먼저 불러온다 — 화면별 CSS가 뒤에 들어와야 같은 우선순위에서 화면 쪽 값이 이긴다.
import './common/styles/tokens.css'
import './common/styles/forms.css'
import './common/styles/components.css'
import './common/styles/layout.css'
import App from './App.jsx'
import { applyTheme, readTheme } from './common/utils/theme.js'

// 첫 화면을 그리기 전에 저장해 둔 테마(화이트·블랙)를 먼저 적용해 깜박임을 막는다.
applyTheme(readTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
