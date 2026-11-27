import { useEffect, useRef, useState } from 'react'
import { getScenarioBase, recalculateMemberScenario } from '../../diagnosis/api/diagnosisApi.js'
import { adaptBaseline, adaptResponse } from '../adapters/scenarioAdapter.js'
import { BASE_PRESET, presetValues, scenarioInputError } from './scenarioConfig.js'

const INITIAL = presetValues(BASE_PRESET)

// N-17-1·N-17-3 기준값을 조회하고, 사용자가 계산 버튼을 누른 조건으로 서버에서 재계산한다.
// 회원·직군 전환 시 이전 응답을 버리고, 입력을 바꿔도 기존 결과는 버튼을 누를 때까지 유지한다.
export function useScenario(userId, workerTypeCode) {
  const [revision, setRevision] = useState(0)
  const [load, setLoad] = useState({ key: null, baseline: null, error: '' })
  const [draft, setDraft] = useState({ key: null, values: INITIAL, lastValid: INITIAL, presetId: BASE_PRESET.id })
  const [calculation, setCalculation] = useState({ key: null, result: null, applied: null, version: -1, error: '' })
  // N-17-3 요청 버전으로 계산·초기화를 구분하고, 처음에는 현재 조건을 한 번 계산한다.
  const [request, setRequest] = useState({ key: null, values: INITIAL, version: 0 })
  const [resetPending, setResetPending] = useState(false)
  const [retryVersion, setRetryVersion] = useState(0)
  const [retryPending, setRetryPending] = useState(false)
  const seq = useRef(0)
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
  // N-17-2 기준값으로 원 단위 입력 범위를 안내한다.
  const inputError = scenarioInputError(current.values, ready ? load.baseline : null)

  const requested = request.key === key ? request : { key, values: INITIAL, version: 0 }

  // N-17-3 최초 현재 조건과 사용자가 계산 또는 다시 시도를 눌렀을 때만 서버에 요청한다.
  // 늦게 온 이전 응답은 버리고, 실패하면 이전 결과를 그대로 둔다.
  useEffect(() => {
    const requestId = ++seq.current
    if (!ready || !load.baseline || scenarioInputError(requested.values, load.baseline)) return undefined
    const { values, version } = requested
    recalculateMemberScenario(values).then(adaptResponse).then(
      (result) => { if (seq.current === requestId) { setCalculation({ key, result, applied: values, version, error: '' }); setResetPending(false); setRetryPending(false) } },
      (error) => { if (seq.current === requestId) { setCalculation((prev) => ({ key, result: prev.key === key ? prev.result : null, applied: prev.key === key ? prev.applied : null, version, error: error.data?.fieldErrors?.[0]?.message || error.message })); setResetPending(false); setRetryPending(false) } },
    )
    return () => { seq.current += 1 }
  }, [key, ready, load.baseline, requested.values, requested.version, retryVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // N-17-2 값 바꾸기. 올바른 값이면 그 값을 계산 기준으로 삼고, 아니면 마지막 올바른 값의 결과를 그대로 둔다.
  // 상황 버튼을 누르면 그 버튼을 선택 상태로 두고, 슬라이더·직접 입력으로 바꾸면 값이 우연히 같아도 선택을 푼다.
  const change = (values, presetId) => setDraft({ key, values, presetId, lastValid: scenarioInputError(values) ? current.lastValid : values })
  const setValue = (name, value) => change({ ...current.values, [name]: value }, null)
  const selectPreset = (preset) => change(presetValues(preset), preset.id)

  const result = calculation.key === key ? calculation.result : null
  const calcError = calculation.key === key ? calculation.error : ''
  // 계산 중: 누른 횟수(requested.version)의 응답이 아직 오지 않았을 때
  const calculating = ready && !inputError && (calculation.key !== key || calculation.version !== requested.version)
  // N-17-2 입력이 올바를 때만 현재 조건으로 계산을 요청한다.
  const calculate = () => { if (!inputError) setRequest({ key, values: current.values, version: requested.version + 1 }) }
  // N-17-2 초기화는 입력을 항상 기본 조건으로 되돌리고, 이미 해당 결과가 있을 때만 중복 계산을 생략한다.
  const reset = () => {
    const values = INITIAL
    setDraft({ key, values, presetId: BASE_PRESET.id, lastValid: values })
    if (calculation.key === key && calculation.applied === values) return
    // N-17-2 초기화 재계산 중에는 stale 안내 대신 계산 중 상태를 유지한다.
    setResetPending(true)
    setRequest({ key, values, version: requested.version + 1 })
  }

  // N-17-2 실패한 계산의 재시도도 요청이 끝날 때까지 계산 중으로 표시한다.
  const retry = () => {
    if (!inputError) { setRetryPending(true); setRetryVersion((value) => value + 1) }
  }

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
    // 결과가 지금 입력과 다른 조건으로 계산된 것인지(버튼을 아직 안 누름)
    stale: Boolean(result) && calculation.applied !== current.values && !resetPending,
    calculating: calculating || resetPending || retryPending,
    setValue,
    selectPreset,
    calculate,
    reset,
    retry,
    reload: () => setRevision((value) => value + 1),
  }
}
