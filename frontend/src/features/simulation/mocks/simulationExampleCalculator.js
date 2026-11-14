// N-18-5 시연용 예시 계산식이다. 실제 모형(FastAPI) 계산이 아니며 mock 모드에서만 쓴다.
// UI 참고자료의 scoreOf 항목 중 입력 10개에 해당하는 부분만 가져와, 내 실제 값(baseline)과의 차이만 현재 점수에 더한다.
// 그래서 아무 값도 바꾸지 않고 계산하면 점수 변화와 영향은 모두 0이다.

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

// 카드 사용 비율. 한도가 0이면 사용액이 있을 때 100%, 없을 때 0%로 본다(0으로 나누지 않는다).
function cardUsageRatio(v) {
  if (v.cardLimitAmount === 0) return v.cardMonthlyUsage > 0 ? 1 : 0
  return v.cardMonthlyUsage / v.cardLimitAmount
}

// 금융 이력 쪽 시연 점수 항목 합.
function financialPart(v) {
  return clamp(20 - cardUsageRatio(v) * 53, -40, 20)
    + clamp(8 - v.loanBalance / 2_000_000, -40, 8)
    - 14 * v.delinquencyCount
    + (5 - 2.5 * v.cashAdvanceMonths)
    - 6 * v.newLoanCount
    - (v.privateLenderBalance > 0 ? 25 + v.privateLenderBalance / 5_000_000 : 0)
}

// 대안 데이터 쪽 시연 점수 항목 합.
function alternativePart(v) {
  return (v.telecomOnTimeMonths > 0 ? 28 * Math.min(v.telecomOnTimeMonths, 12) / 12 + 13 : 0)
    + (v.easyPayMonthlyCount > 0 ? 0.5 * Math.min(v.easyPayMonthlyCount, 60) + 13 : 0)
    - 6 * v.utilityUnpaidMonths
}

// 점수대별 시연 금리(%)·한도(원)·부도 확률(0~1). UI 참고자료의 rateOf·limitOf·pdOf 식이다.
function offerOf(score) {
  return {
    interestRatePct: Math.round(clamp(16.5 - (score - 600) * 0.045, 4.9, 17.9) * 10) / 10,
    limitAmount: Math.max(3_000_000, Math.round((score - 550) * 12 / 10) * 100_000),
    defaultProbability: 1 / (1 + Math.exp((score - 520) / 38)),
  }
}

// 시연 등급 경계(780·665)도 UI 참고자료 값이다.
const gradeOf = (score) => (score >= 780 ? 'GOOD' : score >= 665 ? 'STANDARD' : 'CAUTION')

// N-18-5 바꾼 값 10개로 예상 점수를 구한다. 입력 검증은 adapter에서 끝난 값만 들어온다고 보지만 한 번 더 막는다.
export function calculateExampleResult({ currentScore, baseline, values }) {
  if (!Number.isInteger(currentScore)) throw new Error('현재 점수가 없어 계산할 수 없습니다.')
  const keys = Object.keys(baseline)
  // 시연식은 내 실제 값과의 차이로 계산하므로 저장값에 미입력이 있으면 계산할 수 없다(0으로 채우지 않는다).
  if (keys.some((key) => baseline[key] === null)) throw new Error('저장된 내 실제 값 중 미입력 항목이 있어 시연 계산을 할 수 없습니다. 실제 값과의 차이를 구할 기준이 없습니다.')
  if (keys.some((key) => !Number.isSafeInteger(values[key]) || values[key] < 0 || !Number.isSafeInteger(baseline[key]))) {
    throw new Error('입력은 0 이상의 정수여야 합니다.')
  }
  const financialImpact = Math.round(financialPart(values) - financialPart(baseline))
  const alternativeImpact = Math.round(alternativePart(values) - alternativePart(baseline))
  const score = clamp(currentScore + financialImpact + alternativeImpact, 0, 1000)
  return {
    current: { score: currentScore, gradeCode: gradeOf(currentScore), ...offerOf(currentScore) },
    changed: { score, gradeCode: gradeOf(score), ...offerOf(score) },
    financialImpact,
    // 0~1000 경계에서 잘린 몫은 대안 쪽에서 빼서 합이 실제 변화량과 같게 둔다.
    alternativeImpact: score - currentScore - financialImpact,
    source: 'ui-mock-formula',
  }
}
