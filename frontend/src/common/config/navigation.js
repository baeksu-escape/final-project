// N-08-1 화면 경로와 계정 유형별 메뉴 — 헤더 메뉴와 라우트가 같은 값을 쓴다. 메뉴 이름·순서·경로는 이 파일만 고치면 된다.
// TODO(D-14) 경로는 임시안이다.
export const PATHS = Object.freeze({
  HOME: '/',
  LOGIN: '/login',
  SELECT_JOB: '/select-job',
  FORBIDDEN: '/forbidden',
  DATA_INPUT: '/data-input',

  REPORT: '/report',
  ASSET_DEBT: '/asset-debt',
  SCENARIO: '/scenario',
  CASH_FLOW: '/cash-flow',
  MARKET: '/market',
  SIMULATOR: '/simulator',
  LOANS: '/loans',
  COMPARISON: '/comparison',
  LOUNGE: '/lounge',
  MY_PAGE: '/mypage',
  // v3 삭제(N-08-3, 11/06) — 직군별 재무 진단 묶음. 라우트에 연결하지 않으며, 이 경로는 없는 페이지로 간다.
  DIAGNOSIS: '/diagnosis',

  ADMIN_MODEL: '/admin/model',
  ADMIN_STATS: '/admin/stats',
  ADMIN_ACCOUNTS: '/admin/accounts',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_AUDIT: '/admin/audit-logs',
})

// N-08-1 사용자 주 메뉴 9개(이 순서). 직군과 상관없이 모두 같다. 마이 페이지는 헤더 버튼이다.
export const USER_TABS = Object.freeze([
  { key: 'report', label: '신용 리포트', path: PATHS.REPORT, nId: 'N-12' },
  { key: 'asset-debt', label: '자산·부채 건전성', path: PATHS.ASSET_DEBT, nId: 'N-16' },
  { key: 'scenario', label: '시나리오 테스트', path: PATHS.SCENARIO, nId: 'N-17' },
  { key: 'cash-flow', label: '현금흐름·소득 변동성', path: PATHS.CASH_FLOW, nId: 'N-21·N-22' },
  { key: 'market', label: '상권 분석', path: PATHS.MARKET, nId: 'N-24' },
  { key: 'simulator', label: '신용케어 시뮬레이터', path: PATHS.SIMULATOR, nId: 'N-18' },
  { key: 'loans', label: '대출 상품', path: PATHS.LOANS, nId: 'N-37' },
  { key: 'comparison', label: '비교 분석', path: PATHS.COMPARISON, nId: 'N-13·N-26' },
  { key: 'lounge', label: '신용 라운지', path: PATHS.LOUNGE, nId: 'N-06' },
])

// N-08-1 관리자 탭 5개(이 순서).
export const ADMIN_TABS = Object.freeze([
  { key: 'model', label: '모형 성능 비교', path: PATHS.ADMIN_MODEL, nId: 'N-25' },
  { key: 'stats', label: '직군·연령별 통계', path: PATHS.ADMIN_STATS, nId: 'N-26' },
  { key: 'accounts', label: '계정·권한 관리', path: PATHS.ADMIN_ACCOUNTS, nId: 'N-27' },
  { key: 'reports', label: '신고 접수', path: PATHS.ADMIN_REPORTS, nId: 'N-34' },
  { key: 'audit', label: '접근·감사 로그', path: PATHS.ADMIN_AUDIT, nId: 'N-28·N-35' },
])
