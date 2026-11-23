// FP-164 N-26-5~7 사용자 비교 분석(ADM-04) mock — 실제 API와 같은 모양·규칙. 관리자 통계 mock(ADM-03)과 같은 예시 회원·계산을 쓴다
// (서버도 같은 계산을 쓴다, 11/23 동주 합의). 예시 점수는 화면 확인용이며 실제 저장 데이터가 아니다.
import { ApiError } from '../../../common/api/ApiError.js'
import { ROLES } from '../../../common/config/roles.js'
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'
import {
  GROUP_CODES,
  MIN_GROUP_SIZE,
  SAMPLE_MEMBERS,
  SAMPLE_MODEL_VERSION,
  aggregate,
} from '../../admin/mocks/adminStatsMockHandlers.js'

// 데모 계정 중 점수가 있는 계정(hasScore: true)만 내 평가가 있다. 예시 회원 첫 줄(급여소득자·30대)을 내 평가로 본다.
const MY_SAMPLE_INDEX = Object.freeze({ 'u-employee': 0 })

const group = (groupCode, members) => ({ groupCode, memberCount: members.length, ...aggregate(members) })

function handleGroupComparison({ token }) {
  const user = requireMockUser(token) // 실제 API처럼 비로그인 401
  if (user.role === ROLES.ADMIN) throw new ApiError(403, '일반 회원만 볼 수 있습니다.') // 실제 API: /api/members/me/** = ROLE_USER
  const members = SAMPLE_MEMBERS
  const mine = members[MY_SAMPLE_INDEX[user.userId]]
  return {
    modelVersion: SAMPLE_MODEL_VERSION,
    minGroupSize: MIN_GROUP_SIZE,
    me: mine
      ? {
          workerTypeCode: mine.workerTypeCode,
          ageBandCode: mine.ageBandCode,
          tradScore: mine.tradScore,
          altScore: mine.altScore,
          tradGradeBandCode: mine.tradGradeBandCode,
          altGradeBandCode: mine.altGradeBandCode,
        }
      : null,
    overall: group('ALL', members),
    byWorkerType: GROUP_CODES.WORKER_TYPE.map((code) => group(code, members.filter((m) => m.workerTypeCode === code))),
    byAgeBand: GROUP_CODES.AGE_BAND.map((code) => group(code, members.filter((m) => m.ageBandCode === code))),
    grid: GROUP_CODES.WORKER_TYPE.flatMap((workerTypeCode) =>
      GROUP_CODES.AGE_BAND.map((ageBandCode) => ({
        workerTypeCode,
        ageBandCode,
        stats: group(
          `${workerTypeCode}:${ageBandCode}`,
          members.filter((m) => m.workerTypeCode === workerTypeCode && m.ageBandCode === ageBandCode),
        ),
      })),
    ),
  }
}

registerMockHandlers({
  'GET /api/members/me/group-comparison': handleGroupComparison,
})
