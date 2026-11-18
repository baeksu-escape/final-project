import { USE_MOCK } from '../../../common/config/env.js'
import { adaptAssetDebtData, adaptCashFlowData, adaptCashFlowForecast, validateForecastConditions } from '../adapters/financeAdapter.js'
import { calculateFinancialHealth, getCashFlowForecast } from './diagnosisApi.js'
import { createFinanceMockData } from '../mocks/financeMockData.js'
import { forecastCashFlowMock, previewAssetDebtMock } from '../mocks/financeMockCalculations.js'

// N-16-1 회원별 화면 호출 범위를 확인하고 시연 기준값을 반환한다. 실제 API 경로는 정하지 않는다.
// TODO(광희 요청: DIAG-03-1): 저장된 총자산·연소득·총부채·대출 목록·직군 평균 조회 API가 🟡 미정이라 브라우저 mock 기준값을 유지한다.
export async function getAssetDebtData(userId, workerTypeCode) {
  requireMock(userId)
  const data = adaptAssetDebtData(createFinanceMockData(workerTypeCode).asset)
  await mockDelay()
  return data
}

// N-21-1 DIAG-08-1 응답의 월별 실적(months)을 기준 자료로 쓴다.
// 서버에 없는 값(고정·기타 지출 분리, 월 상환액 기준값, 현재 점수)은 한곳(mockOnlyCashFields)에서 브라우저 mock으로 채운다.
export async function getCashFlowData(userId, workerTypeCode) {
  requireUser(userId)
  const server = await getCashFlowForecast({ forecastMonths: 3 })
  return adaptCashFlowData({ months: server?.months, ...mockOnlyCashFields(workerTypeCode) })
}

// N-21 서버가 아직 주지 않는 현금흐름 기준값을 브라우저 mock에서 가져온다(실제 회원 자료가 아님).
// TODO(광희 요청 11/19): DIAG-08-1 응답에 기준 고정지출·기타지출 분리값(fixedExpenseAmount, otherExpenseAmount)과 월 상환액 기준값(monthlyPaymentAmount)을 추가해 달라고 요청.
// TODO(광희 요청 11/19): 현재 점수(currentScore)와 월별 예상 점수 경로(scorePath, endScore)는 DIAG-09(🟡) 확정 뒤 서버 값으로 교체.
function mockOnlyCashFields(workerTypeCode) {
  const { fixedExpenseAmount, otherExpenseAmount, monthlyPaymentAmount, currentScore, assumptions } = createFinanceMockData(workerTypeCode).cash
  return { fixedExpenseAmount, otherExpenseAmount, monthlyPaymentAmount, currentScore, assumptions }
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

// N-21-4·N-21-5 조건을 검증한 뒤 DIAG-08-1(GET /api/diagnosis/cash-flow/forecast)로 전망을 조회한다.
// 예상 점수 필드(scorePath·currentScore·endScore)만 서버에 없어 브라우저 mock 값을 붙인다(DIAG-09 대기, TODO는 mockOnlyCashFields 참고).
export async function forecastCashFlow({ userId, baseline, conditions }) {
  requireUser(userId)
  requireExactKeys(conditions, ['incomeVariationPct', 'fixedExpenseAmount', 'paymentStatus', 'months'])
  const error = validateForecastConditions(conditions)
  if (error) throw new Error(error)
  const data = adaptCashFlowData(baseline)
  const server = await getCashFlowForecast({
    forecastMonths: conditions.months, incomeVariationPct: conditions.incomeVariationPct,
    fixedExpenseAmount: conditions.fixedExpenseAmount, paymentStatus: conditions.paymentStatus,
  })
  const { scorePath, currentScore, endScore } = forecastCashFlowMock(data, { ...conditions })
  return { ...adaptCashFlowForecast(server), scorePath, currentScore, endScore }
}

// N-21 로그인 회원 식별값이 없으면 호출하지 않는다.
function requireUser(userId) {
  if (!(typeof userId === 'string' && userId.trim() || Number.isSafeInteger(userId) && userId > 0)) throw new Error('로그인 회원을 확인해 주세요.')
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
