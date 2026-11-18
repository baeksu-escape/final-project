import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { PATHS } from '../../../common/config/navigation.js'
import { Button, Chip, ProgressBar } from '../../../common/components/index.js'
import { GRADE_STATUS, getNotScorableMessage } from '../../../common/config/scoreStatus.js'
import { fetchFinancialInput, requestScoreCalculation, saveFinancialInput } from '../api/dataInputApi.js'
import AltDataImport from '../components/AltDataImport.jsx'
import FieldControl from '../components/FieldControl.jsx'
import InputStatus from '../components/InputStatus.jsx'
import SectionFields from '../components/SectionFields.jsx'
import SectionList from '../components/SectionList.jsx'
import { isInputComplete } from '../config/completionItems.js'
import { BASE_MONTH_FIELD, getSectionsForJob } from '../config/inputSections.js'
import { INPUT_STEPS, LAST_INPUT_STEP, REVIEW_STEP, getStepIndexOfErrorKey } from '../config/inputSteps.js'
import { clearDraft, loadDraft, saveDraft } from '../utils/inputDraft.js'
import { buildPayload, createEmptyValues, toValues, withFixedMonthRows } from '../utils/inputValues.js'
import { createRequestId } from '../utils/requestId.js'
import { monthRule } from '../validation/inputRules.js'
import { errorKeyOf, getInputNotices, validateFinancialInput } from '../validation/inputValidation.js'
import { SCORE_ERROR_CODES, fromServerFieldErrors } from '../validation/serverErrors.js'
import '../dataInput.css'

// N-05-8 같은 requestId로 다시 보내도 되는 실패인지 본다 — 서버에 연결하지 못함(0)·시간 초과(408·504)·서버 오류(5xx).
// 이때는 서버가 요청을 처리했는지 모르므로 같은 값을 다시 보내 서버가 한 번만 계산하게 한다.
function isRetryableFailure(error) {
  return error?.status === 0 || error?.status === 408 || error?.status >= 500
}

// N-05 데이터 입력 화면 — 내 직군의 소득 섹션과 공통 섹션(부채·자산·월 고정 지출·할부·정기결제)을 설정대로 그리고,
// 기준월과 함께 저장한 뒤 입력 완료 현황을 보여 준다. 대안 데이터는 모의 연동으로 따로 불러온다.
// 카드를 단계(config/inputSteps.js)로 묶어 [이전]/[다음]으로 넘기고, 입력값은 브라우저에 임시저장한다(utils/inputDraft.js).
// 마지막 입력 단계의 [저장하고 다음]에서 서버에 저장하고, 마지막 단계에서 대안 데이터·완료 현황·점수 산출을 한다.
// FP-86: 잘못된 값은 입력 즉시, 빈 필수 칸은 그 단계에서 [다음]을 시도한 뒤부터 칸 옆에 오류를 보여 주고, 오류가 있으면 [다음] 버튼을 막는다.
export default function DataInputPage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const sections = useMemo(() => getSectionsForJob(user.jobType), [user.jobType])

  const [values, setValues] = useState(() => createEmptyValues(sections))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const [altData, setAltData] = useState({})
  const [step, setStep] = useState(0)
  // 빈 필수 칸 오류를 보여 줄 단계 번호들 — [다음]을 시도한 단계만 넣는다.
  const [attemptedSteps, setAttemptedSteps] = useState([])
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [savedBaseMonths, setSavedBaseMonths] = useState([])
  const [calculating, setCalculating] = useState(false)
  const [calculateError, setCalculateError] = useState('')
  // N-05-8 점수 산출 요청 번호 — 다시 보낼 때 같은 값을 쓰려고 화면이 들고 있는다. 처리 결과를 받으면 비운다.
  const requestIdRef = useRef(null)
  // 요청 중에 버튼을 빠르게 두 번 눌러도 한 번만 보내도록 막는 표시.
  const calculatingRef = useRef(false)

  // 들어오면 저장된 입력과 완료 현황, 불러온 대안 데이터를 받아 화면을 채운다.
  // 브라우저 임시저장본이 있으면 서버 저장본보다 나중에 고친 값이므로 입력값과 단계를 그걸로 채운다.
  useEffect(() => {
    let cancelled = false
    fetchFinancialInput()
      .then((result) => {
        if (cancelled) return
        const draft = loadDraft(user.jobType, sections)
        if (draft) {
          setValues(draft.values)
          setStep(draft.step)
        } else if (result.input) {
          setValues(toValues(result.input, sections))
        }
        if (result.input) setSavedAt(result.input.savedAt)
        setSavedBaseMonths(result.savedBaseMonths ?? [])
        setStatus(result.status)
        setAltData(result.altData ?? {})
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sections, user.jobType])

  // 입력값과 단계를 바뀔 때마다 브라우저에 임시저장한다. 불러오기 전에는 저장본을 덮어쓰지 않고, 입력 카드가 없는 마지막 단계에서는 저장하지 않는다.
  useEffect(() => {
    if (!loading && step < REVIEW_STEP) saveDraft(user.jobType, values, step)
  }, [loading, values, step, user.jobType])

  // 입력할 때마다 다시 검사한다. 빈 필수 칸 오류는 [다음]을 시도한 단계의 칸에만 넣고, 서버가 돌려준 칸 오류도 함께 보여 준다.
  const fullErrors = validateFinancialInput(values, sections)
  const errors = {
    ...validateFinancialInput(values, sections, { checkRequired: false }),
    ...Object.fromEntries(Object.entries(fullErrors).filter(([key]) => attemptedSteps.includes(getStepIndexOfErrorKey(key)))),
    ...serverErrors,
  }
  // 지금 단계의 카드(기준월은 0단계)에 있는 오류만 센다.
  const errorCount = Object.keys(errors).filter((key) => getStepIndexOfErrorKey(key) === step).length
  const stepSectionKeys = INPUT_STEPS[step].sectionKeys
  // N-05-7 오류가 아닌 안내(월별 소득의 남은 달 수). 지금 입력 중인 값으로 세고, 저장은 막지 않는다.
  const notices = getInputNotices(values, sections)
  // 이미 저장한 기준월로 다시 저장하려 하면 덮어쓴다고 알려 준다. 입력은 기준월별로 저장된다(D-16).
  const willOverwrite = savedBaseMonths.includes(values.baseMonth) && !justSaved

  // 고친 칸의 서버 오류만 지운다 — key가 errorKey와 같거나 'errorKey.'로 시작하는 오류(줄 섹션이면 그 섹션 전체)를 뺀다.
  const clearServerErrors = (errorKey) =>
    setServerErrors((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => key !== errorKey && !key.startsWith(`${errorKey}.`))),
    )

  // 값 하나가 바뀌면 화면 상태를 갱신하고 '저장됨' 안내와 그 칸의 서버 오류를 내린다.
  const change = (updater, errorKey) => {
    setValues(updater)
    setJustSaved(false)
    clearServerErrors(errorKey)
  }
  // 기준월·칸 섹션·줄 섹션의 값이 바뀔 때 부르는 함수들 — 바뀐 부분만 새 값으로 바꾼다.
  // N-05-2 기준월이 바뀌면(형식이 맞고 미래가 아닐 때) 월별 소득 12줄을 새 기준월에 맞춘다. 줄이 바뀌므로 서버 칸 오류는 모두 지운다.
  const handleBaseMonthChange = (baseMonth) => {
    change((prev) => {
      const next = { ...prev, baseMonth }
      return monthRule(baseMonth) ? next : withFixedMonthRows(next, sections)
    }, BASE_MONTH_FIELD.key)
    setServerErrors({})
  }
  // 칸 섹션은 칸 하나만, 줄 섹션은 목록 전체를 새 값으로 바꾼다.
  const handleFieldChange = (sectionKey) => (fieldKey, fieldValue) =>
    change(
      (prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], [fieldKey]: fieldValue } }),
      errorKeyOf(sectionKey, fieldKey),
    )
  const handleListChange = (sectionKey) => (items) => change((prev) => ({ ...prev, [sectionKey]: items }), sectionKey)
  // N-05-8 "대출 없음" 체크 — 체크하면 입력해 둔 줄을 비운다.
  const handleNoItemsChange = (sectionKey) => (checked) =>
    change(
      (prev) => ({ ...prev, noItems: { ...prev.noItems, [sectionKey]: checked }, [sectionKey]: checked ? [] : prev[sectionKey] }),
      sectionKey,
    )

  // 단계를 바꾸고 화면 맨 위로 올린다.
  const goToStep = (nextStep) => {
    setStep(nextStep)
    window.scrollTo(0, 0)
  }

  // [이전] — 검사 없이 앞 단계로 돌아간다. 입력값은 임시저장되어 있다.
  const handlePrev = () => {
    setFormError('')
    goToStep(step - 1)
  }

  // [다음]·[저장하고 다음] — 지금 단계의 오류가 없으면 다음 단계로 넘긴다. 임시저장은 값이 바뀔 때마다 이미 되어 있다.
  // 마지막 입력 단계에서는 모든 단계를 검사해 오류가 있는 가장 앞 단계로 돌아가고, 통과하면 요청 본문(모든 섹션에 기준월)을 서버에 저장한 뒤 마지막 단계로 간다.
  // 서버가 400과 칸별 오류(fieldErrors)를 주면 해당 칸이 있는 단계로 돌아가 칸 옆에 보여 주고, 칸을 찾지 못한 오류는 폼 아래 문구에 붙인다.
  // TODO(D-20) { code, message, fieldErrors }는 팀 공통 형식이 정해지지 않은 임시 형식이다.
  const handleNext = async (event) => {
    event.preventDefault()
    setFormError('')
    const checkedSteps = step < LAST_INPUT_STEP ? [step] : Array.from({ length: LAST_INPUT_STEP + 1 }, (_, index) => index)
    setAttemptedSteps((prev) => [...new Set([...prev, ...checkedSteps])])
    const errorSteps = Object.keys({ ...fullErrors, ...serverErrors })
      .map(getStepIndexOfErrorKey)
      .filter((index) => checkedSteps.includes(index))
    if (errorSteps.length > 0) {
      goToStep(Math.min(...errorSteps))
      return
    }
    if (step < LAST_INPUT_STEP) {
      goToStep(step + 1)
      return
    }

    setPending(true)
    try {
      const result = await saveFinancialInput(buildPayload(values, sections, user.jobType))
      setStatus(result.status)
      setSavedAt(result.savedAt)
      setSavedBaseMonths(result.savedBaseMonths ?? [])
      setServerErrors({})
      setJustSaved(true)
      clearDraft(user.jobType)
      goToStep(REVIEW_STEP)
    } catch (error) {
      const { errors: fieldErrors, unmatched } = fromServerFieldErrors(error.data?.fieldErrors, values)
      setServerErrors(fieldErrors)
      setFormError([error.message, ...unmatched].join(' '))
      const errorKeys = Object.keys(fieldErrors)
      if (errorKeys.length > 0) goToStep(Math.min(...errorKeys.map(getStepIndexOfErrorKey)))
    } finally {
      setPending(false)
    }
  }

  // 대안 데이터를 불러오면 표 데이터와 완료 현황을 함께 바꾼다.
  const handleAltImported = (sourceKey, result) => {
    setAltData((prev) => ({ ...prev, [sourceKey]: result }))
    setStatus((prev) => (prev ? { ...prev, altData: { ...prev.altData, [sourceKey]: true } } : prev))
  }

  // N-05-9 [연결 해제]하면 서버가 그 동의로 불러온 데이터를 지우므로, 화면에서도 표 데이터를 지우고 완료 현황을 미완료로 바꾼다.
  const handleAltDisconnected = (sourceKey) => {
    setAltData((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== sourceKey)))
    setStatus((prev) => (prev ? { ...prev, altData: { ...prev.altData, [sourceKey]: false } } : prev))
  }

  // N-05-8 [점수 산출하기] — 마지막으로 저장한 입력으로 산출을 요청한다(RPT-01). 점수·등급은 화면에서 계산하지 않는다.
  // - requestId: 처음 누를 때 소문자 UUID를 만들고, 네트워크 오류·시간 초과로 다시 누르면 같은 값을 보낸다. 처리 결과를 받으면 비운다.
  // - SCORED면 신용 리포트로, NOT_SCORABLE이면 입력 화면에 머물며 사유별 안내를 보여 준다.
  // - 409 JOB_TYPE_REQUIRED는 직군 선택으로 보내고, REQUEST_ID_CONFLICT는 새 requestId를 만든다. 그 밖의 409(입력 미완료)는 서버 문구를 보여 준다.
  const handleCalculateScore = async () => {
    if (calculatingRef.current) return
    calculatingRef.current = true
    setCalculating(true)
    setCalculateError('')
    try {
      if (!requestIdRef.current) requestIdRef.current = createRequestId()
      const result = await requestScoreCalculation(requestIdRef.current)
      requestIdRef.current = null
      if (result.gradeStatusCode === GRADE_STATUS.SCORED) {
        updateUser({ hasScore: true })
        navigate(PATHS.REPORT)
        return
      }
      setCalculateError(getNotScorableMessage(result.notScorableReasonCode))
    } catch (error) {
      if (isRetryableFailure(error)) {
        setCalculateError(error.message)
        return
      }
      requestIdRef.current = null
      const code = error.data?.code
      if (code === SCORE_ERROR_CODES.JOB_TYPE_REQUIRED) {
        // 직군 선택 화면은 직군이 있는 사용자를 첫 화면으로 돌려보내므로, 화면의 직군 정보도 비운 뒤 이동한다.
        updateUser({ jobType: null })
        navigate(PATHS.SELECT_JOB)
        return
      }
      if (code === SCORE_ERROR_CODES.REQUEST_ID_CONFLICT) {
        requestIdRef.current = createRequestId()
        setCalculateError('다시 시도해 주세요.')
        return
      }
      setCalculateError(error.message)
    } finally {
      calculatingRef.current = false
      setCalculating(false)
    }
  }

  if (loading) return <p className="data-input-page__loading">저장된 입력을 불러오는 중입니다.</p>

  return (
    <section className="data-input-page">
      <h1 className="data-input-page__title">데이터 입력</h1>
      <p className="data-input-page__job">직군: {JOB_TYPE_LABELS[user.jobType]}</p>
      {loadError && (
        <p className="data-input-page__error" role="alert">
          저장된 입력을 불러오지 못했습니다. ({loadError})
        </p>
      )}

      {/* 단계 표시 — 현재 단계는 강조 칩, 아래 막대는 진행 정도 */}
      <div role="group" aria-label="입력 단계">
        {INPUT_STEPS.map((inputStep, index) => (
          <Chip key={inputStep.key} accent={index === step}>
            {index + 1}. {inputStep.title}
          </Chip>
        ))}
        <ProgressBar label="입력 단계 진행" value={step + 1} max={INPUT_STEPS.length} />
      </div>

      {step < REVIEW_STEP && (
        <form className="data-input-form" onSubmit={handleNext} noValidate>
          {sections
            .filter((section) => stepSectionKeys.includes(section.key))
            .map((section) => {
              // N-05-2 기준월은 소득 카드 안에서 입력한다.
              const headerSlot =
                section.key === 'income' ? (
                  <FieldControl
                    field={BASE_MONTH_FIELD}
                    value={values.baseMonth}
                    onChange={handleBaseMonthChange}
                    error={errors[BASE_MONTH_FIELD.key]}
                  />
                ) : null
              return section.kind === 'list' ? (
                <SectionList
                  key={section.key}
                  section={section}
                  items={values[section.key]}
                  onChange={handleListChange(section.key)}
                  noItems={values.noItems[section.key]}
                  onNoItemsChange={handleNoItemsChange(section.key)}
                  errors={errors}
                  headerSlot={headerSlot}
                />
              ) : (
                <SectionFields
                  key={section.key}
                  section={section}
                  value={values[section.key]}
                  onFieldChange={handleFieldChange(section.key)}
                  errors={errors}
                  headerSlot={headerSlot}
                />
              )
            })}
          {errorCount > 0 && (
            <p className="data-input-form__error-summary" role="alert">
              고쳐야 할 항목이 {errorCount}개 있습니다. 모두 고치면 다음 단계로 넘어갈 수 있습니다.
            </p>
          )}
          {formError && (
            <p className="data-input-form__error" role="alert">
              {formError}
            </p>
          )}
          {step === LAST_INPUT_STEP && willOverwrite && (
            <p className="data-input-form__overwrite-notice" role="status">
              기준월 {values.baseMonth}에 저장한 입력이 있습니다. 지금 저장하면 기존 입력을 덮어씁니다.
            </p>
          )}
          <div>
            {step > 0 && <Button onClick={handlePrev}>이전</Button>}
            <Button variant="primary" type="submit" disabled={pending || errorCount > 0}>
              {step === LAST_INPUT_STEP ? (pending ? '저장 중…' : '저장하고 다음') : '다음'}
            </Button>
          </div>
        </form>
      )}

      {step === REVIEW_STEP && (
        <>
          {justSaved && (
            <p className="data-input-form__saved" role="status">
              저장되었습니다.
            </p>
          )}
          <InputStatus status={status} savedAt={savedAt} notices={notices} />
          <AltDataImport
            baseMonth={values.baseMonth}
            imported={altData}
            onImported={handleAltImported}
            onDisconnected={handleAltDisconnected}
          />

          <button
            type="button"
            className="data-input-page__calculate"
            onClick={handleCalculateScore}
            disabled={calculating || !isInputComplete(status)}
          >
            {calculating ? '산출 중…' : '점수 산출하기'}
          </button>
          {calculateError && (
            <p className="data-input-page__calculate-error" role="alert">
              {calculateError}
            </p>
          )}

          <div>
            <Button onClick={handlePrev}>이전</Button>
          </div>
          <Link to={PATHS.REPORT} className="data-input-page__next-link">
            신용 리포트로 이동
          </Link>
        </>
      )}
    </section>
  )
}
