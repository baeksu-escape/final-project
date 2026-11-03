// N-08 화면 경로와 역할별 탭 목록 — 헤더 탭 메뉴와 라우트가 같은 값을 쓴다.
// TODO(D-14) 경로는 임시안이다. 바꿀 때는 이 파일만 고치면 된다.
export const PATHS = Object.freeze({
  HOME: '/',
  LOGIN: '/login',
  SELECT_JOB: '/select-job',
  FORBIDDEN: '/forbidden',

  REPORT: '/report',
  DIAGNOSIS: '/diagnosis',
  SIMULATOR: '/simulator',
  MY_PAGE: '/mypage',

  ADMIN_MODEL: '/admin/model',
  ADMIN_STATS: '/admin/stats',
  ADMIN_ACCOUNTS: '/admin/accounts',
})

// 일반 사용자 탭 (N-08 출력 순서).
export const USER_TABS = Object.freeze([
  { key: 'report', label: '신용 리포트', path: PATHS.REPORT, nId: 'N-12' },
  { key: 'diagnosis', label: '직군별 재무 진단', path: PATHS.DIAGNOSIS, nId: 'N-16·N-21·N-22·N-24' },
  { key: 'simulator', label: '점수·금리 시뮬레이터', path: PATHS.SIMULATOR, nId: 'N-18' },
  { key: 'mypage', label: '마이 페이지', path: PATHS.MY_PAGE, nId: 'N-04' },
])

// 관리자 탭 (N-08 출력 순서).
export const ADMIN_TABS = Object.freeze([
  { key: 'model', label: '모형 성능 비교', path: PATHS.ADMIN_MODEL, nId: 'N-25' },
  { key: 'stats', label: '직군·연령별 통계', path: PATHS.ADMIN_STATS, nId: 'N-26' },
  { key: 'accounts', label: '계정·권한 관리', path: PATHS.ADMIN_ACCOUNTS, nId: 'N-27' },
])
