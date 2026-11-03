// 계정 역할 2가지 (decisions.md 확정: ROLE_USER, ROLE_ADMIN).
export const ROLES = Object.freeze({
  USER: 'ROLE_USER',
  ADMIN: 'ROLE_ADMIN',
})

export const ROLE_LABELS = Object.freeze({
  [ROLES.USER]: '일반 사용자',
  [ROLES.ADMIN]: '관리자',
})

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN
}
