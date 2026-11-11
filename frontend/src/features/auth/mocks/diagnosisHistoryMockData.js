// N-04-6 mock 설정 — scenario 값 하나를 바꾸면 진단 내역 응답이 달라진다.
//   'MANY'(합성 진단 여러 건) | 'EMPTY'(0건, 안내 문구 확인용)
export const mockDiagnosisHistorySettings = {
  scenario: 'MANY',
}

// 합성 진단 기록(오래된 순). 실제 평가 결과가 아니다. 점수는 0~1000 범위이고, 등급·변화는 mock 핸들러가 붙인다.
export const MOCK_DIAGNOSES = Object.freeze([
  { diagnosisId: 'd-1', calculatedAt: '2026-07-05T10:12:00', existingScore: 598, alternativeScore: 640, modelVersion: 'alt-v1.0' },
  { diagnosisId: 'd-2', calculatedAt: '2026-08-03T09:40:00', existingScore: 605, alternativeScore: 672, modelVersion: 'alt-v1.0' },
  { diagnosisId: 'd-3', calculatedAt: '2026-09-02T20:15:00', existingScore: 610, alternativeScore: 667, modelVersion: 'alt-v1.0' },
  { diagnosisId: 'd-4', calculatedAt: '2026-10-01T14:30:00', existingScore: 612, alternativeScore: 667, modelVersion: 'alt-v1.0' },
  { diagnosisId: 'd-5', calculatedAt: '2026-11-09T14:30:00', existingScore: 630, alternativeScore: 785, modelVersion: 'alt-v1.0' },
])
