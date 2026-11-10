// N-04-6 신용 등급 3단계(decisions.md 1-4, "Poor"는 쓰지 않는다). 서버가 보내는 코드 → 화면에 보일 이름.
// TODO(D-20) 백엔드 코드값이 정해지면 키를 맞춘다.
export const GRADE_LABELS = Object.freeze({
  GOOD: 'Good',
  STANDARD: 'Standard',
  CAUTION: 'Caution',
})

// N-04-6 진단 내역이 0건일 때 보일 안내 문구.
export const EMPTY_HISTORY_MESSAGE = '아직 산출한 점수가 없습니다.'
