// N-18 서버(또는 mock) 응답을 화면 모델로 바꾸고, 입력을 검증한다. 화면 상태와 API 호출은 여기서 다루지 않는다.

// N-18-2·N-18-3 입력 10개와 화면 범위. 슬라이더 범위는 UI 참고자료 기준이며 금액은 원 단위 0 이상이다.
export const SLIDER_FIELDS = [
  { key: 'telecomOnTimeMonths', label: '통신비 정시 납부 기간', min: 0, max: 12, unit: '개월' },
  { key: 'delinquencyCount', label: '최근 1년 연체 횟수', min: 0, max: 8, unit: '회' },
  { key: 'cashAdvanceMonths', label: '현금서비스 이용 기간 (최근 12개월)', min: 0, max: 12, unit: '개월' },
  { key: 'newLoanCount', label: '최근 3개월 신규 대출', min: 0, max: 5, unit: '건' },
  { key: 'easyPayMonthlyCount', label: '간편결제 월 이용 건수', min: 0, max: 60, unit: '건' },
  { key: 'utilityUnpaidMonths', label: '공과금 미납 개월 수', min: 0, max: 12, unit: '개월' },
]
export const MONEY_FIELDS = [
  { key: 'cardLimitAmount', label: '카드 한도' },
  { key: 'cardMonthlyUsage', label: '월 카드 사용액' },
  { key: 'loanBalance', label: '대출 잔액' },
  { key: 'privateLenderBalance', label: '대부업 대출 잔액' },
]
export const INPUT_KEYS = [...SLIDER_FIELDS, ...MONEY_FIELDS].map((field) => field.key)

export const GRADE_LABELS = { GOOD: 'Good', STANDARD: 'Standard', CAUTION: 'Caution' }

// 부호를 붙여 보여 준다(0은 ±0).
export function formatSigned(value) {
  if (value === 0) return '±0'
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toLocaleString('ko-KR')}`
}

// 값 하나가 화면 범위 안의 0 이상 안전한 정수인지 본다. NULL(미입력)은 통과시키지 않는다.
function isValidValue(key, value) {
  if (!Number.isSafeInteger(value) || value < 0) return false
  const slider = SLIDER_FIELDS.find((field) => field.key === key)
  return !slider || value <= slider.max
}

// 응답 형식이 맞지 않을 때 쓰는 오류. 정상적인 NULL(미입력·미산출)과 구분한다.
function malformed(field) {
  return new Error(`시뮬레이터 응답 형식이 올바르지 않습니다(${field}).`)
}
const isScore = (value) => Number.isInteger(value) && value >= 0 && value <= 1000

// N-18-1 저장값을 입력 모델로 바꾼다. 없는 값(null·undefined)은 0으로 바꾸지 않고 null(미입력)로 두고, 형식이 틀린 값은 오류로 본다.
export function adaptSimulationInputs(raw) {
  if (!raw || typeof raw !== 'object') throw malformed('응답 본문')
  const inputs = Object.fromEntries(INPUT_KEYS.map((key) => {
    const value = raw.inputs?.[key]
    if (value === null || value === undefined) return [key, null]
    if (!isValidValue(key, value)) throw malformed(key)
    return [key, value]
  }))
  const score = raw.currentScore
  if (score !== null && score !== undefined && !isScore(score)) throw malformed('currentScore')
  if (raw.deductions !== undefined && !Array.isArray(raw.deductions)) throw malformed('deductions')
  const deductions = (raw.deductions ?? []).slice(0, 3)
  if (deductions.some((item) => !item?.featureCode || !item.label || !Number.isFinite(item.shapScore))) throw malformed('deductions')
  return { currentScore: score ?? null, inputs, deductions }
}

// 계산 요청 전에 10개 값이 모두 입력됐는지 확인한다. 문제가 있으면 안내 문구를, 없으면 빈 문자열을 돌려준다.
export function validateInputs(values) {
  const missing = INPUT_KEYS.filter((key) => values[key] === null || values[key] === undefined)
  if (missing.length) return '입력하지 않은 값이 있습니다. 모든 칸을 채워야 계산할 수 있습니다.'
  if (INPUT_KEYS.some((key) => !isValidValue(key, values[key]))) return '입력은 화면 범위 안의 0 이상 정수여야 합니다.'
  return ''
}

// 두 입력 묶음이 10개 값 모두 같은지 본다(계산 필요 안내용).
export const sameInputs = (a, b) => INPUT_KEYS.every((key) => a?.[key] === b?.[key])

// N-18-5·N-18-6·N-18-7 재계산 응답을 화면 모델로 바꾼다. 형식이 틀리면 오류를 낸다.
// 점수·등급은 반드시 있어야 하고, 금리·한도·부도 확률은 null(제공 안 함)을 허용한다. 부도 확률은 0~1 값을 그대로 두고 화면에서 %로 바꾼다.
export function adaptSimulationResult(raw) {
  const side = (s, name) => {
    if (!s || typeof s !== 'object') throw malformed(name)
    if (!isScore(s.score)) throw malformed(`${name}.score`)
    if (!Object.hasOwn(GRADE_LABELS, s.gradeCode)) throw malformed(`${name}.gradeCode`)
    const rate = s.interestRatePct ?? null
    const limit = s.limitAmount ?? null
    const prob = s.defaultProbability ?? null
    if (rate !== null && !(Number.isFinite(rate) && rate >= 0)) throw malformed(`${name}.interestRatePct`)
    if (limit !== null && !(Number.isSafeInteger(limit) && limit >= 0)) throw malformed(`${name}.limitAmount`)
    if (prob !== null && !(Number.isFinite(prob) && prob >= 0 && prob <= 1)) throw malformed(`${name}.defaultProbability`)
    return { score: s.score, gradeCode: s.gradeCode, interestRatePct: rate, limitAmount: limit, defaultProbability: prob }
  }
  if (!raw || typeof raw !== 'object') throw malformed('응답 본문')
  const current = side(raw.current, 'current')
  const changed = side(raw.changed, 'changed')
  const impact = (value, name) => {
    if (value === null || value === undefined) return null
    if (!Number.isSafeInteger(value)) throw malformed(name)
    return value
  }
  return {
    current,
    changed,
    delta: changed.score - current.score,
    financialImpact: impact(raw.financialImpact, 'financialImpact'),
    alternativeImpact: impact(raw.alternativeImpact, 'alternativeImpact'),
    source: raw.source ?? null,
  }
}

// N-18-7 계산 점수와 회원 직군에 맞는 상품 3개를 고른다. 최소 점수가 높은 순, 같으면 최저 금리가 낮은 순(UI 참고자료 규칙).
export function selectRecommendations(products, score, workerTypeCode, matchesLoanScore) {
  if (!Number.isInteger(score) || !workerTypeCode) return []
  return products
    .filter((product) => matchesLoanScore(product, score) && product.workerTypeCodes?.includes(workerTypeCode))
    .sort((a, b) => b.minScore - a.minScore || a.rateMinPct - b.rateMinPct)
    .slice(0, 3)
}
