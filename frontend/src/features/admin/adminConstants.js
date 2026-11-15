import { ROLES } from '../../common/config/roles.js'

// FP-80 관리자 화면 경로 — 관리자 탭 5개(PATHS.ADMIN_*)는 공통 navigation.js에 있고, 탭에 없는 화면만 여기에 둔다.
export const ADMIN_PATHS = Object.freeze({
  // 관리자 비밀번호 변경 — 헤더의 [비밀번호 변경]으로 들어온다.
  PASSWORD: '/admin/password',
})

// 관리자 API가 돌려주는 오류 코드(error.data.code). 같은 상황의 이름은 작업 7(관리자 백엔드)과 맞춘다.
export const ADMIN_ERROR_CODES = Object.freeze({
  STEP_UP_REQUIRED: 'STEP_UP_REQUIRED', // 401: 재확인 토큰이 없거나 만료됐다(로그아웃되지 않는다).
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED', // 403: 첫 비밀번호를 아직 정하지 않았다 → 로그아웃 후 다시 로그인.
  INVALID_INPUT: 'INVALID_INPUT', // 400: 칸별 오류(fieldErrors)가 함께 온다.
  INVALID_PASSWORD: 'INVALID_PASSWORD', // 400: 현재 비밀번호가 틀림(PUT /api/admin/me/password)
  SAME_PASSWORD: 'SAME_PASSWORD', // 400: 지금 쓰는 비밀번호와 같다(fieldErrors newPassword).
  ACCESS_REASON_REQUIRED: 'ACCESS_REASON_REQUIRED', // 400: 열람 사유 없음(ADM-08)
})

// FP-80 작업 7 백엔드 오류 code → 화면 문구. 화면 상황에 맞춘 안내가 필요한 code만 적고, 없는 code는 서버 message를 그대로 쓴다.
export const ADMIN_ERROR_MESSAGES = Object.freeze({
  ADMIN_CHALLENGE_INVALID: '인증 시간이 지났거나 이미 사용한 요청입니다. [처음으로]를 눌러 다시 로그인해 주세요.',
  INVALID_VERIFICATION_CODE: '인증번호가 올바르지 않습니다. 다시 확인해 주세요.',
  VERIFICATION_CODE_EXPIRED: '인증번호가 만료되었습니다. 새 번호를 받아 주세요.',
  VERIFICATION_ATTEMPTS_EXCEEDED: '인증번호를 5회 틀렸습니다. 새 번호를 받아 주세요.',
  CODE_RESEND_TOO_SOON: '인증번호는 1분에 한 번만 받을 수 있습니다. 잠시 뒤 다시 시도해 주세요.',
  PASSWORD_SETUP_INVALID: '비밀번호 설정 시간이 지났습니다. [처음으로]를 눌러 다시 로그인해 주세요.',
  SAME_PASSWORD: '지금 쓰는 비밀번호와 다른 비밀번호를 입력해 주세요.',
  ACCESS_REASON_REQUIRED: '열람 사유를 입력해야 볼 수 있습니다.',
  CANNOT_CHANGE_SELF: '본인 계정은 바꿀 수 없습니다.',
  ACCOUNT_WITHDRAWN: '탈퇴한 계정은 바꿀 수 없습니다.',
  ADMIN_EMAIL_UNAVAILABLE: '업무 이메일을 확인할 수 없어 인증번호를 보낼 수 없습니다. 다른 관리자에게 문의해 주세요.',
  ACCOUNT_LOCKED: '잠긴 계정입니다. 관리자에게 문의해 주세요.',
  STEP_UP_REQUIRED: '재확인 시간이 지났습니다. 다시 시도해 주세요.',
  PASSWORD_CHANGE_REQUIRED: '비밀번호를 새로 정해야 합니다. 다시 로그인해 주세요.',
})

// 오류를 화면 문구로 바꾼다 — 아는 code면 위 문구, 모르는 code면 서버 message 그대로.
// 사용 예: catch (error) { setError(adminErrorMessage(error)) }
export function adminErrorMessage(error) {
  return ADMIN_ERROR_MESSAGES[error?.data?.code] ?? error?.message
}

// 재확인(step-up)으로 받은 1회용 토큰을 붙이는 요청 헤더 이름.
export const STEP_UP_HEADER = 'X-Step-Up-Token'

// 관리자 로그인 2단계 인증번호를 다시 보내려면 기다려야 하는 시간(초). 서버는 1분 안에 다시 부르면 429를 준다.
export const RESEND_WAIT_SECONDS = 60

// 인증번호 자릿수.
export const CODE_LENGTH = 6

// N-35-1 열람 사유 보기 — 11/06 확정 UI(AUDIT_REASONS)의 5개 + 직접 입력.
export const AUDIT_REASONS = Object.freeze([
  '신고 처리 중 작성자 확인',
  '점수 이의 문의 응대',
  '탈퇴 요청 본인 확인',
  '모형 검증용 표본 점검',
  '로그인 잠금 문의 확인',
])
// 열람 사유 선택 상자에서 '직접 입력'을 뜻하는 값.
export const CUSTOM_REASON = 'CUSTOM'
// 열람 사유·잠금 사유 최대 길이 — DDL ACCESS_AUDIT_LOG.ACCESS_REASON VARCHAR2(300 CHAR).
export const REASON_MAX_LENGTH = 300

// 계정 상태 코드(DDL APP_USER.ACCOUNT_STATUS_CODE) → 화면 이름.
export const ACCOUNT_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', LOCKED: 'LOCKED', WITHDRAWN: 'WITHDRAWN' })
export const ACCOUNT_STATUS_LABELS = Object.freeze({
  [ACCOUNT_STATUS.ACTIVE]: '정상',
  [ACCOUNT_STATUS.LOCKED]: '잠김',
  [ACCOUNT_STATUS.WITHDRAWN]: '탈퇴',
})

// N-27-1 목록 필터. value가 ''이면 조건 없이(전체) 부른다.
export const ROLE_FILTER_OPTIONS = Object.freeze([
  { value: '', label: '전체' },
  { value: ROLES.USER, label: '일반' },
  { value: ROLES.ADMIN, label: '관리자' },
])
export const STATUS_FILTER_OPTIONS = Object.freeze([
  { value: '', label: '전체' },
  ...Object.values(ACCOUNT_STATUS).map((value) => ({ value, label: ACCOUNT_STATUS_LABELS[value] })),
])

// N-28 시스템 로그 구분(DDL SYSTEM_LOG.LOG_TYPE_CODE). value ''은 전체.
export const SYSTEM_LOG_TYPE_OPTIONS = Object.freeze([
  { value: '', label: '전체' },
  { value: 'AUTH', label: 'AUTH' },
  { value: 'INFO', label: 'INFO' },
  { value: 'WARN', label: 'WARN' },
])

// 접근·감사 로그 화면의 탭 2개.
export const LOG_TABS = Object.freeze({ ACCESS: 'access', SYSTEM: 'system' })
export const LOG_TAB_OPTIONS = Object.freeze([
  { value: LOG_TABS.ACCESS, label: '열람 감사 로그' },
  { value: LOG_TABS.SYSTEM, label: '시스템 로그' },
])

// 목록 한 쪽에 보일 줄 수.
export const ADMIN_PAGE_SIZE = 10
// 첫 쪽 번호. Spring Pageable 기본처럼 0부터 센다. TODO 작업 7이 1부터 세면 이 값만 1로 바꾼다.
export const ADMIN_FIRST_PAGE = 0

// N-27-4 새 관리자 아이디 규칙 — 11/06 확정 UI 안내("영문 소문자로 시작, 4~16자", 소문자·숫자·_). TODO 작업 7과 규칙이 다르면 맞춘다.
export const ADMIN_LOGIN_ID_PATTERN = /^[a-z][a-z0-9_]{3,15}$/
export const ADMIN_LOGIN_ID_RULE_TEXT = '영문 소문자로 시작하는 4~16자(영문 소문자·숫자·_)'
