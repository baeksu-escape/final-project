// N-05-8 점수 산출 mock 설정 — scenario 값 하나를 바꾸면 [점수 산출하기] 응답이 달라진다.
//   'SCORED'(산출 성공)
//   'CONSENT_REQUIRED' | 'STALE_INPUT' | 'MODEL_ERROR'(산출 불가 NOT_SCORABLE, 사유별 안내 확인용)
//   'NETWORK_ERROR_ONCE'(첫 요청만 연결 실패 → 다시 누르면 같은 requestId로 보내는지 확인용)
export const mockScoreSettings = {
  scenario: 'SCORED',
}
