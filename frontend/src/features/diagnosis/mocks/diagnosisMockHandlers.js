// N-20 DSR 계산 및 N-17 시나리오 상환 여력 재계산 mock 핸들러
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { evaluateDsrRisk } from './diagnosisMockData.js'

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

// mock 핸들러 등록
registerMockHandlers({
  'POST /api/diagnosis/dsr/calculate': handleDsrCalculate,
  'POST /api/diagnosis/scenario/recalculate': handleScenarioRecalculate,
})

