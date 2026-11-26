const fields = ['monthlyIncomeAmount', 'monthlyExpenseAmount', 'monthlyPaymentAmount', 'variableLoanBalanceAmount', 'totalAssetAmount']

// N-17-1 기준 금액을 검증하고 누락은 그대로 보존한다.
export function adaptBaseline(data) {
  if (!data || typeof data !== 'object') throw new Error('기준 데이터를 확인해 주세요.')
  for (const key of fields) if (data[key] !== null && (!Number.isSafeInteger(data[key]) || data[key] < 0)) throw new Error(`기준 금액을 확인해 주세요: ${key}`)
  if (!Array.isArray(data.assumptions) || data.assumptions.some((item) => typeof item !== 'string')) throw new Error('시연 가정을 확인해 주세요.')
  // N-17-1 대출별 현재 상환 정보를 검증해 화면용으로 옮기며, 잘못된 목록은 비운다.
  const loanItems = Array.isArray(data.loanItems) && data.loanItems.every((item) => item && Number.isSafeInteger(item.monthlyPaymentAmount) && item.monthlyPaymentAmount >= 0)
    ? data.loanItems.map((item) => ({
      loanId: Number.isSafeInteger(item.loanId) ? item.loanId : null,
      loanTypeName: typeof item.loanTypeName === 'string' ? item.loanTypeName : null,
      annualRatePct: Number.isFinite(item.annualRatePct) ? item.annualRatePct : null,
      rateTypeCode: typeof item.rateTypeCode === 'string' ? item.rateTypeCode : null,
      monthlyPaymentAmount: item.monthlyPaymentAmount,
    }))
    : []
  return Object.fromEntries([...fields.map((key) => [key, data[key]]), ['loanItems', loanItems], ['policyRate', data.policyRate ?? null], ['assumptions', [...data.assumptions]]])
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
  return result
}
