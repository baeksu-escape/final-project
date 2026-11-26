import { useState } from 'react'
import { flushSync } from 'react-dom'

// FP-258 2차 N-01-1 비밀번호 보기 상태 — 한 화면의 비밀번호 칸들이 보이는지를 칸 이름별로 들고 있다.
// 사용 예:
//   const { reveal, hideAll } = usePasswordReveal()
//   <PasswordField label="비밀번호" value={password} onChange={setPassword} {...reveal('password')} />
//   요청이 성공해 저장하거나 화면을 옮기기 직전에 hideAll()을 부르면 모든 칸이 즉시(flushSync) 가려진다. 실패하면 부르지 않아 보기 상태가 그대로다.
export default function usePasswordReveal() {
  const [shown, setShown] = useState({})

  // 그 칸에 넘길 { visible, onToggleVisible }.
  const reveal = (key) => ({
    visible: Boolean(shown[key]),
    onToggleVisible: () => setShown((prev) => ({ ...prev, [key]: !prev[key] })),
  })

  const hideAll = () => {
    flushSync(() => setShown({}))
  }

  return { reveal, hideAll }
}
