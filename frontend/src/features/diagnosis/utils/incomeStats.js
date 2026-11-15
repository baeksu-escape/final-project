// N-21-7·N-22-3·4·5 기존 이름 호환용 전달 — 정식 프론트 계산이 아니다.
// 정식 계산은 광희 FP-203 백엔드 API 담당이며, 지금은 mocks/incomeVolatilityMock.js의 임시 계산을 그대로 전달만 한다.
// 새 화면 코드는 이 파일을 쓰지 말고 api/incomeVolatilityApi.js의 결과만 표시한다.
export { calculateIncomeDeficitMonths, calculateIncomeGap, calculateIncomeStats } from '../mocks/incomeVolatilityMock.js'
