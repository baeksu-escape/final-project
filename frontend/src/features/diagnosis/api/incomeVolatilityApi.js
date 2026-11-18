import { getIncomeVolatility as fetchIncomeVolatility } from './diagnosisApi.js'

// N-22-3·4·5 로그인 회원의 소득 변동성 결과를 서버 계약으로 조회한다.
export async function getIncomeVolatility({ userId }) {
  if (!(typeof userId === 'string' && userId.trim()) && !(Number.isSafeInteger(userId) && userId > 0)) throw new Error('로그인 회원을 확인해 주세요.')
  const data = await fetchIncomeVolatility()
  if (!data || !Array.isArray(data.deficitMonths)) throw new Error('소득 변동성 응답 형식이 올바르지 않습니다.')
  return {
    stats: {
      averageAmount: data.meanIncome,
      medianAmount: data.medianIncome,
      standardDeviation: data.standardDeviation,
      coefficientOfVariationPct: data.meanIncome === 0 ? null : data.incomeCv,
      zeroIncomeMonthCount: data.zeroIncomeMonthsCount,
      lowestMonth: { baseMonth: data.offPeakMonth, incomeAmount: data.offPeakIncome },
      recentThreeAverageAmount: data.recent3MonthsAverageIncome,
      recentThreeVsAnnualAverageAmount: data.recent3MonthsDiff,
      gapAmount: data.peakOffPeakGap,
    },
    fixedExpenseRatio: data.offPeakIncome === 0 ? null : data.fixedExpenseToLowestIncomeRatio,
    // N-22-5 가장 가까운 비수기 요약 — 경고가 있고 달이 정해졌을 때만 값을 만들고, 아니면 null이다.
    nearestDeficit: data.hasDeficitWarning && data.nearestDeficitMonth
      ? { baseMonth: data.nearestDeficitMonth, monthsUntil: data.monthsUntilNearest, reserveAmount: data.recommendedReserveAmount }
      : null,
    deficits: data.deficitMonths.map((item) => ({
      baseMonth: item.yearMonth,
      incomeAmount: item.income,
      shortageAmount: item.shortfallAmount,
      monthsUntilNextOccurrence: item.monthsUntilNext,
    })),
  }
}
