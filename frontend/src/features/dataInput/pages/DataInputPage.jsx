import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { PATHS } from '../../../common/config/navigation.js'
import { Button, Card, Notice } from '../../../common/components/index.js'
import { GRADE_STATUS, getNotScorableMessage } from '../../../common/config/scoreStatus.js'
import { fetchFinancialInput, requestScoreCalculation, saveFinancialInput } from '../api/dataInputApi.js'
import AltDataImport from '../components/AltDataImport.jsx'
import FieldControl from '../components/FieldControl.jsx'
import InputStatus from '../components/InputStatus.jsx'
import SectionFields from '../components/SectionFields.jsx'
import SectionList from '../components/SectionList.jsx'
import { areInputSectionsComplete, getAltDataItem, isInputComplete } from '../config/completionItems.js'
import { BASE_MONTH_FIELD, getSectionsForJob } from '../config/inputSections.js'
import {
  ALT_DATA_STEP,
  INPUT_STEPS,
  LAST_INPUT_STEP,
  SCORE_STEP,
  SCORE_STEP_TITLE,
  canJumpToStep,
  getStepDoneList,
  getStepIndexOfErrorKey,
  getStepTitle,
} from '../config/inputSteps.js'
import { FROM_DATA_INPUT } from '../dataInputPaths.js'
import { clearDraft, loadDraft, saveDraft } from '../utils/inputDraft.js'
import { buildPayload, createEmptyValues, toValues, withFixedMonthRows, withMinimumRows } from '../utils/inputValues.js'
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

// 입력값을 비교용 문자열로 바꾼다 — 줄마다 화면에서 붙인 id는 뺀다.
function toComparable(values) {
  return JSON.stringify(values, (key, value) => (key === 'id' ? undefined : value))
}

// N-05 데이터 입력 화면 —내 직군의 소득 섹션과 공통 섹션(부채·자산·월 고정 지출·할부·정기결제)을 설정대로 그리고,
// 기준월과 함께 저장한 뒤 입력 완료 현황을 보여 준다. 대안 데이터는 모의 연동으로 따로 불러온다.
// FP-227 카드를 7단계(config/inputSteps.js)로 나눠 [이전]/[다음]으로 넘기고, 입력값은 브라우저에 임시저장한다(utils/inputDraft.js).
// 5단계의 [저장하기]에서 서버에 저장하고, 6단계에서 대안 데이터를 불러오고, 7단계에서 점수를 산출한다.
// 입력 완료 현황은 develop 화면처럼 모든 단계에서 오른쪽 열 같은 자리에 둔다(왼쪽 열 내용만 단계마다 바뀐다).
// FP-86: 잘못된 값은 입력 즉시, 빈 필수 칸은 그 단계에서 [다음]을 시도한 뒤부터 칸 옆에 오류를 보여 주고, 오류가 있으면 [다음] 버튼을 막는다.
export default function DataInputPage() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const sections = useMemo(() => getSectionsForJob(user.jobType), [user.jobType])

  const [values, setRawValues] = useState(() => withMinimumRows(createEmptyValues(sections), sections))
  // FP-227 화면 값은 늘 이 함수로 바꾼다 — 처음 값·서버 저장본·임시저장본·[삭제]·체크 해제가 모두 withMinimumRows를 지나,
  // "보유한 대출이 없습니다."를 체크하지 않았으면 대출 줄이 최소 1개 남는다. 값 또는 (이전 값 => 새 값) 함수를 받는다.
  const setValues = useCallback(
    (next) => setRawValues((prev) => withMinimumRows(typeof next === 'function' ? next(prev) : next, sections)),
    [sections],
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [status, setStatus] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  // 서버에 저장된 입력(없으면 null) — [처음 값으로]에서 되돌릴 값이다.
  const [serverInput, setServerInput] = useState(null)
  // 임시저장본으로 화면을 채웠고 그 값이 서버 값(없으면 빈 값)과 다를 때 true — 입력 카드 위에 이어서 보여 준다는 안내를 띄운다.
  const [draftRestored, setDraftRestored] = useState(false)
  const [altData, setAltData] = useState({})
  const [step, setStep] = useState(0)
  // 빈 필수 칸 오류를 보여 줄 단계 번호들 — [다음]을 시도한 단계만 넣는다.
  const [attemptedSteps, setAttemptedSteps] = useState([])
  // FP-227 [다음] 검사를 통과한 단계 번호들(1~4단계) — 입력 완료 현황의 초록 동그라미에 쓰고, 임시저장본에 함께 남긴다.
  const [passedSteps, setPassedSteps] = useState([])
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
  // 단계를 사용자가 바꿨을 때만 새 단계 제목으로 포커스를 옮기려는 표시(처음 불러올 때는 옮기지 않는다).
  const focusStepRef = useRef(false)

  // 들어오면 저장된 입력과 완료 현황, 불러온 대안 데이터를 받아 화면을 채운다.
  // 브라우저 임시저장본이 있으면 서버 저장본보다 나중에 고친 값이므로 입력값과 단계를 그걸로 채운다.
  // FP-227: 임시저장본은 이 회원 것만 보고, 임시저장할 때의 서버 저장 시각이 지금과 다르면(다른 탭에서 저장 등) 버리고 서버 값을 쓴다.
  useEffect(() => {
    let cancelled = false
    fetchFinancialInput()
      .then((result) => {
        if (cancelled) return
        const serverValues = withMinimumRows(result.input ? toValues(result.input, sections) : createEmptyValues(sections), sections)
        const storedDraft = loadDraft(user.userId, user.jobType, sections, result.input?.savedAt ?? null)
        // 서버 값(없으면 빈 값)과 같은 임시저장본은 이어서 보여 줄 것이 없으므로 지우고 없는 것으로 본다(들어오기만 해도 자동 임시저장되기 때문).
        // 줄 id는 화면에서 새로 만들어 붙이므로 비교에서 빼고, 임시저장본도 같은 최소 줄 규칙을 지난 값으로 비교한다(FP-227 빈 대출 줄).
        const draft =
          storedDraft && toComparable(withMinimumRows(storedDraft.values, sections)) !== toComparable(serverValues) ? storedDraft : null
        if (storedDraft && !draft) clearDraft(user.userId, user.jobType)
        setServerInput(result.input ?? null)
        if (draft) {
          setValues(draft.values)
          setStep(draft.step)
          setPassedSteps(draft.passedSteps)
          setDraftRestored(true)
        } else {
          if (result.input) setValues(serverValues)
          // FP-227(사람 결정 B, 7단계) 대안 데이터까지 모두 마친 회원은 점수 산출 단계, 입력 섹션 5개만 마친 회원은 대안 데이터 단계부터 시작한다.
          if (isInputComplete(result.status, user.jobType)) setStep(SCORE_STEP)
          else if (areInputSectionsComplete(result.status)) setStep(ALT_DATA_STEP)
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
  }, [sections, setValues, user.jobType, user.userId])

  // 입력값과 단계를 바뀔 때마다 브라우저에 임시저장한다. 불러오기 전에는 저장본을 덮어쓰지 않고, 입력 카드가 없는 6·7단계에서는 저장하지 않는다.
  // 그 시점의 서버 저장 시각(savedAt)을 함께 넣어, 나중에 서버 저장본이 바뀌었는지 알아볼 수 있게 한다.
  useEffect(() => {
    if (!loading && step <= LAST_INPUT_STEP) saveDraft(user.userId, user.jobType, values, step, savedAt, passedSteps)
  }, [loading, values, step, savedAt, passedSteps, user.jobType, user.userId])

  // 단계가 바뀌면 키보드·화면 낭독기 포커스를 왼쪽 열의 첫 제목(카드 제목 또는 대안 데이터 제목)으로 옮긴다. 화면은 goToStep이 이미 맨 위로 올렸다.
  // 오른쪽 입력 완료 현황의 제목으로 가지 않도록 왼쪽 열(.data-input-form) 안에서만 찾는다.
  useEffect(() => {
    if (!focusStepRef.current) return
    focusStepRef.current = false
    const heading = document.querySelector(
      '.data-input-page > .data-input-form .card__title, .data-input-page > .data-input-form .alt-data__title',
    )
    if (!heading) return
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }, [step])

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

  // FP-227 입력 완료 현황(단계 리모컨)의 줄 7개 — 완료 여부는 통과한 단계·서버 저장 여부·지금 값의 오류·서버 status로 정한다.
  const saved = savedAt !== null
  const errorSteps = [...new Set(Object.keys({ ...fullErrors, ...serverErrors }).map(getStepIndexOfErrorKey))]
  const altDataItem = getAltDataItem(status)
  const stepDone = getStepDoneList({ passedSteps, saved, errorSteps, altDataDone: altDataItem.done })
  const statusSteps = INPUT_STEPS.map((inputStep, index) => ({
    key: inputStep.key,
    title: getStepTitle(inputStep, sections),
    done: stepDone[index],
    canJump: canJumpToStep(index, step, stepDone, saved),
    // 줄 옆 안내 — 소득 단계는 월별 소득의 남은 달 수(N-05-7), 대안 데이터 단계는 미완료일 때 불러온 종류 수.
    hint: inputStep.sectionKeys.includes('income')
      ? notices.income
      : index === ALT_DATA_STEP && !altDataItem.done
        ? altDataItem.hint
        : '',
  }))
  // 서버 저장 전에 [다음]으로 통과한 단계가 있으면 그 단계까지 임시저장되었다고 알린다(값은 바뀔 때마다 임시저장된다).
  const draftNotice =
    !saved && passedSteps.length > 0
      ? `임시 저장됨: ${Math.max(...passedSteps) + 1}단계까지 (${LAST_INPUT_STEP + 1}단계 [저장하기] 전)`
      : ''

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
  // N-05-8 "대출 없음" 체크 — FP-227부터 입력해 둔 줄은 지우지 않고 보관한다. 체크하면 줄이 잠기고, 풀면 그 값이 다시 보인다.
  // 잠긴 줄은 검사하지 않고 요청 본문에도 넣지 않는다(validateFinancialInput·buildPayload).
  const handleNoItemsChange = (sectionKey) => (checked) =>
    change((prev) => ({ ...prev, noItems: { ...prev.noItems, [sectionKey]: checked } }), sectionKey)

  // 단계를 바꾸고 화면 맨 위로 올린다. 포커스는 위 effect가 새 단계 제목으로 옮긴다.
  const goToStep = (nextStep) => {
    focusStepRef.current = true
    setStep(nextStep)
    window.scrollTo(0, 0)
  }

  // FP-227 [처음 값으로] — 임시저장본을 지우고 서버 저장본(없으면 빈 값)으로 되돌린 뒤 첫 단계로 간다.
  const handleResetDraft = () => {
    clearDraft(user.userId, user.jobType)
    setValues(serverInput ? toValues(serverInput, sections) : createEmptyValues(sections))
    setDraftRestored(false)
    setAttemptedSteps([])
    setPassedSteps([])
    setServerErrors({})
    setFormError('')
    setJustSaved(false)
    goToStep(0)
  }

  // FP-227 입력 완료 현황의 줄을 눌러 단계를 옮긴다. 누를 수 있는지는 canJumpToStep이 정한다(뒤 단계는 앞 단계가 모두 완료일 때만, 6·7단계는 저장 후).
  // 옮길 때는 검사하지 않는다. 지금 단계에 쓰던 값은 임시저장되어 남는다.
  const handleStepJump = (index) => {
    setFormError('')
    goToStep(index)
  }

  // [이전] — 검사 없이 앞 단계로 돌아간다. 입력값은 임시저장되어 있다.
  const handlePrev = () => {
    setFormError('')
    goToStep(step - 1)
  }

  // FP-227 1단계 [이전] — 서버에 저장한 입력이 없을 때만 보이고, 직군 선택 화면으로 가서 직군을 다시 고르게 한다(MEM-05 저장 전 변경).
  const handleBackToJobSelect = () => navigate(PATHS.SELECT_JOB, { state: { from: FROM_DATA_INPUT } })

  // 1~4단계 [다음]·5단계 [저장하기] — 지금 단계의 오류가 없으면 다음 단계로 넘긴다. 임시저장은 값이 바뀔 때마다 이미 되어 있다.
  // 5단계에서는 1~5단계를 모두 검사해 오류가 있는 가장 앞 단계로 돌아가고, 통과하면 요청 본문(모든 섹션에 기준월)을 서버에 저장한 뒤 6단계(대안 데이터)로 간다.
  // 서버가 400과 칸별 오류(fieldErrors)를 주면 해당 칸이 있는 단계로 돌아가 칸 옆에 보여 주고, 칸을 찾지 못한 오류는 폼 아래 문구에 붙인다.
  // { code, message, fieldErrors }는 팀 공통 오류 형식이다(D-20 확정, FP-87).
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
      setPassedSteps((prev) => (prev.includes(step) ? prev : [...prev, step]))
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
      clearDraft(user.userId, user.jobType)
      setDraftRestored(false)
      goToStep(ALT_DATA_STEP)
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

  // 6단계 [다음] — 대안 데이터를 다 불러오지 않아도 7단계로 간다. [점수 산출하기]는 입력 완료 현황이 모두 완료일 때만 켜진다.
  const handleAltDataNext = () => goToStep(SCORE_STEP)

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

      {/* 왼쪽 열 — 단계마다 내용만 바뀐다. 1~5단계는 입력 폼, 6·7단계는 같은 왼쪽 열 클래스(data-input-form)를 쓴 묶음이다. */}
      {step <= LAST_INPUT_STEP && (
        <form className="data-input-form" onSubmit={handleNext} noValidate>
          {/* FP-227 임시저장본으로 채운 경우 안내와 [처음 값으로] */}
          {draftRestored && (
            <Notice>
              저장하지 않은 입력을 이어서 보여 줍니다. <Button size="sm" onClick={handleResetDraft}>처음 값으로</Button>
            </Notice>
          )}
          {/* FP-227 처음 쓰는 사람 안내 — 저장된 입력도 임시저장본도 없을 때 첫 단계에서만 */}
          {!serverInput && !draftRestored && step === 0 && (
            <Notice>
              {INPUT_STEPS.length}단계로 나눠 입력합니다. 입력값은 이 탭에 임시로 보관되고, {LAST_INPUT_STEP + 1}단계에서 [저장하기]를 누르면
              저장됩니다.
            </Notice>
          )}
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
          {/* FP-227 버튼 줄 — 왼쪽 입력 열 안에서 [이전]은 왼쪽 끝, 주 버튼([다음]·[저장하기])은 오른쪽 끝. [이전]이 없어도 주 버튼은 오른쪽이다. */}
          <div className="data-input-form__actions">
            <div className="data-input-form__actions-start">
              {step > 0 && <Button onClick={handlePrev}>이전</Button>}
              {step === 0 && !saved && <Button onClick={handleBackToJobSelect}>이전</Button>}
            </div>
            <div className="data-input-form__actions-end">
              <Button variant="primary" type="submit" disabled={pending || errorCount > 0}>
                {step === LAST_INPUT_STEP ? (pending ? '저장 중…' : '저장하기') : '다음'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* 6단계 — 대안 데이터 불러오기. 저장 직후면 위쪽에 "저장되었습니다."를 보여 준다. */}
      {step === ALT_DATA_STEP && (
        <div className="data-input-form">
          {justSaved && (
            <p className="data-input-form__saved" role="status">
              저장되었습니다.
            </p>
          )}
          <AltDataImport
            baseMonth={values.baseMonth}
            imported={altData}
            onImported={handleAltImported}
            onDisconnected={handleAltDisconnected}
          />
          <div className="data-input-form__actions">
            <div className="data-input-form__actions-start">
              <Button onClick={handlePrev}>이전</Button>
            </div>
            <div className="data-input-form__actions-end">
              <Button variant="primary" onClick={handleAltDataNext}>
                다음
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 7단계 — 점수 산출. [점수 산출하기]는 입력 완료 현황 6개가 모두 완료일 때만 켜진다. */}
      {step === SCORE_STEP && (
        <div className="data-input-form">
          <Card title={SCORE_STEP_TITLE}>
            <p className="hint">
              오른쪽 입력 완료 현황이 모두 완료되면 점수를 산출할 수 있습니다. 점수는 마지막으로 저장한 입력으로 계산합니다.
            </p>
          </Card>
          {calculateError && (
            <p className="data-input-page__calculate-error" role="alert">
              {calculateError}
            </p>
          )}
          {/* 7단계 버튼 줄 — [이전] 왼쪽 끝, [처음으로 돌아가기]·[점수 산출하기](주 버튼)는 오른쪽 끝. */}
          {/* FP-260 멘토링 13 [신용 리포트로 이동] 대신 1단계로 돌아가는 보조 버튼을 둔다(직군 선택 화면으로는 보내지 않는다). */}
          <div className="data-input-form__actions">
            <div className="data-input-form__actions-start">
              <Button onClick={handlePrev}>이전</Button>
            </div>
            <div className="data-input-form__actions-end">
              <Button variant="weak" onClick={() => goToStep(0)}>
                처음으로 돌아가기
              </Button>
              <button
                type="button"
                className="data-input-page__calculate"
                onClick={handleCalculateScore}
                disabled={calculating || !isInputComplete(status, user.jobType)}
              >
                {calculating ? '산출 중…' : SCORE_STEP_TITLE}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 오른쪽 열 — 입력 완료 현황 = 단계 리모컨(develop과 같은 자리). 왼쪽 열 다음에 두어야 같은 줄 오른쪽에 놓인다. */}
      <InputStatus
        steps={statusSteps}
        currentStep={step}
        onSelect={handleStepJump}
        savedAt={savedAt}
        draftNotice={draftNotice}
      />
    </section>
  )
}
