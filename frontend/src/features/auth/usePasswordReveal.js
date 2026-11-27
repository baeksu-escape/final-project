import { useState } from 'react'
import { flushSync } from 'react-dom'

// FP-258 N-01-1 비밀번호 보기 상태 — 한 화면의 비밀번호 칸들이 보이는지를 칸 이름별로 들고 있다. 칸에는 {...reveal('password')}를 넘긴다.
// 요청이 성공했을 때만 hideAll()로 모든 칸을 즉시(flushSync) 가린다(실패하면 부르지 않아 보기 상태가 그대로다).
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
