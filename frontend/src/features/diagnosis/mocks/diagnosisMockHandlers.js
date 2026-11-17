// N-20 DSR 계산 및 N-17 시나리오 상환 여력 재계산 mock 핸들러
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'
import { ApiError } from '../../../common/api/ApiError.js'
import {
  evaluateDsrRisk,
  evaluateHealthLevel,
  HEALTH_RISK_THRESHOLDS,
  SAMPLE_CASH_FLOW_BASE,
  SAMPLE_INCOME_VOLATILITY,
  SAMPLE_MONTHLY_INCOMES,
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
  const incomeChangePercent = Number(query?.get('incomeChangePercent') ?? 0)
  const expenseChangePercent = Number(query?.get('expenseChangePercent') ?? 0)
  const loanPaymentChangePercent = Number(query?.get('loanPaymentChangePercent') ?? 0)
  // N-21-2 예측 기간은 실제 API처럼 없거나 0이면 6개월, 3·6·12만 받고 그 밖은 400이다.
  const requestedMonths = Number(query?.get('forecastMonths') ?? 0)
  if (requestedMonths !== 0 && ![3, 6, 12].includes(requestedMonths)) {
    const message = '예측 기간은 3·6·12개월 중 하나여야 합니다.'
    throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field: 'forecastMonths', message }] })
  }
  const forecastMonths = requestedMonths || 6

  const { baseMonthlyIncome, monthlyTotalExpense, monthlyLoanPayment } = SAMPLE_CASH_FLOW_BASE
  const forecastIncome = Math.round(baseMonthlyIncome * (1 + incomeChangePercent / 100))
  const forecastExpense = Math.round(monthlyTotalExpense * (1 + expenseChangePercent / 100))
  const forecastLoanPayment = Math.round(monthlyLoanPayment * (1 + loanPaymentChangePercent / 100))
  const netCashFlow = forecastIncome - (forecastExpense + forecastLoanPayment)

  const lastMonth = SAMPLE_MONTHLY_INCOMES[SAMPLE_MONTHLY_INCOMES.length - 1].yearMonth
  const [lastYear, lastMonthNumber] = lastMonth.split('-').map(Number)
  const monthlyForecasts = Array.from({ length: forecastMonths }, (_, index) => {
    const date = new Date(lastYear, lastMonthNumber + index, 1)
    const forecastYearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return {
      forecastYearMonth,
      forecastIncome,
      forecastExpense,
      forecastLoanPayment,
      netCashFlow,
      deficit: netCashFlow < 0,
    }
  })

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
    worstForecastMonth: monthlyForecasts[0].forecastYearMonth,
    worstNetCashFlow: netCashFlow,
    totalAccumulatedSurplus: netCashFlow * forecastMonths,
  }
}

// mock 핸들러 등록
registerMockHandlers({
  'POST /api/diagnosis/dsr/calculate': handleDsrCalculate,
  'POST /api/diagnosis/scenario/recalculate': handleScenarioRecalculate,
  'POST /api/diagnosis/financial-health/calculate': handleFinancialHealth,
  'GET /api/diagnosis/income-volatility': handleIncomeVolatility,
  'GET /api/diagnosis/cash-flow/forecast': handleCashFlowForecast,
})

