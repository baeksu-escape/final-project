// N-20-4 DSR 위험 단계 기준 및 시나리오 재계산 기본 데이터
// decisions.md: DSR 30% 주의 / 40% 위험 (N-16-1 상환 부담률과 계산식 공유)

export const DSR_RISK_LEVELS = Object.freeze({
  SAFE: {
    level: 'SAFE',
    label: '안전',
    maxRatio: 30.0,
    description: '연소득 대비 원리금 상환 부담이 안정적인 수준입니다.',
  },
  CAUTION: {
    level: 'CAUTION',
    label: '주의',
    minRatio: 30.0,
    maxRatio: 40.0,
    description: '상환 부담률이 30%를 초과하여 추가 대출 시 주의가 필요합니다.',
  },
  DANGER: {
    level: 'DANGER',
    label: '위험',
    minRatio: 40.0,
    description: '상환 부담률이 40%를 초과하여 연체 위험이 높은 위험 단계입니다.',
  },
})

// DSR 비율에 따른 위험 단계 판정 함수 (N-16-2, N-20-4 공통)
export function evaluateDsrRisk(dsrRatio = 0) {
  if (dsrRatio >= 40.0) return DSR_RISK_LEVELS.DANGER
  if (dsrRatio >= 30.0) return DSR_RISK_LEVELS.CAUTION
  return DSR_RISK_LEVELS.SAFE
}

