import { JOB_TYPE_LABELS } from '../../common/config/jobTypes.js'

// N-25 모형 성능 비교 화면 코드값 — 고객 집단, 컷오프 범위, 비교 표 지표 6개. 서버(ADM-01·02)와 같은 코드 문자열을 쓴다.

// N-25-1 고객 집단 — 합성 데이터의 두 집단(기존 이력·금융 이력 부족)을 합쳐 보고, 집단별로도 본다(투표 D6).
export const MODEL_GROUPS = Object.freeze([
  { value: 'ALL', label: '전체' },
  { value: 'LEGACY', label: '기존 이력 집단' },
  { value: 'THIN_FILE', label: '금융 이력 부족' },
])
export const DEFAULT_GROUP = 'ALL'

// N-25-1 승인 기준 점수(컷오프) 슬라이더 — 550~750점, 기본 650점(decisions.md N-25)
export const CUTOFF = Object.freeze({ min: 550, max: 750, step: 10, initial: 650 })

// N-25-2 비교 표 지표 6개 — key는 응답 필드 이름. lowerIsBetter면 값이 작을수록 좋은 지표다.
// type: auc는 소수 셋째 자리, rate는 %, cost는 상대값(오거절 + 오승인×5)
export const MODEL_METRICS = Object.freeze([
  { key: 'auc', label: 'ROC-AUC', type: 'auc', lowerIsBetter: false },
  { key: 'accuracy', label: '정확도', type: 'rate', lowerIsBetter: false },
  { key: 'misclassCost', label: '오분류 비용 (상대값)', type: 'cost', lowerIsBetter: true },
  { key: 'goodRejectRate', label: '우량 고객 오거절률', type: 'rate', lowerIsBetter: true },
  { key: 'badApproveRate', label: '부도 고객 오승인률', type: 'rate', lowerIsBetter: true },
  { key: 'approvalRate', label: '승인률', type: 'rate', lowerIsBetter: false },
])

// 직군 코드 → 이름 (공통 직군 코드를 그대로 쓴다)
export const jobLabel = (jobType) => JOB_TYPE_LABELS[jobType] ?? jobType

// 0~1 비율을 '12.3%'로
export const formatRate = (value) => `${(value * 100).toFixed(1)}%`
