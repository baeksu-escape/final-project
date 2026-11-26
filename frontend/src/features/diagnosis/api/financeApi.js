import { apiGet } from '../../../common/api/client.js'
import { adaptAssetDebtData, adaptCashFlowData, adaptCashFlowForecast, validateForecastConditions } from '../adapters/financeAdapter.js'
import { calculateFinancialHealth, getCashFlowForecast, getMemberFinancialHealth } from './diagnosisApi.js'
import { previewAssetDebtMock } from '../mocks/financeMockCalculations.js'

const PEER_BENCHMARK_PATH = '/api/members/me/peer-benchmark'

// N-15-3 로그인 회원의 같은 직군·연령대 회원 평균을 조회한다.
export function getPeerBenchmark() {
  return apiGet(PEER_BENCHMARK_PATH)
}

// N-15-2·N-16-1 저장된 자산·부채와 직군·연령대 회원 평균을 병렬 조회한다. 평균 조회 실패는 별도로 기록한다.
export async function getAssetDebtData(userId) {
  requireUser(userId)
  const [health, benchmark] = await Promise.allSettled([getMemberFinancialHealth(), getPeerBenchmark()])
  if (health.status === 'rejected') throw health.reason
  // N-15-2 평균 조회가 실패해도 저장된 자산·부채 정보는 화면에 표시한다.
  const workerPeer = benchmark.status === 'fulfilled' ? benchmark.value?.sameWorkerType : null
  const peer = { ...(workerPeer ?? { memberCount: null, annualIncomeAmount: null, totalAssetAmount: null, totalDebtAmount: null }),
    agePeer: benchmark.status === 'fulfilled' ? benchmark.value?.sameAgeBand ?? null : null, peerFailed: benchmark.status === 'rejected' }
  return adaptAssetDebtData({ ...health.value, peer,
    assumptions: ['금액은 저장된 입력값 기준이며 실제 심사 결과가 아닙니다.'] })
}

// N-21-1·2 DIAG-08-1 응답의 월별 실적(months)과 기준 고정·기타 지출·월 상환액을 기준 자료로 쓴다.
// 서버 이름(baseFixedExpenseAmount 등)을 화면 이름으로 옮기며, 저장값이 없으면(null) 0으로 채우지 않고 null로 둔다.
export async function getCashFlowData(userId) {
  requireUser(userId)
  const server = await getCashFlowForecast({ forecastMonths: 3 })
  return adaptCashFlowData({
    months: server?.months,
    pastDeficitMonthsCount: server?.pastDeficitMonthsCount ?? null,
    fixedExpenseAmount: server?.baseFixedExpenseAmount ?? null,
    otherExpenseAmount: server?.baseOtherExpenseAmount ?? null,
    monthlyPaymentAmount: server?.baseMonthlyLoanPayment ?? null,
    // N-21-3 월 지출 구성 목록(서버가 추가할 필드). 없으면 어댑터가 빈 목록으로 처리한다.
    baseOtherExpenseItems: server?.baseOtherExpenseItems,
    baseLoanItems: server?.baseLoanItems,
  })
}

// N-16-3 화면의 세 입력을 검증하고, 시연 상환 추정(연 원리금)을 만든 뒤 비율·단계는 DIAG-03(재무 건전성 계산 API)으로 구한다.
// 빈 값이 있으면 서버를 부르지 않고 기존 화면 계산(계산 불가 사유 표시)을 그대로 쓴다.
export async function calculateAssetDebtPreview(baseline, changes) {
  requireExactKeys(changes, ['totalAssetAmount', 'annualIncomeAmount', 'totalDebtAmount'])
  for (const value of Object.values(changes)) if (value !== null && (!Number.isSafeInteger(value) || value < 0)) throw new Error('금액은 0원 이상 원 단위 정수 또는 미입력이어야 합니다.')
  const local = previewAssetDebtMock(adaptAssetDebtData(baseline), { ...changes })
  const { totalAssetAmount, annualIncomeAmount, totalDebtAmount, annualPaymentAmount } = local
  if ([totalAssetAmount, annualIncomeAmount, totalDebtAmount, annualPaymentAmount].some((value) => value == null)) return local
  const server = await calculateFinancialHealth({ totalAsset: totalAssetAmount, annualIncome: annualIncomeAmount, totalDebt: totalDebtAmount, annualDebtService: annualPaymentAmount })
  return adaptFinancialHealth(server, local)
}

// N-16-1·N-16-3 서버 응답(SAFE·CAUTION·DANGER, 계산 불가 null)을 화면 결과 모양(safe·caution·danger·unavailable)으로 바꾼다.
// 계산 불가 사유 문구는 서버에 없어 화면 계산 결과(local)의 사유를 쓴다.
function adaptFinancialHealth(server, local) {
  const levels = { SAFE: 'safe', CAUTION: 'caution', DANGER: 'danger' }
  const pick = (key, ratio, level) => {
    if (ratio == null) return { value: null, risk: 'unavailable', unavailableReason: local.ratios[key].unavailableReason }
    if (!Number.isFinite(ratio) || !levels[level]) throw new Error('재무 건전성 응답 형식이 올바르지 않습니다.')
    return { value: ratio, risk: levels[level], unavailableReason: null }
  }
  if (!server || !Number.isSafeInteger(server.netAsset)) throw new Error('재무 건전성 응답 형식이 올바르지 않습니다.')
  const ratios = {
    dsr: pick('dsr', server.repaymentBurdenRatio, server.repaymentBurdenLevel),
    debtToAsset: pick('debtToAsset', server.debtToAssetRatio, server.debtToAssetLevel),
    debtToNetAsset: pick('debtToNetAsset', server.debtToNetAssetRatio, server.debtToNetAssetLevel),
  }
  const risks = Object.values(ratios).map((ratio) => ratio.risk)
  const overallRisk = risks.includes('danger') ? 'danger' : risks.includes('caution') ? 'caution' : risks.every((risk) => risk === 'safe') ? 'safe' : 'unavailable'
  return { ...local, totalNetAssetAmount: server.netAsset, ratios, overallRisk }
}

// N-21-2·N-21-4·N-21-5 조건(소득 변동 폭·월 고정 지출·예측 기간)을 검증한 뒤 DIAG-08-1로 전망을 조회한다.
// 11/25 팀 결정으로 예상 점수(DIAG-09)는 부르지 않고 납부 상태(paymentStatus)도 보내지 않는다(서버는 둘 다 생략 가능).
export async function forecastCashFlow({ userId, baseline, conditions }) {
  requireUser(userId)
  requireExactKeys(conditions, ['incomeVariationPct', 'fixedExpenseAmount', 'months'])
  const error = validateForecastConditions(conditions)
  if (error) throw new Error(error)
  adaptCashFlowData(baseline) // 기준 자료 형식 검사(틀리면 오류)
  const forecast = await getCashFlowForecast({ forecastMonths: conditions.months, incomeVariationPct: conditions.incomeVariationPct, fixedExpenseAmount: conditions.fixedExpenseAmount })
  return adaptCashFlowForecast(forecast)
}

// N-21 로그인 회원 식별값이 없으면 호출하지 않는다.
function requireUser(userId) {
  if (!(typeof userId === 'string' && userId.trim() || Number.isSafeInteger(userId) && userId > 0)) throw new Error('로그인 회원을 확인해 주세요.')
}

// N-16-3·N-21-4 누락·추가된 입력 필드는 자동 보정하지 않는다.
function requireExactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key))) throw new Error('입력 필드를 확인해 주세요.')
}
