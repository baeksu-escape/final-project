import { getGradeByScore } from '../../../common/config/grades.js'
import { GRADE_STATUS } from '../../../common/config/scoreStatus.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { MOCK_USERS } from '../../../common/mocks/mockUsers.js'
import { requireAccountByToken } from './authMockHandlers.js'
import {
  MOCK_DIAGNOSES,
  MOCK_NO_EXISTING_SCORE_DIAGNOSIS,
  MOCK_NOT_SCORABLE_DIAGNOSIS,
  mockDiagnosisHistorySettings,
} from './diagnosisHistoryMockData.js'

registerMockHandlers({
  // N-04-6 진단 내역 조회(MEM-06) — 산출 일시 기준 최신순으로 돌려준다.
  // 변화는 바로 앞의 산출 성공(SCORED) 평가 대비 대안 점수 차이다. 첫 SCORED 평가와 산출 불가(NOT_SCORABLE) 평가는 null이다.
  // 점수를 아직 산출하지 않은 계정(hasScore가 false)은 0건이다. 직군은 서버처럼 진단 당시 직군을 보낸다 — 합성 진단은 데모 계정의
  // 처음 직군(MOCK_USERS)으로 받은 것으로 보고, 마이페이지에서 직군을 바꿔도(FP-298) 지난 진단의 직군은 그대로다.
  // 등급은 대안 점수로 공통 경계(getGradeByScore)를 써서 붙인다. 이 계산은 서버 역할이고, 화면은 받은 grade를 그대로 보여 준다.
  'GET /api/members/me/diagnoses': ({ token }) => {
    const account = requireAccountByToken(token)
    const { scenario } = mockDiagnosisHistorySettings
    if (scenario === 'EMPTY' || account.user.hasScore === false) return { items: [] }
    const diagnoses =
      scenario === 'MIXED'
        ? [...MOCK_DIAGNOSES, MOCK_NOT_SCORABLE_DIAGNOSIS, MOCK_NO_EXISTING_SCORE_DIAGNOSIS]
        : [...MOCK_DIAGNOSES]
    diagnoses.sort((a, b) => a.calculatedAt.localeCompare(b.calculatedAt))
    const assessedJobType = MOCK_USERS.find((item) => item.user.userId === account.user.userId)?.user.jobType ?? account.user.jobType
    let previousScored = null
    const items = diagnoses.map((diagnosis) => {
      const scored = diagnosis.gradeStatusCode === GRADE_STATUS.SCORED
      const item = {
        ...diagnosis,
        jobType: assessedJobType,
        grade: scored ? getGradeByScore(diagnosis.alternativeScore) : null,
        alternativeScoreChange: scored && previousScored ? diagnosis.alternativeScore - previousScored.alternativeScore : null,
      }
      if (scored) previousScored = diagnosis
      return item
    })
    return { items: items.reverse() }
  },
})
