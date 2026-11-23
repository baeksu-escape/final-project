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
//                tradStandardOrAboveRatePct },
//     gradeDistribution: [{ gradeBandCode, count, ratePct }], tradGradeDistribution: [같은 모양],
//     groups: [{ groupCode, memberCount, avgTradScore, avgAltScore, avgScoreUplift, standardOrAboveRatePct, gradeDistribution,
//                tradStandardOrAboveRatePct, tradGradeDistribution }] }
// standardOrAboveRatePct·gradeDistribution은 대안 모델, trad*는 기존 모델이다(화면의 "기존 → 대안" 비교, 기존은 기존 모델로 산출된 회원만 분모).
// 대상은 서비스 회원별 최근 평가(탈퇴 제외). minGroupSize(5)명보다 적은 그룹·전체는 평균·비율·gradeDistribution이 null이다(인원 수는 있음).
export function getAdminStats({ groupBy } = {}) {
  const query = groupBy ? `?groupBy=${encodeURIComponent(groupBy)}` : ''
  return apiGet(`${ADMIN_STATS_API.STATS}${query}`)
}
