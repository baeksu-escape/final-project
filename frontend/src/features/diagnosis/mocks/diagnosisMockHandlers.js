// N-20 DSR 계산 및 N-17 시나리오 상환 여력 재계산 mock 핸들러
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'
import { ApiError } from '../../../common/api/ApiError.js'
import { ROLES } from '../../../common/config/roles.js'
import { createFinanceMockData } from './financeMockData.js'
import {
  evaluateDsrRisk,
  evaluateHealthLevel,
  HEALTH_RISK_THRESHOLDS,
  SAMPLE_CASH_FLOW_BASE,
  SAMPLE_EXPECTED_SCORE_BASE,
  SAMPLE_INCOME_VOLATILITY,
  SAMPLE_MONTHLY_INCOMES,
  SAMPLE_SCENARIO_BASE,
} from './diagnosisMockData.js'

// N-20-4 DSR(연소득 대비 연원리금 상환비율) 및 위험 단계 계산
function handleDsrCalculate({ body }) {
  const annualIncome = Number(body?.annualIncome ?? 0)
  const annualDebtService = Number(body?.annualDebtService ?? 0)

  // 0 나누기 방지 및 반올림 처리
  let dsrRatio = 0
  if (annualIncome > 0) {
    dsrRatio = Math.round((annualDebtService / annualIncome) * 10000) / 100
  }

  const risk = evaluateDsrRisk(dsrRatio)

  return {
    annualIncome,
    annualDebtService,
    dsrRatio,
    riskLevel: risk.level,
    riskBadgeText: risk.label,
    description: risk.description,
  }
}

// N-17-4 시나리오(금리·소득·지출 변화) 반영 상환 여력 재계산 (N-17-3, N-21-4 공통 틀)
function handleScenarioRecalculate({ body }) {
  const baseMonthlyIncome = Number(body?.baseMonthlyIncome ?? 3500000)
  const baseMonthlyFixedExpense = Number(body?.baseMonthlyFixedExpense ?? 1200000)
  const baseLoanBalance = Number(body?.baseLoanBalance ?? 30000000)
  const baseRate = Number(body?.baseInterestRate ?? 5.5)

  const interestRateChange = Number(body?.interestRateChange ?? 0) // 예: +1.5%p
  const incomeChangePercent = Number(body?.incomeChangePercent ?? 0) // 예: -10%
  const expenseChangePercent = Number(body?.expenseChangePercent ?? 0) // 예: +5%

  // 기존 월 이자 및 월 잉여금
  const currentMonthlyInterest = Math.round((baseLoanBalance * (baseRate / 100)) / 12)
  const currentMonthlySurplus = baseMonthlyIncome - baseMonthlyFixedExpense - currentMonthlyInterest
  const currentBurden = baseMonthlyIncome > 0 ? (currentMonthlyInterest / baseMonthlyIncome) * 100 : 0

  // 시나리오 적용 후 수치 계산
  const scenarioRate = Math.max(0.1, baseRate + interestRateChange)
  const scenarioMonthlyInterest = Math.round((baseLoanBalance * (scenarioRate / 100)) / 12)
  const scenarioMonthlyInterestDiff = scenarioMonthlyInterest - currentMonthlyInterest

  const scenarioIncome = Math.round(baseMonthlyIncome * (1 + incomeChangePercent / 100))
  const scenarioExpense = Math.round(baseMonthlyFixedExpense * (1 + expenseChangePercent / 100))
  const scenarioMonthlySurplus = scenarioIncome - scenarioExpense - scenarioMonthlyInterest
  const monthlySurplusDiff = scenarioMonthlySurplus - currentMonthlySurplus

  const scenarioBurden = scenarioIncome > 0 ? (scenarioMonthlyInterest / scenarioIncome) * 100 : 0

  // 적자 발생 시 기존 유동자산(가정: 월소득의 6배)으로 버틸 수 있는 개월 수 계산
  const assumedLiquidAssets = baseMonthlyIncome * 6
  let sustainableMonths = null
  let isDeficit = false

  if (scenarioMonthlySurplus < 0) {
    isDeficit = true
    const monthlyDeficit = Math.abs(scenarioMonthlySurplus)
    sustainableMonths = Math.max(1, Math.floor(assumedLiquidAssets / monthlyDeficit))
  }

  return {
    currentMonthlySurplus,
    scenarioMonthlySurplus,
    monthlySurplusDiff,
    scenarioMonthlyInterestDiff,
    currentRepaymentBurden: Math.round(currentBurden * 10) / 10,
    scenarioRepaymentBurden: Math.round(scenarioBurden * 10) / 10,
    sustainableMonths,
    isDeficit,
  }
}

// N-16-1·2 건전성 지표 mock — 백엔드와 같은 규칙(소수 둘째 자리 반올림, 나누는 값이 0 이하면 null)으로 계산한다.
function handleFinancialHealth({ body }) {
  const totalAsset = Number(body?.totalAsset ?? 0)
  const annualIncome = Number(body?.annualIncome ?? 0)
  const totalDebt = Number(body?.totalDebt ?? 0)
  const annualDebtService = Number(body?.annualDebtService ?? 0)
  const netAsset = totalAsset - totalDebt

  const ratio = (numerator, denominator) =>
    denominator > 0 ? Math.round((numerator / denominator) * 10000) / 100 : null

  const repaymentBurdenRatio = ratio(annualDebtService, annualIncome)
  const debtToAssetRatio = ratio(totalDebt, totalAsset)
  const debtToNetAssetRatio = ratio(totalDebt, netAsset)

  return {
    totalAsset,
    totalDebt,
    netAsset,
    repaymentBurdenRatio,
    repaymentBurdenLevel: evaluateHealthLevel(repaymentBurdenRatio, HEALTH_RISK_THRESHOLDS.repaymentBurden),
    debtToAssetRatio,
    debtToAssetLevel: evaluateHealthLevel(debtToAssetRatio, HEALTH_RISK_THRESHOLDS.debtToAsset),
    debtToNetAssetRatio,
    debtToNetAssetLevel: evaluateHealthLevel(debtToNetAssetRatio, HEALTH_RISK_THRESHOLDS.debtToNetAsset),
  }
}

// N-22 저장 데이터 기반 소득 변동성 진단 mock — 로그인한 mock 회원이 누구든 시드 회원 2번 예시를 돌려준다.
function handleIncomeVolatility({ token }) {
  requireMockUser(token) // 실제 API처럼 로그인하지 않았으면 401
  return structuredClone(SAMPLE_INCOME_VOLATILITY)
}

// N-21 저장 데이터 기반 현금흐름 전망 mock — 쿼리의 변화율·기간으로 마지막 입력월 다음 달부터 월별 전망을 만든다.
// query는 공용 mock이 넘기는 URLSearchParams라 get()으로 읽는다(값이 없으면 null → 0).
function handleCashFlowForecast({ query, token }) {
  requireMockUser(token) // 실제 API처럼 로그인하지 않았으면 401
  // 변화율(%)은 실제 API가 소수 칸(double)으로 받아, 빈 값이나 숫자가 아닌 값이면 400이다. mock도 같게 막는다(문구는 한국어).
  const readPercent = (field) => {
    const raw = query?.get(field)
    if (raw === null || raw === undefined) return 0
    const value = raw.trim() === '' ? Number.NaN : Number(raw)
    if (!Number.isFinite(value)) {
      const message = '숫자로 입력해 주세요.'
      throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field, message }] })
    }
    return value
  }
  const incomeChangePercent = readPercent('incomeChangePercent')
  const expenseChangePercent = readPercent('expenseChangePercent')
  const loanPaymentChangePercent = readPercent('loanPaymentChangePercent')
  // N-21-2 예측 기간은 실제 API처럼 없거나 0이면 6개월, 3·6·12만 받고 그 밖은 400이다.
  // 빈 값(forecastMonths=)은 실제 API가 숫자로 바꾸지 못해 400을 내므로 mock도 400으로 맞춘다.
  const rawMonths = query?.get('forecastMonths')
  const requestedMonths = rawMonths === '' ? Number.NaN : Number(rawMonths ?? 0)
  if (requestedMonths !== 0 && ![3, 6, 12].includes(requestedMonths)) {
    const message = '예측 기간은 3·6·12개월 중 하나여야 합니다.'
    throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field: 'forecastMonths', message }] })
  }
  const forecastMonths = requestedMonths || 6

  // N-21-2 화면 조건 — 실제 API와 같은 검사·문구. 모두 생략할 수 있다.
  const invalid = (field, message) =>
    new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field, message }] })
  // 숫자 조건은 실제 API처럼 없거나 빈 값이면 생략(null)으로 본다. Number('')가 0이 되어 고정지출 0원으로 계산되는 것을 막는다.
  const optionalNumber = (raw) => (raw === null || raw === undefined || raw === '' ? null : Number(raw))
  const incomeVariationPct = optionalNumber(query?.get('incomeVariationPct'))
  if (incomeVariationPct !== null && !(Number.isInteger(incomeVariationPct) && incomeVariationPct >= 0 && incomeVariationPct <= 200)) {
    throw invalid('incomeVariationPct', '소득 변동 폭은 0~200% 정수여야 합니다.')
  }
  const fixedExpenseAmount = optionalNumber(query?.get('fixedExpenseAmount'))
  if (fixedExpenseAmount !== null && !(Number.isSafeInteger(fixedExpenseAmount) && fixedExpenseAmount >= 0)) {
    throw invalid('fixedExpenseAmount', '월 고정 지출은 0 이상의 원 단위 정수여야 합니다.')
  }
  const paymentStatus = query?.get('paymentStatus') ?? null
  if (paymentStatus !== null && !['ON_TIME', 'DELAYED'].includes(paymentStatus)) {
    throw invalid('paymentStatus', '납부 상태를 선택해 주세요.')
  }

  const { baseMonthlyIncome, monthlyTotalExpense, monthlyFixedExpense, monthlyLoanPayment } = SAMPLE_CASH_FLOW_BASE
  // 고정지출을 보내면 저장된 고정지출(FIXED) 자리만 그 값으로 바꾼다.
  const baseExpense = fixedExpenseAmount === null ? monthlyTotalExpense : fixedExpenseAmount + (monthlyTotalExpense - monthlyFixedExpense)
  const forecastExpense = Math.round(baseExpense * (1 + expenseChangePercent / 100))
  const forecastLoanPayment = Math.round(monthlyLoanPayment * (1 + loanPaymentChangePercent / 100))
  // 소득 변동 폭: 평균 + (과거 같은 달 − 평균) × % (같은 달이 없으면 평균, 0원 아래로 안 내려감)
  const monthIncome = (month) => {
    if (incomeVariationPct === null) return baseMonthlyIncome
    const same = SAMPLE_MONTHLY_INCOMES.find(({ yearMonth }) => Number(yearMonth.slice(5)) === month)
    const past = same ? same.income : baseMonthlyIncome
    return Math.round(Math.max(0, baseMonthlyIncome + ((past - baseMonthlyIncome) * incomeVariationPct) / 100))
  }

  const lastMonth = SAMPLE_MONTHLY_INCOMES[SAMPLE_MONTHLY_INCOMES.length - 1].yearMonth
  const [lastYear, lastMonthNumber] = lastMonth.split('-').map(Number)
  const monthlyForecasts = Array.from({ length: forecastMonths }, (_, index) => {
    const date = new Date(lastYear, lastMonthNumber + index, 1)
    const forecastYearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const forecastIncome = Math.round(monthIncome(date.getMonth() + 1) * (1 + incomeChangePercent / 100))
    const netCashFlow = forecastIncome - (forecastExpense + forecastLoanPayment)
    return {
      forecastYearMonth,
      forecastIncome,
      forecastExpense,
      forecastLoanPayment,
      netCashFlow,
      deficit: netCashFlow < 0,
    }
  })

  // 순현금이 가장 적은 달(같으면 앞선 달)
  const worst = monthlyForecasts.reduce((min, item) => (item.netCashFlow < min.netCashFlow ? item : min))

  const pastDeficitMonthsCount = SAMPLE_MONTHLY_INCOMES.filter(
    ({ income }) => monthlyTotalExpense > income
  ).length

  return {
    pastDeficitMonthsCount,
    peakOffPeakGap: SAMPLE_INCOME_VOLATILITY.peakOffPeakGap,
    peakMonth: SAMPLE_INCOME_VOLATILITY.peakMonth,
    peakIncome: SAMPLE_INCOME_VOLATILITY.peakIncome,
    offPeakMonth: SAMPLE_INCOME_VOLATILITY.offPeakMonth,
    offPeakIncome: SAMPLE_INCOME_VOLATILITY.offPeakIncome,
    monthlyForecasts,
    worstForecastMonth: worst.forecastYearMonth,
    worstNetCashFlow: worst.netCashFlow,
    totalAccumulatedSurplus: monthlyForecasts.reduce((sum, item) => sum + item.netCashFlow, 0),
    // N-21-9 과거 월 실적 (오래된 달 → 최근 달). 실제 API처럼 지출은 매달 같은 월 지출 합계다.
    months: SAMPLE_MONTHLY_INCOMES.map(({ yearMonth, income }) => ({
      baseMonth: yearMonth,
      incomeAmount: income,
      expenseAmount: monthlyTotalExpense,
    })),
    // N-21-1·2 화면 조건의 처음 값(FP-170 11/19) — 조건을 적용하기 전 저장값. 기타 지출 = 합계 − 고정, 원리금은 지출에 없다.
    baseFixedExpenseAmount: monthlyFixedExpense,
    baseOtherExpenseAmount: monthlyTotalExpense - monthlyFixedExpense,
    baseMonthlyLoanPayment: monthlyLoanPayment,
  }
}

// N-21-8 DIAG-09 예상 대안 점수 mock — 본문은 현금흐름 전망 조건과 같은 이름이다. 검사·문구는 실제 API와 같다.
// 점수는 "평균 소득 변화율 × 1점 − 월 지출 변화율 × 0.5점"의 mock 규칙이다(진짜 모델 아님). 납부 상태는 실제 API처럼 점수에 쓰지 않는다.
function handleExpectedScore({ body, token }) {
  requireMockUser(token) // 실제 API처럼 로그인하지 않았으면 401
  const condition = body ?? {}
  const invalid = (field, message) =>
    new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field, message }] })
  const readPercent = (field) => {
    const value = condition[field]
    if (value === undefined || value === null) return 0
    if (typeof value !== 'number' || !Number.isFinite(value)) throw invalid(field, '숫자로 입력해 주세요.')
    return value
  }
  const incomeChangePercent = readPercent('incomeChangePercent')
  const expenseChangePercent = readPercent('expenseChangePercent')
  const { incomeVariationPct = null, fixedExpenseAmount = null, paymentStatus = null } = condition
  if (incomeVariationPct !== null && !(Number.isInteger(incomeVariationPct) && incomeVariationPct >= 0 && incomeVariationPct <= 200)) {
    throw invalid('incomeVariationPct', '소득 변동 폭은 0~200% 정수여야 합니다.')
  }
  if (fixedExpenseAmount !== null && !(Number.isSafeInteger(fixedExpenseAmount) && fixedExpenseAmount >= 0)) {
    throw invalid('fixedExpenseAmount', '월 고정 지출은 0 이상의 원 단위 정수여야 합니다.')
  }
  if (paymentStatus !== null && !['ON_TIME', 'DELAYED'].includes(paymentStatus)) {
    throw invalid('paymentStatus', '납부 상태를 선택해 주세요.')
  }

  // 소득 변동 폭은 평균을 바꾸지 않으므로(0원 아래로 잘리는 달 제외) mock 점수에는 변화율만 쓴다.
  const { monthlyTotalExpense, monthlyFixedExpense } = SAMPLE_CASH_FLOW_BASE
  const baseExpense = fixedExpenseAmount === null ? monthlyTotalExpense : fixedExpenseAmount + (monthlyTotalExpense - monthlyFixedExpense)
  const expenseRatioPct = ((baseExpense * (1 + expenseChangePercent / 100)) / monthlyTotalExpense - 1) * 100
  const base = SAMPLE_EXPECTED_SCORE_BASE
  const expectedScore = Math.min(1000, Math.max(0, Math.round(
    base.score + incomeChangePercent * base.incomePointPerPercent - expenseRatioPct * base.expensePointPerPercent,
  )))
  const gradeOf = (score) => {
    if (score >= base.gradeCutoffs.good) return 'GOOD'
    return score >= base.gradeCutoffs.standard ? 'STANDARD' : 'CAUTION'
  }
  return {
    currentScore: base.score,
    currentGradeBandCode: gradeOf(base.score),
    expectedScore,
    expectedGradeBandCode: gradeOf(expectedScore),
    scoreDiff: expectedScore - base.score,
    modelVersion: base.modelVersion,
    baseModelVersion: base.modelVersion, // mock은 현재·예상 점수를 같은 모델로 본다(다르면 화면이 모델 변경 안내)
    baseRequestId: base.baseRequestId,
    paymentStatusApplied: false,
  }
}

// N-15-3 로그인 회원의 직군별 시연 평균을 회원 평균 API 형태로 제공한다.
function handlePeerBenchmark({ token }) {
  const user = requireMockUser(token)
  if (user.role === ROLES.ADMIN) throw new ApiError(403, '일반 회원만 이용할 수 있습니다.')
  const empty = { memberCount: null, annualIncomeAmount: null, totalAssetAmount: null, totalDebtAmount: null }
  const counts = { EMPLOYEE: 120, SELF_EMPLOYED: 80, FREELANCER: 60 }
  const sameWorkerType = counts[user.jobType]
    ? { memberCount: counts[user.jobType], ...createFinanceMockData(user.jobType).asset.peer }
    : { ...empty }
  return { workerTypeCode: user.jobType, ageBandCode: null, sameWorkerType, sameAgeBand: { ...empty } }
}

// N-17-1 DIAG-04 시나리오 기준값 mock — 실제 API(GET /api/members/me/scenario-base)와 같은 모양이다.
function handleScenarioBase({ token }) {
  requireMockUser(token) // 실제 API처럼 로그인하지 않았으면 401
  const b = SAMPLE_SCENARIO_BASE
  // survivableAssetRatioPct는 mock 계산용 값이라 응답에 넣지 않는다(실제 응답 모양과 같게).
  return structuredClone({
    monthlyIncomeAmount: b.monthlyIncomeAmount,
    monthlyExpenseAmount: b.monthlyExpenseAmount,
    monthlyPaymentAmount: b.monthlyPaymentAmount,
    variableLoanBalanceAmount: b.variableLoanBalanceAmount,
    totalAssetAmount: b.totalAssetAmount,
    policyRate: b.policyRate,
    assumptions: b.assumptions,
  })
}

// 서버 BigDecimal HALF_UP과 같은 원 단위 반올림: 0.5는 0에서 먼 쪽(-0.5 → -1). Math.round는 -0.5를 0으로 올려 서버와 달라진다.
function roundHalfUp(value) {
  return Math.sign(value) * Math.round(Math.abs(value)) || 0 // -0은 0으로
}

// 한쪽(지금 또는 조건 반영 후)의 상환 여력. 상환 부담률은 서버(N-16-1)처럼 연 원리금 ÷ 연소득 × 100, 소수 둘째 자리, 소득 0 이하면 null.
function scenarioSide(income, expense, payment) {
  const dsrPct = income > 0 ? Math.round(((payment * 12) / (income * 12)) * 10000) / 100 : null
  return {
    monthlyIncomeAmount: income,
    monthlyExpenseAmount: expense,
    monthlyPaymentAmount: payment,
    monthlySurplusAmount: income - expense - payment,
    dsrPct,
  }
}

// N-17-2~4 DIAG-04 시나리오 재계산 mock — 검사 범위·문구·계산 규칙은 실제 API(ScenarioService)와 같다. 생략한 조건은 0(변화 없음).
function handleMemberScenarioRecalculate({ body, token }) {
  requireMockUser(token) // 실제 API처럼 로그인하지 않았으면 401
  const condition = body ?? {}
  const readPct = (field, min, max, message) => {
    const value = condition[field]
    if (value === undefined || value === null) return 0
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field, message }] })
    }
    return value
  }
  const ratePctPoint = readPct('ratePctPoint', -5, 10, '금리 변화는 -5~+10%p 사이로 입력해 주세요.')
  const incomePct = readPct('incomePct', -100, 100, '소득 변화는 -100~+100% 사이로 입력해 주세요.')
  const expensePct = readPct('expensePct', -50, 100, '지출 변화는 -50~+100% 사이로 입력해 주세요.')

  const b = SAMPLE_SCENARIO_BASE
  // 월 이자 변화 = Σ 변동금리 잔액 × (max(금리 + 변화, 0) − 금리) ÷ 100 ÷ 12. 대출마다 금리는 0% 아래로 내려가지 않고,
  // 합계를 낸 뒤 서버와 같은 HALF_UP으로 한 번만 반올림한다.
  const interestSum = b.variableLoans.reduce(
    (sum, loan) => sum + loan.balanceAmount * (Math.max(loan.annualRatePct + ratePctPoint, 0) - loan.annualRatePct),
    0,
  )
  const interestChange = roundHalfUp(interestSum / 1200)
  // 이자 변화는 변동금리 대출의 상환액에만 더한다(0 아래로는 내려가지 않음). 고정금리 상환액은 그대로다.
  const variablePayment = b.variableLoans.reduce((sum, loan) => sum + loan.monthlyPaymentAmount, 0)
  const fixedPayment = b.monthlyPaymentAmount - variablePayment
  const current = scenarioSide(b.monthlyIncomeAmount, b.monthlyExpenseAmount, b.monthlyPaymentAmount)
  const changed = scenarioSide(
    roundHalfUp(b.monthlyIncomeAmount * (1 + incomePct / 100)),
    roundHalfUp(b.monthlyExpenseAmount * (1 + expensePct / 100)),
    fixedPayment + Math.max(0, variablePayment + interestChange),
  )
  const surplusDiffAmount = changed.monthlySurplusAmount - current.monthlySurplusAmount
  // 적자일 때만 ⌊총자산 × 25% ÷ 월 부족액⌋. 흑자이거나 총자산 미입력이면 null
  const survivableMonths = changed.monthlySurplusAmount < 0 && b.totalAssetAmount !== null
    ? Math.floor((b.totalAssetAmount * b.survivableAssetRatioPct) / 100 / -changed.monthlySurplusAmount)
    : null
  let verdict = 'STILL_POSITIVE'
  if (changed.monthlySurplusAmount < 0) verdict = 'SHORTFALL'
  else if (surplusDiffAmount > 0) verdict = 'IMPROVED'
  return {
    current,
    changed,
    monthlyInterestChangeAmount: interestChange,
    surplusDiffAmount,
    survivableMonths,
    verdict,
    assumptions: [...b.assumptions],
  }
}

// mock 핸들러 등록
registerMockHandlers({
  'GET /api/members/me/peer-benchmark': handlePeerBenchmark,
  'POST /api/diagnosis/dsr/calculate': handleDsrCalculate,
  'POST /api/diagnosis/scenario/recalculate': handleScenarioRecalculate,
  'POST /api/diagnosis/financial-health/calculate': handleFinancialHealth,
  'GET /api/members/me/income-volatility': handleIncomeVolatility,
  'GET /api/members/me/cash-flow-forecast': handleCashFlowForecast,
  'POST /api/members/me/cash-flow-expected-score': handleExpectedScore,
  'GET /api/members/me/scenario-base': handleScenarioBase,
  'POST /api/members/me/scenario-recalculate': handleMemberScenarioRecalculate,
})

