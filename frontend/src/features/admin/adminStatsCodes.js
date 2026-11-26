import { GRADES, GRADE_LABELS } from '../../common/config/grades.js'
import { JOB_TYPE_LABELS } from '../../common/config/jobTypes.js'
import { EMPTY_TEXT } from './adminFormat.js'

// FP-162 N-26 관리자 직군·연령별 통계 화면 코드값과 값 표시 함수. 코드 문자열은 서버(ADM-03)와 같다.

// N-26-1 구분 선택 — 직군별(기본)·연령대별
export const GROUP_BY_OPTIONS = Object.freeze([
  { value: 'WORKER_TYPE', label: '직군별' },
  { value: 'AGE_BAND', label: '연령대별' },
])
export const DEFAULT_GROUP_BY = 'WORKER_TYPE'

// ADM-03 groups[].groupCode(연령대) → 화면 이름
export const AGE_BAND_LABELS = Object.freeze({
  '20S': '20대',
  '30S': '30대',
  '40S': '40대',
  '50_PLUS': '50대 이상',
})

// N-26-3 등급 분포 순서 — 서버 응답과 같은 Caution·Standard·Good 순서
export const GRADE_ORDER = Object.freeze([GRADES.CAUTION, GRADES.STANDARD, GRADES.GOOD])

// 그룹 코드 → 화면 이름. 모르는 코드는 그대로 보여 준다. 'ALL'은 전체 행(FP-164 비교 분석 요약표, ADM-04 overall)이다.
export function groupLabel(groupBy, code) {
  if (code === 'ALL') return '전체'
  const labels = groupBy === 'AGE_BAND' ? AGE_BAND_LABELS : JOB_TYPE_LABELS
  return labels[code] ?? code
}

export function gradeLabel(code) {
  return GRADE_LABELS[code] ?? code
}

const isEmpty = (value) => value === null || value === undefined

// 평균 점수 — 소수 첫째 자리. 5명 미만으로 숨긴 값(null)은 '—'
export function formatScore(value) {
  return isEmpty(value) ? EMPTY_TEXT : value.toFixed(1)
}

// 비율(값이 이미 %) — 예) 71.4%
export function formatPct(value) {
  return isEmpty(value) ? EMPTY_TEXT : `${value.toFixed(1)}%`
}

// 상승폭(대안 − 기존) — 부호를 붙인다. 예) +68.8점
export function formatUplift(value) {
  if (isEmpty(value)) return EMPTY_TEXT
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}점`
}

// 기존 → 대안 한 줄 — 예) 636.9 → 705.4
export function formatTradToAlt(tradValue, altValue, format) {
  return `${format(tradValue)} → ${format(altValue)}`
}
