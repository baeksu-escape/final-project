import { USE_MOCK } from '../../../common/config/env.js'
import { adaptBaseline } from '../adapters/scenarioAdapter.js'
import { createScenarioMock } from '../mocks/scenarioMock.js'
export { calculateScenario } from '../utils/calculateScenario.js'

// N-17-1 mock 기준값만 조회하고 실제 API 미연결을 명시한다.
export async function getScenarioData(userId, workerTypeCode) {
  if (!USE_MOCK) throw new Error('시나리오 API가 아직 연결되지 않았습니다.')
  if (!(typeof userId === 'string' && userId.trim()) && !(Number.isSafeInteger(userId) && userId > 0)) throw new Error('로그인 회원을 확인해 주세요.')
  return adaptBaseline(createScenarioMock(workerTypeCode))
}
