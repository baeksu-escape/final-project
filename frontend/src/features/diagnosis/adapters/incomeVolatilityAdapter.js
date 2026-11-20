// N-22 소득 변동성 응답 adapter — 응답 모양을 검사해 화면 모델로 옮긴다. FP-203 정식 응답 계약이 정해지면 이 파일만 맞춘다(지금 모양은 임시).
const isAmount = (value) => Number.isSafeInteger(value) && value >= 0
const isMoney = (value) => Number.isFinite(value)
const isMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value ?? '')
const REASONS = ['INCOME_MISSING', 'INCOME_INVALID']

function malformed(field) {
  return new Error(`소득 변동성 응답 형식이 올바르지 않습니다(${field}).`)
}

// N-22-3 지표 묶음. 값이 없으면 null을 그대로 둔다(0으로 바꾸지 않는다).
function adaptStats(stats) {
  if (stats === null || stats === undefined) return null
  for (const key of ['averageAmount', 'medianAmount', 'standardDeviation', 'recentThreeAverageAmount', 'recentThreeVsAnnualAverageAmount']) {
    if (!isMoney(stats[key])) throw malformed(`stats.${key}`)
  }
  if (stats.coefficientOfVariationPct !== null && !(isMoney(stats.coefficientOfVariationPct) && stats.coefficientOfVariationPct >= 0)) throw malformed('stats.coefficientOfVariationPct')
  if (!Number.isSafeInteger(stats.zeroIncomeMonthCount) || stats.zeroIncomeMonthCount < 0) throw malformed('stats.zeroIncomeMonthCount')
  if (!isMonth(stats.lowestMonth?.baseMonth) || !isAmount(stats.lowestMonth?.incomeAmount)) throw malformed('stats.lowestMonth')
  if (stats.gapAmount !== null && !isAmount(stats.gapAmount)) throw malformed('stats.gapAmount')
  return {
    averageAmount: stats.averageAmount,
    medianAmount: stats.medianAmount,
    standardDeviation: stats.standardDeviation,
    coefficientOfVariationPct: stats.coefficientOfVariationPct,
    zeroIncomeMonthCount: stats.zeroIncomeMonthCount,
    lowestMonth: { baseMonth: stats.lowestMonth.baseMonth, incomeAmount: stats.lowestMonth.incomeAmount },
    recentThreeAverageAmount: stats.recentThreeAverageAmount,
    recentThreeVsAnnualAverageAmount: stats.recentThreeVsAnnualAverageAmount,
    gapAmount: stats.gapAmount,
  }
}

// N-22-5 부족 달 목록. null은 "확인할 수 없음", 빈 배열은 "부족 달 없음"으로 구분한다.
function adaptDeficits(deficits) {
  if (deficits === null || deficits === undefined) return null
  if (!Array.isArray(deficits)) throw malformed('deficits')
  return deficits.map((item, index) => {
    if (!isMonth(item?.baseMonth) || !isAmount(item.incomeAmount) || !isAmount(item.shortageAmount)
      || !isMonth(item.nextOccurrenceMonth) || !Number.isSafeInteger(item.monthsUntilNextOccurrence) || item.monthsUntilNextOccurrence < 1) {
      throw malformed(`deficits[${index}]`)
    }
    return { baseMonth: item.baseMonth, incomeAmount: item.incomeAmount, shortageAmount: item.shortageAmount,
      nextOccurrenceMonth: item.nextOccurrenceMonth, monthsUntilNextOccurrence: item.monthsUntilNextOccurrence }
  })
}

// N-22-3·4·5 응답 전체를 화면 모델로 바꾼다.
export function adaptIncomeVolatility(raw) {
  if (!raw || typeof raw !== 'object') throw malformed('응답 본문')
  if (raw.fixedExpenseAmount !== null && raw.fixedExpenseAmount !== undefined && !isAmount(raw.fixedExpenseAmount)) throw malformed('fixedExpenseAmount')
  if (raw.lowestMonthVsFixedExpenseAmount !== null && raw.lowestMonthVsFixedExpenseAmount !== undefined
    && !Number.isSafeInteger(raw.lowestMonthVsFixedExpenseAmount)) throw malformed('lowestMonthVsFixedExpenseAmount')
  if (raw.unavailableReason !== null && raw.unavailableReason !== undefined && !REASONS.includes(raw.unavailableReason)) throw malformed('unavailableReason')
  return {
    stats: adaptStats(raw.stats),
    deficits: adaptDeficits(raw.deficits),
    fixedExpenseAmount: raw.fixedExpenseAmount ?? null,
    lowestMonthVsFixedExpenseAmount: raw.lowestMonthVsFixedExpenseAmount ?? null,
    unavailableReason: raw.unavailableReason ?? null,
    source: raw.source ?? null,
  }
}
