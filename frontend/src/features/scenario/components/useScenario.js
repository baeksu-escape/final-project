import { useEffect, useRef, useState } from 'react'
import { getScenarioBase, recalculateMemberScenario } from '../../diagnosis/api/diagnosisApi.js'
import { adaptBaseline, adaptResponse } from '../adapters/scenarioAdapter.js'
import { BASE_PRESET, presetValues, scenarioInputError } from './scenarioConfig.js'

const INITIAL = presetValues(BASE_PRESET)

// N-17-1·N-17-3 저장값을 조회하고 변경된 조건을 서버에서 재계산한다.
// 회원·직군 전환이나 입력 변경 시 이전 응답을 버리고 기존 결과는 유지한다.
export function useScenario(userId, workerTypeCode) {
  const [revision, setRevision] = useState(0)
  const [load, setLoad] = useState({ key: null, baseline: null, error: '' })
  const [draft, setDraft] = useState({ key: null, values: INITIAL, lastValid: INITIAL, presetId: BASE_PRESET.id })
  const [calculation, setCalculation] = useState({ key: null, result: null, applied: null, error: '' })
  const [retryVersion, setRetryVersion] = useState(0)
  const seq = useRef(0)
  const startedKey = useRef(null)
  const startedRetry = useRef(0)
  const key = `${userId}:${workerTypeCode}:${revision}`

  // N-17-1 저장값 조회. 화면을 떠나거나 범위가 바뀌면 늦은 응답을 버린다.
  useEffect(() => {
    let active = true
    getScenarioBase().then(adaptBaseline).then(
      (baseline) => { if (active) setLoad({ key, baseline, error: '' }) },
      (error) => { if (active) setLoad({ key, baseline: null, error: error.message }) },
    )
    return () => { active = false }
  }, [key, userId, workerTypeCode])

  const ready = load.key === key
  const current = draft.key === key ? draft : { key, values: INITIAL, lastValid: INITIAL, presetId: BASE_PRESET.id }
  const inputError = scenarioInputError(current.values)

  // N-17-3 첫 계산과 재시도는 즉시 요청하고 이후 입력은 300ms 모아서 요청한다.
  useEffect(() => {
    const requestId = ++seq.current
    if (!ready || !load.baseline || inputError) return
    const first = startedKey.current !== key
    const retrying = startedRetry.current !== retryVersion
    startedKey.current = key
    startedRetry.current = retryVersion
    const run = () => {
      recalculateMemberScenario(current.values).then(adaptResponse).then(
        (result) => { if (seq.current === requestId) setCalculation({ key, result, applied: current.values, retryVersion, error: '' }) },
        (error) => { if (seq.current === requestId) setCalculation((prev) => ({ key, result: prev.key === key ? prev.result : null, applied: prev.key === key ? prev.applied : null, error: error.data?.fieldErrors?.[0]?.message || error.message })) },
      )
    }
    if (first || retrying) run()
    const timer = first || retrying ? null : setTimeout(run, 300)
    return () => { clearTimeout(timer); seq.current += 1 }
  }, [key, ready, load.baseline, current.values, inputError, retryVersion])

  // N-17-2 값 바꾸기. 올바른 값이면 그 값을 계산 기준으로 삼고, 아니면 마지막 올바른 값의 결과를 그대로 둔다.
  // 상황 버튼을 누르면 그 버튼을 선택 상태로 두고, 슬라이더·직접 입력으로 바꾸면 값이 우연히 같아도 선택을 푼다.
  const change = (values, presetId) => setDraft({ key, values, presetId, lastValid: scenarioInputError(values) ? current.lastValid : values })
  const setValue = (name, value) => change({ ...current.values, [name]: value }, null)
  const selectPreset = (preset) => change(presetValues(preset), preset.id)

  const result = calculation.key === key ? calculation.result : null
  const calcError = calculation.key === key ? calculation.error : ''

  return {
    loading: !ready,
    loadError: ready ? load.error : '',
    baseline: ready ? load.baseline : null,
    values: current.values,
    presetId: current.presetId,
    applied: calculation.key === key ? calculation.applied : null,
    inputError,
    result,
    calcError,
    stale: Boolean(result) && (calculation.applied !== current.values || calculation.retryVersion !== retryVersion),
    setValue,
    selectPreset,
    retry: () => { if (!inputError) setRetryVersion((value) => value + 1) },
    reload: () => setRevision((value) => value + 1),
  }
}
