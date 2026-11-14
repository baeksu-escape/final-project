// N-05-3 대출 종류 선택지 — DDL DIM_LOAN_TYPE 6개(USER_LOAN.LOAN_TYPE_CODE). 대부업은 종류에 없고 '카드·신용 이용'의 대부업 대출 잔액 칸으로 받는다.
export const LOAN_TYPE_OPTIONS = Object.freeze([
  { value: 'CREDIT', label: '신용대출' },
  { value: 'BUSINESS_OPERATING', label: '사업자 운전자금' },
  { value: 'JEONSE', label: '전세자금대출' },
  { value: 'MORTGAGE', label: '주택담보대출' },
  { value: 'CARD_LOAN', label: '카드론' },
  { value: 'OTHER', label: '기타' },
])

// 대출 업권 선택지 — 옛 더미 DB MEMBER_LOAN.SECTOR_CODE(0~6) 값. FP-86 작업 5부터 화면은 LOAN_TYPE_OPTIONS를 쓰고 이 목록은 더 이상 쓰지 않는다.
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
  // FP-86 작업 5: DDL USER_EXPENSE_ITEM.EXPENSE_GROUP_CODE의 INSTALLMENT(할부)로 저장한다.
  { value: 'INSTALLMENT', label: '할부' },
  { value: 'FAMILY_EVENT', label: '경조사비' },
  { value: 'ETC', label: '기타' },
])
