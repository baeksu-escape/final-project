import { apiGet } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/modelPerformanceMockHandlers.js'

// N-25 모형 성능 비교 API 경로 — B팀 API 정의서 ADM-01·02(🟡 제안, 11/17). 응답 필드는 FP-185에서 정한 제안안.
export const MODEL_PERFORMANCE_API = Object.freeze({
  PERFORMANCE: '/api/admin/model-performance',
  ROC: '/api/admin/model-performance/roc',
})

// ADM-01 N-25-1·2·4 컷오프 기준 지표 비교 — group: LEGACY|THINFILE, label: DELINQ|NONFIN, cutoff: 600~800
// → { group, label, cutoff, sampleBasis: VALID|TRAIN_VALID, sampleCount, badCount, aucBasis: SEED_MEAN_5|SINGLE_SEED,
//     legacy: { modelVersion, auc, accuracy, misclassCost, goodRejectRate, badApproveRate, approvalRate }, alternative: { 같은 필드 },
//     byJob: [{ jobType, sampleCount, badCount, legacyGoodRejectRate, alternativeGoodRejectRate }] }
// 서버(FP-184)는 지표·직군별 값을 MODEL_EVAL_SAMPLE에서, AUC는 LEGACY면 MODEL_ARTIFACT.METRICS_JSON(5개 시드 평균)에서 낸다.
export function fetchModelPerformance({ group, label, cutoff }) {
  const params = new URLSearchParams({ group, label, cutoff: String(cutoff) })
  return apiGet(`${MODEL_PERFORMANCE_API.PERFORMANCE}?${params}`)
}

// ADM-02 N-25-3 ROC 곡선 — 컷오프와 무관하고 집단·라벨만 받는다. 곡선은 평가 표(시드 1개)로 그려서 AUC 숫자는 주지 않는다.
// → { group, label, legacy: { points: [{ fpr, tpr }] }, alternative: { points } }
export function fetchModelRoc({ group, label }) {
  return apiGet(`${MODEL_PERFORMANCE_API.ROC}?${new URLSearchParams({ group, label })}`)
}
