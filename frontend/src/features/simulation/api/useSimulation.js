import { useCallback, useEffect, useRef, useState } from 'react'
import { adaptSimulationInputs, adaptSimulationResult, sameInputs, validateInputs } from '../adapters/simulationAdapter.js'
import { getSimulationInputs, recalculateSimulation } from './simulationApi.js'

const EMPTY = { userId: null, revision: -1, loading: true, error: '', currentScore: null, baseline: null, deductions: [] }

const AUTO_CALC_DELAY_MS = 500
const IDLE_FORM = { applied: null, result: null, status: 'idle', calcError: '' }

// N-18-1·N-18-4·N-18-10 시뮬레이터 화면 상태. 입력이 0.5초 멈추면 최신 값으로 한 번만 자동 계산하고, 늦게 온 응답은 버린다.
// status: idle(대기) · waiting(입력 멈춤 대기) · calculating(계산 중) · invalid(요청 안 함) · error(계산 실패)
export function useSimulation(userId) {
  const [revision, setRevision] = useState(0)
  const [loaded, setLoaded] = useState(EMPTY)
  const [form, setForm] = useState({ key: null, values: null, ...IDLE_FORM })
  const calcSeq = useRef(0)
  const timer = useRef(null)
  const formKey = `${userId}:${revision}`

  // 예약된 자동 계산과 진행 중인 계산 응답을 모두 무효로 만든다.
  const cancelPending = () => {
    clearTimeout(timer.current)
    timer.current = null
    calcSeq.current += 1
  }

  // N-18-1 회원별 현재값을 불러온다. 회원이 바뀌거나 다시 불러오면 예약·진행 중인 계산과 이전 응답을 모두 버린다.
  useEffect(() => {
    let active = true
    clearTimeout(timer.current)
    calcSeq.current += 1
    // 응답 변환에서 형식 오류가 나도 같은 오류 처리로 가도록 변환을 then 단계로 분리한다.
    getSimulationInputs(userId).then(adaptSimulationInputs).then(
      (model) => { if (active) setLoaded({ userId, revision, loading: false, error: '', ...toLoaded(model) }) },
      (error) => { if (active) setLoaded({ ...EMPTY, userId, revision, loading: false, error: error.message }) },
    )
    return () => { active = false }
  }, [userId, revision])

  // 화면을 떠나면 예약된 계산을 지우고 진행 중인 계산 응답이 상태를 바꾸지 않게 한다.
  useEffect(() => () => {
    clearTimeout(timer.current)
    calcSeq.current += 1
  }, [])

  const ready = loaded.userId === userId && loaded.revision === revision
  const base = ready ? loaded : { ...EMPTY, userId }
  // 불러온 값이 바뀌면 입력 칸을 내 실제 값으로 다시 채운다(다른 회원 값이 남지 않게 key로 구분).
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

  // N-18-2·N-18-3·N-18-9 입력이 바뀔 때마다 이전 예약·응답을 취소하고, 유효하면 0.5초 뒤 최신 값으로 계산을 예약한다.
  const change = (nextValues) => {
    cancelPending()
    const message = base.currentScore === null ? '현재 대안 점수가 없어 계산할 수 없습니다.' : validateInputs(nextValues)
    if (message) {
      setForm({ ...current, values: nextValues, status: 'invalid', calcError: message })
      return
    }
    // 마지막으로 계산한 값(계산 전에는 내 실제 값)과 같으면 다시 요청하지 않는다.
    if (sameInputs(nextValues, current.applied ?? base.baseline)) {
      setForm({ ...current, values: nextValues, status: 'idle', calcError: '' })
      return
    }
    setForm({ ...current, values: nextValues, status: 'waiting', calcError: '' })
    const seq = calcSeq.current
    timer.current = setTimeout(() => { timer.current = null; runCalc(nextValues, seq) }, AUTO_CALC_DELAY_MS)
  }

  // 값 하나를 바꾼다(슬라이더·숫자 칸·금액 칸).
  const setValue = (key, value) => change({ ...current.values, [key]: value })

  // N-18-9 예시 값 여러 개를 한 번에 넣는다. 일반 입력과 같은 자동 계산 예약을 거친다.
  const fillValues = (patch) => change({ ...current.values, ...patch })

  // 계산 실패 후 같은 값으로 바로 다시 요청한다.
  const retry = () => {
    cancelPending()
    runCalc({ ...current.values }, calcSeq.current)
  }

  // N-18-10 바꾼 값과 결과를 지우고 내 실제 값으로 돌아간다. 예약·진행 중인 계산을 취소하고 새로 요청하지 않는다.
  const reset = () => {
    cancelPending()
    setForm({ key: formKey, values: base.baseline, ...IDLE_FORM })
  }

  const reload = useCallback(() => setRevision((value) => value + 1), [])

  return {
    loading: !ready || base.loading,
    error: base.error,
    currentScore: base.currentScore,
    baseline: base.baseline,
    deductions: base.deductions,
    values: current.values,
    applied: current.applied,
    result: current.result,
    status: current.status,
    calcError: current.calcError,
    setValue, fillValues, retry, reset, reload,
  }
}

// 불러온 화면 모델을 상태 모양으로 옮긴다.
function toLoaded(model) {
  return { currentScore: model.currentScore, baseline: model.inputs, deductions: model.deductions }
}
