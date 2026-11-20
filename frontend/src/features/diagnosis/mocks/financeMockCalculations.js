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
