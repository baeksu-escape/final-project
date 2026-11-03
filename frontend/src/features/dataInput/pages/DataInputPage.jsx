import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { PATHS } from '../../../common/config/navigation.js'
import { fetchFinancialInput, saveFinancialInput } from '../api/dataInputApi.js'
import AltDataImport from '../components/AltDataImport.jsx'
import FieldControl from '../components/FieldControl.jsx'
import InputStatus from '../components/InputStatus.jsx'
import SectionFields from '../components/SectionFields.jsx'
import SectionList from '../components/SectionList.jsx'
import { BASE_MONTH_FIELD, getSectionsForJob } from '../config/inputSections.js'
import { buildPayload, createEmptyValues, toValues } from '../utils/inputValues.js'
import { validateFinancialInput } from '../validation/inputValidation.js'

// N-05 데이터 입력 화면 — 내 직군의 소득 섹션과 공통 섹션(부채·자산·고정지출·기타 지출)을 설정대로 그리고,
// 기준월과 함께 저장한 뒤 입력 완료 현황을 보여 준다. 대안 데이터는 모의 연동으로 따로 불러온다.
export default function DataInputPage() {
  const { user } = useAuth()
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

  // 처음 저장을 시도한 뒤부터는 입력할 때마다 다시 검사한다.
  const errors = submitted ? validateFinancialInput(values, sections) : {}
  const errorCount = Object.keys(errors).length

  // 값 하나가 바뀌면 화면 상태를 갱신하고 '저장됨' 안내를 내린다.
  const change = (updater) => {
    setValues(updater)
    setJustSaved(false)
  }
  const handleBaseMonthChange = (baseMonth) => change((prev) => ({ ...prev, baseMonth }))
  const handleFieldChange = (sectionKey) => (fieldKey, fieldValue) =>
    change((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], [fieldKey]: fieldValue } }))
  const handleListChange = (sectionKey) => (items) => change((prev) => ({ ...prev, [sectionKey]: items }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFormError('')
    if (Object.keys(validateFinancialInput(values, sections)).length > 0) return

    setPending(true)
    try {
      const result = await saveFinancialInput(buildPayload(values, sections, user.jobType))
      setStatus(result.status)
      setSavedAt(result.savedAt)
      setJustSaved(true)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setPending(false)
    }
  }

  // 대안 데이터를 불러오면 표 데이터와 완료 현황을 함께 바꾼다.
  const handleAltImported = (sourceKey, result) => {
    setAltData((prev) => ({ ...prev, [sourceKey]: result }))
    setStatus((prev) => (prev ? { ...prev, altData: { ...prev.altData, [sourceKey]: true } } : prev))
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
            입력하지 않은 필수 항목이 {errorCount}개 있습니다.
          </p>
        )}
        {formError && (
          <p className="data-input-form__error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="data-input-form__submit" disabled={pending}>
          {pending ? '저장 중…' : '저장하기'}
        </button>
        {justSaved && (
          <p className="data-input-form__saved" role="status">
            저장되었습니다.
          </p>
        )}
      </form>

      <InputStatus sections={sections} status={status} savedAt={savedAt} />
      <AltDataImport baseMonth={values.baseMonth} imported={altData} onImported={handleAltImported} />

      <Link to={PATHS.REPORT} className="data-input-page__next-link">
        신용 리포트로 이동
      </Link>
    </section>
  )
}
