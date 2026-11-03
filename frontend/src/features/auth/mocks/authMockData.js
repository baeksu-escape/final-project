import { JOB_TYPES } from '../../../common/config/jobTypes.js'
import { ROLES } from '../../../common/config/roles.js'

// 개발용 고정 인증코드. 실제 메일은 보내지 않는다.
export const MOCK_EMAIL_CODE = '123456'

// 인증코드 유효 시간(초).
export const MOCK_EMAIL_CODE_TTL_SECONDS = 300

// 공통 데모 계정(common/mocks/mockUsers.js)에 붙일 합성 연락처. 아이디·비밀번호 찾기 확인용이며 실제 정보가 아니다.
export const DEMO_ACCOUNT_CONTACTS = Object.freeze({
  employee: { email: 'employee@example.com', phone: '01000000001' },
  self: { email: 'self@example.com', phone: '01000000002' },
  freelancer: { email: 'freelancer@example.com', phone: '01000000003' },
  newbie: { email: 'newbie@example.com', phone: '01000000004' },
  admin: { email: 'admin@example.com', phone: '01000000005' },
})

// N-01 잠긴 계정 안내 확인용 데모 계정(아이디 locked, 비밀번호는 아무 값).
export const LOCKED_DEMO_ACCOUNT = Object.freeze({
  loginId: 'locked',
  email: 'locked@example.com',
  phone: '01000000009',
  locked: true,
  user: { userId: 'u-locked', name: '데모 잠긴 계정', role: ROLES.USER, jobType: JOB_TYPES.EMPLOYEE },
})
