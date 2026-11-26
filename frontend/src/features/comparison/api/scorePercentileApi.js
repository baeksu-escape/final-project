import { apiGet } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/scorePercentileMockHandlers.js'

// FP-251 N-13-1~3 내 위치(RPT-05). 일반 회원만(관리자 403), 쿼리 값은 없다.
export const SCORE_PERCENTILE_API = Object.freeze({
  PERCENTILE: '/api/members/me/score-percentile',
})

// → { myScore, workerTypeCode, ageBandCode, modelVersion, minGroupSize,
//     groups: [{ groupType, memberCount, topPct, avgScore, diffFromAvg }] }
// groups는 항상 WORKER_TYPE(직군), AGE_BAND(연령대), WORKER_TYPE_AGE(직군+연령대) 순서로 3개다.
// 인원이 minGroupSize보다 적은 집단은 topPct·avgScore·diffFromAvg가 null. 내 점수가 없으면 404 ASSESSMENT_NOT_FOUND.
export function getScorePercentile() {
  return apiGet(SCORE_PERCENTILE_API.PERCENTILE)
}
