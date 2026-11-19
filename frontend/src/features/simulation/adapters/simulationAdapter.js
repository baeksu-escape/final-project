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

const API_CHANGE_KEYS = {
  telecomOnTimeMonths: 'TELECOM_ON_TIME_MONTHS',
  delinquencyCount: 'DELINQ_COUNT_12M',
  cashAdvanceMonths: 'CASH_ADVANCE_MONTHS',
  newLoanCount: 'NEW_LOAN_COUNT_3M',
  easyPayMonthlyCount: 'EASYPAY_MONTHLY_COUNT',
  utilityUnpaidMonths: 'UTILITY_LATE_MONTHS',
  cardLimitAmount: 'CARD_LIMIT_AMT',
  cardMonthlyUsage: 'CARD_MONTHLY_SPEND_AMT',
  loanBalance: 'LOAN_BALANCE_AMT',
  privateLenderBalance: 'PRIVATE_LENDER_LOAN_BALANCE_AMT',
}

export const GRADE_LABELS = { GOOD: 'Good', STANDARD: 'Standard', CAUTION: 'Caution' }

// 부호를 붙여 보여 준다(0은 ±0).
export function formatSigned(value) {
  if (value === 0) return '±0'
  return `${value > 0 ? '+' : '−'}${Math.abs(value).toLocaleString('ko-KR')}`
}

// N-18-1 서버가 준 실제 값이 0 이상 안전한 정수인지만 본다. 슬라이더 범위 밖 값도 실제 값이므로 오류로 보지 않는다(NULL은 따로 처리).
const isStoredValue = (value) => Number.isSafeInteger(value) && value >= 0

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
    if (!isStoredValue(value)) throw malformed(key)
    return [key, value]
  }))
  const score = raw.currentScore
  if (score !== null && score !== undefined && !isScore(score)) throw malformed('currentScore')
  if (raw.deductions != null && !Array.isArray(raw.deductions)) throw malformed('deductions')
  // 감점 요인이 없는 응답(null)은 "아직 모름"이고, 빈 배열은 "감점 요인 없음"이다.
  const deductions = raw.deductions == null ? null : raw.deductions.slice(0, 3)
  if (deductions?.some((item) => !item?.featureCode || !item.label || !Number.isFinite(item.shapScore))) throw malformed('deductions')
  return { currentScore: score ?? null, inputs, deductions }
}

// N-18-1·10 SIM-01 응답(values: ML-04 키 10개, 없으면 null)을 화면 입력 모양으로 바꾼다. null은 0으로 채우지 않고 그대로 둔다.
// SIM-01에는 감점 요인이 없어 deductions는 빈 목록이다(감점 요인은 SIM-02 재계산 응답의 topReductionFactors에 있다).
export function fromCreditCareBase(raw) {
  if (!raw || typeof raw !== 'object' || !raw.values || typeof raw.values !== 'object') throw malformed('응답 본문')
  const inputs = Object.fromEntries(INPUT_KEYS.map((key) => [key, raw.values[API_CHANGE_KEYS[key]] ?? null]))
  return { currentScore: raw.score ?? null, inputs, deductions: adaptReductionFactors(raw.topReductionFactors) }
}

// N-18-8 서버의 topReductionFactors(rank, featureCode, featureName, featureValue, shapScore, recoverScore)를 감점 카드 모양으로 바꾼다.
// 필드가 없으면(null) 무시한다. shapScore는 모델 계산상 점수를 낮추는 쪽으로 계산된 크기이며 원인을 뜻하지 않는다.
export function adaptReductionFactors(list) {
  if (list == null) return null
  if (!Array.isArray(list)) throw malformed('topReductionFactors')
  return [...list].sort((a, b) => a.rank - b.rank).slice(0, 3).map((item) => {
    if (!item?.featureCode || !item.featureName || !Number.isFinite(item.shapScore)) throw malformed('topReductionFactors')
    return { featureCode: item.featureCode, label: item.featureName, shapScore: item.shapScore, featureValue: item.featureValue ?? null,
      recoverScore: Number.isFinite(item.recoverScore) ? item.recoverScore : null, editable: false }
  })
}

// N-18 SIM-01·02·04 오류를 화면에 보여 줄 한국어 안내로 바꾼다. 400은 서버가 알려 준 입력 칸 이름과 문구를 함께 보여 준다.
export function describeSimulationError(error) {
  const code = error?.data?.code
  if (error?.status === 404 && code === 'ASSESSMENT_NOT_FOUND') return '저장된 대안 점수가 없어 시뮬레이터를 쓸 수 없습니다. 먼저 신용 점수를 산출해 주세요.'
  if (error?.status === 409 && code === 'VERSION_MISMATCH') return '저장된 평가의 모델이 바뀌었습니다. 점수를 다시 산출한 뒤 이용해 주세요.'
  if (error?.status === 503) return '점수 계산 서버가 준비 중입니다. 잠시 후 다시 시도해 주세요.'
  if (error?.status === 400 && code === 'INVALID_INPUT') {
    const labels = Object.fromEntries([...SLIDER_FIELDS, ...MONEY_FIELDS].map((field) => [API_CHANGE_KEYS[field.key], field.label]))
    const details = (error.data.fieldErrors ?? []).map((item) => {
      const label = labels[String(item.field).replace(/^changes\./, '')]
      return label ? `${label}: ${item.message}` : item.message
    }).filter(Boolean)
    return details.length ? `입력값을 확인해 주세요. ${details.join(' / ')}` : '입력값을 확인해 주세요.'
  }
  return error?.message ?? '요청을 처리하지 못했습니다.'
}

// N-18-5 화면의 camelCase 입력 10개를 FastAPI 재계산 changes 키로 바꾼다.
export function toSimulationChanges(values, baseline) {
  if (!values || typeof values !== 'object') throw new Error('시뮬레이션 입력값이 올바르지 않습니다.')
  const keys = INPUT_KEYS.filter((key) => values[key] !== baseline?.[key])
  if (keys.includes('cardLimitAmount') || keys.includes('cardMonthlyUsage')) {
    for (const key of ['cardLimitAmount', 'cardMonthlyUsage']) if (!keys.includes(key)) keys.push(key)
  }
  // 값이 없는(null) 항목은 바꾼 값이 아니므로 보내지 않는다.
  return Object.fromEntries(keys.filter((key) => values[key] != null).map((key) => [API_CHANGE_KEYS[key], values[key]]))
}

// 범위·정수 위반 시 validateInputs가 돌려주는 일반 문구. 칸 옆 항목별 오류가 있어 화면에는 따로 보여 주지 않는다.
export const RANGE_INPUT_MESSAGE = '입력은 화면 범위 안의 0 이상 정수여야 합니다.'

// 값이 비었을 때 validateInputs가 돌려주는 일반 문구. 칸 옆 "값을 입력해 주세요."가 있어 화면에는 따로 보여 주지 않는다.
export const MISSING_INPUT_MESSAGE = '입력하지 않은 값이 있습니다. 값이 있는 칸은 모두 채워야 계산할 수 있습니다.'
// invalid 상태에서 Notice에 보여 주지 않을 일반 문구 목록(항목별 오류가 칸 옆에 표시된다).
export const HIDDEN_INVALID_MESSAGES = [RANGE_INPUT_MESSAGE, MISSING_INPUT_MESSAGE]

// 계산 요청 전에 값을 확인한다. 저장된 값이 없던 항목(baseline이 null)은 비어 있어도 되고, 바꾸지 않은 값은 슬라이더 범위 밖이어도 통과한다.
// 문제가 있으면 안내 문구를, 없으면 빈 문자열을 돌려준다.
export function validateInputs(values, baseline = null) {
  const absent = (key) => values[key] === null || values[key] === undefined
  const missing = INPUT_KEYS.filter((key) => absent(key) && !(baseline && baseline[key] == null))
  if (missing.length) return MISSING_INPUT_MESSAGE
  const invalid = INPUT_KEYS.some((key) => !absent(key) && !(baseline && values[key] === baseline[key] && isStoredValue(values[key])) && !isValidValue(key, values[key]))
  if (invalid) return RANGE_INPUT_MESSAGE
  return ''
}

// N-18-2·3 칸 옆에 보여 줄 항목별 오류를 { 항목 key: 문구 }로 돌려준다. 판정 규칙은 validateInputs와 같고 문제가 없는 항목은 담지 않는다.
export function getInputErrors(values, baseline = null) {
  const errors = {}
  for (const key of INPUT_KEYS) {
    const value = values?.[key]
    const field = [...SLIDER_FIELDS, ...MONEY_FIELDS].find((item) => item.key === key)
    if (value === null || value === undefined) {
      if (!(baseline && baseline[key] == null)) errors[key] = '값을 입력해 주세요.'
    } else if (!(baseline && value === baseline[key] && isStoredValue(value)) && !isValidValue(key, value)) {
      errors[key] = field.max === undefined ? '0 이상 정수로 입력해 주세요.' : `${field.min}~${field.max}${field.unit} 사이 정수로 입력해 주세요.`
    }
  }
  return errors
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
    // 재계산 뒤에도 남은 감점 요인. 응답에 없으면 null(처음 값 유지).
    deductions: adaptReductionFactors(raw.topReductionFactors),
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
