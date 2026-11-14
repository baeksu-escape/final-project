// 점수 산출 결과 공통 상수 — 산출 상태(gradeStatusCode)와 산출 불가 사유(notScorableReasonCode)의 안내 문구를 한곳에 둔다.
// 데이터 입력의 [점수 산출하기](FP-86)와 마이페이지 진단 내역(FP-92)이 같은 문구를 쓴다. 상태·사유는 서버가 정해 보내고 화면은 표시만 한다.
// TODO(D-20) Avenue API 명세서 B팀 v0.2(3-1 점수 산출, 3-4 진단 내역) 기준 값이다. 명세가 바뀌면 이 파일만 고친다.
export const GRADE_STATUS = Object.freeze({
  SCORED: 'SCORED',
  NOT_SCORABLE: 'NOT_SCORABLE',
})

// 산출 불가 사유 코드 → 화면 안내 문구.
export const NOT_SCORABLE_REASON_MESSAGES = Object.freeze({
  CONSENT_REQUIRED: '대안 데이터 5종에 모두 동의해야 점수를 산출할 수 있습니다.',
  STALE_INPUT: '입력한 자료가 오래되었습니다. 최근 자료로 다시 저장해 주세요.',
  MODEL_ERROR: '지금은 점수를 계산할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  INPUT_INCOMPLETE: '입력하지 않은 항목이 있습니다.',
})

// 사유 코드로 안내 문구를 찾는다. 모르는 코드면 기본 문구를 쓴다.
export function getNotScorableMessage(reasonCode) {
  return NOT_SCORABLE_REASON_MESSAGES[reasonCode] ?? '점수를 산출할 수 없습니다.'
}
