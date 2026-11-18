import { apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/authMockHandlers.js'

// N-01~N-03 인증 화면 API 경로. 로그인·내 정보는 공통 common/api/authApi.js를 쓴다.
// TODO(D-20) api_spec.md가 정해지면 경로와 요청·응답 필드를 맞춘다.
export const AUTH_FEATURE_API = Object.freeze({
  SIGNUP: '/api/auth/signup',
  EMAIL_SEND: '/api/auth/email/send',
  EMAIL_VERIFY: '/api/auth/email/verify',
  FIND_ID: '/api/auth/find-id',
  PASSWORD_RESET: '/api/auth/password/reset',
  NICKNAME_CHECK: '/api/auth/nickname/check',
  PHONE_SEND: '/api/auth/phone/send',
  PHONE_VERIFY: '/api/auth/phone/verify',
})

// N-02 회원가입 — { loginId, name, nickname, phone, email, password, birthYear, ageGroup, agreeCreditInfo, emailVerificationToken, phoneVerificationToken } → { userId }
//   name: 완성형 한글 2~20자(validation.js validateName).
//   nickname: 닉네임(앞뒤 공백을 뺀 2~12자, '탈퇴'로 시작할 수 없음). 신용 라운지에 작성자로 보인다.
//   phone: 숫자만 남긴 휴대폰(010XXXXXXXX). phoneVerificationToken: 휴대폰 인증 확인에서 받은 토큰(필수).
//   birthYear: 생일(달력)의 연도(숫자). 월·일은 보내지 않는다. ageGroup은 birthYear로 계산해 함께 보낸다(authConstants.js toAgeGroup). TODO(D-20) 백엔드 확정 시 ageGroup 제거.
//   400: 칸별 오류는 data.fieldErrors [{ field, message }]로 온다(예: field 'birthYear', 'nickname', 'phone').
//   409: 이미 있는 닉네임이면 data.code 'DUPLICATE_NICKNAME'.
export function requestSignup(payload) {
  return apiPost(AUTH_FEATURE_API.SIGNUP, payload)
}

// N-02-1 닉네임 중복 확인 — { nickname } → { available }
//   닉네임을 주소에 남기지 않으려고 POST로 보낸다. 형식이 틀리면 400(data.fieldErrors의 field 'nickname').
//   가입할 때 서버가 다시 중복을 막으므로(409 DUPLICATE_NICKNAME), 이 결과는 안내용이다.
export function checkNicknameAvailability(nickname) {
  return apiPost(AUTH_FEATURE_API.NICKNAME_CHECK, { nickname })
}

// N-02 휴대폰 인증번호 발송 — { phone, purpose } → { expiresInSeconds }   (purpose: PHONE_PURPOSES.SIGNUP)
//   실제 문자는 보내지 않는다. 개발 서버는 로그에 코드를 남기고(LOG 모드), mock은 고정 코드(MOCK_PHONE_CODE)를 쓴다.
export function requestPhoneCode({ phone, purpose }) {
  return apiPost(AUTH_FEATURE_API.PHONE_SEND, { phone, purpose })
}

// N-02 휴대폰 인증번호 확인 — { phone, code, purpose } → { verificationToken }
export function verifyPhoneCode({ phone, code, purpose }) {
  return apiPost(AUTH_FEATURE_API.PHONE_VERIFY, { phone, code, purpose })
}

// 이메일 인증코드 발송 — { email, purpose, loginId? } → { expiresInSeconds }
export function requestEmailCode(payload) {
  return apiPost(AUTH_FEATURE_API.EMAIL_SEND, payload)
}

// 이메일 인증코드 확인 — { email, code, purpose, loginId? } → { verificationToken }
export function verifyEmailCode(payload) {
  return apiPost(AUTH_FEATURE_API.EMAIL_VERIFY, payload)
}

// N-03 아이디 찾기 — { name, phone } → { maskedLoginId }
export function requestFindId(payload) {
  return apiPost(AUTH_FEATURE_API.FIND_ID, payload)
}

// N-03 비밀번호 재설정 — { loginId, email, emailVerificationToken, newPassword } → {}
export function requestPasswordReset(payload) {
  return apiPost(AUTH_FEATURE_API.PASSWORD_RESET, payload)
}
