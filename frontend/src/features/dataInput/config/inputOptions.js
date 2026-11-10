// 대출 업권 선택지 — 더미 DB MEMBER_LOAN.SECTOR_CODE(0~6)와 같은 값을 쓴다.
export const LOAN_SECTOR_OPTIONS = Object.freeze([
  { value: '0', label: '은행' },
  { value: '1', label: '카드' },
  { value: '2', label: '저축은행' },
  { value: '3', label: '캐피탈' },
  { value: '4', label: '대부업' },
  { value: '5', label: '상호금융' },
  { value: '6', label: '보험' },
])

// N-05-3 대출 금리 방식 선택지. TODO(D-20) 백엔드 코드값이 정해지면 value를 맞춘다.
export const LOAN_RATE_TYPE_OPTIONS = Object.freeze([
  { value: 'FIXED', label: '고정' },
  { value: 'VARIABLE', label: '변동' },
])

// 할부·정기결제 종류 선택지. TODO(D-20) 백엔드 코드값이 정해지면 value를 맞춘다.
export const OTHER_EXPENSE_CATEGORY_OPTIONS = Object.freeze([
  { value: 'INSURANCE', label: '보험료' },
  { value: 'EDUCATION', label: '교육비' },
  { value: 'MEDICAL', label: '의료비' },
  { value: 'SUBSCRIPTION', label: '구독·멤버십' },
  { value: 'FAMILY_EVENT', label: '경조사비' },
  { value: 'ETC', label: '기타' },
])
