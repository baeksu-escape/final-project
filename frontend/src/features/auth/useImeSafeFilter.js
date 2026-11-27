import { useRef } from 'react'

// FP-258 N-02-1 한글 조합을 깨지 않는 걸러내기 — 조합 중에는 값을 그대로 두고 조합이 끝날 때 한 번 거른다(조합 중에 값을 바꾸면 Windows 한글 IME가 써 둔 값을 지운다).
// 사용 예: const id = useImeSafeFilter()(setLoginId, filterLoginId) → <div {...id.compositionProps}><TextInput onChange={id.onChange} /></div> (공통 TextInput은 조합 이벤트를 넘기지 않아 감싼 div에 단다)
export default function useImeSafeFilter() {
  // 한 화면에서 조합은 한 칸에서만 일어나므로 표시 하나를 함께 쓴다.
  const composing = useRef(false)

  // 값이 바뀐 뒤 다시 그려지고 나서 커서를 pos로 옮긴다. 그사이 새 조합이 시작됐거나 칸을 벗어났으면 건드리지 않는다(FP-258).
  const moveCaret = (input, pos) => {
    requestAnimationFrame(() => {
      if (!composing.current && document.activeElement === input) input.setSelectionRange(pos, pos)
    })
  }

  // type="email" 칸은 커서 위치를 읽을 수 없어(null) 커서 복원을 건너뛴다.
  const caretOf = (input) => (input && typeof input.selectionStart === 'number' ? input.selectionStart : null)

  // 칸 하나에 붙일 { onChange, compositionProps }. finish를 주면 조합이 끝날 때 filter 대신 쓴다(비밀번호 칸).
  // 걸러서 값이 바뀌면 커서를 "입력 위치 − 앞쪽에서 빠진 글자 수"(앞부분을 거른 길이)로 되돌린다. 값이 그대로면 커서를 건드리지 않는다.
  return (setValue, filter, finish = filter) => ({
    onChange: (raw) => {
      if (composing.current) {
        setValue(raw)
        return
      }
      const next = filter(raw)
      // 조합이 아닌 입력은 이벤트를 받은 칸이 포커스를 가진 칸이다(공통 TextInput은 값만 넘겨 준다).
      const input = document.activeElement
      const caret = next !== raw && input?.value === raw ? caretOf(input) : null
      setValue(next)
      if (caret !== null) moveCaret(input, filter(raw.slice(0, caret)).length)
    },
    compositionProps: {
      onCompositionStart: () => {
        composing.current = true
      },
      onCompositionEnd: (event) => {
        composing.current = false
        const input = event.target
        const raw = input.value
        const caret = caretOf(input)
        const next = finish(raw)
        setValue(next)
        if (caret === null || next === raw) return
        // 커서 앞부분에서 빠지거나 늘어난 글자만큼 옮겨, 기존 값 사이에 친 글자 자리 뒤에 커서가 남게 한다.
        moveCaret(input, finish(raw.slice(0, caret)).length)
      },
    },
  })
}
