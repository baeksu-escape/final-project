import { useState } from 'react'

// FP-258 N-02-1 가입 [중복 확인] 한 칸(아이디 AUTH-16·닉네임 AUTH-13) — request(value) → { available }. 결과는 확인한 그 값에만 유효해서, 값을 고치면 확인이 풀린 것으로 본다.
// 사용 예: const nicknameCheck = useAvailabilityCheck(checkNicknameAvailability) → onClick={() => nicknameCheck.run(nickname)}, nicknameCheck.checked(nickname)
export default function useAvailabilityCheck(request) {
  // { value, available } — 마지막으로 확인한 값과 결과
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const run = async (value) => {
    setChecking(true)
    setError('')
    try {
      const { available } = await request(value)
      setResult({ value, available })
    } catch (checkError) {
      setResult(null)
      setError(checkError.message)
    } finally {
      setChecking(false)
    }
  }

  return {
    error,
    checking,
    run,
    checked: (value) => result?.value === value && result.available,
    taken: (value) => result?.value === value && !result.available,
    // 가입 때 409로 막히면 확인을 풀어 다시 확인하게 한다.
    reset: () => setResult(null),
    clearError: () => setError(''),
  }
}
