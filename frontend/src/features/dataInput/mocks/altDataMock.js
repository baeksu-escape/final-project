import { JOB_TYPES } from '../../../common/config/jobTypes.js'
import { ALT_DATA_MONTHS } from '../config/altDataSources.js'

// 문자열로 시작값을 정하는 간단한 난수 생성기 — 같은 사용자·기준월이면 항상 같은 더미 데이터가 나온다.
function seededRandom(seedText) {
  let state = 2166136261
  for (const char of seedText) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

// 최소~최대 사이 값을 step 단위로 고른다.
function pick(random, min, max, step = 1) {
  return Math.round((min + random() * (max - min)) / step) * step
}

// 기준월을 포함해 과거로 count개월의 'YYYY-MM' 목록을 오래된 달부터 돌려준다.
export function recentMonths(baseMonth, count = ALT_DATA_MONTHS) {
  const [year, month] = baseMonth.split('-').map(Number)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - 1 - (count - 1 - index), 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
}

// 'YYYY-MM'의 day일을 'YYYY-MM-DD'로 만든다. monthOffset만큼 뒤 달로 옮길 수 있다(예: 다음 달 5일).
function dateIn(month, day, monthOffset = 0) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + monthOffset, day)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 납부 상태에 맞는 납부 기한·납부일. 기한은 그달 25일이고, ON_TIME은 기한 안, LATE는 다음 달 초에 납부, UNPAID는 납부일이 없다.
// DDL v0.3.2 CK_UTP_PAID_DATE·CK_UUP_PAID_DATE(상태와 납부일이 서로 맞아야 한다)와 같은 규칙이다.
function paymentDates(month, paymentStatusCode, random) {
  const dueDate = dateIn(month, 25)
  if (paymentStatusCode === 'ON_TIME') return { dueDate, paidDate: dateIn(month, pick(random, 10, 25)) }
  if (paymentStatusCode === 'LATE') return { dueDate, paidDate: dateIn(month, pick(random, 1, 10), 1) }
  return { dueDate, paidDate: null }
}

// 기존 표에 보이는 납부 상태 글자(paymentStatus). 코드 값은 paymentStatusCode로 따로 보낸다.
const PAYMENT_STATUS_TEXT = Object.freeze({ ON_TIME: '정상 납부', LATE: '연체', UNPAID: '미납' })

// 국민연금·건강보험료 한 달 줄. DDL USER_SOCIAL_INSURANCE_PAYMENT의 NOT NULL 열(보험 종류·가입 상태·납부자 유형·납부 상태)을 함께 담는다.
// 납부자 유형은 급여소득자면 사업장(WORKPLACE), 그 밖의 직군은 지역(REGIONAL)으로 둔다. 미납이면 납부 금액은 0원이다.
function socialInsuranceRow(insuranceTypeCode, [minAmount, maxAmount], month, random, jobType) {
  const amount = pick(random, minAmount, maxAmount, 10)
  const paymentStatusCode = random() < 0.95 ? 'ON_TIME' : 'UNPAID'
  return {
    month,
    paidAmount: paymentStatusCode === 'UNPAID' ? 0 : amount,
    paymentStatus: PAYMENT_STATUS_TEXT[paymentStatusCode],
    insuranceTypeCode,
    coverageStatusCode: 'COVERED',
    payerTypeCode: jobType === JOB_TYPES.EMPLOYEE ? 'WORKPLACE' : 'REGIONAL',
    paymentStatusCode,
    ...paymentDates(month, paymentStatusCode, random),
  }
}

// 공과금은 기간 중 1~2달이 연체·미납이 되도록 달을 미리 고른다(합성 데이터의 가정, N-05-6 비고).
function pickUtilityStatuses(count, random) {
  const statuses = Array(count).fill('ON_TIME')
  statuses[pick(random, 0, count - 1)] = 'LATE'
  if (random() < 0.5) statuses[pick(random, 0, count - 1)] = 'UNPAID'
  return statuses
}

// 대안 데이터 종류별 더미 줄 만들기. 필드 이름은 더미 DB(MEMBER_PAYMENT_MONTHLY·MEMBER_TELECOM_BILL·MEMBER_SOCIAL_INSURANCE)를 따른다.
// FP-85: 기존 필드 이름은 그대로 두고, DDL v0.3.2 표의 NOT NULL 열 중 없던 값(납부 기한·납부일·상태 코드 등)을 추가했다.
//   서버가 채우는 값(SOURCE_CODE·CONSENT_ID·BASE_DATE)은 넣지 않는다. 공과금은 처음부터 DDL 열 이름(camelCase)을 쓴다.
// context: { jobType, utilityStatus } — 국민연금·건강보험의 납부자 유형, 공과금의 그달 납부 상태
const ROW_BUILDERS = {
  easypay: (month, random) => {
    const paymentCount = pick(random, 8, 45)
    const paymentAmount = pick(random, 80000, 900000, 100)
    // DDL CK_UEU_VALUES — 이용이 있으면(OBSERVED) 이용일 수는 1~31일이고 이용 건수보다 많을 수 없다.
    return [{ month, paymentCount, paymentAmount, observationStatusCode: 'OBSERVED', activeDays: pick(random, 1, Math.min(paymentCount, 28)) }]
  },
  telecom: (month, random) => {
    const billedAmount = pick(random, 40000, 110000, 10)
    const paymentStatusCode = random() < 0.9 ? 'ON_TIME' : 'LATE'
    return [
      { month, billedAmount, paymentStatus: PAYMENT_STATUS_TEXT[paymentStatusCode], paymentStatusCode, ...paymentDates(month, paymentStatusCode, random) },
    ]
  },
  nationalPension: (month, random, { jobType }) => [socialInsuranceRow('NATIONAL_PENSION', [90000, 250000], month, random, jobType)],
  healthInsurance: (month, random, { jobType }) => [socialInsuranceRow('HEALTH_INSURANCE', [60000, 180000], month, random, jobType)],
  utility: (month, random, { utilityStatus }) => [
    { billMonth: month, billedAmt: pick(random, 50000, 250000, 10), paymentStatusCode: utilityStatus, ...paymentDates(month, utilityStatus, random) },
  ],
}

// N-05 모의 연동 — 실제 외부 기관 대신 사용자·기준월로 정해지는 더미 데이터를 만든다. jobType은 국민연금·건강보험의 납부자 유형에 쓴다.
export function createAltDataRows(sourceKey, userId, baseMonth, jobType = null) {
  const random = seededRandom(`${sourceKey}:${userId}:${baseMonth}`)
  const months = recentMonths(baseMonth)
  const utilityStatuses = sourceKey === 'utility' ? pickUtilityStatuses(months.length, random) : []
  return months.flatMap((month, index) => ROW_BUILDERS[sourceKey](month, random, { jobType, utilityStatus: utilityStatuses[index] }))
}
