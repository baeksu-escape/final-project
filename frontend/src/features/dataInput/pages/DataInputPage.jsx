import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { PATHS } from '../../../common/config/navigation.js'
import { GRADE_STATUS, getNotScorableMessage } from '../../../common/config/scoreStatus.js'
import { fetchFinancialInput, requestScoreCalculation, saveFinancialInput } from '../api/dataInputApi.js'
import AltDataImport from '../components/AltDataImport.jsx'
import FieldControl from '../components/FieldControl.jsx'
import InputStatus from '../components/InputStatus.jsx'
import SectionFields from '../components/SectionFields.jsx'
import SectionList from '../components/SectionList.jsx'
import { isInputComplete } from '../config/completionItems.js'
import { BASE_MONTH_FIELD, getSectionsForJob } from '../config/inputSections.js'
import { buildPayload, createEmptyValues, toValues, withFixedMonthRows } from '../utils/inputValues.js'
import { monthRule } from '../validation/inputRules.js'
import { errorKeyOf, getInputNotices, validateFinancialInput } from '../validation/inputValidation.js'
import { SCORE_ERROR_CODES, fromServerFieldErrors } from '../validation/serverErrors.js'

// N-05-8 같은 requestId로 다시 보내도 되는 실패인지 본다 — 서버에 연결하지 못함(0)·시간 초과(408·504)·서버 오류(5xx).
// 이때는 서버가 요청을 처리했는지 모르므로 같은 값을 다시 보내 서버가 한 번만 계산하게 한다.
function isRetryableFailure(error) {
  return error?.status === 0 || error?.status === 408 || error?.status >= 500
}

// N-05 데이터 입력 화면 — 내 직군의 소득 섹션과 공통 섹션(부채·자산·월 고정 지출·할부·정기결제)을 설정대로 그리고,
// 기준월과 함께 저장한 뒤 입력 완료 현황을 보여 준다. 대안 데이터는 모의 연동으로 따로 불러온다.
// FP-86: 잘못된 값은 입력 즉시, 빈 필수 칸은 첫 저장 시도 뒤부터 칸 옆에 오류를 보여 주고, 오류가 있으면 저장 버튼을 막는다.
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
  const [submitted, setSubmitted] = useState(false)
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
  useEffect(() => {
    let cancelled = false
    fetchFinancialInput()
      .then((result) => {
        if (cancelled) return
        if (result.input) {
          setValues(toValues(result.input, sections))
          setSavedAt(result.input.savedAt)
        }
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
  }, [sections])

  // 입력할 때마다 다시 검사한다. 빈 필수 칸 오류는 처음 저장을 시도한 뒤부터 넣고, 서버가 돌려준 칸 오류도 함께 보여 준다.
  const errors = { ...validateFinancialInput(values, sections, { checkRequired: submitted }), ...serverErrors }
  const errorCount = Object.keys(errors).length
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

  // 저장 — 검사를 통과하면 요청 본문(모든 섹션에 기준월)을 보내고, 응답의 완료 현황으로 화면을 바꾼다.
  // 서버가 400과 칸별 오류(fieldErrors)를 주면 해당 칸 옆에 보여 주고, 칸을 찾지 못한 오류는 폼 아래 문구에 붙인다.
  // TODO(D-20) { code, message, fieldErrors }는 팀 공통 형식이 정해지지 않은 임시 형식이다.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFormError('')
    if (Object.keys({ ...validateFinancialInput(values, sections), ...serverErrors }).length > 0) return

    setPending(true)
    try {
      const result = await saveFinancialInput(buildPayload(values, sections, user.jobType))
      setStatus(result.status)
      setSavedAt(result.savedAt)
      setSavedBaseMonths(result.savedBaseMonths ?? [])
      setServerErrors({})
      setJustSaved(true)
    } catch (error) {
      const { errors: fieldErrors, unmatched } = fromServerFieldErrors(error.data?.fieldErrors, values)
      setServerErrors(fieldErrors)
      setFormError([error.message, ...unmatched].join(' '))
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
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID()
    try {
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
        requestIdRef.current = crypto.randomUUID()
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

      <form className="data-input-form" onSubmit={handleSubmit} noValidate>
        <FieldControl
          field={BASE_MONTH_FIELD}
          value={values.baseMonth}
          onChange={handleBaseMonthChange}
          error={errors[BASE_MONTH_FIELD.key]}
        />
        {sections.map((section) =>
          section.kind === 'list' ? (
            <SectionList
              key={section.key}
              section={section}
              items={values[section.key]}
              onChange={handleListChange(section.key)}
              noItems={values.noItems[section.key]}
              onNoItemsChange={handleNoItemsChange(section.key)}
              errors={errors}
            />
          ) : (
            <SectionFields
              key={section.key}
              section={section}
              value={values[section.key]}
              onFieldChange={handleFieldChange(section.key)}
              errors={errors}
            />
          ),
        )}
        {errorCount > 0 && (
          <p className="data-input-form__error-summary" role="alert">
            고쳐야 할 항목이 {errorCount}개 있습니다. 모두 고치면 저장할 수 있습니다.
          </p>
        )}
        {formError && (
          <p className="data-input-form__error" role="alert">
            {formError}
          </p>
        )}
        {willOverwrite && (
          <p className="data-input-form__overwrite-notice" role="status">
            기준월 {values.baseMonth}에 저장한 입력이 있습니다. 지금 저장하면 기존 입력을 덮어씁니다.
          </p>
        )}
        <button type="submit" className="data-input-form__submit" disabled={pending || errorCount > 0}>
          {pending ? '저장 중…' : '저장하기'}
        </button>
        {justSaved && (
          <p className="data-input-form__saved" role="status">
            저장되었습니다.
          </p>
        )}
      </form>

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

      <Link to={PATHS.REPORT} className="data-input-page__next-link">
        신용 리포트로 이동
      </Link>
    </section>
  )
}
