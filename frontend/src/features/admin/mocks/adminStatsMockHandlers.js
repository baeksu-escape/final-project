// FP-161 N-26 관리자 직군·연령별 통계(ADM-03) mock — 실제 API와 같은 모양·규칙(5명 미만 그룹은 평균·비율·등급 분포 null, 소수 첫째 자리 반올림).
// 아래 회원 점수는 화면 확인용 예시값이며 실제 저장 데이터가 아니다.
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { ApiError } from '../../../common/api/ApiError.js'
import { requireMockAdmin } from './adminMockShared.js'

const MIN_GROUP_SIZE = 5
const GROUP_CODES = Object.freeze({
  WORKER_TYPE: ['EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER'],
  AGE_BAND: ['20S', '30S', '40S', '50_PLUS'],
})
const GRADE_CODES = ['CAUTION', 'STANDARD', 'GOOD']

// [직군, 연령대, 기존 점수(null = 기존 모델로 산출 못 함), 대안 점수, 대안 등급] — 회원별 최근 평가 예시
const SAMPLE_MEMBERS = Object.freeze([
  ['EMPLOYEE', '30S', 640, 700, 'STANDARD'], ['EMPLOYEE', '30S', 700, 760, 'STANDARD'], ['EMPLOYEE', '40S', 750, 800, 'GOOD'],
  ['EMPLOYEE', '20S', 600, 650, 'CAUTION'], ['EMPLOYEE', '40S', 680, 720, 'STANDARD'], ['EMPLOYEE', '30S', 610, 690, 'STANDARD'],
  ['SELF_EMPLOYED', '40S', 590, 640, 'CAUTION'], ['SELF_EMPLOYED', '50_PLUS', 620, 690, 'STANDARD'], ['SELF_EMPLOYED', '40S', 660, 730, 'STANDARD'],
  ['SELF_EMPLOYED', '30S', 570, 655, 'CAUTION'], ['SELF_EMPLOYED', '50_PLUS', 700, 790, 'GOOD'],
  ['FREELANCER', '20S', 560, 640, 'CAUTION'], ['FREELANCER', '20S', null, 700, 'STANDARD'], ['FREELANCER', '30S', 600, 710, 'STANDARD'],
].map(([workerTypeCode, ageBandCode, tradScore, altScore, altGradeBandCode]) =>
  Object.freeze({ workerTypeCode, ageBandCode, tradScore, altScore, altGradeBandCode })))
const SAMPLE_REGISTERED_MEMBER_COUNT = 40
const SAMPLE_TODAY_SCORED_COUNT = 3

// 서버 BigDecimal HALF_UP(소수 첫째 자리)과 같은 반올림 — 값이 모두 0 이상이라 Math.round로 같다
const round1 = (value) => Math.round(value * 10) / 10
const average = (values) => (values.length ? round1(values.reduce((sum, v) => sum + v, 0) / values.length) : null)
const rate = (count, total) => (total ? round1((count * 100) / total) : null)

function aggregate(members) {
  const withTrad = members.filter((m) => m.tradScore !== null)
  return {
    avgTradScore: average(withTrad.map((m) => m.tradScore)),
    avgAltScore: average(members.map((m) => m.altScore)),
    avgScoreUplift: average(withTrad.map((m) => m.altScore - m.tradScore)),
    standardOrAboveRatePct: rate(members.filter((m) => m.altGradeBandCode !== 'CAUTION').length, members.length),
    gradeDistribution: GRADE_CODES.map((gradeBandCode) => {
      const count = members.filter((m) => m.altGradeBandCode === gradeBandCode).length
      return { gradeBandCode, count, ratePct: rate(count, members.length) }
    }),
  }
}

// 5명 미만이면 평균·비율·등급 분포를 숨긴다(인원 수는 보인다)
function hidden() {
  return { avgTradScore: null, avgAltScore: null, avgScoreUplift: null, standardOrAboveRatePct: null, gradeDistribution: null }
}

function handleAdminStats({ token, query }) {
  requireMockAdmin(token) // 실제 API처럼 비로그인 401, 일반 회원 403
  const groupBy = query?.get('groupBy') || 'WORKER_TYPE'
  if (!GROUP_CODES[groupBy]) {
    const message = '구분은 WORKER_TYPE(직군별) 또는 AGE_BAND(연령대별)여야 합니다.'
    throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field: 'groupBy', message }] })
  }
  const members = SAMPLE_MEMBERS
  const keyOf = (m) => (groupBy === 'WORKER_TYPE' ? m.workerTypeCode : m.ageBandCode)
  const overall = members.length >= MIN_GROUP_SIZE ? aggregate(members) : hidden()
  return {
    groupBy,
    minGroupSize: MIN_GROUP_SIZE,
    summary: {
      assessedMemberCount: members.length,
      avgTradScore: overall.avgTradScore,
      avgAltScore: overall.avgAltScore,
      avgScoreUplift: overall.avgScoreUplift,
      standardOrAboveRatePct: overall.standardOrAboveRatePct,
      registeredMemberCount: SAMPLE_REGISTERED_MEMBER_COUNT,
      todayScoredCount: SAMPLE_TODAY_SCORED_COUNT,
    },
    gradeDistribution: overall.gradeDistribution,
    groups: GROUP_CODES[groupBy].map((groupCode) => {
      const group = members.filter((m) => keyOf(m) === groupCode)
      return { groupCode, memberCount: group.length, ...(group.length >= MIN_GROUP_SIZE ? aggregate(group) : hidden()) }
    }),
  }
}

registerMockHandlers({
  'GET /api/admin/stats': handleAdminStats,
})
