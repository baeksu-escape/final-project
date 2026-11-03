import { PATHS } from '../../common/config/navigation.js'

// N-01~N-03 로그인 전 화면 경로. 로그인 경로는 공통 PATHS.LOGIN을 그대로 쓴다.
export const AUTH_PATHS = Object.freeze({
  LOGIN: PATHS.LOGIN,
  SIGNUP: '/signup',
  FIND_ID: '/find-id',
  FIND_PASSWORD: '/find-password',
})
