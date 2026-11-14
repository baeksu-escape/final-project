import { USE_MOCK } from '../../../common/config/env.js'
import { simulationExample } from '../mocks/simulationMock.js'
import { calculateExampleResult } from '../mocks/simulationExampleCalculator.js'
import { INPUT_KEYS, validateInputs } from '../adapters/simulationAdapter.js'

// 실제 API 계약(경로·요청·응답 필드)은 아직 정해지지 않았다. 실제 모드에서는 mock으로 넘어가지 않고 오류를 낸다.
// TODO(N-18 API 계약): 백엔드 경로가 정해지면 apiGet/apiPost로 바꾸고 응답은 adapters/simulationAdapter.js에서 맞춘다.

// N-18-1 회원의 시뮬레이터 입력 10개 현재값, 현재 대안 점수, 감점 상위 3개를 불러온다.
export async function getSimulationInputs(userId) {
  if (!USE_MOCK) throw new Error('시뮬레이터 현재값 조회 API가 아직 연결되지 않았습니다. 현재 화면은 mock 모드에서 확인할 수 있습니다.')
  if (userId == null) throw new Error('로그인 정보가 없어 값을 불러올 수 없습니다.')
  await new Promise((resolve) => setTimeout(resolve, 200))
  return structuredClone(simulationExample)
}

// N-18-5 바꾼 값 10개로 예상 점수를 다시 구한다. 결과는 저장하지 않고 기존 평가를 덮어쓰지 않는다.
export async function recalculateSimulation({ userId, currentScore, baseline, values }) {
  if (!USE_MOCK) throw new Error('시뮬레이터 재계산 API가 아직 연결되지 않았습니다. 현재 화면은 mock 모드에서 확인할 수 있습니다.')
  if (userId == null) throw new Error('로그인 정보가 없어 계산할 수 없습니다.')
  // mock 요청 처리에서도 화면과 같은 규칙으로 막는다(음수·NULL·소수·범위 밖 거부). 브라우저 안의 시연 검사이며 서버 검증이 아니다.
  if (!(Number.isInteger(currentScore) && currentScore >= 0 && currentScore <= 1000)) throw new Error('현재 점수는 0~1000 정수여야 합니다.')
  if (!hasExactInputKeys(values)) throw new Error('계산 입력은 정해진 10개 항목이어야 합니다(누락·추가 항목 거부).')
  const valuesError = validateInputs(values)
  if (valuesError) throw new Error(valuesError)
  if (!hasExactInputKeys(baseline) || validateInputs(baseline)) throw new Error('저장된 내 실제 값이 비었거나 올바르지 않아 시연 계산을 할 수 없습니다.')
  await new Promise((resolve) => setTimeout(resolve, 200))
  return calculateExampleResult({ currentScore, baseline: { ...baseline }, values: { ...values } })
}

// 입력 묶음이 정해진 10개 키만 정확히 가졌는지 본다.
function hasExactInputKeys(input) {
  if (!input || typeof input !== 'object') return false
  const keys = Object.keys(input)
  return keys.length === INPUT_KEYS.length && INPUT_KEYS.every((key) => Object.hasOwn(input, key))
}
