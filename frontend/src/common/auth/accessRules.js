import { PATHS } from '../config/navigation.js'
import { ROLES } from '../config/roles.js'

// N-08-1 접근 규칙 — 들어갈 수 없으면 보낼 경로를, 들어갈 수 있으면 null을 돌려준다. 라우트 가드가 이 함수만 쓴다(11/06 확정 UI 기준).
//   requiredRole: 이 역할만 들어갈 수 있다. 다른 역할이면 그 계정의 첫 화면으로 보낸다(관리자 → 모형 성능 비교, 사용자 → 신용 리포트).
//   requireJobType: 직군을 아직 고르지 않은 일반 사용자를 직군 선택 화면으로 보낸다.
//   requireScore: 점수를 아직 산출하지 않은 일반 사용자(hasScore가 false)를 데이터 입력으로 보낸다.
export function getAccessRedirect(user, { requiredRole, requireJobType = false, requireScore = false } = {}) {
  if (!user) return PATHS.LOGIN
  if (requiredRole && user.role !== requiredRole) return getHomePath(user)
  if (requireJobType && user.role === ROLES.USER && !user.jobType) return PATHS.SELECT_JOB
  if (requireScore && user.role === ROLES.USER && user.hasScore === false) return PATHS.DATA_INPUT
  return null
}

// N-08-1 주 메뉴 노출 — 관리자 메뉴는 늘 보이고, 사용자 주 메뉴는 직군을 고르고 점수가 나온 뒤에만 보인다.
// 직군 선택·데이터 입력 중에는 메뉴 없이 헤더 버튼(알림·마이 페이지·로그아웃)만 보인다.
export function canSeeMainMenu(user) {
  if (!user) return false
  if (user.role === ROLES.ADMIN) return true
  return Boolean(user.jobType) && user.hasScore !== false
}

// N-01-2 로그인 직후나 '/'에 들어왔을 때 갈 첫 화면 — 관리자는 모형 성능 비교, 직군이 없으면 직군 선택, 점수가 없으면 데이터 입력, 그 외는 신용 리포트.
// hasScore는 서버가 주는 사용자 정보다. 서버가 아직 보내지 않으면(undefined) 신용 리포트로 보낸다.
export function getHomePath(user) {
  if (!user) return PATHS.LOGIN
  if (user.role === ROLES.ADMIN) return PATHS.ADMIN_MODEL
  if (!user.jobType) return PATHS.SELECT_JOB
  if (user.hasScore === false) return PATHS.DATA_INPUT
  return PATHS.REPORT
}
