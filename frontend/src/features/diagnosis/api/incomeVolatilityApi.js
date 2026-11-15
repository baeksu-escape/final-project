import { USE_MOCK } from '../../../common/config/env.js'
import { adaptCashFlowData } from '../adapters/financeAdapter.js'
import { adaptIncomeVolatility } from '../adapters/incomeVolatilityAdapter.js'
import { buildIncomeVolatilityMock } from '../mocks/incomeVolatilityMock.js'

// N-22-3·4·5 소득 변동성 지표 조회. 정식 계산은 광희 FP-203 백엔드 API 담당이며 경로·응답 계약은 아직 미정이다.
// TODO(FP-203 연동): 서버 경로가 정해지면 apiGet/apiPost로 바꾸고 응답은 adaptIncomeVolatility에서 맞춘다. 지금은 mock 임시 계산만 쓴다.
// baseline은 현금흐름 화면이 이미 받은 getCashFlowData 응답을 그대로 넘긴다(다시 조회하지 않는다).
export async function getIncomeVolatility({ userId, baseline }) {
  if (!USE_MOCK) throw new Error('소득 변동성 API(FP-203)가 아직 연결되지 않았습니다. 현재 화면은 mock 모드에서 확인할 수 있습니다.')
  if (!(typeof userId === 'string' && userId.trim()) && !(Number.isSafeInteger(userId) && userId > 0)) throw new Error('로그인 회원을 확인해 주세요.')
  const data = adaptCashFlowData(baseline)
  await new Promise((resolve) => setTimeout(resolve, 120))
  return adaptIncomeVolatility(buildIncomeVolatilityMock(data))
}
