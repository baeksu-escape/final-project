import { calculateAssetDebt } from '../utils/financeCalculations.js'
import { ASSET_ASSUMPTIONS, MOCK_MONTHLY_DEBT_RATE } from './financeMockData.js'

// N-16-3 시연 상환 추정만 이곳에 격리한다. 비율 계산은 공유 함수에 맡기며 기준 객체를 수정하지 않는다.
export function previewAssetDebtMock(baseline, changes) {
  const debt = changes.totalDebtAmount
  let annualPaymentAmount = baseline.annualPaymentAmount
  if (debt !== baseline.totalDebtAmount) {
    if (debt == null || baseline.totalDebtAmount == null || baseline.annualPaymentAmount == null) annualPaymentAmount = null
    else annualPaymentAmount = Math.round(baseline.totalDebtAmount > 0
      ? baseline.annualPaymentAmount * (debt / baseline.totalDebtAmount) : debt * MOCK_MONTHLY_DEBT_RATE * 12)
  }
  if (annualPaymentAmount != null && (!Number.isSafeInteger(annualPaymentAmount) || annualPaymentAmount < 0)) throw new Error('시연 상환액의 계산 범위를 벗어났습니다.')
  return calculateAssetDebt(baseline, { ...changes, annualPaymentAmount, assumptions: [...ASSET_ASSUMPTIONS] })
}

// N-21-5·N-21-8 UI 원본 예시식으로만 전망한다. 실적 NULL은 0으로 채우지 않으며 결과를 저장하지 않는다.
export function forecastCashFlowMock(baseline, conditions) {
  if (baseline.months.some((month) => month.incomeAmount == null)
    || baseline.otherExpenseAmount == null || baseline.monthlyPaymentAmount == null) throw new Error('소득·지출·상환 기준값이 미입력이어서 예측할 수 없습니다.')
  const average = baseline.months.reduce((sum, month) => checkedAmount(sum + month.incomeAmount), 0) / 12
  const monthlyExpenseAmount = checkedAmount(conditions.fixedExpenseAmount + baseline.otherExpenseAmount + baseline.monthlyPaymentAmount)
  const [lastYear, lastMonth] = baseline.months[11].baseMonth.split('-').map(Number)
  let score = baseline.currentScore
  const scorePath = []
  const forecastMonths = Array.from({ length: conditions.months }, (_, index) => {
    const serial = lastYear * 12 + lastMonth + index
    const baseMonth = `${Math.floor(serial / 12)}-${String(serial % 12 + 1).padStart(2, '0')}`
    const incomeAmount = checkedAmount(Math.round(Math.max(0, average + (baseline.months[index].incomeAmount - average) * conditions.incomeVariationPct / 100)))
    const netAmount = incomeAmount - monthlyExpenseAmount
    if (score != null) {
      score = Math.max(0, Math.min(1000, score + (conditions.paymentStatus === 'ON_TIME' ? 1.2 : -3) + (netAmount < 0 ? -0.8 : 0)))
      scorePath.push({ baseMonth, score: Math.round(score) })
    }
    return { baseMonth, incomeAmount, netAmount }
  })
  const cumulativeSurplusAmount = forecastMonths.reduce((sum, month) => sum + month.netAmount, 0)
  if (!Number.isSafeInteger(cumulativeSurplusAmount)) throw new Error('누적 금액의 계산 범위를 벗어났습니다.')
  const tightestMonth = forecastMonths.reduce((min, month) => month.netAmount < min.netAmount ? month : min)
  return { forecastMonths, monthlyExpenseAmount, cumulativeSurplusAmount,
    tightestMonth: { baseMonth: tightestMonth.baseMonth, netAmount: tightestMonth.netAmount },
    scorePath, currentScore: baseline.currentScore, endScore: score == null ? null : Math.round(score), source: 'ui-mock' }
}

// N-21-5 시연 연산도 원 단위 안전정수 범위를 벗어나면 중단한다.
function checkedAmount(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('원 단위 계산 범위를 벗어났습니다.')
  return value
}
