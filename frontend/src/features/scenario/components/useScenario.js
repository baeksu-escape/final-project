import { useEffect, useState } from 'react'
import { getScenarioData } from '../api/scenarioApi.js'
import { calculateScenario } from '../utils/calculateScenario.js'
import { BASE_PRESET, presetValues, scenarioInputError } from './scenarioConfig.js'

const INITIAL = presetValues(BASE_PRESET)

// N-17-1·N-17-3 시나리오 화면 상태 — 저장값을 불러오고, 입력이 바뀌면 공용 계산 함수로 바로 다시 계산한다(확정 UI 초안의 즉시 계산).
// 회원·직군·다시 불러오기마다 범위를 나눠 이전 회원의 값과 늦은 응답을 보여 주지 않는다. 계산 자체는 이 파일에서 하지 않는다.
export function useScenario(userId, workerTypeCode) {
  const [revision, setRevision] = useState(0)
  const [load, setLoad] = useState({ key: null, baseline: null, error: '' })
  const [draft, setDraft] = useState({ key: null, values: INITIAL, lastValid: INITIAL, presetId: BASE_PRESET.id })
  const key = `${userId}:${workerTypeCode}:${revision}`

  // N-17-1 저장값 조회. 화면을 떠나거나 범위가 바뀌면 늦은 응답을 버린다.
  useEffect(() => {
    let active = true
    getScenarioData(userId, workerTypeCode).then(
      (baseline) => { if (active) setLoad({ key, baseline, error: '' }) },
      (error) => { if (active) setLoad({ key, baseline: null, error: error.message }) },
    )
    return () => { active = false }
  }, [key, userId, workerTypeCode])

  const ready = load.key === key
  const current = draft.key === key ? draft : { key, values: INITIAL, lastValid: INITIAL, presetId: BASE_PRESET.id }
  const inputError = scenarioInputError(current.values)

  // N-17-2 값 바꾸기. 올바른 값이면 그 값을 계산 기준으로 삼고, 아니면 마지막 올바른 값의 결과를 그대로 둔다.
  // 상황 버튼을 누르면 그 버튼을 선택 상태로 두고, 슬라이더·직접 입력으로 바꾸면 값이 우연히 같아도 선택을 푼다.
  const change = (values, presetId) => setDraft({ key, values, presetId, lastValid: scenarioInputError(values) ? current.lastValid : values })
  const setValue = (name, value) => change({ ...current.values, [name]: value }, null)
  const selectPreset = (preset) => change(presetValues(preset), preset.id)

  // N-17-3·N-17-4 계산은 공용 순수 함수에 맡긴다. 계산 실패는 화면 안 안내로 보여 준다.
  let result = null
  let calcError = ''
  if (ready && load.baseline) {
    try { result = calculateScenario(load.baseline, current.lastValid) } catch (error) { calcError = error.message }
  }

  return {
    loading: !ready,
    loadError: ready ? load.error : '',
    baseline: ready ? load.baseline : null,
    values: current.values,
    presetId: current.presetId,
    applied: current.lastValid,
    inputError,
    result,
    calcError,
    setValue,
    selectPreset,
    reload: () => setRevision((value) => value + 1),
  }
}
