import { getGradeByScore } from '../../../common/config/grades.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { requireAccountByToken } from './authMockHandlers.js'
import { MOCK_DIAGNOSES, mockDiagnosisHistorySettings } from './diagnosisHistoryMockData.js'

registerMockHandlers({
  // N-04-6 진단 내역 조회 — 최신순으로 돌려준다. 변화는 바로 이전 진단 대비 대안 점수 차이이고, 가장 오래된 진단은 null이다.
  // 점수를 아직 산출하지 않은 계정(hasScore가 false)은 0건이다. 직군은 로그인 계정의 직군으로 채운다(실제로는 진단 당시 직군을 저장해 보낸다).
  // 등급은 대안 점수로 공통 경계(getGradeByScore)를 써서 붙인다. 실제로는 서버가 정해 보낸다.
  'GET /api/members/me/diagnoses': ({ token }) => {
    const account = requireAccountByToken(token)
    if (mockDiagnosisHistorySettings.scenario === 'EMPTY' || account.user.hasScore === false) return { items: [] }
    const items = MOCK_DIAGNOSES.map((diagnosis, index) => ({
      ...diagnosis,
      jobType: account.user.jobType,
      grade: getGradeByScore(diagnosis.alternativeScore),
      alternativeScoreChange: index === 0 ? null : diagnosis.alternativeScore - MOCK_DIAGNOSES[index - 1].alternativeScore,
    }))
    return { items: items.reverse() }
  },
})
