import { JOB_TYPE_LABELS } from '../../common/config/jobTypes.js'
import { EMPTY_TEXT } from '../admin/adminFormat.js'
import { AGE_BAND_LABELS } from '../admin/adminStatsCodes.js'

// FP-164 N-26-5~7 비교 분석 '같은 집단과 나란히 보기' 구역의 코드값과 표시 함수. 코드 문자열은 서버(ADM-04)와 같다.

// N-26-5 보기 전환 — 직군 × 연령 격자(기본)·직군별·연령대별. 직군별·연령대별 값은 관리자 통계의 groupBy 값과 같다.
export const VIEW_OPTIONS = Object.freeze([
  { value: 'GRID', label: '직군 × 연령' },
  { value: 'WORKER_TYPE', label: '직군별' },
  { value: 'AGE_BAND', label: '연령대별' },
])
export const DEFAULT_VIEW = 'GRID'

// N-26-6 격자 칸에 표시할 값 — 대안 평균 점수·상승폭·보통 이상 비율(11/06 UI의 '칸에 표시할 값'). field는 ADM-04 집단의 필드 이름.
// 등급 이름은 UI 리뉴얼 규칙대로 한글('보통 이상')로 쓴다.
export const CELL_METRICS = Object.freeze([
  { value: 'ALT_SCORE', label: '대안 점수', field: 'avgAltScore', formatValue: (v) => `${v.toFixed(1)}점` },
  { value: 'UPLIFT', label: '상승폭', field: 'avgScoreUplift', formatValue: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}점` },
  { value: 'STANDARD_OR_ABOVE', label: '보통 이상', field: 'standardOrAboveRatePct', formatValue: (v) => `${v.toFixed(1)}%` },
])
export const DEFAULT_CELL_METRIC = 'ALT_SCORE'

// 격자의 행(직군)·열(연령대) 순서 — 서버 응답의 고정 순서와 같다.
export const WORKER_TYPE_ORDER = Object.freeze(['EMPLOYEE', 'SELF_EMPLOYED', 'FREELANCER'])
export const AGE_BAND_ORDER = Object.freeze(['20S', '30S', '40S', '50_PLUS'])

export const jobName = (code) => JOB_TYPE_LABELS[code] ?? code
export const ageName = (code) => AGE_BAND_LABELS[code] ?? code

// 격자 칸 이름 — 예) 30대 급여소득자
export const cellName = (workerTypeCode, ageBandCode) => `${ageName(ageBandCode)} ${jobName(workerTypeCode)}`

// 두 평균의 차이(소수 첫째 자리). 어느 한쪽이 숨겨졌으면(null) 차이도 null이다.
export function diffOf(value, base) {
  if (value === null || value === undefined || base === null || base === undefined) return null
  return Math.round((value - base) * 10) / 10
}

// 차이를 화살표와 함께 — 예) ▲ 12.3점, ▼ 4.0점, 같음(11/06 UI). 숨김이면 '—'
export function formatDiff(diff) {
  if (diff === null) return EMPTY_TEXT
  if (diff === 0) return '같음'
  return `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}점`
}
