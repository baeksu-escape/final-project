import { calculateDsr } from '../../diagnosis/utils/financeCalculations.js'
import { adaptBaseline, adaptConditions, adaptResponse } from '../adapters/scenarioAdapter.js'

// N-17-3·4 입력값을 검증해 현재와 변경 후 상환 여력을 계산한다.
export function calculateScenario(baseline, scenario) {
  const b = adaptBaseline(baseline)
  const s = adaptConditions(scenario)
  const money = (v) => Number.isFinite(v) && Number.isSafeInteger(Math.round(v)) ? Math.round(v) : null
  const add = (...values) => values.some((v) => v === null) ? null : money(values.reduce((a, v) => a + v, 0))
  const scaled = (v, pct) => v === null ? null : money(v * (1 + pct / 100))
  const interest = b.variableLoanBalanceAmount === null ? null : money(b.variableLoanBalanceAmount * s.ratePctPoint / 100 / 12)
  const make = (income, expense, payment) => {
    const annualIncome = income === null ? null : money(income * 12)
    const annualPayment = payment === null ? null : money(payment * 12)
    return { monthlyIncomeAmount: income, monthlyExpenseAmount: expense, monthlyPaymentAmount: payment,
      monthlySurplusAmount: income === null || expense === null || payment === null ? null : add(income, -expense, -payment), dsrPct: calculateDsr(annualPayment, annualIncome).value }
  }
  const current = make(b.monthlyIncomeAmount, b.monthlyExpenseAmount, b.monthlyPaymentAmount)
  const payment = add(b.monthlyPaymentAmount, interest)
  const changed = make(scaled(b.monthlyIncomeAmount, s.incomePct), scaled(b.monthlyExpenseAmount, s.expensePct), payment === null ? null : Math.max(0, payment))
  const surplusDiffAmount = current.monthlySurplusAmount === null || changed.monthlySurplusAmount === null ? null : add(changed.monthlySurplusAmount, -current.monthlySurplusAmount)
  const survivableMonths = changed.monthlySurplusAmount < 0 && b.totalAssetAmount !== null ? Math.floor(b.totalAssetAmount / 4 / -changed.monthlySurplusAmount) : null
  const verdict = changed.monthlySurplusAmount === null || surplusDiffAmount === null ? null : changed.monthlySurplusAmount < 0 ? 'SHORTFALL' : surplusDiffAmount > 0 ? 'IMPROVED' : 'STILL_POSITIVE'
  return adaptResponse({ current, changed, monthlyInterestChangeAmount: interest, surplusDiffAmount, survivableMonths, verdict, assumptions: b.assumptions })
}
