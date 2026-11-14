import { GRADE_STATUS } from '../../../common/config/scoreStatus.js'

// N-04-6 mock 설정 — scenario 값 하나를 바꾸면 진단 내역 응답이 달라진다.
//   'MANY'(합성 진단 여러 건) | 'MIXED'(여러 건 + 산출 불가 1건 + 기존 점수 없는 산출 1건, '—' 표시 확인용) | 'EMPTY'(0건, 안내 문구 확인용)
export const mockDiagnosisHistorySettings = {
  scenario: 'MANY',
}

// 합성 진단 기록(오래된 순). 실제 평가 결과가 아니다. 점수는 0~1000 범위이고, 등급·변화는 mock 핸들러가 붙인다(서버 역할).
// diagnosisId는 점수 산출 요청의 requestId와 같은 값(소문자 UUID, MEM-06)이다. ASSESSMENT_ID 같은 순번을 쓰지 않는다.
export const MOCK_DIAGNOSES = Object.freeze([
  { diagnosisId: '6f1c2a3e-8b4d-4c7a-9e21-3a5b7c9d1e01', calculatedAt: '2026-07-05T10:12:00', existingScore: 598, alternativeScore: 640, modelVersion: 'alt-v1.0', gradeStatusCode: GRADE_STATUS.SCORED, notScorableReasonCode: null },
  { diagnosisId: '2b8e4f6a-1c3d-4e5f-8a7b-9c0d1e2f3a02', calculatedAt: '2026-08-03T09:40:00', existingScore: 605, alternativeScore: 672, modelVersion: 'alt-v1.0', gradeStatusCode: GRADE_STATUS.SCORED, notScorableReasonCode: null },
  { diagnosisId: '9d3a5c7e-2f4b-4a6c-8e1d-0b2c4d6e8f03', calculatedAt: '2026-09-02T20:15:00', existingScore: 610, alternativeScore: 667, modelVersion: 'alt-v1.0', gradeStatusCode: GRADE_STATUS.SCORED, notScorableReasonCode: null },
  { diagnosisId: '4e7b9d1f-3a5c-4e8a-9b2d-1c3e5f7a9b04', calculatedAt: '2026-10-01T14:30:00', existingScore: 612, alternativeScore: 667, modelVersion: 'alt-v1.0', gradeStatusCode: GRADE_STATUS.SCORED, notScorableReasonCode: null },
  { diagnosisId: 'a1c3e5f7-4b6d-4f8a-8c0e-2d4f6a8c0e05', calculatedAt: '2026-11-09T14:30:00', existingScore: 630, alternativeScore: 785, modelVersion: 'alt-v1.0', gradeStatusCode: GRADE_STATUS.SCORED, notScorableReasonCode: null },
])

// 'MIXED' 시나리오에서 더하는 산출 불가 평가 1건(입력 자료가 오래됨). 점수·등급이 없다.
export const MOCK_NOT_SCORABLE_DIAGNOSIS = Object.freeze({
  diagnosisId: '7c9e1a3b-5d7f-4b9c-9d1f-3e5a7c9e1b06',
  calculatedAt: '2026-09-20T11:05:00',
  existingScore: null,
  alternativeScore: null,
  modelVersion: 'alt-v1.0',
  gradeStatusCode: GRADE_STATUS.NOT_SCORABLE,
  notScorableReasonCode: 'STALE_INPUT',
})

// 'MIXED' 시나리오에서 더하는 기존 점수 없는 평가 1건 — 산출은 됐지만(SCORED) 금융 이력이 부족해 기존 점수가 null이다(B팀 명세서 v0.3 3-1 traditional.scorableYn = 'N').
// 금융 이력이 쌓이기 전인 가장 오래된 평가로 둔다. 대안 점수와 등급은 있다.
export const MOCK_NO_EXISTING_SCORE_DIAGNOSIS = Object.freeze({
  diagnosisId: '3f5a7c9e-1b3d-4f5a-8b7c-9d1e3f5a7c07',
  calculatedAt: '2026-06-07T16:20:00',
  existingScore: null,
  alternativeScore: 612,
  modelVersion: 'alt-v1.0',
  gradeStatusCode: GRADE_STATUS.SCORED,
  notScorableReasonCode: null,
})
