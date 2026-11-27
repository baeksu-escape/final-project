// N-08-1 화면 경로와 계정 유형별 메뉴 — 헤더 메뉴와 라우트가 같은 값을 쓴다. 메뉴 이름·순서·경로는 이 파일만 고치면 된다.
// TODO(D-14) 경로는 임시안이다.
export const PATHS = Object.freeze({
  HOME: '/',
  // UI 리뉴얼: 로그인 후 홈과 큰 분류(허브) 화면
  DASHBOARD: '/home',
  MY_CREDIT: '/my-credit',
  FINANCE: '/finance',
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
  LOAN_DETAIL: '/loans/:productCode',
  COMPARISON: '/comparison',
  LOUNGE: '/lounge',
  NOTIFICATIONS: '/notifications',
  MY_PAGE: '/mypage',
  // v3 삭제(N-08-3, 11/06) — 직군별 재무 진단 묶음. 라우트에 연결하지 않으며, 이 경로는 없는 페이지로 간다.
  DIAGNOSIS: '/diagnosis',

  ADMIN_MODEL: '/admin/model',
  ADMIN_STATS: '/admin/stats',
  ADMIN_ACCOUNTS: '/admin/accounts',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_AUDIT: '/admin/audit-logs',
})

// N-08-1 사용자 기능 9개(이 순서). 직군과 상관없이 모두 같다. 마이 페이지는 헤더 버튼이다.
// 화면 위쪽 메뉴는 아래 NAV_GROUPS로 큰 분류 5개에 묶어 보인다(UI 리뉴얼 FP-252).
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

// UI 리뉴얼 — 사용자 메뉴를 큰 분류 5개로 묶는다. 분류 안 항목은 USER_TABS의 key를 가리키고, 설명은 허브·홈 화면 목록에 쓴다.
const TAB_BY_KEY = Object.fromEntries(USER_TABS.map((tab) => [tab.key, tab]))
const item = (key, description) => Object.freeze({ ...TAB_BY_KEY[key], description })

export const NAV_GROUPS = Object.freeze([
  // 로그인 후 첫 화면(요약 대시보드) — 메뉴 이름 '한눈에'(11/23 범영 결정)
  { key: 'home', label: '한눈에', path: PATHS.DASHBOARD, items: [] },
  {
    key: 'credit', label: '내 신용', path: PATHS.MY_CREDIT,
    description: '두 모델로 본 내 점수와, 점수를 올리는 방법',
    items: [
      item('report', '기존·대안 점수와 점수를 움직인 항목'),
      item('simulator', '조건을 바꾸면 점수가 얼마나 오를까'),
      item('comparison', '같은 직군·연령과 나란히 보기'),
    ],
  },
  {
    key: 'finance', label: '재무 진단', path: PATHS.FINANCE,
    description: '빚·현금흐름·위기 상황·상권까지 내 살림 점검',
    items: [
      item('asset-debt', '자산 대비 빚, 상환 부담률 점검'),
      item('cash-flow', '월별 수입·지출과 소득 흔들림'),
      item('scenario', '금리·소득이 바뀌면 어떻게 될까'),
      item('market', '서울 동네별 업종 개폐업 흐름'),
    ],
  },
  { key: 'loans', label: '대출', path: PATHS.LOANS, description: '내 점수로 알아볼 수 있는 대출 상품', items: [item('loans', '조건·금리·한도 비교')] },
  { key: 'lounge', label: '라운지', path: PATHS.LOUNGE, description: '같은 고민을 가진 사람들과 이야기', items: [item('lounge', '익명 게시판')] },
].map((group) => Object.freeze(group)))

// 현재 경로가 속한 분류를 찾는다(허브 경로 또는 항목 경로로 시작하면 그 분류).
export function findNavGroup(pathname) {
  return NAV_GROUPS.find((group) => pathname === group.path || group.items.some((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`)))
}
