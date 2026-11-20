// N-22 소득 변동성 mock 임시 계산 — 정식 계산은 광희 FP-203 백엔드 API가 맡는다. 연동 전 화면 시연용으로만 쓰며, 응답 계약도 아직 확정되지 않았다.
// 계산식은 이 파일 한 벌에만 둔다(utils/incomeStats.js는 기존 이름 호환을 위한 전달만 한다).
const MONTH_COUNT = 12

// N-22-1 최근 월 자료 검사에 쓸 YYYY-MM 형식을 확인한다.
function parseMonth(value) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value ?? '')
  return match ? { year: Number(match[1]), month: Number(match[2]) } : null
}

// N-22-5 마지막 입력월에서 비수기 재도래 월까지 달력을 기준으로 이동한다.
function moveMonth(value, offset) {
  const parsed = parseMonth(value)
  if (!parsed) return null
  const index = parsed.year * 12 + parsed.month - 1 + offset
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`
}

// N-22-3 지표 계산 전에 연속된 12개월과 원 단위 소득을 확인한다.
function isValidIncomeMonths(months) {
  if (!Array.isArray(months) || months.length !== MONTH_COUNT) return false
  return months.every((item, index) => {
    if (!item || !parseMonth(item.baseMonth)) return false
    if (item.incomeAmount !== null && (!Number.isSafeInteger(item.incomeAmount) || item.incomeAmount < 0)) return false
    return index === 0 || item.baseMonth === moveMonth(months[index - 1].baseMonth, 1)
  })
}

// N-21-7·N-22-4 소득 격차 — 12개월 소득 중 가장 높은 달과 낮은 달의 차이를 공통 계산한다.
export function calculateIncomeGap(months) {
  if (!isValidIncomeMonths(months) || months.some(({ incomeAmount }) => incomeAmount === null)) return null
  const lowest = months.reduce((result, current) => current.incomeAmount < result.incomeAmount ? current : result)
  const highest = months.reduce((result, current) => current.incomeAmount > result.incomeAmount ? current : result)
  return {
    lowestMonth: { baseMonth: lowest.baseMonth, incomeAmount: lowest.incomeAmount },
    highestMonth: { baseMonth: highest.baseMonth, incomeAmount: highest.incomeAmount },
    gapAmount: highest.incomeAmount - lowest.incomeAmount,
  }
}

// N-22-3 변동성 지표 — 완결된 12개월 소득으로 평균·중앙값·CV와 최근 3개월 비교값을 계산한다.
export function calculateIncomeStats(months) {
  if (!isValidIncomeMonths(months) || months.some(({ incomeAmount }) => incomeAmount === null)) return null
  const incomes = months.map(({ incomeAmount }) => incomeAmount)
  const total = incomes.reduce((sum, amount) => sum + amount, 0)
  if (!Number.isSafeInteger(total)) return null

  const averageAmount = total / MONTH_COUNT
  const sorted = [...incomes].sort((left, right) => left - right)
  const medianAmount = (sorted[5] + sorted[6]) / 2
  const variance = incomes.reduce((sum, amount) => sum + (amount - averageAmount) ** 2, 0) / MONTH_COUNT
  const standardDeviation = Math.sqrt(variance)
  const lowestIndex = incomes.indexOf(sorted[0])
  const recentThreeAverageAmount = incomes.slice(-3).reduce((sum, amount) => sum + amount, 0) / 3
  const gap = calculateIncomeGap(months)

  return {
    averageAmount,
    medianAmount,
    standardDeviation,
    coefficientOfVariationPct: averageAmount === 0 ? null : standardDeviation / averageAmount * 100,
    zeroIncomeMonthCount: incomes.filter((amount) => amount === 0).length,
    lowestMonth: { baseMonth: months[lowestIndex].baseMonth, incomeAmount: sorted[0] },
    recentThreeAverageAmount,
    recentThreeVsAnnualAverageAmount: recentThreeAverageAmount - averageAmount,
    gapAmount: gap?.gapAmount ?? null,
  }
}

// N-22-5 소득 부족 달 — 월 고정지출보다 소득이 낮았던 달과 12개월 주기의 다음 도래월을 정리한다.
export function calculateIncomeDeficitMonths(months, fixedExpenseAmount) {
  if (!isValidIncomeMonths(months) || months.some(({ incomeAmount }) => incomeAmount === null)
    || !Number.isSafeInteger(fixedExpenseAmount) || fixedExpenseAmount < 0) return null

  return months.flatMap(({ baseMonth, incomeAmount }, index) => {
    if (incomeAmount >= fixedExpenseAmount) return []
    return [{
      baseMonth,
      incomeAmount,
      shortageAmount: fixedExpenseAmount - incomeAmount,
      nextOccurrenceMonth: moveMonth(months[MONTH_COUNT - 1].baseMonth, index + 1),
      monthsUntilNextOccurrence: index + 1,
    }]
  }).sort((left, right) => left.monthsUntilNextOccurrence - right.monthsUntilNextOccurrence)
}

// N-22-3·4·5 mock 응답 한 건 — 기준 12개월과 월 고정지출로 화면이 그대로 보여 줄 값을 만든다. 소득 NULL·고정지출 NULL은 0으로 바꾸지 않는다.
export function buildIncomeVolatilityMock(baseline) {
  const months = baseline?.months
  const fixedExpenseAmount = baseline?.fixedExpenseAmount ?? null
  const stats = calculateIncomeStats(months)
  const deficits = calculateIncomeDeficitMonths(months, fixedExpenseAmount)
  const validFixed = Number.isSafeInteger(fixedExpenseAmount) && fixedExpenseAmount >= 0
  let unavailableReason = null
  if (!stats) unavailableReason = Array.isArray(months) && months.some((item) => item?.incomeAmount === null) ? 'INCOME_MISSING' : 'INCOME_INVALID'
  return {
    stats,
    deficits,
    fixedExpenseAmount,
    lowestMonthVsFixedExpenseAmount: stats && validFixed ? stats.lowestMonth.incomeAmount - fixedExpenseAmount : null,
    unavailableReason,
    source: 'mock',
  }
}
