import { useState } from 'react'
import { filterName, validateName } from './validation.js'

// FP-258 N-03-1·N-03-2 찾기 화면 이름 칸 — 가입과 같은 걸러내기(filterName)·규칙(validateName). 요청 전(check)과 칸을 벗어날 때(값이 있을 때만) 검사해 틀리면 칸 아래에 알린다.
// 오류가 보이는 동안은 고칠 때마다 다시 검사한다(조합 중 칸을 벗어나면 blur 뒤에 조합이 끝나며 값이 들어와, 지우면 자모 안내가 사라졌다).
// bindFilter는 화면의 useImeSafeFilter() 결과다. 사용 예: const nameField = useFindNameField(bindFilter) → <div {...nameField.compositionProps} onBlur={nameField.onBlur}><TextInput value={nameField.name} onChange={nameField.onChange} error={nameField.error} /></div>
export default function useFindNameField(bindFilter) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const input = bindFilter((value) => {
    setName(value)
    setError((prev) => (prev ? validateName(value) : ''))
  }, filterName)

  // 지금 이름(또는 칸을 벗어날 때의 값)을 검사해 오류를 보이고, 통과하면 true.
  const check = (value = name) => {
    const message = validateName(value)
    setError(message)
    return message === ''
  }

  return {
    name,
    error,
    setError,
    check,
    onChange: input.onChange,
    compositionProps: input.compositionProps,
    // 빈 칸은 버튼을 누를 때 알린다.
    onBlur: (event) => {
      if (event.target.value) check(event.target.value)
    },
  }
}
