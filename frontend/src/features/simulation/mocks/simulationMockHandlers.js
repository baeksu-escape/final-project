// N-18 신용케어 시뮬레이터 mock 핸들러 — 한도·금리 추천 및 점수 재계산
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { ApiError } from '../../../common/api/ApiError.js'
import {
  SCORE_BAND_OFFER_BASE_DATE,
  SCORE_BAND_OFFER_ROWS,
  SIMULATION_BASE_ASSESSMENT,
  SIMULATION_CARD,
  SIMULATION_DEFAULT_PROB,
  SIMULATION_FEATURES,
  SIMULATION_MAX_VALUES,
} from './simulationMockData.js'

// N-18-5·8 ML-04 changes에 쓰는 키 10개. 이 밖의 키는 오타일 수 있어 오류로 알려 준다(ML-04와 같은 규칙).
const SIMULATION_CHANGE_KEYS = new Set([
  ...SIMULATION_FEATURES.map((feature) => feature.key),
  SIMULATION_CARD.limitKey,
  SIMULATION_CARD.spendKey,
])

// 점수가 속한 등급(CUT-0.3)과 부도 확률 예시를 ML-04 before·after 모양으로 만든다.
function summarizeScore(score) {
  const gradeBandCode = SCORE_BAND_OFFER_ROWS.find((row) => score >= row.minScore && score <= row.maxScore).gradeBand
  return { score, gradeBandCode, defaultProb: SIMULATION_DEFAULT_PROB[gradeBandCode] }
}

// 피처 하나의 mock 감점: 가장 좋은 값에서 떨어진 만큼 음수로 깎는다.
function penaltyOf(value, best, pointPerUnit) {
  return -Math.abs(value - best) * pointPerUnit
}

// SIM-02 입력 검사 — ML-04 규칙(모르는 키, 카드 한도·사용액 한쪽만)에 더해, ML-04가 하지 않는 범위 검사(0 이상 정수, 상한)를 먼저 한다.
// null은 키를 뺀 것과 같이 "바꾸지 않음"이다(B조 11/17).
function validateSimulationChanges(changes) {
  const fieldErrors = Object.keys(changes)
    .sort()
    .filter((key) => !SIMULATION_CHANGE_KEYS.has(key))
    .map((key) => ({ field: `changes.${key}`, message: '모르는 항목입니다.' }))
  Object.entries(changes).forEach(([key, value]) => {
    if (!SIMULATION_CHANGE_KEYS.has(key) || value === null) return
    const number = Number(value)
    const max = SIMULATION_MAX_VALUES[key]
    if (value === '' || !Number.isInteger(number) || number < 0) {
      fieldErrors.push({ field: `changes.${key}`, message: '0 이상의 정수를 입력해 주세요.' })
    } else if (max !== undefined && number > max) {
      fieldErrors.push({ field: `changes.${key}`, message: `0~${max} 사이로 입력해 주세요.` })
    }
  })
  const hasLimit = changes[SIMULATION_CARD.limitKey] != null
  const hasSpend = changes[SIMULATION_CARD.spendKey] != null
  if (hasLimit !== hasSpend) {
    fieldErrors.push({ field: `changes.${SIMULATION_CARD.limitKey}`, message: '카드 한도와 월 카드 사용액은 함께 보내야 합니다.' })
  }
  return fieldErrors
}

// 카드 한도 사용률(%) = 월 사용액 ÷ 한도 × 100, 소수 첫째 자리. 한도가 0 이하면 결측(null)이다(ML-04와 같은 규칙).
function cardUtilization(limit, spend) {
  return limit > 0 ? Math.round((spend / limit) * 1000) / 10 : null
}

// N-18-5·8 시뮬레이터 점수 재계산 mock (SIM-02) — 응답은 ML-04 모양(requestId·shap 제외, featureName 추가)이다.
// 출발 평가 예시(588점)에 바꾼 값을 덮어써 간단한 규칙으로 점수를 다시 낸다. 진짜 모델 점수가 아니다.
function handleCreditCareRecalculate({ body }) {
  const changes = body?.changes ?? {}
  const fieldErrors =
    typeof changes === 'object' && !Array.isArray(changes)
      ? validateSimulationChanges(changes)
      : [{ field: 'changes', message: '바꾼 값 목록이 필요합니다.' }]
  if (fieldErrors.length > 0) {
    const message = '입력값을 확인해 주세요.'
    throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors })
  }

  // 1) 피처마다 바꾸기 전·후 감점을 구한다. 값이 없는(null) 키는 출발 값을 그대로 쓴다.
  const rows = SIMULATION_FEATURES.map((feature) => {
    const value = changes[feature.key] != null ? Number(changes[feature.key]) : feature.base
    return {
      featureCode: feature.featureCode,
      featureName: feature.featureName,
      alternative: feature.alternative,
      featureValue: value * (feature.featureScale ?? 1),
      beforePenalty: penaltyOf(feature.base, feature.best, feature.pointPerUnit),
      afterPenalty: penaltyOf(value, feature.best, feature.pointPerUnit),
    }
  })

  // 2) 카드는 한도·사용액 두 값으로 사용률을 다시 계산한다. 사용률이 결측이면 점수 영향은 0으로 둔다.
  const card = SIMULATION_CARD
  const baseUtilization = cardUtilization(card.baseLimit, card.baseSpend)
  const cardChanged = changes[card.limitKey] != null
  const utilization = cardChanged
    ? cardUtilization(Number(changes[card.limitKey]), Number(changes[card.spendKey]))
    : baseUtilization
  const cardBeforePenalty = penaltyOf(baseUtilization, card.best, card.pointPerUnit)
  rows.push({
    featureCode: card.featureCode,
    featureName: card.featureName,
    alternative: false,
    featureValue: utilization,
    beforePenalty: cardBeforePenalty,
    afterPenalty: utilization === null ? cardBeforePenalty : penaltyOf(utilization, card.best, card.pointPerUnit),
  })

  // 3) 점수 차이를 금융 이력 영향과 대안 데이터 영향으로 나눈다(N-18-5). 0~1000을 넘으면 자르고, 두 영향을 같은 비율로 줄인다.
  const effectOf = (isAlternative) =>
    rows
      .filter((row) => row.alternative === isAlternative)
      .reduce((sum, row) => sum + (row.afterPenalty - row.beforePenalty), 0)
  const rawFinancial = effectOf(false)
  const rawTotal = rawFinancial + effectOf(true)
  const beforeScore = SIMULATION_BASE_ASSESSMENT.score
  const afterScore = Math.min(1000, Math.max(0, Math.round(beforeScore + rawTotal)))
  const total = afterScore - beforeScore
  const financialEffect = rawTotal === 0 ? 0 : Math.round((rawFinancial * total) / rawTotal)

  // 4) N-18-8 바꾼 뒤에도 남은 감점이 큰 항목 3개와, 그 항목을 가장 좋은 값으로 바꿨을 때의 회복 점수. 값이 결측인 항목은 뺀다.
  const topReductionFactors = rows
    .filter((row) => row.featureValue !== null && Math.round(row.afterPenalty) < 0)
    .sort((a, b) => a.afterPenalty - b.afterPenalty || a.featureName.localeCompare(b.featureName))
    .slice(0, 3)
    .map((row, index) => ({
      rank: index + 1,
      featureCode: row.featureCode,
      featureName: row.featureName,
      featureValue: row.featureValue,
      shapScore: Math.round(row.afterPenalty),
      recoverScore: Math.min(Math.round(-row.afterPenalty), 1000 - afterScore),
    }))

  return {
    modelVersion: SIMULATION_BASE_ASSESSMENT.modelVersion,
    cutoffVersion: SIMULATION_BASE_ASSESSMENT.cutoffVersion,
    before: summarizeScore(beforeScore),
    after: summarizeScore(afterScore),
    delta: { total, financialEffect, alternativeEffect: total - financialEffect },
    topReductionFactors,
  }
}

// N-18-1·10 SIM-01 입력 10개의 내 실제 값 mock — 재계산 mock의 출발 값(base)과 같은 숫자를 돌려준다.
// 실제 서버는 점수가 나온 최근 평가의 피처값과 그 기준월 카드 직접 입력에서 꺼낸다. 값이 없으면 null이다.
function handleCreditCareBase() {
  const values = {}
  SIMULATION_FEATURES.forEach((feature) => {
    values[feature.key] = feature.base
  })
  values[SIMULATION_CARD.limitKey] = SIMULATION_CARD.baseLimit
  values[SIMULATION_CARD.spendKey] = SIMULATION_CARD.baseSpend
  const { score, gradeBandCode } = summarizeScore(SIMULATION_BASE_ASSESSMENT.score)
  return {
    baseRequestId: '00000000-0000-4000-8000-000000000588',
    assessedAt: '2026-11-17T10:00:00+09:00',
    score,
    gradeBandCode,
    values,
    topReductionFactors: baseReductionFactors(),
  }
}

// N-18-8 SIM-01 출발 평가의 감점 요인 상위 3개 mock — SIM-02 mock과 같은 감점 규칙을 출발 값에 적용한다.
// 실제 서버는 저장된 요인(ASSESSMENT_FACTOR)에서 고르고 회복 점수는 저장돼 있지 않아 null이다.
function baseReductionFactors() {
  const rows = SIMULATION_FEATURES.map((feature) => ({
    featureCode: feature.featureCode,
    featureName: feature.featureName,
    featureValue: feature.base * (feature.featureScale ?? 1),
    penalty: penaltyOf(feature.base, feature.best, feature.pointPerUnit),
  }))
  const card = SIMULATION_CARD
  const utilization = cardUtilization(card.baseLimit, card.baseSpend)
  if (utilization !== null) {
    rows.push({
      featureCode: card.featureCode,
      featureName: card.featureName,
      featureValue: utilization,
      penalty: penaltyOf(utilization, card.best, card.pointPerUnit),
    })
  }
  return rows
    .filter((row) => Math.round(row.penalty) < 0)
    .sort((a, b) => a.penalty - b.penalty || a.featureName.localeCompare(b.featureName))
    .slice(0, 3)
    .map((row, index) => ({
      rank: index + 1,
      featureCode: row.featureCode,
      featureName: row.featureName,
      featureValue: row.featureValue,
      shapScore: Math.round(row.penalty),
      recoverScore: null,
    }))
}

// N-18-7 같은 점수대 참고 금리·한도 mock — 백엔드와 같이 점수가 0~1000 밖이면 400 INVALID_INPUT(fieldErrors에 score)을 낸다.
function handleScoreBandOffer({ query }) {
  const rawScore = query?.get('score') ?? null
  const score = Number(rawScore)
  if (rawScore === null || rawScore === '' || !Number.isInteger(score) || score < 0 || score > 1000) {
    const message = '점수는 0~1000 사이여야 합니다.'
    throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field: 'score', message }] })
  }
  const band = SCORE_BAND_OFFER_ROWS.find((row) => score >= row.minScore && score <= row.maxScore)
  return {
    score,
    gradeBand: band.gradeBand,
    cutoffVersion: 'CUT-0.3',
    bandMinScore: band.minScore,
    bandMaxScore: band.maxScore,
    expectedMinRate: band.rateMin,
    expectedMaxRate: band.rateMax,
    expectedAvgRate: band.rateAvg,
    expectedLimitAmount: band.limit,
    baseDate: SCORE_BAND_OFFER_BASE_DATE,
    dummyNotice: true,
  }
}

// mock 핸들러 등록
registerMockHandlers({
  'GET /api/simulation/score-band-offer': handleScoreBandOffer,
  'GET /api/members/me/credit-care-base': handleCreditCareBase,
  'POST /api/members/me/credit-care-recalculate': handleCreditCareRecalculate,
})

