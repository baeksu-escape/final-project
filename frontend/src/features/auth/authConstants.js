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
  // FP-258 아이디 찾기(이메일 인증). 가입 여부와 상관없이 코드를 보낸다.
  FIND_ID: 'FIND_ID',
})

// 휴대폰 인증을 어디에 쓰는지 서버에 알려 주는 값. 회원가입(11/18 1차 시연 후속)과 아이디 찾기(FP-258)가 쓴다.
export const PHONE_PURPOSES = Object.freeze({
  SIGNUP: 'SIGNUP',
  FIND_ID: 'FIND_ID',
})

// 서버가 오류 종류를 알려 줄 때 쓰는 코드(error.data.code).
export const AUTH_ERROR_CODES = Object.freeze({
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  DUPLICATE_LOGIN_ID: 'DUPLICATE_LOGIN_ID',
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  DUPLICATE_NICKNAME: 'DUPLICATE_NICKNAME',
  // 실제 서버: 관리자 2단계 인증(AUTH-11) 준비 전에는 관리자 로그인을 409로 막는다(FP-87 작업 2, 작업 7에서 연다).
  ADMIN_2FA_NOT_READY: 'ADMIN_2FA_NOT_READY',
  // FP-222 MEM-04 새 비밀번호가 지금 비밀번호와 같음(400).
  SAME_PASSWORD: 'SAME_PASSWORD',
  // FP-222 MEM-08 새 닉네임이 지금 닉네임과 같음(400).
  SAME_NICKNAME: 'SAME_NICKNAME',
  // FP-258 로그인 5회 실패 뒤 5분 제한(429).
  LOGIN_TEMPORARILY_BLOCKED: 'LOGIN_TEMPORARILY_BLOCKED',
})

// FP-222 N-04-3 새 닉네임이 지금 닉네임과 같을 때 문구. 서버 MyPageService.SAME_NICKNAME_MESSAGE와 같다.
export const SAME_NICKNAME_MESSAGE = '지금 쓰는 닉네임과 같습니다.'

// FP-222 N-04-3 새 비밀번호가 지금 비밀번호와 같을 때 문구. 서버 MyPageService.SAME_PASSWORD_MESSAGE와 같다.
export const SAME_PASSWORD_MESSAGE = '지금 쓰는 비밀번호와 같습니다. 다른 비밀번호를 입력해 주세요.'

// N-01 로그인 실패 문구. 아이디와 비밀번호 중 무엇이 틀렸는지 알려 주지 않는다. 탈퇴한 옛 아이디로 로그인할 때도 이 문구를 쓴다(FP-93 작업 지시서 문구).
export const LOGIN_FAILED_MESSAGE = '아이디 또는 비밀번호가 맞지 않습니다.'
// FP-258 잠금은 비밀번호 찾기(재설정)로 풀린다. 서버 AuthErrors.ACCOUNT_LOCKED_MESSAGE와 같다.
export const ACCOUNT_LOCKED_MESSAGE = '잠긴 계정입니다. 비밀번호 찾기에서 이메일 인증 후 비밀번호를 재설정하면 풀립니다.'

// FP-258 로그인 단계적 제한 — 5회 실패하면 5분 동안 막고(429), 누적 10회면 잠근다(423). 서버 AuthService 상수와 같다(mock이 쓴다).
export const LOGIN_TEMP_BLOCK_FAILURES = 5
export const LOGIN_TEMP_BLOCK_MINUTES = 5
export const LOGIN_MAX_FAILURES = 10

// FP-258 5분 제한 문구. 서버 AuthErrors.loginTemporarilyBlocked와 같다.
export function loginTemporarilyBlockedMessage(minutes) {
  return `로그인 시도가 너무 많습니다. ${minutes}분 뒤에 다시 시도해 주세요.`
}

// FP-258 N-03-1 아이디 찾기 방법. 서버 AuthService.FIND_ID_PHONE·FIND_ID_EMAIL과 같다.
export const FIND_ID_METHODS = Object.freeze({
  PHONE: 'PHONE',
  EMAIL: 'EMAIL',
})

// N-02 필수 동의 문구.
export const CREDIT_INFO_AGREEMENT_LABEL = '(필수) 개인신용정보 수집·이용에 동의합니다.'
