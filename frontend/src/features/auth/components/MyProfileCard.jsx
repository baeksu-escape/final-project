import { useState } from 'react'
import { Card, TextInput } from '../../../common/components/index.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'

// 값이 없는 항목(새 가입자의 닉네임·가입일 등)에 보일 문자.
const EMPTY_VALUE = '-'

// N-04-1 내 정보 카드 — 7개 항목을 보여 준다. 이름·휴대폰·이메일은 서버가 가려서 보낸 값을 그대로 쓴다.
// N-04-2 [가림 해제]를 누르면 비밀번호 칸을 열고, 확인은 onUnmask(password)가 맡는다(틀리면 오류를 던진다). 해제 뒤에는 unmasked 값을 보여 준다.
export default function MyProfileCard({ profile, unmasked, onUnmask }) {
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const shown = unmasked ?? profile
  const items = [
    ['아이디', profile.loginId],
    ['닉네임', profile.nickname],
    ['이름', shown.name],
    ['휴대폰', shown.phone],
    ['이메일', shown.email],
    ['가입일', profile.joinedAt],
    ['직군', JOB_TYPE_LABELS[profile.jobType]],
  ]

  // 비밀번호 칸을 닫고 입력한 값과 안내를 지운다.
  const closeForm = () => {
    setAsking(false)
    setPassword('')
    setError('')
  }

  // 비밀번호를 서버에 확인받는다. 맞든 틀리든 입력한 비밀번호는 바로 지운다.
  const handleUnmask = async (event) => {
    event.preventDefault()
    if (!password) {
      setError('비밀번호를 입력해 주세요.')
      return
    }
    setPending(true)
    setError('')
    try {
      await onUnmask(password)
      setAsking(false)
    } catch (unmaskError) {
      setError(unmaskError.message)
    } finally {
      setPassword('')
      setPending(false)
    }
  }

  return (
    <Card title="내 정보" className="my-profile-card">
      <dl className="my-profile-card__list">
        {items.map(([label, value]) => (
          <div key={label} className="my-profile-card__item">
            <dt className="my-profile-card__label">{label}</dt>
            <dd className="my-profile-card__value">{value ?? EMPTY_VALUE}</dd>
          </div>
        ))}
      </dl>
      {unmasked && (
        <p className="my-profile-card__unmasked" role="status">
          가림을 해제했습니다. 이 화면을 벗어나면 다시 가려집니다.
        </p>
      )}
      {!unmasked && asking && (
        <form className="my-profile-card__unmask-form" onSubmit={handleUnmask} noValidate>
          <TextInput
            label="비밀번호"
            type="password"
            value={password}
            onChange={setPassword}
            error={error}
            hint="가린 정보를 보려면 비밀번호를 다시 입력해 주세요."
            autoComplete="current-password"
          />
          <button type="submit" className="my-profile-card__unmask-submit" disabled={pending}>
            확인
          </button>
          <button type="button" className="my-profile-card__unmask-cancel" onClick={closeForm}>
            취소
          </button>
        </form>
      )}
      {!unmasked && !asking && (
        <button type="button" className="my-profile-card__unmask" onClick={() => setAsking(true)}>
          가림 해제
        </button>
      )}
    </Card>
  )
}
