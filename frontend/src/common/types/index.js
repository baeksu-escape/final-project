// 공통 데이터 모양(JSDoc). 프로젝트가 JavaScript로 확정이라 TypeScript 대신 주석으로 타입을 적는다.
// 다른 파일에서는 /** @typedef {import('../types/index.js').User} User */ 처럼 불러 쓴다.

/**
 * 계정 역할.
 * @typedef {'ROLE_USER' | 'ROLE_ADMIN'} Role
 */

/**
 * 직군 코드. 아직 고르지 않았으면 null.
 * @typedef {'EMPLOYEE' | 'SELF_EMPLOYED' | 'FREELANCER'} JobType
 */

/**
 * 로그인한 사용자. TODO(D-20) 백엔드 응답 형식이 정해지면 맞춘다.
 * @typedef {object} User
 * @property {string} userId
 * @property {string} name
 * @property {Role} role
 * @property {JobType | null} jobType
 */

/**
 * POST /api/auth/login 응답. TODO(D-20)
 * @typedef {object} LoginResponse
 * @property {string} accessToken
 * @property {User} user
 */

/**
 * 로그인 상태.
 * @typedef {'loading' | 'authenticated' | 'anonymous'} AuthStatus
 */

/**
 * 선택 상자 항목.
 * @typedef {object} SelectOption
 * @property {string} value
 * @property {string} label
 */

export {}
