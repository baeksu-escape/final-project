import { useRef } from 'react'

// FP-258 3차 N-02-1 한글 조합을 깨지 않는 걸러내기 — 조합 중(compositionstart~compositionend)에는 입력 값을 그대로 두고,
// 조합이 끝나는 순간 한 번 걸러 낸다. 조합 도중 값을 되돌리면 Windows 한글 IME의 조합 범위가 어긋나 써 둔 값이 지워지기 때문이다.
// 사용 예:
//   const bindFilter = useImeSafeFilter()
//   const loginIdInput = bindFilter(setLoginId, filterLoginId)
//   <div {...loginIdInput.compositionProps}><TextInput value={loginId} onChange={loginIdInput.onChange} /></div>
//   공통 TextInput은 composition 이벤트를 넘기지 않으므로 감싼 div에 단다(이벤트가 위로 올라온다). <input>을 직접 그리면 input에 단다.
export default function useImeSafeFilter() {
  // 한 화면에서 조합은 한 칸에서만 일어나므로 표시 하나를 함께 쓴다.
  const composing = useRef(false)

  // 칸 하나에 붙일 { onChange, compositionProps }. setValue는 칸 값을 바꾸는 함수, filter는 validation.js의 걸러내기 함수다.
  // FP-258 5차 finish를 주면 조합이 끝날 때만 filter 대신 쓴다(비밀번호 칸: 한글을 영문 키로 바꾼 뒤 거르기). 없으면 filter와 같다.
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
