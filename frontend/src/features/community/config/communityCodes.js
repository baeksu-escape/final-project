// N-06·N-33·N-34 신용 라운지 코드값 — 서버(CommunityCodes.java)와 같은 코드를 화면 문구로 바꿀 때 쓴다.

// 게시판 한 쪽에 보이는 글 수 (N-06-1, 데모 기준 10개)
export const PAGE_SIZE = 10

// 글 제목·본문·댓글·신고 상세의 최대 글자 수 — 서버 검증(BoardDtos·ReportDtos)과 같다
export const TITLE_MAX = 200
export const CONTENT_MAX = 1300
export const COMMENT_MAX = 1000
export const DETAIL_MAX = 500

// N-06 글 카테고리 7개(FP-261, 서버 CommunityCodes·DDL CK_BPT_CATEGORY와 같다). 글쓰기 기본값은 자유다.
export const POST_CATEGORIES = Object.freeze([
  { value: 'CREDIT_SCORE', label: '신용점수' },
  { value: 'LOAN', label: '대출·상환' },
  { value: 'CARD', label: '카드·결제' },
  { value: 'EMPLOYEE', label: '직장인' },
  { value: 'SELF_EMPLOYED', label: '자영업' },
  { value: 'FREELANCER', label: '프리랜서' },
  { value: 'FREE', label: '자유' },
])
export const DEFAULT_CATEGORY = 'FREE'

// N-33-1 신고 사유 5개 (이 순서로 보여 준다). 상세 내용은 OTHER일 때만 받는다.
export const REPORT_REASONS = Object.freeze([
  { value: 'ABUSE', label: '욕설·비방' },
  { value: 'SPAM', label: '광고·스팸' },
  { value: 'PRIVACY_EXPOSURE', label: '개인정보 노출' },
  { value: 'FALSE_INFO', label: '허위 정보' },
  { value: 'OTHER', label: '기타' },
])
export const REASON_OTHER = 'OTHER'

// N-34-1 신고 처리 상태 4개
export const REPORT_STATUSES = Object.freeze([
  { value: 'RECEIVED', label: '접수' },
  { value: 'IN_REVIEW', label: '검토 중' },
  { value: 'DONE', label: '처리 완료' },
  { value: 'REJECTED', label: '반려' },
])

// N-34-1 상태 필터 선택지(FP-277) — '검토 중'은 저장하는 곳이 없어 늘 0건이라 필터에서만 뺀다. 목록의 상태 이름은 위 4개를 쓴다.
export const REPORT_STATUS_FILTERS = Object.freeze(REPORT_STATUSES.filter((item) => item.value !== 'IN_REVIEW'))

// N-34-3 관리자 처리 결과 3개 — 처리 기록·저장 알림의 이름 표시용. 예전에 '숨김 유지'로 처리한 기록도 이름이 보여야 해서 3개를 그대로 둔다.
export const REPORT_RESULTS = Object.freeze([
  { value: 'KEEP_HIDDEN', label: '숨김 유지', hint: '일반 사용자에게 계속 숨김' },
  { value: 'DELETE', label: '삭제', hint: '글·댓글을 삭제' },
  { value: 'REJECT', label: '반려', hint: '숨김을 풀고 원래대로' },
])

// N-34-3 관리자가 고를 수 있는 처리 결과(FP-224) — '숨김 유지'는 화면에서 빼고 서버도 400으로 막는다. DB의 이전 처리 기록은 그대로 둔다.
// 기본 선택은 되돌릴 수 있는 [반려]다.
export const REPORT_RESULT_CHOICES = Object.freeze(REPORT_RESULTS.filter((item) => item.value !== 'KEEP_HIDDEN'))
export const DEFAULT_REPORT_RESULT = 'REJECT'

// N-34-1 기간 필터 — days가 null이면 기간 제한 없음
export const REPORT_PERIODS = Object.freeze([
  { value: '7', label: '최근 7일', days: 7 },
  { value: '30', label: '최근 30일', days: 30 },
  { value: 'all', label: '전체', days: null },
])

// N-34 자동 숨김 기준 설정 키(ADM-14)와 바꿀 수 있는 범위
export const AUTO_HIDE_KEY = 'REPORT_AUTO_HIDE_COUNT'

// 코드 → 화면 문구. 모르는 코드는 그대로 보여 준다.
export function labelOf(list, code) {
  return list.find((item) => item.value === code)?.label ?? code
}

// 서버의 LocalDateTime 문자열(2026-11-15T10:00:00)을 화면용 '2026-11-15 10:00'으로 바꾼다
export function formatDateTime(value) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : ''
}

// 목록용 날짜 '2026.11.15'
export function formatDate(value) {
  return value ? String(value).slice(0, 10).replace(/-/g, '.') : ''
}
