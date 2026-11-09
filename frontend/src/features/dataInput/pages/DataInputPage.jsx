import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { PATHS } from '../../../common/config/navigation.js'
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
import { fromServerFieldErrors } from '../validation/serverErrors.js'

// N-05 데이터 입력 화면 — 내 직군의 소득 섹션과 공통 섹션(부채·자산·월 고정 지출·할부·정기결제)을 설정대로 그리고,
// 기준월과 함께 저장한 뒤 입력 완료 현황을 보여 준다. 대안 데이터는 모의 연동으로 따로 불러온다.
// FP-86: 잘못된 값은 입력 즉시, 빈 필수 칸은 첫 저장 시도 뒤부터 칸 옆에 오류를 보여 주고, 오류가 있으면 저장 버튼을 막는다.
export default function DataInputPage() {
  const { user } = useAuth()
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
  const [savedBaseMonth, setSavedBaseMonth] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [calculateError, setCalculateError] = useState('')

  // 들어오면 저장된 입력과 완료 현황, 불러온 대안 데이터를 받아 화면을 채운다.
  useEffect(() => {
    let cancelled = false
    fetchFinancialInput()
      .then((result) => {
        if (cancelled) return
        if (result.input) {
          setValues(toValues(result.input, sections))
          setSavedAt(result.input.savedAt)
          setSavedBaseMonth(result.input.baseMonth)
        }
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
  // 이미 저장한 기준월로 다시 저장하려 하면 덮어쓴다고 알려 준다.
  const willOverwrite = savedBaseMonth !== null && savedBaseMonth === values.baseMonth && !justSaved

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
  const handleFieldChange = (sectionKey) => (fieldKey, fieldValue) =>
    change(
      (prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], [fieldKey]: fieldValue } }),
      errorKeyOf(sectionKey, fieldKey),
    )
  const handleListChange = (sectionKey) => (items) => change((prev) => ({ ...prev, [sectionKey]: items }), sectionKey)

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
      setSavedBaseMonth(values.baseMonth)
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

  // N-05-8 [점수 산출하기] — 마지막으로 저장한 입력으로 산출을 요청하고, 성공하면 신용 리포트로 보낸다.
  const handleCalculateScore = async () => {
    setCalculating(true)
    setCalculateError('')
    try {
      await requestScoreCalculation()
      navigate(PATHS.REPORT)
    } catch (error) {
      setCalculateError(error.message)
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
      <AltDataImport baseMonth={values.baseMonth} imported={altData} onImported={handleAltImported} />

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
