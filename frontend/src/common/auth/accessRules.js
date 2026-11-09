import { DATA_INPUT_PATHS } from '../../features/dataInput/dataInputPaths.js'
import { PATHS } from '../config/navigation.js'
import { ROLES } from '../config/roles.js'

// N-08 접근 규칙 — 들어갈 수 없으면 보낼 경로를, 들어갈 수 있으면 null을 돌려준다. 라우트 가드가 이 함수만 쓴다.
//   requiredRole: 이 역할만 들어갈 수 있다(다른 역할이면 안내 화면으로).
//   requireJobType: 직군을 아직 고르지 않은 일반 사용자를 직군 선택 화면으로 보낸다.
export function getAccessRedirect(user, { requiredRole, requireJobType = false } = {}) {
  if (!user) return PATHS.LOGIN
  if (requiredRole && user.role !== requiredRole) return PATHS.FORBIDDEN
  if (requireJobType && user.role === ROLES.USER && !user.jobType) return PATHS.SELECT_JOB
  return null
}

// N-01-2 로그인 직후나 '/'에 들어왔을 때 갈 첫 화면 — 관리자는 모형 성능 비교, 직군이 없으면 직군 선택, 점수가 없으면 데이터 입력, 그 외는 신용 리포트.
// hasScore는 서버가 주는 사용자 정보다. 서버가 아직 보내지 않으면(undefined) 신용 리포트로 보낸다.
export function getHomePath(user) {
  if (!user) return PATHS.LOGIN
  if (user.role === ROLES.ADMIN) return PATHS.ADMIN_MODEL
  if (!user.jobType) return PATHS.SELECT_JOB
  if (user.hasScore === false) return DATA_INPUT_PATHS.DATA_INPUT
  return PATHS.REPORT
}
