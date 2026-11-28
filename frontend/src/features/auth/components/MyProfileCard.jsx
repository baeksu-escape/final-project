import { useState } from 'react'
import { Card, TextInput } from '../../../common/components/index.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'

// 값이 없는 항목(새 가입자의 닉네임·가입일 등)에 보일 문자.
const EMPTY_VALUE = '-'
// 휴대폰을 등록하지 않은 계정(휴대폰 null)에 보일 문구.
const NO_PHONE = '등록 안 함'
// 직군을 아직 고르지 않은 계정(jobType null)에 보일 문구.
const NO_JOB_TYPE = '직군 미선택'

// N-04-1 내 정보 카드 — 7개 항목을 보여 준다. 이름·휴대폰·이메일은 서버가 가려서 보낸 값을 그대로 쓴다.
// N-04-2 [가림 해제]를 누르면 비밀번호 칸을 열고, 확인은 onUnmask(password)가 맡는다(틀리면 오류를 던진다). 해제 뒤에는 unmasked 값을 보여 준다.
// FP-222 확인한 뒤에는 이 카드에서 [숨기기]·[표시]로 가린 값과 원래 값을 오간다. 원래 값은 MyPage 상태에만 있어 다시 표시할 때 비밀번호를 묻지 않고,
// 화면을 벗어나면 함께 사라진다(서버 MEM-02는 유효시간 없이 요청마다 비밀번호를 확인한다).
export default function MyProfileCard({ profile, unmasked, onUnmask }) {
  const [asking, setAsking] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  // FP-259 비밀번호 확인 뒤에도, 탭에 다시 들어와도 가린 값부터 보여 준다. 원래 값은 [표시]를 눌러야 보인다(비밀번호는 다시 묻지 않음).
  const [revealed, setRevealed] = useState(false)

  const shown = unmasked && revealed ? unmasked : profile
  const items = [
    ['아이디', profile.loginId],
    ['닉네임', profile.nickname],
    ['이름', shown.name],
    ['휴대폰', shown.phone ?? NO_PHONE],
    ['이메일', shown.email],
    ['가입일', profile.joinedAt],
    ['직군', JOB_TYPE_LABELS[profile.jobType] ?? NO_JOB_TYPE],
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
      setRevealed(true)
    } catch (unmaskError) {
      setError(unmaskError.message)
    } finally {
      setPassword('')
      setPending(false)
    }
  }

  // FP-259 제목 줄 — 버튼·안내를 제목 옆에 둬 값을 펼치거나 가려도 카드 높이가 그대로다. 공통 Card title은 글자만 받아 card__title로 직접 그린다.
  const head = (
    <div className="my-profile-card__head">
      <h2 className="card__title">내 정보</h2>
      {/* FP-259 9차 안내 자리는 원래 값이 있으면 늘 그려 둔다(가린 상태에서는 빈칸). 좁은 화면에서 안내가 다음 줄로 내려가도 [표시] 전후 높이가 같다. */}
      {unmasked && (
        <p className="my-profile-card__unmasked" role="status">
          {revealed ? '원래 값 표시 중 · 탭·화면을 옮기면 다시 가려집니다' : ' '}
        </p>
      )}
      {unmasked && (
        <button type="button" className="my-profile-card__unmask" onClick={() => setRevealed((value) => !value)}>
          {revealed ? '숨기기' : '표시'}
        </button>
      )}
      {!unmasked && !asking && (
        <button type="button" className="my-profile-card__unmask" onClick={() => setAsking(true)}>
          가림 해제
        </button>
      )}
    </div>
  )

  return (
    <Card className="my-profile-card">
      {head}
      <dl className="my-profile-card__list">
        {items.map(([label, value]) => (
          <div key={label} className="my-profile-card__item">
            <dt className="my-profile-card__label">{label}</dt>
            <dd className="my-profile-card__value">{value ?? EMPTY_VALUE}</dd>
          </div>
        ))}
      </dl>
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
    </Card>
  )
}
