import { ApiError } from '../../../common/api/ApiError.js'
import { JOB_TYPES } from '../../../common/config/jobTypes.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { CUTOFF, MODEL_GROUPS, MODEL_LABELS } from '../modelPerformanceCodes.js'
import { requireMockAdmin } from './adminMockShared.js'

// N-25 모형 성능 비교 mock (ADM-01·02) — 실제 응답과 같은 모양으로 돌려준다.
// 건수·불량 수·AUC는 B조 평가 표 MODEL_EVAL_SAMPLE(3,085행)과 METRICS_JSON 값과 같다(11/19 FP-235).
// 11/20 ACTIVE 모델 0.2 기준으로 맞춤: LEGACY AUC는 0.2 same_label_comparison(5개 시드 평균),
// THINFILE AUC는 load_model_eval_sample_lgbm_base_0_2.sql 점수로 계산한 시드 1개 값. 불량 수는 라벨이 모델과 무관해 0.1과 같다.
// 컷오프별 지표·ROC 점·직군별 오거절률은 컷오프에 따라 움직이는 **시연용 예시**이며 실제 계산 결과가 아니다(FP-184에서 표로 계산).
// 단위는 실제 API와 같다: 비율·ROC 좌표는 % 소수 둘째 자리, AUC는 0~1(API README 3장). 아래 계산은 0~1로 하고 내보낼 때 %로 바꾼다.

const MODEL_VERSION = 'LGBM-BASE-0.2'
// ROC 점 개수 — 실제 API처럼 기준 점수 0, 10, …, 1010마다 한 점(102개). 화면이 컷오프/10번째 점을 컷오프 위치로 쓴다.
const ROC_POINT_COUNT = 101

// 집단·라벨별 값 — auc: [기존, 대안](LEGACY는 5개 시드 평균, THINFILE은 시드 1개), bad: 불량(라벨 1) 수,
// improve: 예시 지표에서 대안이 나아지는 정도(연체 라벨은 대안 효과를 넣지 않은 라벨이라 0), penalty: 씬파일의 기존 모형 불리함(예시)
const GROUP_EXAMPLES = {
  LEGACY: {
    sampleBasis: 'VALID',
    aucBasis: 'SEED_MEAN_5',
    penalty: 0,
    DELINQ: { auc: [0.6047, 0.6078], bad: 174, improve: 0 },
    NONFIN: { auc: [0.608, 0.6591], bad: 175, improve: 0.8 },
  },
  THINFILE: {
    sampleBasis: 'TRAIN_VALID',
    aucBasis: 'SINGLE_SEED',
    penalty: 0.06,
    DELINQ: { auc: [0.5798, 0.5867], bad: 122, improve: 0 },
    NONFIN: { auc: [0.5605, 0.6263], bad: 117, improve: 1.2 },
  },
}

// 집단·직군별 평가 표본 건수 (LEGACY VALID 1,800명, THINFILE 노출 1인 TRAIN+VALID 1,285명)
const SAMPLE_COUNTS = {
  LEGACY: { [JOB_TYPES.EMPLOYEE]: 1411, [JOB_TYPES.SELF_EMPLOYED]: 261, [JOB_TYPES.FREELANCER]: 128 },
  THINFILE: { [JOB_TYPES.EMPLOYEE]: 422, [JOB_TYPES.SELF_EMPLOYED]: 422, [JOB_TYPES.FREELANCER]: 441 },
}

// 직군별 우량 고객 오거절률 예시 기준값 [기존, 대안] (컷오프 650 부근)
const JOB_REJECT_BASE = {
  [JOB_TYPES.EMPLOYEE]: [0.14, 0.12],
  [JOB_TYPES.SELF_EMPLOYED]: [0.26, 0.19],
  [JOB_TYPES.FREELANCER]: [0.31, 0.21],
}

const clamp = (value) => Math.min(0.95, Math.max(0.01, value))
const round4 = (value) => Math.round(value * 10000) / 10000
// 0~1 비율 → % 소수 둘째 자리
const toPercent = (value) => Math.round(value * 10000) / 100

const totalOf = (group) => Object.values(SAMPLE_COUNTS[group]).reduce((sum, n) => sum + n, 0)

// 오거절률·오승인률로 나머지 지표를 만든다. 오분류 비용은 부도 오승인을 5배로 본다(decisions.md N-25).
function metricsOf(auc, goodRejectRate, badApproveRate, defaultRate) {
  const good = 1 - defaultRate
  return {
    modelVersion: MODEL_VERSION,
    auc,
    accuracy: toPercent(1 - (goodRejectRate * good + badApproveRate * defaultRate)),
    misclassCost: round4(goodRejectRate * good + badApproveRate * defaultRate * 5),
    goodRejectRate: toPercent(goodRejectRate),
    badApproveRate: toPercent(badApproveRate),
    approvalRate: toPercent((1 - goodRejectRate) * good + badApproveRate * defaultRate),
  }
}

// AUC가 주어진 값이 되는 예시 곡선 tpr = fpr^k (k = 1/auc - 1). 기준 점수가 오를수록 fpr이 커지게 순서대로 만든다.
function rocPoints(auc) {
  const k = 1 / auc - 1
  return Array.from({ length: ROC_POINT_COUNT + 1 }, (_, i) => {
    const fpr = Math.min(1, i / (ROC_POINT_COUNT - 1))
    return { fpr: toPercent(fpr), tpr: toPercent(fpr ** k) }
  })
}

// 쿼리 값이 허용 목록에 있는지 본다. 없으면 실제 API처럼 400(field = 쿼리 이름).
function readCode(query, field, options, fallback, message) {
  const value = query.get(field) ?? fallback
  if (!options.some((item) => item.value === value)) {
    throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field, message }] })
  }
  return value
}
const readGroup = (query) => readCode(query, 'group', MODEL_GROUPS, 'LEGACY', '고객 집단 값이 올바르지 않습니다.')
const readLabel = (query) => readCode(query, 'label', MODEL_LABELS, 'DELINQ', '비교 라벨 값이 올바르지 않습니다.')

registerMockHandlers({
  // ADM-01 컷오프 기준 지표 비교·직군별 오거절률
  'GET /api/admin/model-performance': ({ token, query }) => {
    requireMockAdmin(token)
    const group = readGroup(query)
    const label = readLabel(query)
    const cutoff = Number(query.get('cutoff') ?? CUTOFF.initial)
    if (!Number.isInteger(cutoff) || cutoff < CUTOFF.min || cutoff > CUTOFF.max) {
      const message = `컷오프는 ${CUTOFF.min}~${CUTOFF.max}점 사이로 넣어 주세요.`
      throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field: 'cutoff', message }] })
    }
    const example = GROUP_EXAMPLES[group]
    const byLabel = example[label]
    const total = totalOf(group)
    const defaultRate = byLabel.bad / total
    // 컷오프를 올리면 오거절은 늘고 오승인은 줄어든다(시연용 예시)
    const t = (cutoff - CUTOFF.min) / (CUTOFF.max - CUTOFF.min)
    const legacyReject = clamp(0.12 + t * 0.45 + example.penalty)
    const legacyApprove = clamp(0.38 - t * 0.3 + example.penalty / 2)
    const altReject = clamp(legacyReject - 0.07 * byLabel.improve)
    const altApprove = clamp(legacyApprove - 0.05 * byLabel.improve)
    const scale = 0.6 + t * 0.9
    const byJob = Object.values(JOB_TYPES).map((jobType) => {
      const [legacyBase, altBase] = JOB_REJECT_BASE[jobType]
      const sampleCount = SAMPLE_COUNTS[group][jobType]
      return {
        jobType,
        sampleCount,
        // 직군별 불량 수는 집단 불량 수를 표본 비율로 나눈 예시 값이다
        badCount: Math.round((byLabel.bad * sampleCount) / total),
        legacyGoodRejectRate: toPercent(clamp(legacyBase * scale + example.penalty)),
        alternativeGoodRejectRate: toPercent(clamp(legacyBase * scale - (legacyBase - altBase) * byLabel.improve + example.penalty / 2)),
      }
    })
    return {
      group,
      label,
      cutoff,
      sampleBasis: example.sampleBasis,
      sampleCount: total,
      badCount: byLabel.bad,
      aucBasis: example.aucBasis,
      legacy: metricsOf(byLabel.auc[0], legacyReject, legacyApprove, defaultRate),
      alternative: metricsOf(byLabel.auc[1], altReject, altApprove, defaultRate),
      byJob,
    }
  },

  // ADM-02 ROC 곡선 — 곡선 점만 준다(곡선은 시드 1개 표로 그려서, 표의 AUC와 섞이지 않게 숫자는 뺐다)
  'GET /api/admin/model-performance/roc': ({ token, query }) => {
    requireMockAdmin(token)
    const group = readGroup(query)
    const label = readLabel(query)
    const [legacyAuc, altAuc] = GROUP_EXAMPLES[group][label].auc
    return {
      group,
      label,
      legacy: { points: rocPoints(legacyAuc) },
      alternative: { points: rocPoints(altAuc) },
    }
  },
})
