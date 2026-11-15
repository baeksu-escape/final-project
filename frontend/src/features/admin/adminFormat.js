import { formatWithComma } from '../../common/utils/number.js'

// FP-80 관리자 화면의 값 표시 함수. 값이 없으면 '—'를 보여 준다.
export const EMPTY_TEXT = '—'

// 서버 시각(2026-11-09T14:30:00)을 "2026-11-09 14:30"으로 보여 준다.
export function formatDateTime(value) {
  return value ? String(value).slice(0, 16).replace('T', ' ') : EMPTY_TEXT
}

// 서버 시각에서 날짜만 보여 준다. 예) 2026-11-09
export function formatDate(value) {
  return value ? String(value).slice(0, 10) : EMPTY_TEXT
}

// 금액을 "1,200,000원"으로 보여 준다.
export function formatAmount(value) {
  return value === null || value === undefined ? EMPTY_TEXT : `${formatWithComma(value)}원`
}

// 개수·개월 수 등 숫자에 단위를 붙인다. 예) formatCount(3, '건') → "3건"
export function formatCount(value, unit) {
  return value === null || value === undefined ? EMPTY_TEXT : `${value}${unit}`
}
