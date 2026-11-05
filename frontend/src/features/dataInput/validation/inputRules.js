import { formatWithComma } from '../../../common/utils/number.js'
import { VALIDATION_LIMITS } from '../config/validationLimits.js'
import { currentMonth, isEmptyValue } from '../utils/inputValues.js'

// FP-86 N-05 입력 검증 규칙 — 화면과 분리한 순수 함수 모음이다. config/inputSections.js의 칸 설정 validate에 꽂아 쓴다.
// 칸 규칙은 값이 있을 때만 불리며(빈 값은 필수 검사가 맡는다), 문제가 있으면 오류 문구를, 없으면 null을 돌려준다.
//   amountRule(max)·numberRule({...})는 규칙 함수를 만들어 주는 함수이고, monthRule·incomeMonthRule은 그대로 꽂는 규칙 함수다.

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

// 'YYYY-MM' 형식인지 본다.
export function isValidMonthText(text) {
  return typeof text === 'string' && MONTH_PATTERN.test(text)
}

// from 달에서 to 달까지 몇 달 차이인지 돌려준다. 같은 달이면 0, to가 더 앞이면 음수.
export function monthsBetween(from, to) {
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)
  return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

// 'YYYY-MM'에 count달을 더한다(음수면 뺀다).
export function addMonths(month, count) {
  const [year, monthNumber] = month.split('-').map(Number)
  const index = year * 12 + (monthNumber - 1) + count
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

// 숫자 공통 검사 — 숫자인지, 0 이상인지, 정수인지, 상한 이하인지 차례로 보고 첫 번째 오류 문구를 돌려준다.
function checkNumber(value, { max, integer, unit }) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '숫자만 입력할 수 있습니다.'
  if (value < 0) return '0 이상으로 입력해 주세요.'
  if (integer && !Number.isInteger(value)) return '소수점 없이 입력해 주세요.'
  if (max !== undefined && value > max) return `${formatWithComma(max)}${unit} 이하로 입력해 주세요.`
  return null
}

// 금액 칸 규칙을 만든다 — 원 단위 정수, 0 이상, max원 이하.
// 사용 예: { key: 'monthlySalary', input: 'money', validate: amountRule(VALIDATION_LIMITS.MONTHLY_AMOUNT_MAX) }
export function amountRule(max) {
  return (value) => checkNumber(value, { max, integer: true, unit: '원' })
}

// 숫자 칸 규칙을 만든다 — 0 이상, max 이하. integer가 true면 소수점을 막는다. unit은 오류 문구에 붙는 단위.
// 사용 예: { key: 'remainingMonths', input: 'number', validate: numberRule({ max: 600, integer: true, unit: '개월' }) }
export function numberRule({ max, integer = false, unit = '' }) {
  return (value) => checkNumber(value, { max, integer, unit })
}

// 달 공통 검사 — 'YYYY-MM' 형식이고 이번 달(nowMonth)보다 늦지 않아야 한다.
function checkMonth(value, nowMonth) {
  if (!isValidMonthText(value)) return '연-월(YYYY-MM) 형식으로 입력해 주세요.'
  if (value > nowMonth) return '미래의 달은 입력할 수 없습니다.'
  return null
}

// 기준월 규칙 — 연-월 형식이고 미래 월이 아니어야 한다. ctx.nowMonth가 없으면 이번 달을 기준으로 본다.
export function monthRule(value, { nowMonth = currentMonth() } = {}) {
  return checkMonth(value, nowMonth)
}

// 월별 소득의 '소득 월' 규칙 — 형식·미래 월에 더해, 기준월부터 거꾸로 최근 12개월 안에 있어야 한다.
// 기준월이 비었거나 형식이 틀리면 범위 검사는 건너뛴다(기준월 칸에 오류가 따로 나온다).
export function incomeMonthRule(value, { values, nowMonth = currentMonth() } = {}) {
  const monthError = checkMonth(value, nowMonth)
  if (monthError) return monthError
  const baseMonth = values?.baseMonth
  if (!isValidMonthText(baseMonth)) return null
  const gap = monthsBetween(value, baseMonth)
  if (gap < 0) return '기준월보다 늦은 달은 입력할 수 없습니다.'
  const maxMonths = VALIDATION_LIMITS.INCOME_MONTHS_MAX
  if (gap >= maxMonths) {
    return `기준월 기준 최근 ${maxMonths}개월(${addMonths(baseMonth, -(maxMonths - 1))}~${baseMonth})만 입력할 수 있습니다.`
  }
  return null
}

// 줄 목록에서 앞줄과 같은 값을 가진 줄의 id를 돌려준다. 처음 나온 줄은 빼고 뒤에 다시 나온 줄만 모은다. 빈 값은 비교하지 않는다.
export function findDuplicateRowIds(rows, fieldKey) {
  const seen = new Set()
  const duplicateIds = []
  for (const row of rows) {
    const value = row[fieldKey]
    if (isEmptyValue(value)) continue
    if (seen.has(value)) duplicateIds.push(row.id)
    else seen.add(value)
  }
  return duplicateIds
}

// 월별 소득에서 '입력한 달' 수를 센다 — 달 형식이 맞고 금액이 있는 줄의 서로 다른 달만 센다.
export function countEnteredMonths(rows) {
  const months = rows.filter((row) => isValidMonthText(row.month) && !isEmptyValue(row.amount)).map((row) => row.month)
  return new Set(months).size
}

// 월별 소득 '정보 부족' 안내 — 입력한 달이 6개월 미만이면 안내 문구를, 아니면 null을 돌려준다. 오류가 아니므로 저장은 막지 않는다.
export function incomeShortageNotice(rows) {
  const count = countEnteredMonths(rows)
  const shortage = VALIDATION_LIMITS.INCOME_MONTHS_SHORTAGE
  if (count >= shortage) return null
  return `입력한 달이 ${count}개월입니다. ${shortage}개월 미만이면 소득 변동성 진단에서 '정보 부족'으로 표시되며, 감점하지는 않습니다.`
}
