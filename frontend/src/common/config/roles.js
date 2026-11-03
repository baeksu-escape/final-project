// 계정 역할 2가지 (decisions.md 확정: ROLE_USER, ROLE_ADMIN).
export const ROLES = Object.freeze({
  USER: 'ROLE_USER',
  ADMIN: 'ROLE_ADMIN',
})

// 역할 코드 → 화면에 보일 한국어 이름.
export const ROLE_LABELS = Object.freeze({
  [ROLES.USER]: '일반 사용자',
  [ROLES.ADMIN]: '관리자',
})

// 관리자 계정인지 돌려준다. 로그인하지 않았으면(user가 null) false.
export function isAdmin(user) {
  return user?.role === ROLES.ADMIN
}
