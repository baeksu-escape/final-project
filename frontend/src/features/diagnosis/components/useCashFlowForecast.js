import { useCallback, useEffect, useRef, useState } from 'react'
import { forecastCashFlow, getCashFlowData } from '../api/financeApi.js'

// 처음 화면에 쓰는 예측 조건(UI 참고자료 기본값: 변동 폭 100%, 12개월). 월 고정 지출은 저장값으로 채운다. 납부 상태는 11/25 팀 결정으로 입력과 요청에서 뺐다.
const DEFAULT_CONDITIONS = { incomeVariationPct: 100, fixedExpenseAmount: null, months: 12 }
const CONDITION_KEYS = Object.keys(DEFAULT_CONDITIONS)
const sameConditions = (a, b) => CONDITION_KEYS.every((key) => a?.[key] === b?.[key])

const validAmount = (value) => Number.isSafeInteger(value) && value >= 0

// 저장된 12개월 소득과 기타 지출·월 상환액이 모두 있어야 예측한다(빈 값을 0으로 채우지 않는다).
// 월 고정 지출은 화면에서 고칠 수 있으므로 여기서 보지 않고 conditionError가 따로 검사한다.
export function isBaselineComplete(baseline) {
  return Array.isArray(baseline?.months) && baseline.months.length === 12
    && baseline.months.every((row) => validAmount(row.incomeAmount))
    && validAmount(baseline.otherExpenseAmount) && validAmount(baseline.monthlyPaymentAmount)
}

// 화면에서 막는 조건 검사(최종 검사는 공용 API 입구가 한다). 문제가 없으면 빈 문자열.
export function conditionError(conditions) {
  const fixed = conditions.fixedExpenseAmount
  if (fixed === null || fixed === undefined) return '월 고정 지출을 입력해 주세요. 입력할 때까지 예측하지 않습니다.'
  if (!Number.isSafeInteger(fixed) || fixed < 0) return '월 고정 지출은 0원 이상 정수로 입력해 주세요. 올바른 값이 될 때까지 예측하지 않습니다.'
  return ''
}

const EMPTY_LOAD = { key: null, loading: true, error: '', baseline: null }
const IDLE = { applied: null, result: null, status: 'idle', error: '' }

// N-21-2·N-21-4·N-21-5 현금흐름 예측 화면 상태.
// 처음에는 저장값과 기본 조건으로 예측하고 이후에는 버튼으로 다시 예측한다.
// status: idle(완료·대기) · loading(계산 중) · invalid(요청 안 함) · error(실패)
// 회원·직군 전환, 다시 불러오기, 새 입력, 화면 이탈 시 늦은 응답을 버린다.
export function useCashFlowForecast(userId, workerTypeCode) {
  const [revision, setRevision] = useState(0)
  const [load, setLoad] = useState(EMPTY_LOAD)
  const [form, setForm] = useState({ key: null, values: DEFAULT_CONDITIONS, ...IDLE })
  const seq = useRef(0)
  const key = `${userId}:${workerTypeCode}:${revision}`

  // 진행 중인 예측 응답을 무효로 만든다.
  const cancelPending = () => {
    seq.current += 1
  }

  // 예측 요청 하나. 그사이 입력이 바뀌거나 취소되면(seq 변경) 응답을 버린다. 이전 결과는 계산 중에도 그대로 둔다.
  const runForecast = useCallback(async (baseline, conditions, formKey, mySeq) => {
    if (mySeq !== seq.current) return
    setForm((prev) => (prev.key === formKey ? { ...prev, status: 'loading', error: '' } : prev))
    try {
      const result = await forecastCashFlow({ userId, baseline, conditions })
      if (mySeq !== seq.current) return
      setForm((prev) => (prev.key === formKey ? { ...prev, applied: conditions, result, status: 'idle', error: '' } : prev))
    } catch (error) {
      if (mySeq !== seq.current) return
      setForm((prev) => (prev.key === formKey ? { ...prev, status: 'error', error: error.message } : prev))
    }
  }, [userId])

  // N-21-1 저장값을 불러오고 기본 조건으로 첫 예측을 한 번 요청한다.
  useEffect(() => {
    let active = true
    seq.current += 1
    getCashFlowData(userId, workerTypeCode).then(
      (baseline) => {
        if (!active) return
        setLoad({ key, loading: false, error: '', baseline })
        const values = { ...DEFAULT_CONDITIONS, fixedExpenseAmount: baseline?.fixedExpenseAmount ?? null }
        const invalid = conditionError(values)
        setForm({ key, values, ...IDLE, status: invalid ? 'invalid' : 'idle', error: invalid })
        if (isBaselineComplete(baseline) && !invalid) runForecast(baseline, values, key, seq.current)
      },
      (error) => { if (active) setLoad({ key, loading: false, error: error.message, baseline: null }) },
    )
    return () => { active = false }
  }, [key, userId, workerTypeCode, runForecast])

  // 화면을 떠나면 진행 중 응답을 버린다.
  useEffect(() => () => {
    seq.current += 1
  }, [])

  const ready = load.key === key
  const current = form.key === key ? form : { key, values: DEFAULT_CONDITIONS, ...IDLE }
  const baseline = ready ? load.baseline : null
  const complete = isBaselineComplete(baseline)

  // N-21-2 조건 하나를 바꾸고 이전 응답을 무효화한다.
  const setCondition = (name, value) => {
    cancelPending()
    const values = { ...current.values, [name]: value }
    const invalid = conditionError(values)
    if (invalid || !complete) {
      setForm({ ...current, values, status: invalid ? 'invalid' : 'idle', error: invalid })
      return
    }
    setForm({ ...current, values, status: 'idle', error: '' })
  }

  const canForecast = complete && current.status !== 'loading' && !conditionError(current.values)
    && !sameConditions(current.values, current.applied)

  // N-21-2·N-21-5 유효한 변경 조건을 버튼으로 예측한다.
  const forecast = () => {
    if (!canForecast) return
    cancelPending()
    runForecast(baseline, { ...current.values }, key, seq.current)
  }

  // C-17 예측 조건을 처음 상태(변동 폭 100%·12개월·저장된 월 고정 지출)로 되돌린다. 예측은 [예측 다시 하기]로 한다.
  const initialValues = { ...DEFAULT_CONDITIONS, fixedExpenseAmount: baseline?.fixedExpenseAmount ?? null }
  const canReset = Boolean(baseline) && !sameConditions(current.values, initialValues)
  const reset = () => {
    if (!canReset) return
    cancelPending()
    const invalid = conditionError(initialValues)
    setForm({ ...current, values: initialValues, status: invalid ? 'invalid' : 'idle', error: invalid })
  }

  return {
    loading: !ready || load.loading,
    loadError: ready ? load.error : '',
    baseline,
    baselineComplete: complete,
    values: current.values,
    result: current.result,
    applied: current.applied,
    status: current.status,
    error: current.error,
    stale: Boolean(current.result) && !sameConditions(current.values, current.applied),
    canForecast,
    setCondition,
    canReset,
    reset,
    forecast,
    retry: forecast,
    reload: () => setRevision((value) => value + 1),
  }
}
