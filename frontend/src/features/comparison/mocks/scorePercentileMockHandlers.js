// FP-253 N-13 내 위치(RPT-05) mock — 실제 API와 같은 모양·오류. 점수는 화면 확인용 예시이며 실제 저장 데이터가 아니다.
// 값은 관리자 통계 mock의 예시 회원 14명으로 계산한 결과다(내 평가 = 급여소득자·30대·700점, FP-164 비교 분석 mock의 me와 같음).
import { ApiError } from '../../../common/api/ApiError.js'
import { ROLES } from '../../../common/config/roles.js'
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'

const SAMPLE = Object.freeze({
  myScore: 700,
  workerTypeCode: 'EMPLOYEE',
  ageBandCode: '30S',
  modelVersion: 'LGBM-BASE-0.3',
  minGroupSize: 5,
  groups: [
    { groupType: 'WORKER_TYPE', memberCount: 6, topPct: 66.7, avgScore: 720.0, diffFromAvg: -20.0 },
    { groupType: 'AGE_BAND', memberCount: 5, topPct: 60.0, avgScore: 703.0, diffFromAvg: -3.0 },
    { groupType: 'WORKER_TYPE_AGE', memberCount: 3, topPct: null, avgScore: null, diffFromAvg: null },
  ],
})

function handleScorePercentile({ token }) {
  const user = requireMockUser(token) // 실제 API처럼 비로그인 401
  if (user.role === ROLES.ADMIN) throw new ApiError(403, '일반 회원만 볼 수 있습니다.') // 실제 API: /api/members/me/** = ROLE_USER
  if (!user.hasScore) {
    const message = '산출된 점수가 없습니다.'
    throw new ApiError(404, message, { code: 'ASSESSMENT_NOT_FOUND', message, fieldErrors: [] })
  }
  return structuredClone(SAMPLE)
}

registerMockHandlers({
  'GET /api/members/me/score-percentile': handleScorePercentile,
})
