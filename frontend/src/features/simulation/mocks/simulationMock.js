// N-18-1·N-18-8 화면 확인용 고정 합성 입력이다. 실제 회원·DB 값과 무관한 시연값이다.
// 출처: UI 참고자료(Claude Artifact 5unyCwrGcxS3WrWFUk9qid, 버전 1794641606-4f83)의 시연 회원 값.
// 재계산 API mock의 출발 평가와 같은 588점과 입력값을 사용한다.
export const simulationExample = {
  currentScore: 588,
  workerTypeCode: 'SELF_EMPLOYED',
  inputs: {
    telecomOnTimeMonths: 6, delinquencyCount: 1, cashAdvanceMonths: 3, newLoanCount: 1,
    easyPayMonthlyCount: 5, utilityUnpaidMonths: 2, cardLimitAmount: 5_000_000,
    cardMonthlyUsage: 3_000_000, loanBalance: 30_000_000, privateLenderBalance: 0,
  },
  // N-18-8 감점 상위 3개 시연값. example은 화면에서 넣어 보는 예시 값일 뿐 실제 개선 효과가 아니다.
  // exampleScoreChange는 위 입력에 예시 값만 넣었을 때 시연 계산식으로 미리 구한 고정 숫자다(재계산 API를 부르지 않는다).
  deductions: [
    { featureCode: 'DQ1200001', label: '최근 1년 연체 1회', shapScore: -15, editable: true, condition: '최근 1년 연체 횟수', example: { delinquencyCount: 0 }, exampleText: '연체 횟수 0회' },
    { featureCode: 'telecom_on_time_streak', label: '통신비 정시 납부 6개월', shapScore: -12, editable: true, condition: '통신비 정시 납부 기간', example: { telecomOnTimeMonths: 12 }, exampleText: '정시 납부 12개월' },
    { featureCode: 'CL0631905', label: '카드 사용 비율 60%', shapScore: -12, editable: true, condition: '월 카드 사용액 · 카드 한도', example: { cardMonthlyUsage: 1_500_000 }, exampleText: '한도의 30%로 쓰기' },
  ],
}
