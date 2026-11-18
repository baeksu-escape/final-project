import { calculateAssetDebt } from '../utils/financeCalculations.js'

const validAmount = (value) => value === null || (Number.isSafeInteger(value) && value >= 0)

// N-16·N-20·N-21 응답의 월·원 단위와 미입력 NULL을 검증해 화면 공통 데이터로 맞춘다.
export function adaptAssetDebtData(raw) {
  const amountKeys = ['totalAssetAmount','annualIncomeAmount','totalDebtAmount','annualPaymentAmount']
  if (!raw || !amountKeys.every((key) => Object.hasOwn(raw, key) && validAmount(raw[key]))) {
    throw new Error('자산·부채 응답의 금액이 올바르지 않습니다.')
  }
  if (!Array.isArray(raw.loans)) throw new Error('대출 목록 응답이 올바르지 않습니다.')
  const loans = raw.loans.map((loan) => {
    const loanKeys = ['loanId','loanTypeName','balanceAmount','annualRatePct','rateTypeCode','remainingMonths','monthlyPaymentAmount']
    if (!loan || typeof loan !== 'object' || !loanKeys.every((key) => Object.hasOwn(loan, key))) throw new Error('대출 항목 응답이 올바르지 않습니다.')
    return {
      loanId: idOrNull(loan.loanId), loanTypeName: stringOrNull(loan.loanTypeName), balanceAmount: amountOrNull(loan.balanceAmount), annualRatePct: finiteOrNull(loan.annualRatePct),
      rateTypeCode: stringOrNull(loan.rateTypeCode), remainingMonths: integerOrNull(loan.remainingMonths), monthlyPaymentAmount: amountOrNull(loan.monthlyPaymentAmount),
    }
  })
  if (!Object.hasOwn(raw, 'peer') || !Array.isArray(raw.assumptions) || raw.assumptions.some((value) => typeof value !== 'string')) throw new Error('시연 가정 응답이 올바르지 않습니다.')
  return { totalAssetAmount: raw.totalAssetAmount ?? null, annualIncomeAmount: raw.annualIncomeAmount ?? null,
    totalDebtAmount: raw.totalDebtAmount ?? null, annualPaymentAmount: raw.annualPaymentAmount ?? null, loans,
    peer: adaptPeer(raw.peer), assumptions: Array.isArray(raw.assumptions) ? raw.assumptions : [],
    derived: calculateAssetDebt(raw, {}) }
}

// N-21 현금흐름 월별 기준 자료는 정확히 12개월 연속이어야 하며 NULL 소득은 그대로 둔다.
export function adaptCashFlowData(raw) {
  // TODO(광희 요청 11/19): 소득이 12개월보다 적은 회원(자영업자·프리랜서)의 months가 짧을 때 화면이 예측을 어떻게 처리할지 정해 달라고 요청(임의 0 채우기 금지).
  if (raw && Array.isArray(raw.months) && raw.months.length < 12) throw new Error('저장된 소득이 12개월보다 적어 현금흐름을 예측할 수 없습니다.')
  if (!raw || !Array.isArray(raw.months) || raw.months.length !== 12
    || !['fixedExpenseAmount','otherExpenseAmount','monthlyPaymentAmount','currentScore'].every((key) => Object.hasOwn(raw, key))) throw new Error('현금흐름 기준 자료는 12개월이 필요합니다.')
  const months = raw.months.map((month) => {
    if (!month || !Object.hasOwn(month, 'incomeAmount') || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month.baseMonth) || !validAmount(month.incomeAmount)) throw new Error('월별 현금흐름 값이 올바르지 않습니다.')
    return { baseMonth: month.baseMonth, incomeAmount: month.incomeAmount ?? null }
  })
  for (let i=1;i<months.length;i++) if (nextMonth(months[i-1].baseMonth) !== months[i].baseMonth) throw new Error('현금흐름 기준 월이 연속되지 않습니다.')
  for (const key of ['fixedExpenseAmount','otherExpenseAmount','monthlyPaymentAmount']) if (!validAmount(raw[key])) throw new Error(`${key} 금액이 올바르지 않습니다.`)
  if (raw.currentScore !== null && (!Number.isInteger(raw.currentScore) || raw.currentScore < 0 || raw.currentScore > 1000)) throw new Error('currentScore가 올바르지 않습니다.')
  return { months, fixedExpenseAmount: raw.fixedExpenseAmount ?? null, otherExpenseAmount: raw.otherExpenseAmount ?? null,
    monthlyPaymentAmount: raw.monthlyPaymentAmount ?? null, currentScore: raw.currentScore ?? null,
    assumptions: Array.isArray(raw.assumptions) && raw.assumptions.every((value) => typeof value === 'string') ? raw.assumptions : [] }
}

// N-21-5 DIAG-08-1 응답을 화면 결과 모양으로 바꾼다(점수 필드는 호출하는 쪽에서 붙인다).
export function adaptCashFlowForecast(raw) {
  const rows = raw?.monthlyForecasts
  if (!Array.isArray(rows) || rows.length === 0 || typeof raw.worstForecastMonth !== 'string'
    || !Number.isSafeInteger(raw.worstNetCashFlow) || !Number.isSafeInteger(raw.totalAccumulatedSurplus)) throw new Error('현금흐름 전망 응답 형식이 올바르지 않습니다.')
  const forecastMonths = rows.map((row) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.forecastYearMonth) || !Number.isSafeInteger(row.forecastIncome) || !Number.isSafeInteger(row.netCashFlow)) throw new Error('월별 전망 값이 올바르지 않습니다.')
    return { baseMonth: row.forecastYearMonth, incomeAmount: row.forecastIncome, netAmount: row.netCashFlow }
  })
  const first = rows[0]
  return { forecastMonths, monthlyExpenseAmount: first.forecastExpense + first.forecastLoanPayment,
    cumulativeSurplusAmount: raw.totalAccumulatedSurplus,
    tightestMonth: { baseMonth: raw.worstForecastMonth, netAmount: raw.worstNetCashFlow }, source: 'diag-08-1' }
}

export function validateForecastConditions(conditions) {
  if (![3,6,12].includes(conditions?.months)) return '예측 기간은 3·6·12개월 중에서 선택해 주세요.'
  if (!Number.isSafeInteger(conditions?.incomeVariationPct) || conditions.incomeVariationPct < 0 || conditions.incomeVariationPct > 200) return '소득 변동 폭은 0~200% 정수여야 합니다.'
  if (!Number.isSafeInteger(conditions?.fixedExpenseAmount) || conditions.fixedExpenseAmount < 0) return '월 고정 지출은 0 이상의 원 단위 정수여야 합니다.'
  if (!['ON_TIME','DELAYED'].includes(conditions?.paymentStatus)) return '납부 상태를 선택해 주세요.'
  return ''
}

function adaptPeer(peer) {
  if (peer === null) return null
  if (!peer || typeof peer !== 'object' || !['annualIncomeAmount','totalAssetAmount','totalDebtAmount'].every((key) => Object.hasOwn(peer, key))) throw new Error('직군 평균 응답이 올바르지 않습니다.')
  return { annualIncomeAmount: amountOrNull(peer.annualIncomeAmount), totalAssetAmount: amountOrNull(peer.totalAssetAmount), totalDebtAmount: amountOrNull(peer.totalDebtAmount) }
}
function amountOrNull(value) { if (!validAmount(value)) throw new Error('원 단위 금액 응답이 올바르지 않습니다.'); return value ?? null }
function finiteOrNull(value) { if (value == null) return null; if (!Number.isFinite(value) || value < 0) throw new Error('금리 응답이 올바르지 않습니다.'); return value }
function integerOrNull(value) { if (value == null) return null; if (!Number.isSafeInteger(value) || value < 0) throw new Error('남은 기간 응답이 올바르지 않습니다.'); return value }
function stringOrNull(value) { if (value == null) return null; if (typeof value !== 'string') throw new Error('대출 종류 응답이 올바르지 않습니다.'); return value }
function idOrNull(value) { if (value == null || typeof value === 'string' || Number.isSafeInteger(value)) return value ?? null; throw new Error('대출 식별자 응답이 올바르지 않습니다.') }
function nextMonth(month) { const [year,number]=month.split('-').map(Number); return number===12 ? `${year+1}-01` : `${year}-${String(number+1).padStart(2,'0')}` }
