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

// 대안 데이터 종류별 더미 줄 만들기. 필드 이름은 더미 DB(MEMBER_PAYMENT_MONTHLY·MEMBER_TELECOM_BILL·MEMBER_SOCIAL_INSURANCE)를 따른다.
const ROW_BUILDERS = {
  easypay: (month, random) => [
    { month, paymentCount: pick(random, 8, 45), paymentAmount: pick(random, 80000, 900000, 100) },
  ],
  telecom: (month, random) => [
    { month, billedAmount: pick(random, 40000, 110000, 10), paymentStatus: random() < 0.9 ? '정상 납부' : '연체' },
  ],
  nationalPension: (month, random) => [
    { month, paidAmount: pick(random, 90000, 250000, 10), paymentStatus: random() < 0.95 ? '정상 납부' : '미납' },
  ],
  healthInsurance: (month, random) => [
    { month, paidAmount: pick(random, 60000, 180000, 10), paymentStatus: random() < 0.95 ? '정상 납부' : '미납' },
  ],
}

// N-05 모의 연동 — 실제 외부 기관 대신 사용자·기준월로 정해지는 더미 데이터를 만든다.
export function createAltDataRows(sourceKey, userId, baseMonth) {
  const random = seededRandom(`${sourceKey}:${userId}:${baseMonth}`)
  return recentMonths(baseMonth).flatMap((month) => ROW_BUILDERS[sourceKey](month, random))
}
