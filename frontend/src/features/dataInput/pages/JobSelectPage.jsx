import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getHomePath } from '../../../common/auth/accessRules.js'
import { useAuth } from '../../../common/auth/useAuth.js'
import { FieldError } from '../../../common/components/index.js'
import { JOB_TYPE_OPTIONS } from '../../../common/config/jobTypes.js'
import { isAdmin } from '../../../common/config/roles.js'
import { saveJobType } from '../api/dataInputApi.js'
import { DATA_INPUT_PATHS } from '../dataInputPaths.js'

// N-05-1 직군 선택 화면 — 직군이 없는 일반 사용자가 세 직군 중 하나를 골라 저장하면 데이터 입력 화면으로 보낸다.
// 이미 직군이 있거나 관리자면 첫 화면으로 보낸다(직군 변경은 팀 결정 전이라 만들지 않는다).
export default function JobSelectPage() {
  const { user, updateUser } = useAuth()
  const [jobType, setJobType] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  // 저장 직후에는 로그인 상태의 직군도 함께 바뀌므로, 아래 '이미 직군 있음' 이동보다 먼저 확인한다.
  if (saved) return <Navigate to={DATA_INPUT_PATHS.DATA_INPUT} replace />
  if (isAdmin(user) || user?.jobType) return <Navigate to={getHomePath(user)} replace />

  // 고른 직군을 저장한다. 성공하면 '저장됨'과 로그인 상태의 직군을 한 번에 바꿔 데이터 입력 화면으로 이동시킨다.
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!jobType) return
    setPending(true)
    setError('')
    try {
      const { user: updated } = await saveJobType(jobType)
      setSaved(true)
      updateUser({ jobType: updated.jobType })
    } catch (saveError) {
      setError(saveError.message)
      setPending(false)
    }
  }

  return (
    <section className="job-select-page">
      <h1 className="job-select-page__title">직군 선택</h1>
      <p className="job-select-page__message">
        직군에 따라 소득 입력 항목이 달라집니다. 지금 소득을 얻는 방식에 가장 가까운 직군을 골라 주세요.
      </p>
      <form className="job-select-form" onSubmit={handleSubmit}>
        <fieldset className="job-select-form__options">
          <legend className="job-select-form__legend">직군</legend>
          {JOB_TYPE_OPTIONS.map((option) => (
            <label key={option.value} className="job-select-form__option">
              <input
                type="radio"
                name="jobType"
                value={option.value}
                checked={jobType === option.value}
                onChange={() => setJobType(option.value)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <FieldError message={error} />
        <button type="submit" className="job-select-form__submit" disabled={!jobType || pending}>
          {pending ? '저장 중…' : '저장하고 계속하기'}
        </button>
      </form>
    </section>
  )
}
