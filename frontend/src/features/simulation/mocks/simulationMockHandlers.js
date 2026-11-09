// N-18 신용케어 시뮬레이터 mock 핸들러 — 한도·금리 추천 및 점수 재계산
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { DUMMY_LOAN_PRODUCTS, getScoreBandOffer } from './simulationMockData.js'

// N-18-7 같은 점수대 금리·한도·추천 대출 상품 조회 (3종 추천)
function handleLoanRecommend({ body }) {
  const score = Number(body?.score ?? 680)
  const jobType = body?.jobType ?? 'FREELANCER'
  const band = getScoreBandOffer(score)

  // 해당 직군과 점수대에 맞는 상품을 우선 선별하고 3종을 맞춘다.
  const matched = DUMMY_LOAN_PRODUCTS.filter((prod) =>
    prod.targetJobTypes.includes(jobType)
  )
  const pool = matched.length >= 3 ? matched : DUMMY_LOAN_PRODUCTS
  const recommended = pool.slice(0, 3).map((prod) => ({
    productId: prod.productId,
    productName: prod.productName,
    institutionName: prod.institutionName,
    minRate: prod.minRate,
    maxRate: prod.maxRate,
    maxLimitAmount: prod.maxLimitAmount,
    jobType,
    description: prod.description,
    isAvailable: score >= prod.minScore,
    isFavorite: false,
  }))

  return {
    score,
    gradeBand: band.gradeBand,
    expectedMinRate: band.expectedMinRate,
    expectedMaxRate: band.expectedMaxRate,
    expectedLimitAmount: band.expectedLimitAmount,
    isDummyNotice: true,
    recommendedProducts: recommended,
  }
}

// N-18-5 시뮬레이터 행동값 9개 기반 점수 재계산 mock
function handleCreditCareRecalculate({ body }) {
  const currentScore = Number(body?.currentScore ?? 680)
  const telecomMonths = Number(body?.telecomPaymentMonths ?? 12)
  const delinquency1y = Number(body?.delinquencyCount1y ?? 0)
  const monthlyCardSpend = Number(body?.monthlyCardSpend ?? 1000000)
  const cardLimit = Number(body?.creditCardLimit ?? 5000000)

  // 행동 개선에 따른 mock 점수 변동 계산
  let scoreDiff = 0
  if (telecomMonths >= 24) scoreDiff += 15
  else if (telecomMonths >= 12) scoreDiff += 8

  if (delinquency1y === 0) scoreDiff += 12
  else scoreDiff -= delinquency1y * 10

  const cardUsageRatio = cardLimit > 0 ? (monthlyCardSpend / cardLimit) * 100 : 50
  if (cardUsageRatio < 30) scoreDiff += 10
  else if (cardUsageRatio > 70) scoreDiff -= 15

  // 점수 범위 300~900 제한
  const expectedScore = Math.min(900, Math.max(300, currentScore + scoreDiff))
  const currentBand = getScoreBandOffer(currentScore).gradeBand
  const expectedBand = getScoreBandOffer(expectedScore).gradeBand

  return {
    currentScore,
    currentGradeBand: currentBand,
    expectedScore,
    expectedGradeBand: expectedBand,
    scoreDiff,
    modelRecalculatedDiff: Math.round(scoreDiff * 0.7),
    altDataBonusDiff: Math.round(scoreDiff * 0.3),
    expectedDefaultRate: expectedScore >= 780 ? 0.021 : expectedScore >= 665 ? 0.075 : 0.21,
    topReductionFactors: [
      {
        factorName: '카드 한도 소진율',
        currentValue: `${Math.round(cardUsageRatio)}%`,
        reductionScore: cardUsageRatio > 50 ? -15 : -5,
        actionCondition: '월 카드 사용액을 한도의 30% 이하로 유지',
        recoverScore: 10,
      },
      {
        factorName: '통신비 연속 납부',
        currentValue: `${telecomMonths}개월`,
        reductionScore: telecomMonths < 24 ? -10 : 0,
        actionCondition: '통신비 12개월 이상 정시 납부 지속',
        recoverScore: 8,
      },
      {
        factorName: '간편결제 이용 실적',
        currentValue: `${body?.easypayMonthlyCount ?? 10}건`,
        reductionScore: -6,
        actionCondition: '간편결제 월 15건 이상 성실 이용',
        recoverScore: 6,
      },
    ],
  }
}

// mock 핸들러 등록
registerMockHandlers({
  'GET /api/simulation/loans/recommend': handleLoanRecommend,
  'POST /api/simulation/loans/recommend': handleLoanRecommend,
  'POST /api/simulation/credit-care/recalculate': handleCreditCareRecalculate,
})

