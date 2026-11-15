const fields = ['monthlyIncomeAmount', 'monthlyExpenseAmount', 'monthlyPaymentAmount', 'variableLoanBalanceAmount', 'totalAssetAmount']

// N-17-1 기준 금액을 검증하고 누락은 그대로 보존한다.
export function adaptBaseline(data) {
  if (!data || typeof data !== 'object') throw new Error('기준 데이터를 확인해 주세요.')
  for (const key of fields) if (data[key] !== null && (!Number.isSafeInteger(data[key]) || data[key] < 0)) throw new Error(`기준 금액을 확인해 주세요: ${key}`)
  if (!Array.isArray(data.assumptions) || data.assumptions.some((item) => typeof item !== 'string')) throw new Error('시연 가정을 확인해 주세요.')
  return Object.fromEntries([...fields.map((key) => [key, data[key]]), ['assumptions', [...data.assumptions]]])
}

// N-17-2 직접 입력 범위와 숫자 유효성을 계산 입구에서 확인한다.
export function adaptConditions(value) {
  const ranges = { ratePctPoint: [-5, 10], incomePct: [-100, 100], expensePct: [-50, 100] }
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 3) throw new Error('시나리오 조건을 확인해 주세요.')
  for (const [key, [min, max]] of Object.entries(ranges)) if (!Number.isFinite(value[key]) || value[key] < min || value[key] > max) throw new Error('시나리오 입력 범위를 확인해 주세요.')
  return { ...value }
}

// N-17-5 계산 결과를 화면 계약으로 전달한다.
export function adaptResponse(result) { return result }
