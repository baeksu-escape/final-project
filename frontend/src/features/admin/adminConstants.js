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
})

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
