// N-02 가입 시 받는 연령대. TODO(D-20) 백엔드 코드값이 정해지면 value를 맞춘다.
export const AGE_GROUP_OPTIONS = Object.freeze([
  { value: 'AGE_20S', label: '20대' },
  { value: 'AGE_30S', label: '30대' },
  { value: 'AGE_40S', label: '40대' },
  { value: 'AGE_50S', label: '50대' },
  { value: 'AGE_60_PLUS', label: '60대 이상' },
])

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
})

// N-01 로그인 실패 문구. 아이디와 비밀번호 중 무엇이 틀렸는지 알려 주지 않는다. 탈퇴한 옛 아이디로 로그인할 때도 이 문구를 쓴다(FP-93 작업 지시서 문구).
export const LOGIN_FAILED_MESSAGE = '아이디 또는 비밀번호가 맞지 않습니다.'
export const ACCOUNT_LOCKED_MESSAGE = '잠긴 계정입니다. 관리자에게 문의해 주세요.'

// N-02 필수 동의 문구.
export const CREDIT_INFO_AGREEMENT_LABEL = '(필수) 개인신용정보 수집·이용에 동의합니다.'
