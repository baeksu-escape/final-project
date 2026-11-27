import { useState } from 'react'

// FP-258 N-03-1·N-03-2 찾기 화면 칸 묶음(휴대폰·이메일) 검사 — 묶음 밖으로 포커스가 나갈 때 친 값이 있으면 검사를 켜고, 그 뒤로는 고칠 때마다 다시 본다.
// 묶음 안 칸끼리 옮겨 갈 때(가운데 → 끝 자리)는 켜지 않는다. 사용 예: const phone = useBlurCheck(() => validatePhoneParts(m, l), () => Boolean(m || l)) → <div onBlur={phone.onBlur}> … error={phone.error}
export default function useBlurCheck(validate, hasValue) {
  const [shown, setShown] = useState(false)
  const onBlur = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return
    if (hasValue()) setShown(true)
  }
  return { error: shown ? validate() : '', onBlur }
}
