import { apiGet } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/modelPerformanceMockHandlers.js'

// N-25 모형 성능 비교 API 경로 — B팀 API 정의서 ADM-01·02(🟡 제안, 11/17). 응답 필드는 FP-185에서 정한 제안안.
export const MODEL_PERFORMANCE_API = Object.freeze({
  PERFORMANCE: '/api/admin/model-performance',
  ROC: '/api/admin/model-performance/roc',
})

// ADM-01 N-25-1·2·4 컷오프 기준 지표 비교 —
// → { group, cutoff, sampleCount, legacy: { modelVersion, auc, accuracy, misclassCost, goodRejectRate, badApproveRate, approvalRate },
//     alternative: { 같은 필드 }, byJob: [{ jobType, sampleCount, legacyGoodRejectRate, alternativeGoodRejectRate }] }
export function fetchModelPerformance({ group, cutoff }) {
  const params = new URLSearchParams({ group, cutoff: String(cutoff) })
  return apiGet(`${MODEL_PERFORMANCE_API.PERFORMANCE}?${params}`)
}

// ADM-02 N-25-3 ROC 곡선 — 컷오프와 무관하고 집단만 받는다.
// → { group, legacy: { auc, points: [{ fpr, tpr }] }, alternative: { auc, points } }
export function fetchModelRoc(group) {
  return apiGet(`${MODEL_PERFORMANCE_API.ROC}?${new URLSearchParams({ group })}`)
}
