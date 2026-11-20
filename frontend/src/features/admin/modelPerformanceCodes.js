import { JOB_TYPE_LABELS } from '../../common/config/jobTypes.js'

// N-25 모형 성능 비교 화면 코드값 — 고객 집단, 비교 라벨, 컷오프 범위, 비교 표 지표 6개. 서버(ADM-01·02)와 같은 코드 문자열을 쓴다.

// N-25-1 고객 집단 — B조 평가 표 MODEL_EVAL_SAMPLE.GROUP_CODE와 같은 코드. 두 집단은 정답 라벨 생성 방식이 달라
// 합치지 않고 집단별로만 본다(11/19 동주, decisions.md). basis: 평가 표본, aucBasis: AUC 출처(B조 권고).
export const MODEL_GROUPS = Object.freeze([
  { value: 'LEGACY', label: '기존 이력 집단', basis: '검증(VALID) 표본', aucBasis: '5개 시드 평균' },
  { value: 'THINFILE', label: '금융 이력 부족', basis: '기존 집단 학습 모델 적용(TRAIN+VALID)', aucBasis: '시드 1개 값' },
])
export const DEFAULT_GROUP = 'LEGACY'

// N-25-1 비교 라벨 — 두 모형을 같은 정답으로 맞춰 비교한다(피처 정의서 C20). 표의 점수 열도 라벨마다 따로 있다.
export const MODEL_LABELS = Object.freeze([
  { value: 'DELINQ', label: '연체 라벨' },
  { value: 'NONFIN', label: '비금융 효과 라벨' },
])
export const DEFAULT_LABEL = 'DELINQ'

// N-25-1 승인 기준 점수(컷오프) 슬라이더 — 600~800점, 기본 700점(11/19 동주: 실제 모델 점수 중앙값 약 700, decisions.md)
export const CUTOFF = Object.freeze({ min: 600, max: 800, step: 10, initial: 700 })

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

// 서버가 % 단위(소수 둘째 자리, API README 3장)로 준 비율을 '12.3%'로
export const formatRate = (value) => `${value.toFixed(1)}%`
