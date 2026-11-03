import { JOB_TYPES } from '../../../common/config/jobTypes.js'
import { formatWithComma } from '../../../common/utils/number.js'
import { LOAN_SECTOR_OPTIONS, OTHER_EXPENSE_CATEGORY_OPTIONS } from './inputOptions.js'

// N-05 데이터 입력 항목 설정 — 화면은 이 설정을 읽어 그리므로, 항목을 늘릴 때는 여기만 고치면 된다.
//
// 칸(field) 설정
//   key: 요청 본문에 그대로 쓰는 이름   label: 화면 이름
//   input: 'money' | 'number' | 'month' | 'select' | 'text'   (FieldControl.jsx가 공통 컴포넌트로 바꿔 그린다)
//   required: 필수 여부   options: select 선택지   unit·min·max·step: number 보조값   hint: 안내 문구
//   validate(value, { row, values }): FP-86 상세 검증을 꽂는 자리 — 문제가 있으면 오류 문구를 돌려준다(값이 있을 때만 호출).
//
// 섹션(section) 설정
//   kind: 'fields'(칸 묶음) | 'list'(줄 추가·삭제)   fields | itemFields: 칸 목록
//   payloadExtra: 요청 본문에 함께 보낼 고정값   minItems·minItemsMessage: list 최소 줄 수
//   derive(value): 요청 본문에 덧붙일 계산값   summary(value): 화면에 보여 줄 요약 문구

// 이 화면의 모든 입력에 함께 보내는 기준월(YYYY-MM).
export const BASE_MONTH_FIELD = Object.freeze({
  key: 'baseMonth',
  label: '기준월',
  input: 'month',
  required: true,
  hint: '이 화면의 모든 입력은 이 기준월로 저장됩니다.',
})

// 급여소득자 소득 — 보너스를 뺀 월급 하나만 받는다.
const SALARY_SECTION = {
  key: 'income',
  title: '월급',
  description: '보너스를 제외한 월급을 입력해 주세요.',
  kind: 'fields',
  payloadExtra: { incomeType: 'MONTHLY_SALARY' },
  fields: [{ key: 'monthlySalary', label: '월급(보너스 제외)', input: 'money', required: true }],
}

// 자영업자·프리랜서 소득 — 한 달에 한 줄씩 받는다.
const MONTHLY_INCOME_SECTION = {
  key: 'income',
  title: '월별 소득',
  description: '한 달에 한 줄씩 입력해 주세요.',
  kind: 'list',
  payloadExtra: { incomeType: 'MONTHLY_INCOME' },
  minItems: 1,
  minItemsMessage: '소득을 한 달 이상 입력해 주세요.',
  addLabel: '소득 월 추가',
  itemFields: [
    { key: 'month', label: '소득 월', input: 'month', required: true },
    { key: 'amount', label: '소득 금액', input: 'money', required: true },
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
      { key: 'balanceAmount', label: '대출 잔액', input: 'money', required: true },
      { key: 'annualRatePercent', label: '연 금리', input: 'number', unit: '%', min: 0, max: 100, step: 0.01, required: true },
      { key: 'monthlyPaymentAmount', label: '월 상환액', input: 'money', required: true },
      { key: 'remainingMonths', label: '남은 기간', input: 'number', unit: '개월', min: 0, step: 1 },
    ],
  },
  {
    key: 'assets',
    title: '자산',
    description: '종류별 금액을 입력하면 합계가 총자산이 됩니다.',
    kind: 'fields',
    fields: [
      { key: 'depositAmount', label: '예금·적금', input: 'money' },
      { key: 'investmentAmount', label: '투자(주식·펀드 등)', input: 'money' },
      { key: 'realEstateAmount', label: '부동산·보증금', input: 'money' },
      { key: 'otherAmount', label: '기타 자산', input: 'money' },
    ],
    derive: (value) => ({ totalAmount: sumAssets(value) }),
    summary: (value) => `자산 합계: ${formatWithComma(sumAssets(value))}원`,
  },
  {
    key: 'fixedExpense',
    title: '월 고정지출',
    description: '월세·관리비처럼 매달 정해진 금액이 나가는 지출의 합계를 입력해 주세요.',
    kind: 'fields',
    fields: [{ key: 'monthlyAmount', label: '월 고정지출', input: 'money' }],
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
      { key: 'monthlyAmount', label: '월 금액', input: 'money', required: true },
    ],
  },
])

// 직군에 맞는 섹션 목록(소득 + 공통)을 돌려준다. 알 수 없는 직군이면 빈 목록.
export function getSectionsForJob(jobType) {
  const incomeSection = INCOME_SECTION_BY_JOB[jobType]
  return incomeSection ? [incomeSection, ...COMMON_SECTIONS] : []
}
