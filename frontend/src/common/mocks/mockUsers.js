import { JOB_TYPES } from '../config/jobTypes.js'
import { ROLES } from '../config/roles.js'

// 개발용 합성 계정. 실제 개인정보가 아니다. 비밀번호는 비교하지 않으므로 아무 값이나 넣으면 된다.
// mock 토큰은 'mock-token-<userId>' 형식이다.
export const MOCK_USERS = Object.freeze([
  { loginId: 'employee', user: { userId: 'u-employee', name: '데모 급여소득자', role: ROLES.USER, jobType: JOB_TYPES.EMPLOYEE } },
  { loginId: 'self', user: { userId: 'u-self', name: '데모 자영업자', role: ROLES.USER, jobType: JOB_TYPES.SELF_EMPLOYED } },
  { loginId: 'freelancer', user: { userId: 'u-freelancer', name: '데모 프리랜서', role: ROLES.USER, jobType: JOB_TYPES.FREELANCER } },
  { loginId: 'newbie', user: { userId: 'u-newbie', name: '데모 직군 미선택', role: ROLES.USER, jobType: null } },
  { loginId: 'admin', user: { userId: 'u-admin', name: '데모 관리자', role: ROLES.ADMIN, jobType: null } },
])

export function toMockToken(userId) {
  return `mock-token-${userId}`
}
