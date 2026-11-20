// N-16·N-21 UI 참고자료의 3직군 예시를 한 벌로 관리한다. 원본 만원 값을 여기서만 원으로 환산한다.
const SAMPLES = {
  EMPLOYEE: { asset: 5000, incomes: Array(12).fill(310), fixed: 150, other: 3, peer: [4300, 9000, 4800], loans: [['신용대출', 1500, 5.4, 'VARIABLE', 36, 46]] },
  SELF_EMPLOYED: { asset: 8000, incomes: [380, 450, 290, 260, 340, 360, 410, 430, 470, 455, 360, 330], fixed: 160, other: 10, peer: [4100, 9800, 5600], loans: [['사업자 운전자금', 3000, 5.8, 'VARIABLE', 28, 121], ['신용대출', 800, 7.2, 'FIXED', 14, 62]] },
  FREELANCER: { asset: 3000, incomes: [520, 180, 610, 240, 90, 700, 450, 300, 660, 210, 380, 560], fixed: 140, other: 16, peer: [3600, 4200, 1800], loans: [['신용대출', 1200, 6.9, 'FIXED', 24, 55]] },
}
export const MOCK_MONTHLY_DEBT_RATE = 0.048
export const ASSET_ASSUMPTIONS = ['직군별 공통 시연값이며 회원의 실제 DB 자료가 아닙니다.', '총부채를 바꾸면 저장 연 상환액을 부채 비율로 조정합니다(시연 가정).', '저장 부채가 0원이면 새 부채의 월 4.8%를 상환한다고 가정합니다(실제 금융 계산 아님).']

// N-16-1·N-21-1 직군별 합성 기준값을 새 객체로 만든다. 실제 개인정보·DB 저장값을 사용하지 않는다.
export function createFinanceMockData(workerTypeCode) {
  const sample = SAMPLES[workerTypeCode]
  if (!sample) throw new Error('시연 직군을 확인해 주세요.')
  const loans = sample.loans.map(([loanTypeName, balance, annualRatePct, rateTypeCode, remainingMonths, payment], index) => ({
    loanId: `mock-${workerTypeCode}-${index + 1}`, loanTypeName, balanceAmount: balance * 10000,
    annualRatePct, rateTypeCode, remainingMonths, monthlyPaymentAmount: payment * 10000,
  }))
  const months = sample.incomes.map((income, index) => {
    const monthIndex = 10 + index
    return { baseMonth: `${2025 + Math.floor(monthIndex / 12)}-${String(monthIndex % 12 + 1).padStart(2, '0')}`, incomeAmount: income * 10000 }
  })
  const monthlyPaymentAmount = loans.reduce((sum, loan) => sum + loan.monthlyPaymentAmount, 0)
  return {
    asset: { totalAssetAmount: sample.asset * 10000, annualIncomeAmount: months.reduce((sum, month) => sum + month.incomeAmount, 0),
      totalDebtAmount: loans.reduce((sum, loan) => sum + loan.balanceAmount, 0), annualPaymentAmount: monthlyPaymentAmount * 12, loans,
      peer: { annualIncomeAmount: sample.peer[0] * 10000, totalAssetAmount: sample.peer[1] * 10000, totalDebtAmount: sample.peer[2] * 10000 }, assumptions: [...ASSET_ASSUMPTIONS] },
    cash: { months, fixedExpenseAmount: sample.fixed * 10000, otherExpenseAmount: sample.other * 10000, monthlyPaymentAmount,
      currentScore: 701, assumptions: ['직군별 공통 시연값이며 회원의 실제 DB 자료가 아닙니다.', '소득 전망·예상 점수는 UI 시연식이며 실제 평가에 반영되지 않습니다.'] },
  }
}
