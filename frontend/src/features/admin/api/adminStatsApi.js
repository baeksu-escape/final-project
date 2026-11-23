import { apiGet } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/adminStatsMockHandlers.js'

// FP-161 N-26-1~4 관리자 직군·연령별 통계(ADM-03). 관리자만(일반 회원 403).
export const ADMIN_STATS_API = Object.freeze({
  STATS: '/api/admin/stats',
})

// groupBy: 'WORKER_TYPE'(직군별, 기본)·'AGE_BAND'(연령대별) →
//   { groupBy, minGroupSize,
//     summary: { assessedMemberCount, avgTradScore, avgAltScore, avgScoreUplift, standardOrAboveRatePct, registeredMemberCount, todayScoredCount,
//                tradStandardOrAboveRatePct, tradScoredMemberCount },
//     gradeDistribution: [{ gradeBandCode, count, ratePct }], tradGradeDistribution: [같은 모양],
//     groups: [{ groupCode, memberCount, avgTradScore, avgAltScore, avgScoreUplift, standardOrAboveRatePct, gradeDistribution,
//                tradStandardOrAboveRatePct, tradGradeDistribution, tradScoredMemberCount }] }
// standardOrAboveRatePct·gradeDistribution은 대안 모델, trad*는 기존 모델이다(화면의 "기존 → 대안" 비교, 기존은 기존 모델로 산출된 회원만 분모).
// 대상은 서비스 회원별 최근 평가(탈퇴 제외). 값마다 계산에 들어간 인원이 minGroupSize(5)명보다 적으면 그 값이 null이다.
// 대안 값은 memberCount명, 기존 평균·기존 등급 값·상승폭은 tradScoredMemberCount명(기존 모델로 산출된 회원)으로 계산한다.
export function getAdminStats({ groupBy } = {}) {
  const query = groupBy ? `?groupBy=${encodeURIComponent(groupBy)}` : ''
  return apiGet(`${ADMIN_STATS_API.STATS}${query}`)
}
