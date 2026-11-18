import { ApiError } from '../../../common/api/ApiError.js'
import { JOB_TYPES } from '../../../common/config/jobTypes.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { CUTOFF, MODEL_GROUPS } from '../modelPerformanceCodes.js'
import { requireMockAdmin } from './adminMockShared.js'

// N-25 모형 성능 비교 mock (ADM-01·02) — 실제 응답과 같은 모양으로 돌려준다.
// 표본 수는 합성 학습 데이터 v3.6.0의 시험(TEST) 표본 건수와 같다. 지표 값은 컷오프에 따라 움직이는 **시연용 예시**이며 실제 모델 결과가 아니다.

const MODEL_VERSION = 'LGBM-BASE-0.1'
const ROC_POINT_COUNT = 20

// 집단별 예시 설정 — auc: [기존, 대안], improve: 대안의 개선 정도, penalty: 금융 이력 부족 집단의 기존 모델 불리함
const GROUP_EXAMPLES = {
  ALL: { auc: [0.605, 0.653], improve: 1.0, penalty: 0, defaultRate: 0.15 },
  LEGACY: { auc: [0.612, 0.65], improve: 0.8, penalty: 0, defaultRate: 0.14 },
  THIN_FILE: { auc: [0.561, 0.668], improve: 1.8, penalty: 0.08, defaultRate: 0.2 },
}

// 집단·직군별 시험 표본 건수 (legacy 1,800명 + thinfile 359명)
const SAMPLE_COUNTS = {
  LEGACY: { [JOB_TYPES.EMPLOYEE]: 1411, [JOB_TYPES.SELF_EMPLOYED]: 261, [JOB_TYPES.FREELANCER]: 128 },
  THIN_FILE: { [JOB_TYPES.EMPLOYEE]: 120, [JOB_TYPES.SELF_EMPLOYED]: 120, [JOB_TYPES.FREELANCER]: 119 },
}

// 직군별 우량 고객 오거절률 예시 기준값 [기존, 대안] (컷오프 650 부근)
const JOB_REJECT_BASE = {
  [JOB_TYPES.EMPLOYEE]: [0.14, 0.12],
  [JOB_TYPES.SELF_EMPLOYED]: [0.26, 0.19],
  [JOB_TYPES.FREELANCER]: [0.31, 0.21],
}

const clamp = (value) => Math.min(0.95, Math.max(0.01, value))
const round4 = (value) => Math.round(value * 10000) / 10000

function countOf(group, jobType) {
  if (group === 'ALL') return SAMPLE_COUNTS.LEGACY[jobType] + SAMPLE_COUNTS.THIN_FILE[jobType]
  return SAMPLE_COUNTS[group][jobType]
}

// 오거절률·오승인률로 나머지 지표를 만든다. 오분류 비용은 부도 오승인을 5배로 본다(decisions.md N-25).
function metricsOf(auc, goodRejectRate, badApproveRate, defaultRate) {
  const good = 1 - defaultRate
  return {
    modelVersion: MODEL_VERSION,
    auc,
    accuracy: round4(1 - (goodRejectRate * good + badApproveRate * defaultRate)),
    misclassCost: round4(goodRejectRate * good + badApproveRate * defaultRate * 5),
    goodRejectRate: round4(goodRejectRate),
    badApproveRate: round4(badApproveRate),
    approvalRate: round4((1 - goodRejectRate) * good + badApproveRate * defaultRate),
  }
}

// AUC가 주어진 값이 되는 예시 곡선 tpr = fpr^k (k = 1/auc - 1)
function rocPoints(auc) {
  const k = 1 / auc - 1
  return Array.from({ length: ROC_POINT_COUNT + 1 }, (_, i) => {
    const fpr = i / ROC_POINT_COUNT
    return { fpr: round4(fpr), tpr: round4(fpr ** k) }
  })
}

function readGroup(query) {
  const group = query.get('group') ?? 'ALL'
  if (!MODEL_GROUPS.some((item) => item.value === group)) {
    throw new ApiError(400, '고객 집단 값이 올바르지 않습니다.', { code: 'INVALID_INPUT' })
  }
  return group
}

registerMockHandlers({
  // ADM-01 컷오프 기준 지표 비교·직군별 오거절률
  'GET /api/admin/model-performance': ({ token, query }) => {
    requireMockAdmin(token)
    const group = readGroup(query)
    const cutoff = Number(query.get('cutoff') ?? CUTOFF.initial)
    if (!Number.isInteger(cutoff) || cutoff < CUTOFF.min || cutoff > CUTOFF.max) {
      throw new ApiError(400, `컷오프는 ${CUTOFF.min}~${CUTOFF.max}점 사이로 넣어 주세요.`, { code: 'INVALID_INPUT' })
    }
    const example = GROUP_EXAMPLES[group]
    // 컷오프를 올리면 오거절은 늘고 오승인은 줄어든다
    const t = (cutoff - CUTOFF.min) / (CUTOFF.max - CUTOFF.min)
    const legacyReject = clamp(0.12 + t * 0.45 + example.penalty)
    const legacyApprove = clamp(0.38 - t * 0.3 + example.penalty / 2)
    const altReject = clamp(legacyReject - 0.07 * example.improve)
    const altApprove = clamp(legacyApprove - 0.05 * example.improve)
    const scale = 0.6 + t * 0.9
    const byJob = Object.values(JOB_TYPES).map((jobType) => {
      const [legacyBase, altBase] = JOB_REJECT_BASE[jobType]
      return {
        jobType,
        sampleCount: countOf(group, jobType),
        legacyGoodRejectRate: round4(clamp(legacyBase * scale + example.penalty)),
        alternativeGoodRejectRate: round4(clamp(altBase * scale + example.penalty / 2)),
      }
    })
    return {
      group,
      cutoff,
      sampleCount: byJob.reduce((sum, row) => sum + row.sampleCount, 0),
      legacy: metricsOf(example.auc[0], legacyReject, legacyApprove, example.defaultRate),
      alternative: metricsOf(example.auc[1], altReject, altApprove, example.defaultRate),
      byJob,
    }
  },

  // ADM-02 ROC 곡선
  'GET /api/admin/model-performance/roc': ({ token, query }) => {
    requireMockAdmin(token)
    const group = readGroup(query)
    const [legacyAuc, altAuc] = GROUP_EXAMPLES[group].auc
    return {
      group,
      legacy: { auc: legacyAuc, points: rocPoints(legacyAuc) },
      alternative: { auc: altAuc, points: rocPoints(altAuc) },
    }
  },
})
