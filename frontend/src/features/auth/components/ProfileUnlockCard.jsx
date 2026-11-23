import { useState } from 'react'
import { Card, TextInput } from '../../../common/components/index.js'

// FP-222 v2 내정보 탭 잠금 — 탭에 들어오면 먼저 비밀번호를 받는다. 확인은 onUnlock(password)가 기존 MEM-02(가림 해제)로 맡고, 틀리면 오류를 던진다.
// 입력한 비밀번호는 맞든 틀리든 바로 지운다. 모양은 내 정보 카드의 가림 해제 폼과 같은 클래스를 쓴다.
export default function ProfileUnlockCard({ onUnlock }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!password) {
      setError('비밀번호를 입력해 주세요.')
      return
    }
    setPending(true)
    setError('')
    try {
      await onUnlock(password)
    } catch (unlockError) {
      setError(unlockError.message)
      setPending(false)
    } finally {
      setPassword('')
    }
  }

  return (
    <Card title="내 정보 확인" className="profile-unlock-card">
      <form className="my-profile-card__unmask-form" onSubmit={handleSubmit} noValidate>
        <TextInput
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          error={error}
          hint="내 정보를 보려면 비밀번호를 입력해 주세요. 이 탭을 벗어나면 다시 잠깁니다."
          autoComplete="current-password"
        />
        <button type="submit" className="my-profile-card__unmask-submit" disabled={pending}>
          확인
        </button>
      </form>
    </Card>
  )
}
