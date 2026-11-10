import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { requireAccountByToken } from './authMockHandlers.js'
import { MOCK_DIAGNOSES, mockDiagnosisHistorySettings } from './diagnosisHistoryMockData.js'

// 등급 경계 점수(대안 점수 기준). TODO(D-01) 모형 학습 후 다시 정한다. 실제로는 서버가 등급을 정해 보낸다.
const GRADE_BOUNDARIES = Object.freeze({ GOOD: 780, STANDARD: 665 })

// 대안 점수로 3등급 코드를 정한다.
function toGrade(score) {
  if (score >= GRADE_BOUNDARIES.GOOD) return 'GOOD'
  if (score >= GRADE_BOUNDARIES.STANDARD) return 'STANDARD'
  return 'CAUTION'
}

registerMockHandlers({
  // N-04-6 진단 내역 조회 — 최신순으로 돌려준다. 변화는 바로 이전 진단 대비 대안 점수 차이이고, 가장 오래된 진단은 null이다.
  // 직군은 로그인 계정의 직군으로 채운다(실제로는 진단 당시 직군을 저장해 보낸다).
  'GET /api/members/me/diagnoses': ({ token }) => {
    const account = requireAccountByToken(token)
    if (mockDiagnosisHistorySettings.scenario === 'EMPTY') return { items: [] }
    const items = MOCK_DIAGNOSES.map((diagnosis, index) => ({
      ...diagnosis,
      jobType: account.user.jobType,
      grade: toGrade(diagnosis.alternativeScore),
      alternativeScoreChange: index === 0 ? null : diagnosis.alternativeScore - MOCK_DIAGNOSES[index - 1].alternativeScore,
    }))
    return { items: items.reverse() }
  },
})
