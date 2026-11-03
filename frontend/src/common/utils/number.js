// 숫자를 천 단위 쉼표 문자열로 바꾼다. null·빈 값이면 빈 문자열.
export function formatWithComma(value) {
  if (value === null || value === undefined || value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return number.toLocaleString('ko-KR')
}

// 입력 문자열에서 숫자만 남겨 0 이상의 정수로 바꾼다. 숫자가 없으면 null.
// 15자리까지만 받아 안전한 정수 범위를 넘지 않게 한다.
export function parseDigits(text) {
  const digits = String(text ?? '').replace(/\D/g, '').slice(0, 15)
  return digits === '' ? null : Number(digits)
}
