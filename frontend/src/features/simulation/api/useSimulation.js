import { useCallback, useEffect, useRef, useState } from 'react'
import { adaptSimulationInputs, adaptSimulationResult, addDeductionExamples, sameInputs, validateInputs } from '../adapters/simulationAdapter.js'
import { clearScoreBandOfferCache, getSimulationInputs, getInitialSimulationMetrics, recalculateSimulation } from './simulationApi.js'

const EMPTY = { userId: null, revision: -1, loading: true, error: '', currentScore: null, currentGradeCode: null, initialMetrics: null, baseline: null, deductions: [] }

const IDLE_FORM = { applied: null, result: null, status: 'idle', calcError: '' }

// N-18-1·N-18-4·N-18-10 버튼으로 계산하고 늦게 온 응답은 버린다.
// status: idle(대기) · calculating(계산 중) · invalid(요청 안 함) · error(계산 실패)
export function useSimulation(userId) {
  const [revision, setRevision] = useState(0)
  const [loaded, setLoaded] = useState(EMPTY)
  const [form, setForm] = useState({ key: null, values: null, ...IDLE_FORM })
  const calcSeq = useRef(0)
  const formKey = `${userId}:${revision}`

  // 진행 중인 계산 응답을 무효로 만든다.
  const cancelPending = () => {
    calcSeq.current += 1
  }

  // N-18-1 회원별 현재값을 불러온다. 회원 전환이나 재조회 시 이전 계산 응답을 버린다.
  useEffect(() => {
    let active = true
    calcSeq.current += 1
    // 응답 변환에서 형식 오류가 나도 같은 오류 처리로 가도록 변환을 then 단계로 분리한다.
    getSimulationInputs(userId).then((raw) => ({ ...adaptSimulationInputs(raw), currentGradeCode: raw.currentGradeCode })).then(
      (model) => {
        if (!active) return
        setLoaded({ userId, revision, loading: false, error: '', ...toLoaded(model) })
        getInitialSimulationMetrics(model.currentScore).then((initialMetrics) => {
          if (active) setLoaded((prev) => prev.userId === userId && prev.revision === revision ? { ...prev, initialMetrics } : prev)
        })
      },
      (error) => { if (active) setLoaded({ ...EMPTY, userId, revision, loading: false, error: error.message }) },
    )
    return () => { active = false }
  }, [userId, revision])

  // 화면을 떠나면 진행 중인 계산 응답이 상태를 바꾸지 않게 한다.
  useEffect(() => () => {
    calcSeq.current += 1
  }, [])

  const ready = loaded.userId === userId && loaded.revision === revision
  const base = ready ? loaded : { ...EMPTY, userId }
  // 불러온 값이 바뀌면 입력 칸을 내 현재 값으로 다시 채운다(다른 회원 값이 남지 않게 key로 구분).
  const current = form.key === formKey && ready ? form : { key: formKey, values: base.baseline, ...IDLE_FORM }

  // N-18-4·N-18-5 계산 요청 하나를 보낸다. 그사이 입력이 바뀌거나 취소되면(seq 변경) 응답을 버린다.
  const runCalc = async (values, seq) => {
    if (seq !== calcSeq.current) return
    setForm((prev) => ({ ...prev, status: 'calculating', calcError: '' }))
    try {
      const raw = await recalculateSimulation({ userId, currentScore: base.currentScore, baseline: base.baseline, values })
      if (seq !== calcSeq.current) return
      // 응답 형식 오류가 catch로 가도록 상태 갱신 함수 밖(try 안)에서 먼저 변환한다.
      const result = adaptSimulationResult(raw)
      setForm((prev) => ({ ...prev, applied: values, result, status: 'idle', calcError: '' }))
    } catch (error) {
      if (seq !== calcSeq.current) return
      setForm((prev) => ({ ...prev, status: 'error', calcError: error.message }))
    }
  }

  // N-18-2·N-18-3·N-18-9 입력이 바뀌면 이전 응답을 무효화하고 입력을 검증한다.
  const change = (nextValues) => {
    cancelPending()
    const message = base.currentScore === null ? '현재 대안 점수가 없어 계산할 수 없습니다.' : validateInputs(nextValues, base.baseline)
    if (message) {
      setForm({ ...current, values: nextValues, status: 'invalid', calcError: message })
      return
    }
    setForm({ ...current, values: nextValues, status: 'idle', calcError: '' })
  }

  // 값 하나를 바꾼다(슬라이더·숫자 칸·금액 칸).
  const setValue = (key, value) => change({ ...current.values, [key]: value })

  // N-18-9 예시 값을 입력하고 계산은 버튼 입력을 기다린다.
  const fillValues = (patch) => change({ ...current.values, ...patch })

  const canCalculate = Boolean(base.currentScore !== null && current.values && current.status !== 'calculating'
    && !validateInputs(current.values, base.baseline) && !sameInputs(current.values, current.applied ?? base.baseline))

  // N-18-4 유효하고 마지막 계산과 다른 입력만 버튼으로 요청한다.
  const calculate = () => {
    if (!canCalculate) return
    cancelPending()
    runCalc({ ...current.values }, calcSeq.current)
  }

  // N-18-10 바꾼 값과 결과를 지우고 내 현재 값으로 돌아간다. 진행 중인 계산을 취소한다.
  const reset = () => {
    cancelPending()
    setForm({ key: formKey, values: base.baseline, ...IDLE_FORM })
  }

  const reload = useCallback(() => {
    clearScoreBandOfferCache()
    setRevision((value) => value + 1)
  }, [])

  return {
    loading: !ready || base.loading,
    error: base.error,
    currentScore: base.currentScore,
    currentGradeCode: base.currentGradeCode,
    initialMetrics: base.initialMetrics,
    baseline: base.baseline,
    deductions: addDeductionExamples(current.result?.deductions ?? base.deductions, base.baseline, current.values),
    values: current.values,
    applied: current.applied,
    result: current.result,
    status: current.status,
    calcError: current.calcError,
    canCalculate, setValue, fillValues, calculate, retry: calculate, reset, reload,
  }
}

// N-18-1 첫 화면에 필요한 점수·등급과 입력 모델을 상태 모양으로 옮긴다.
function toLoaded(model) {
  return { currentScore: model.currentScore, currentGradeCode: model.currentGradeCode, initialMetrics: null, baseline: model.inputs, deductions: model.deductions }
}
