// 화면 테마(화이트·블랙) 저장·적용 — tokens.css가 html[data-theme="dark"]일 때 블랙 색을 쓴다.
// 저장소(localStorage)를 못 쓰는 환경이면 저장만 건너뛰고 화이트로 동작한다.
const THEME_KEY = 'avenue-theme'

// 저장해 둔 테마를 읽는다. 없거나 읽을 수 없으면 'light'.
export function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

// 테마를 html에 적용하고 저장한다. 화이트는 data-theme을 지워 기본값을 쓴다.
export function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // 저장하지 못해도 이번 화면에는 적용된다.
  }
}
