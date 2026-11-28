import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getHomePath } from '../../../common/auth/accessRules.js'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button, FieldError, JourneySteps } from '../../../common/components/index.js'
import { JOB_TYPES, JOB_TYPE_OPTIONS } from '../../../common/config/jobTypes.js'
import { isAdmin } from '../../../common/config/roles.js'
import { saveJobType } from '../api/dataInputApi.js'
import { DATA_INPUT_PATHS, FROM_DATA_INPUT } from '../dataInputPaths.js'
import { clearDraft } from '../utils/inputDraft.js'
import '../dataInput.css'

// N-05-1 직군 선택 화면 — 일반 사용자가 세 직군 중 하나를 골라 저장하면 데이터 입력 화면으로 보낸다.
// FP-227 데이터 입력 1단계 [이전]으로 넘어온 경우(state.from === FROM_DATA_INPUT)에만 직군이 있는 사용자도 머물며 다시 고른다(MEM-05 저장 전 변경).
// 그 밖에 직군이 이미 있거나 관리자면 첫 화면으로 보낸다. 입력을 저장한 뒤의 직군 변경은 마이페이지 [직군 변경하기](N-04-8, FP-298)에서 한다.
// 직군 카드 한 줄 설명 — 어느 직군을 골라야 할지 헷갈리지 않게 소득을 얻는 방식으로 적는다.
const JOB_DESCRIPTIONS = {
  [JOB_TYPES.EMPLOYEE]: '회사에 다니며 매달 월급을 받아요',
  [JOB_TYPES.SELF_EMPLOYED]: '가게나 사업체를 직접 운영해요',
  [JOB_TYPES.FREELANCER]: '건별·프로젝트 단위로 일하고 대가를 받아요',
}

// 직군 카드 아이콘(선 아이콘) — 자영업자: 가게, 프리랜서: 노트북, 급여소득자: 서류 가방
const JOB_ICONS = {
  [JOB_TYPES.SELF_EMPLOYED]: 'M4 9l1-5h14l1 5M4 9h16v11H4zM9 20v-6h6v6',
  [JOB_TYPES.FREELANCER]: 'M5 5h14v10H5zM2 19h20M10 15v4M14 15v4',
  [JOB_TYPES.EMPLOYEE]: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
}

export default function JobSelectPage() {
  const { user, updateUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fromDataInput = location.state?.from === FROM_DATA_INPUT
  // 다시 고르는 경우 지금 직군을 미리 골라 둔다.
  const [jobType, setJobType] = useState(user?.jobType ?? null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)

  // 저장 직후에는 로그인 상태의 직군도 함께 바뀌므로, 아래 '이미 직군 있음' 이동보다 먼저 확인한다.
  if (saved) return <Navigate to={DATA_INPUT_PATHS.DATA_INPUT} replace />
  if (isAdmin(user) || (user?.jobType && !fromDataInput)) return <Navigate to={getHomePath(user)} replace />

  // 데이터 입력으로 돌아간다([취소], 같은 직군을 다시 골랐을 때). 임시저장본은 그대로 남는다.
  const backToDataInput = () => navigate(DATA_INPUT_PATHS.DATA_INPUT, { replace: true })

  // 고른 직군을 저장한다. 성공하면 '저장됨'과 로그인 상태의 직군을 한 번에 바꿔 데이터 입력 화면으로 이동시킨다.
  // 같은 직군이면 저장하지 않고 돌아간다. 다른 직군으로 바꾸면 입력 항목이 달라지므로 이전 직군의 임시저장본을 지운다(새 직군은 1단계부터).
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!jobType) return
    if (jobType === user.jobType) {
      backToDataInput()
      return
    }
    setPending(true)
    setError('')
    try {
      const previousJobType = user.jobType
      const { user: updated } = await saveJobType(jobType)
      if (previousJobType) clearDraft(user.userId, previousJobType)
      setSaved(true)
      updateUser({ jobType: updated.jobType })
    } catch (saveError) {
      // 서버 오류(409 JOB_TYPE_ALREADY_SELECTED 등)도 서버 문구를 칸 아래에 그대로 보여 준다.
      setError(saveError.message)
      setPending(false)
    }
  }

  return (
    <section className="job-select-page fin-form">
      <JourneySteps current={1} />
      <h1 className="job-select-page__title">직군 선택</h1>
      <p className="job-select-page__message">
        직군에 따라 소득 입력 항목이 달라집니다. 지금 소득을 얻는 방식에 가장 가까운 직군을 골라 주세요.
      </p>
      <p className="job-select-page__message">입력을 저장하기 전까지만 직군을 바꿀 수 있습니다.</p>
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
              <svg className="job-select-form__icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={JOB_ICONS[option.value]} />
              </svg>
              <span className="job-select-form__text">
                {option.label}
                <small>{JOB_DESCRIPTIONS[option.value]}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <FieldError message={error} />
        <div className="l-row">
          <button type="submit" className="job-select-form__submit" disabled={!jobType || pending}>
            {pending ? '저장 중…' : '저장하고 계속하기'}
          </button>
          {fromDataInput && <Button onClick={backToDataInput}>취소</Button>}
        </div>
      </form>
    </section>
  )
}
