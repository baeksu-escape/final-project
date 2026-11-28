// FP-298 mock 점수 산출 기록 — 서버 ASSESSMENT 한 행처럼 산출 당시 직군(WORKER_TYPE_CODE)을 함께 남긴다. 메모리에만 있어 새로고침하면 사라진다.
// 데이터 입력 mock이 산출할 때 넣고, 진단 내역 mock(auth/mocks/diagnosisHistoryMockHandlers.js)이 읽는다.
const assessments = new Map() // userId → [{ diagnosisId, calculatedAt, existingScore, alternativeScore, modelVersion, gradeStatusCode, notScorableReasonCode, jobType }]

// 산출 결과 한 건을 남긴다.
export function recordMockAssessment(userId, assessment) {
  assessments.set(userId, [...(assessments.get(userId) ?? []), structuredClone(assessment)])
}

// 이 회원이 화면에서 산출한 기록(오래된 순).
export function listMockAssessments(userId) {
  return structuredClone(assessments.get(userId) ?? [])
}
