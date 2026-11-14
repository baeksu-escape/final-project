// N-18-1·N-18-8 화면 확인용 고정 합성 입력이다. 실제 회원·DB 값과 무관한 시연값이다.
// 출처: UI 참고자료(Claude Artifact 5unyCwrGcxS3WrWFUk9qid, 버전 1794641606-4f83)의 시연 회원 값.
// currentScore 701은 신용 리포트 mock(creditMockData.js)의 대안 점수와 맞춘 값이다.
export const simulationExample = {
  currentScore: 701,
  workerTypeCode: 'SELF_EMPLOYED',
  inputs: {
    telecomOnTimeMonths: 12, delinquencyCount: 0, cashAdvanceMonths: 2, newLoanCount: 0,
    easyPayMonthlyCount: 38, utilityUnpaidMonths: 0, cardLimitAmount: 8_000_000,
    cardMonthlyUsage: 5_440_000, loanBalance: 38_000_000, privateLenderBalance: 0,
  },
  // N-18-8 감점 상위 3개 시연값. example은 화면에서 넣어 보는 예시 값일 뿐 실제 개선 효과가 아니다.
  // exampleScoreChange는 위 입력에 예시 값만 넣었을 때 시연 계산식으로 미리 구한 고정 숫자다(재계산 API를 부르지 않는다).
  deductions: [
    { featureCode: 'card_util_pct', label: '카드 사용 비율 68%', shapScore: -24, editable: true, condition: '월 카드 사용액 · 카드 한도', example: { cardMonthlyUsage: 2_400_000 }, exampleText: '한도의 30% 아래로 쓰기', exampleScoreChange: 20 },
    { featureCode: 'cash_advance_months', label: '현금서비스 이용 2개월', shapScore: -12, editable: true, condition: '현금서비스 이용 기간', example: { cashAdvanceMonths: 0 }, exampleText: '현금서비스 쓰지 않기', exampleScoreChange: 5 },
    { featureCode: 'income_cv', label: '월별 소득 변동이 큼', shapScore: -9, editable: false, linkKey: 'income-volatility', linkText: '현금흐름·소득 변동성에서 소득 흐름을 확인해 보세요.' },
  ],
}
