const fields = ['monthlyIncomeAmount', 'monthlyExpenseAmount', 'monthlyPaymentAmount', 'variableLoanBalanceAmount', 'totalAssetAmount']

// N-17-1 기준 금액을 검증하고 누락은 그대로 보존한다.
export function adaptBaseline(data) {
  if (!data || typeof data !== 'object') throw new Error('기준 데이터를 확인해 주세요.')
  for (const key of fields) if (data[key] !== null && (!Number.isSafeInteger(data[key]) || data[key] < 0)) throw new Error(`기준 금액을 확인해 주세요: ${key}`)
  if (!Array.isArray(data.assumptions) || data.assumptions.some((item) => typeof item !== 'string')) throw new Error('시연 가정을 확인해 주세요.')
  const loanItems = adaptLoanItems(data.loanItems)
  return Object.fromEntries([...fields.map((key) => [key, data[key]]), ['loanItems', loanItems], ['policyRate', data.policyRate ?? null], ['assumptions', [...data.assumptions]]])
}

// N-17-1 기준·재계산 응답의 대출 목록을 같은 규칙으로 검증한다. 월 원리금이 잘못된 항목은 목록을 비우고, 잘못된 잔액만 null로 둔다.
function adaptLoanItems(items) {
  if (!Array.isArray(items) || !items.every((item) => item && Number.isSafeInteger(item.monthlyPaymentAmount) && item.monthlyPaymentAmount >= 0)) return []
  return items.map((item) => ({
    loanId: Number.isSafeInteger(item.loanId) ? item.loanId : null,
    loanTypeName: typeof item.loanTypeName === 'string' ? item.loanTypeName : null,
    balanceAmount: Number.isSafeInteger(item.balanceAmount) && item.balanceAmount >= 0 ? item.balanceAmount : null,
    annualRatePct: Number.isFinite(item.annualRatePct) ? item.annualRatePct : null,
    rateTypeCode: typeof item.rateTypeCode === 'string' ? item.rateTypeCode : null,
    monthlyPaymentAmount: item.monthlyPaymentAmount,
  }))
}

// N-17-5 서버 계산 결과의 필수 필드를 확인하고 화면에 전달한다.
export function adaptResponse(result) {
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
  if (!isObject(result) || !isObject(result.current) || !isObject(result.changed)
    || typeof result.verdict !== 'string' || !Number.isFinite(result.surplusDiffAmount)
    || !Number.isFinite(result.monthlyInterestChangeAmount)
    || !(result.survivableMonths === null || Number.isSafeInteger(result.survivableMonths))
    || (result.assumptions != null && (!Array.isArray(result.assumptions) || result.assumptions.some((item) => typeof item !== 'string')))) {
    throw new Error('시나리오 결과 응답이 올바르지 않습니다.')
  }
  return Object.hasOwn(result, 'loanItems') ? { ...result, loanItems: adaptLoanItems(result.loanItems) } : result
}
