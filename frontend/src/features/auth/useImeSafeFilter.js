import { useRef } from 'react'

// FP-258 N-02-1 한글 조합을 깨지 않는 걸러내기 — 조합 중에는 값을 그대로 두고 조합이 끝날 때 한 번 거른다(조합 중에 값을 바꾸면 Windows 한글 IME가 써 둔 값을 지운다).
// 사용 예: const id = useImeSafeFilter()(setLoginId, filterLoginId) → <div {...id.compositionProps}><TextInput onChange={id.onChange} /></div> (공통 TextInput은 조합 이벤트를 넘기지 않아 감싼 div에 단다)
export default function useImeSafeFilter() {
  // 한 화면에서 조합은 한 칸에서만 일어나므로 표시 하나를 함께 쓴다.
  const composing = useRef(false)

  // 칸 하나에 붙일 { onChange, compositionProps }. finish를 주면 조합이 끝날 때 filter 대신 쓴다(비밀번호 칸).
  return (setValue, filter, finish = filter) => ({
    onChange: (raw) => setValue(composing.current ? raw : filter(raw)),
    compositionProps: {
      onCompositionStart: () => {
        composing.current = true
      },
      onCompositionEnd: (event) => {
        composing.current = false
        const input = event.target
        const raw = input.value
        // type="email" 칸은 커서 위치를 읽을 수 없어(null) 커서 복원을 건너뛴다.
        const caret = typeof input.selectionStart === 'number' ? input.selectionStart : null
        setValue(finish(raw))
        if (caret === null) return
        // 커서 앞부분에서 빠지거나 늘어난 글자만큼 옮겨, 기존 값 사이에 친 글자 자리 뒤에 커서가 남게 한다.
        const nextCaret = finish(raw.slice(0, caret)).length
        requestAnimationFrame(() => {
          if (document.activeElement === input) input.setSelectionRange(nextCaret, nextCaret)
        })
      },
    },
  })
}
