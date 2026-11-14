import { USE_MOCK } from '../../../common/config/env.js'
import { adaptAssetDebtData, adaptCashFlowData, validateForecastConditions } from '../adapters/financeAdapter.js'
import { createFinanceMockData } from '../mocks/financeMockData.js'
import { forecastCashFlowMock, previewAssetDebtMock } from '../mocks/financeMockCalculations.js'

// N-16-1 회원별 화면 호출 범위를 확인하고 시연 기준값을 반환한다. 실제 API 경로는 정하지 않는다.
export async function getAssetDebtData(userId, workerTypeCode) {
  requireMock(userId)
  const data = adaptAssetDebtData(createFinanceMockData(workerTypeCode).asset)
  await mockDelay()
  return data
}

// N-21-1 12개월 합성 기준값을 반환하며 실제 모드에는 명시적인 미연결 오류를 전달한다.
export async function getCashFlowData(userId, workerTypeCode) {
  requireMock(userId)
  const data = adaptCashFlowData(createFinanceMockData(workerTypeCode).cash)
  await mockDelay()
  return data
}

// N-16-3 화면의 세 입력을 동기 검증하고 시연 상환 추정과 공유 비율 계산을 연결한다.
export function calculateAssetDebtPreview(baseline, changes) {
  requireMock()
  requireExactKeys(changes, ['totalAssetAmount', 'annualIncomeAmount', 'totalDebtAmount'])
  for (const value of Object.values(changes)) if (value !== null && (!Number.isSafeInteger(value) || value < 0)) throw new Error('금액은 0원 이상 원 단위 정수 또는 미입력이어야 합니다.')
  return previewAssetDebtMock(adaptAssetDebtData(baseline), { ...changes })
}

// N-21-4·N-21-5 요청 입구에서도 조건·기준값을 검증한다. 브라우저 mock 계산이며 서버 검증이 아니다.
export async function forecastCashFlow({ userId, baseline, conditions }) {
  requireMock(userId)
  requireExactKeys(conditions, ['incomeVariationPct', 'fixedExpenseAmount', 'paymentStatus', 'months'])
  const error = validateForecastConditions(conditions)
  if (error) throw new Error(error)
  const data = adaptCashFlowData(baseline)
  const result = forecastCashFlowMock(data, { ...conditions })
  await mockDelay()
  return result
}

// N-16·N-21 실제 모드에서 mock으로 우회하지 않고 호출 회원의 누락을 차단한다.
function requireMock(userId) {
  if (!USE_MOCK) throw new Error('이번 진단 화면은 mock 시연용이며 실제 API는 연결되지 않았습니다.')
  if (arguments.length && !(typeof userId === 'string' && userId.trim() || Number.isSafeInteger(userId) && userId > 0)) throw new Error('로그인 회원을 확인해 주세요.')
}

// N-16-3·N-21-4 누락·추가된 입력 필드는 자동 보정하지 않는다.
function requireExactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error('입력 필드를 확인해 주세요.')
}

// N-16·N-21 비동기 화면 상태를 확인하기 위한 짧은 mock 응답 지연이다.
function mockDelay() { return new Promise((resolve) => setTimeout(resolve, 120)) }
