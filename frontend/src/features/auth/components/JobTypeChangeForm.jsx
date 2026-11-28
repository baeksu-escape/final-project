import { useState } from 'react'
import { useAuth } from '../../../common/auth/useAuth.js'
import { JOB_TYPES, JOB_TYPE_LABELS, JOB_TYPE_OPTIONS } from '../../../common/config/jobTypes.js'
import { saveJobType } from '../../dataInput/api/dataInputApi.js'
import { clearDraft } from '../../dataInput/utils/inputDraft.js'

// N-04-8 직군 변경 안내문(11/28 조장 확인) — 기존 입력은 그대로 두고 직군만 바꾼다.
// 기간은 직군과 상관없이 하나이고, 소득은 급여소득자만 기준월 한 달이라 급여소득자에서 바꿀 때만 12개월 소득이 더 필요하다.
const JOB_TYPE_NOTICE_LINES = Object.freeze([
  '급여소득자에서 다른 직군으로 바꾸면 최근 12개월 소득을 입력해야 점수를 낼 수 있습니다.',
  '지금까지 입력한 값과 진단 기록은 그대로 남습니다.',
])

// 바꾼 뒤 안내 — 급여소득자에서 다른 직군으로 바꾼 경우만 12개월 소득 입력을 안내한다.
function savedMessage(fromJobType, toJobType) {
  const head = `직군을 ${JOB_TYPE_LABELS[toJobType]}(으)로 바꿨습니다.`
  if (fromJobType === JOB_TYPES.EMPLOYEE && toJobType !== JOB_TYPES.EMPLOYEE) {
    return `${head} 데이터 입력에서 최근 12개월 소득을 입력해 주세요.`
  }
  return `${head} 입력한 값은 그대로이니 데이터 입력에서 소득을 확인한 뒤 점수를 내 주세요.`
}

// FP-298 N-04-8 직군 변경 폼 — 계정 관리 카드의 [직군 변경하기]를 누르면 펼쳐진다(탈퇴 폼과 같은 "한 번에 하나").
// 지금 직군을 보여 주고 다른 직군 하나를 고르게 한다(지금 직군은 고를 수 없음). 서버(MEM-05)는 같은 직군·틀린 값이면 400이다.
// 바꾸면 이전 직군의 데이터 입력 임시저장본을 지우고 로그인 상태의 직군을 바꾼 뒤 onSaved(안내 문구)로 알린다. [취소]는 onCancel로 접는다.
export default function JobTypeChangeForm({ onSaved, onCancel }) {
  const { user, updateUser } = useAuth()
  const [jobType, setJobType] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const currentJobType = user.jobType

  // 고른 직군으로 바꾼다. 서버 오류(같은 직군·틀린 값·동시 변경)는 폼 아래 문구로 보여 준다.
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!jobType) {
      setError('새 직군을 골라 주세요.')
      return
    }
    setPending(true)
    setError('')
    try {
      const { user: updated } = await saveJobType(jobType)
      if (currentJobType) clearDraft(user.userId, currentJobType)
      updateUser({ jobType: updated.jobType })
      onSaved(savedMessage(currentJobType, updated.jobType))
    } catch (saveError) {
      setError(saveError.data?.fieldErrors?.[0]?.message ?? saveError.message)
      setPending(false)
    }
  }

  return (
    <form className="account-form job-type-form" onSubmit={handleSubmit} noValidate>
      <p className="job-type-form__current">
        지금 직군: <b>{JOB_TYPE_LABELS[currentJobType] ?? '직군 미선택'}</b>
      </p>
      <fieldset className="job-type-form__options">
        <legend className="job-type-form__legend">새 직군</legend>
        {JOB_TYPE_OPTIONS.map((option) => {
          const isCurrent = option.value === currentJobType
          return (
            <label key={option.value} className={`job-type-form__option${isCurrent ? ' is-current' : ''}`}>
              <input
                type="radio"
                name="newJobType"
                value={option.value}
                checked={jobType === option.value}
                disabled={isCurrent || pending}
                onChange={() => {
                  setJobType(option.value)
                  setError('')
                }}
              />
              <span>
                {option.label}
                {isCurrent && <small> (지금 직군)</small>}
              </span>
            </label>
          )
        })}
      </fieldset>
      <p className="job-type-form__notice">
        {JOB_TYPE_NOTICE_LINES[0]}
        <br />
        {JOB_TYPE_NOTICE_LINES[1]}
      </p>
      {error && (
        <p className="account-form__error" role="alert">
          {error}
        </p>
      )}
      {/* [변경하기]·[취소]는 탈퇴 폼과 같은 2칸 격자로 나란히 둔다. */}
      <div className="job-type-form__actions">
        <button type="submit" className="account-form__submit" disabled={pending || !jobType}>
          {pending ? '변경 중…' : '변경하기'}
        </button>
        <button type="button" className="account-form__cancel" onClick={onCancel} disabled={pending}>
          취소
        </button>
      </div>
    </form>
  )
}
