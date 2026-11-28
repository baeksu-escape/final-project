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

// 금액(원)을 한글 단위로 읽기 쉽게 바꾼다. 예) 12000000 → '1,200만 원', 150000000 → '1억 5,000만 원', 12345 → '1만 2,345원'. 0·빈 값이면 ''.
export function toKoreanWon(value) {
  const number = Math.floor(Number(value))
  if (!Number.isFinite(number) || number <= 0) return ''
  const eok = Math.floor(number / 1e8)
  const man = Math.floor((number % 1e8) / 1e4)
  const won = number % 1e4
  const parts = [eok && `${eok.toLocaleString('ko-KR')}억`, man && `${man.toLocaleString('ko-KR')}만`].filter(Boolean)
  if (won) return `${[...parts, won.toLocaleString('ko-KR')].join(' ')}원`
  return `${parts.join(' ')} 원`
}
