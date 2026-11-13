// N-02 가입 시 받는 연령대. TODO(D-20) 백엔드 코드값이 정해지면 value를 맞춘다.
export const AGE_GROUP_OPTIONS = Object.freeze([
  { value: 'AGE_20S', label: '20대' },
  { value: 'AGE_30S', label: '30대' },
  { value: 'AGE_40S', label: '40대' },
  { value: 'AGE_50S', label: '50대' },
  { value: 'AGE_60_PLUS', label: '60대 이상' },
])

// N-02 출생연도로 연령대 값(AGE_GROUP_OPTIONS의 value)을 계산한다. 나이 = 올해 − 출생연도(생일은 따지지 않는다).
// 가입 요청의 ageGroup을 지우지 않고 함께 보내려고 둔다. TODO(D-20) 백엔드 가입 API가 확정되면 ageGroup과 이 함수를 제거한다.
// 숫자가 아닌 값이면 null을 돌려준다(가입 화면은 출생연도 검사를 통과한 값만 넘긴다).
export function toAgeGroup(birthYear, thisYear = new Date().getFullYear()) {
  const decade = Math.floor((thisYear - Number(birthYear)) / 10)
  if (!Number.isFinite(decade)) return null
  const index = Math.min(Math.max(decade - 2, 0), AGE_GROUP_OPTIONS.length - 1)
  return AGE_GROUP_OPTIONS[index].value
}

// 이메일 인증을 어디에 쓰는지 서버에 알려 주는 값. CHANGE_EMAIL은 마이페이지(FP-93)에서 쓴다.
export const EMAIL_PURPOSES = Object.freeze({
  SIGNUP: 'SIGNUP',
  RESET_PASSWORD: 'RESET_PASSWORD',
  CHANGE_EMAIL: 'CHANGE_EMAIL',
})

// 서버가 오류 종류를 알려 줄 때 쓰는 코드(error.data.code).
export const AUTH_ERROR_CODES = Object.freeze({
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  DUPLICATE_LOGIN_ID: 'DUPLICATE_LOGIN_ID',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_NICKNAME: 'DUPLICATE_NICKNAME',
})

// N-01 로그인 실패 문구. 아이디와 비밀번호 중 무엇이 틀렸는지 알려 주지 않는다.
export const LOGIN_FAILED_MESSAGE = '아이디 또는 비밀번호가 올바르지 않습니다.'
export const ACCOUNT_LOCKED_MESSAGE = '잠긴 계정입니다. 관리자에게 문의해 주세요.'

// N-02 필수 동의 문구.
export const CREDIT_INFO_AGREEMENT_LABEL = '(필수) 개인신용정보 수집·이용에 동의합니다.'
