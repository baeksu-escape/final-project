// N-05 입력 검증 기준값 — 검증 규칙(validation/inputRules.js)이 쓰는 숫자를 이 파일 한 곳에 모은다.
// TODO(팀 결정) '임시'라고 적은 값은 팀에서 정하지 않은 값이다. 정해지면 여기 값만 바꾸면 된다.
export const VALIDATION_LIMITS = Object.freeze({
  // 임시 — 월 단위 금액(월급·월 소득·월 상환액·월 고정 지출·할부·정기결제 월 금액)의 상한: 10억원
  MONTHLY_AMOUNT_MAX: 1_000_000_000,
  // 임시 — 쌓인 금액(대출 잔액·자산)의 상한: 1,000억원
  BALANCE_AMOUNT_MAX: 100_000_000_000,
  // 임시 — 대출 연 금리 상한(%)
  ANNUAL_RATE_MAX_PERCENT: 100,
  // 임시 — 대출 남은 기간 상한(개월, 50년)
  REMAINING_MONTHS_MAX: 600,
  // 확정 — 월별 소득은 기준월부터 거꾸로 최근 12개월까지만 받는다.
  INCOME_MONTHS_MAX: 12,
  // N-05-2 '최근 12개월'의 끝 달이 이번 달에서 몇 달 전인지(1 = 지난달). 자영업자·프리랜서의 기준월 기본값이 된다.
  // TODO(팀 결정) 끝 달을 이번 달로 할지 지난달로 할지 팀에서 확정하면 이 값만 바꾼다.
  INCOME_END_MONTHS_AGO: 1,
  // 임시 — N-05-7 재직·운영·활동 기간 상한(개월, 50년). TODO(D-24) 기간의 단위와 상한을 팀이 정하면 바꾼다.
  WORK_PERIOD_MONTHS_MAX: 600,
})
