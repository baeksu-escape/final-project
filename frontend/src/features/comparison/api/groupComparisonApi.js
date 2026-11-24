import { apiGet } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/groupComparisonMockHandlers.js'

// FP-164 N-26-5~7 사용자 비교 분석(ADM-04). 일반 회원만(관리자 403). 조회만 있고 쿼리 값은 없다.
export const GROUP_COMPARISON_API = Object.freeze({
  COMPARISON: '/api/members/me/group-comparison',
})

// → { modelVersion, minGroupSize,
//     me: { workerTypeCode, ageBandCode, tradScore, altScore, tradGradeBandCode, altGradeBandCode } | null,
//     overall: 집단, byWorkerType: [집단 3개], byAgeBand: [집단 4개],
//     grid: [{ workerTypeCode, ageBandCode, stats: 집단 }] (12칸, 직군 순서 → 연령대 순서) }
// 집단 = 관리자 통계 ADM-03 groups[]와 같은 모양:
//   { groupCode, memberCount, avgTradScore, avgAltScore, avgScoreUplift, standardOrAboveRatePct, gradeDistribution,
//     tradStandardOrAboveRatePct, tradGradeDistribution, tradScoredMemberCount }
//   groupCode는 overall이 'ALL', 격자 칸은 '직군:연령대'(예: 'EMPLOYEE:30S').
// 집계 기준은 ADM-03과 같다: ACTIVE 모델로 낸 서비스 회원의 최근 평가, 탈퇴 제외, 값마다 계산 인원이 minGroupSize(5)명보다 적으면 null.
// me는 통계에 들어간 내 평가다(ACTIVE 모델로 점수가 나온 평가가 없으면 null). 본인 값이라 숨기지 않는다.
export function getGroupComparison() {
  return apiGet(GROUP_COMPARISON_API.COMPARISON)
}
