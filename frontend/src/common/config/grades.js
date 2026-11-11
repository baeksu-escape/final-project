// 신용 등급 공통 상수 — 3단계 Good·Standard·Caution(decisions.md 1-4, "Poor"는 쓰지 않는다)과 점수 범위를 한곳에 둔다.
// 실제 등급은 서버가 정해 보낸다. 화면은 받은 등급 코드를 이름으로 바꿔 보여 주고, 경계 값은 mock·참고 표시에만 쓴다.
// TODO(D-20) 백엔드 등급 코드값이 정해지면 키를 맞춘다.
export const GRADES = Object.freeze({
  GOOD: 'GOOD',
  STANDARD: 'STANDARD',
  CAUTION: 'CAUTION',
})

// 등급 코드 → 화면에 보일 이름.
export const GRADE_LABELS = Object.freeze({
  [GRADES.GOOD]: 'Good',
  [GRADES.STANDARD]: 'Standard',
  [GRADES.CAUTION]: 'Caution',
})

// 기존·대안 모델 점수 범위 — DDL v0.2 CHECK와 같은 0~1000. TODO(D-01) 모형 학습 후 환산식이 정해지면 다시 맞춘다.
export const SCORE_RANGE = Object.freeze({ MIN: 0, MAX: 1000 })

// 등급 경계 점수 — Good 780 이상, Standard 665 이상, 그 아래는 Caution. TODO(D-01) 모형 학습 후 다시 정한다.
export const GRADE_BOUNDARIES = Object.freeze({ GOOD: 780, STANDARD: 665 })

// 점수로 등급 코드를 정한다. mock과 참고 표시용이며, 실제 등급은 서버 응답을 쓴다.
export function getGradeByScore(score) {
  if (score >= GRADE_BOUNDARIES.GOOD) return GRADES.GOOD
  if (score >= GRADE_BOUNDARIES.STANDARD) return GRADES.STANDARD
  return GRADES.CAUTION
}
