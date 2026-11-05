import { JOB_TYPES } from '../../../common/config/jobTypes.js'
import { formatWithComma } from '../../../common/utils/number.js'
import { amountRule, incomeMonthRule, incomeShortageNotice, monthRule, numberRule } from '../validation/inputRules.js'
import { LOAN_SECTOR_OPTIONS, OTHER_EXPENSE_CATEGORY_OPTIONS } from './inputOptions.js'
import { VALIDATION_LIMITS } from './validationLimits.js'

// FP-86 금액 칸 규칙 — 월 단위 금액과 쌓인 금액(잔액·자산)의 상한이 다르다. 상한값은 validationLimits.js에 있다.
const monthlyAmountRule = amountRule(VALIDATION_LIMITS.MONTHLY_AMOUNT_MAX)
const balanceAmountRule = amountRule(VALIDATION_LIMITS.BALANCE_AMOUNT_MAX)

// N-05 데이터 입력 항목 설정 — 화면은 이 설정을 읽어 그리므로, 항목을 늘릴 때는 여기만 고치면 된다.
//
// 칸(field) 설정
//   key: 요청 본문에 그대로 쓰는 이름   label: 화면 이름
//   input: 'money' | 'number' | 'month' | 'select' | 'text'   (FieldControl.jsx가 공통 컴포넌트로 바꿔 그린다)
//   required: 필수 여부   options: select 선택지   unit·min·max·step: number 보조값   hint: 안내 문구
//   validate(value, { row, values, nowMonth }): FP-86 상세 검증을 꽂는 자리 — 문제가 있으면 오류 문구를 돌려준다(값이 있을 때만 호출).
//     규칙 함수는 validation/inputRules.js에 있다.
//
// 섹션(section) 설정
//   kind: 'fields'(칸 묶음) | 'list'(줄 추가·삭제)   fields | itemFields: 칸 목록
//   payloadExtra: 요청 본문에 함께 보낼 고정값   minItems·minItemsMessage: list 최소 줄 수
//   derive(value): 요청 본문에 덧붙일 계산값   summary(value): 화면에 보여 줄 요약 문구
//   FP-86 list 전용 — maxItems·maxItemsMessage: 최대 줄 수(추가 버튼도 막힌다)
//     uniqueField·duplicateMessage: 이 칸 값이 앞줄과 같으면 오류   notice(rows): 오류가 아닌 안내 문구(없으면 null)

// 이 화면의 모든 입력에 함께 보내는 기준월(YYYY-MM).
export const BASE_MONTH_FIELD = Object.freeze({
  key: 'baseMonth',
  label: '기준월',
  input: 'month',
  required: true,
  hint: '이 화면의 모든 입력은 이 기준월로 저장됩니다.',
  validate: monthRule,
})

// 급여소득자 소득 — 보너스를 뺀 월급 하나만 받는다.
const SALARY_SECTION = {
  key: 'income',
  title: '월급',
  description: '보너스를 제외한 월급을 입력해 주세요.',
  kind: 'fields',
  payloadExtra: { incomeType: 'MONTHLY_SALARY' },
  fields: [{ key: 'monthlySalary', label: '월급(보너스 제외)', input: 'money', required: true, validate: monthlyAmountRule }],
}

// 자영업자·프리랜서 소득 — 한 달에 한 줄씩 받는다.
const MONTHLY_INCOME_SECTION = {
  key: 'income',
  title: '월별 소득',
  description: `기준월부터 거꾸로 최근 ${VALIDATION_LIMITS.INCOME_MONTHS_MAX}개월까지, 한 달에 한 줄씩 입력해 주세요.`,
  kind: 'list',
  payloadExtra: { incomeType: 'MONTHLY_INCOME' },
  minItems: 1,
  minItemsMessage: '소득을 한 달 이상 입력해 주세요.',
  maxItems: VALIDATION_LIMITS.INCOME_MONTHS_MAX,
  maxItemsMessage: `최근 ${VALIDATION_LIMITS.INCOME_MONTHS_MAX}개월까지만 입력할 수 있습니다.`,
  uniqueField: 'month',
  duplicateMessage: '같은 달이 이미 입력되어 있습니다.',
  notice: incomeShortageNotice,
  addLabel: '소득 월 추가',
  itemFields: [
    { key: 'month', label: '소득 월', input: 'month', required: true, validate: incomeMonthRule },
    { key: 'amount', label: '소득 금액', input: 'money', required: true, validate: monthlyAmountRule },
  ],
}

// 직군별 소득 섹션. 새 직군이나 항목이 생기면 여기에 추가한다.
export const INCOME_SECTION_BY_JOB = Object.freeze({
  [JOB_TYPES.EMPLOYEE]: SALARY_SECTION,
  [JOB_TYPES.SELF_EMPLOYED]: MONTHLY_INCOME_SECTION,
  [JOB_TYPES.FREELANCER]: MONTHLY_INCOME_SECTION,
})

// 자산 칸 금액을 모두 더한다(빈 칸은 0).
function sumAssets(value) {
  return ['depositAmount', 'investmentAmount', 'realEstateAmount', 'otherAmount'].reduce(
    (total, key) => total + (Number(value?.[key]) || 0),
    0,
  )
}

// 모든 직군이 함께 입력하는 섹션(화면 순서대로).
export const COMMON_SECTIONS = Object.freeze([
  {
    key: 'loans',
    title: '기존 부채(대출)',
    description: '보유한 대출을 한 건에 한 줄씩 추가해 주세요. 대출이 없으면 비워 두세요.',
    kind: 'list',
    addLabel: '대출 추가',
    emptyMessage: '추가한 대출이 없습니다.',
    itemFields: [
      { key: 'sectorCode', label: '업권', input: 'select', options: LOAN_SECTOR_OPTIONS, required: true },
      { key: 'balanceAmount', label: '대출 잔액', input: 'money', required: true, validate: balanceAmountRule },
      {
        key: 'annualRatePercent',
        label: '연 금리',
        input: 'number',
        unit: '%',
        min: 0,
        max: VALIDATION_LIMITS.ANNUAL_RATE_MAX_PERCENT,
        step: 0.01,
        required: true,
        validate: numberRule({ max: VALIDATION_LIMITS.ANNUAL_RATE_MAX_PERCENT, unit: '%' }),
      },
      { key: 'monthlyPaymentAmount', label: '월 상환액', input: 'money', required: true, validate: monthlyAmountRule },
      {
        key: 'remainingMonths',
        label: '남은 기간',
        input: 'number',
        unit: '개월',
        min: 0,
        max: VALIDATION_LIMITS.REMAINING_MONTHS_MAX,
        step: 1,
        validate: numberRule({ max: VALIDATION_LIMITS.REMAINING_MONTHS_MAX, integer: true, unit: '개월' }),
      },
    ],
  },
  {
    key: 'assets',
    title: '자산',
    description: '종류별 금액을 입력하면 합계가 총자산이 됩니다.',
    kind: 'fields',
    fields: [
      { key: 'depositAmount', label: '예금·적금', input: 'money', validate: balanceAmountRule },
      { key: 'investmentAmount', label: '투자(주식·펀드 등)', input: 'money', validate: balanceAmountRule },
      { key: 'realEstateAmount', label: '부동산·보증금', input: 'money', validate: balanceAmountRule },
      { key: 'otherAmount', label: '기타 자산', input: 'money', validate: balanceAmountRule },
    ],
    derive: (value) => ({ totalAmount: sumAssets(value) }),
    summary: (value) => `자산 합계: ${formatWithComma(sumAssets(value))}원`,
  },
  {
    key: 'fixedExpense',
    title: '월 고정지출',
    description: '월세·관리비처럼 매달 정해진 금액이 나가는 지출의 합계를 입력해 주세요.',
    kind: 'fields',
    fields: [{ key: 'monthlyAmount', label: '월 고정지출', input: 'money', validate: monthlyAmountRule }],
  },
  {
    key: 'otherExpenses',
    title: '기타 지출',
    description: '고정지출 외에 매달 나가는 지출을 항목별로 추가해 주세요.',
    kind: 'list',
    addLabel: '기타 지출 추가',
    emptyMessage: '추가한 기타 지출이 없습니다.',
    itemFields: [
      { key: 'category', label: '종류', input: 'select', options: OTHER_EXPENSE_CATEGORY_OPTIONS, required: true },
      { key: 'memo', label: '내용', input: 'text', maxLength: 50 },
      { key: 'monthlyAmount', label: '월 금액', input: 'money', required: true, validate: monthlyAmountRule },
    ],
  },
])

// 직군에 맞는 섹션 목록(소득 + 공통)을 돌려준다. 알 수 없는 직군이면 빈 목록.
export function getSectionsForJob(jobType) {
  const incomeSection = INCOME_SECTION_BY_JOB[jobType]
  return incomeSection ? [incomeSection, ...COMMON_SECTIONS] : []
}
