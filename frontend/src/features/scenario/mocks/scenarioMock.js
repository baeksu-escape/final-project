import { createFinanceMockData } from '../../diagnosis/mocks/financeMockData.js'

// N-17-1 기존 진단 합성 데이터에서 시연 기준값을 만든다.
export function createScenarioMock(workerTypeCode) {
  const { asset, cash } = createFinanceMockData(workerTypeCode)
  return { monthlyIncomeAmount: Math.round(asset.annualIncomeAmount / 12), monthlyExpenseAmount: cash.fixedExpenseAmount + cash.otherExpenseAmount,
    monthlyPaymentAmount: cash.monthlyPaymentAmount, variableLoanBalanceAmount: asset.loans.filter((loan) => loan.rateTypeCode === 'VARIABLE').reduce((sum, loan) => sum + loan.balanceAmount, 0),
    totalAssetAmount: asset.totalAssetAmount, assumptions: ['직군별 합성 시연값이며 실제 저장 데이터가 아닙니다.', '총자산의 25%를 부족액에 사용할 수 있다고 가정합니다.'] }
}
