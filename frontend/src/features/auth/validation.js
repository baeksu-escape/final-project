// N-02 비밀번호 규칙 — 입력하는 동안 PasswordRuleList가 이 목록으로 충족 여부를 보여 준다.
export const PASSWORD_RULES = Object.freeze([
  { key: 'length', label: '8자 이상', test: (value) => value.length >= 8 },
  { key: 'letter', label: '영문 포함', test: (value) => /[A-Za-z]/.test(value) },
  { key: 'number', label: '숫자 포함', test: (value) => /\d/.test(value) },
  { key: 'symbol', label: '기호 포함', test: (value) => /[^A-Za-z0-9\s]/.test(value) },
])

// 비밀번호가 모든 규칙을 지키는지 돌려준다.
export function isValidPassword(value) {
  return PASSWORD_RULES.every((rule) => rule.test(value ?? ''))
}

// 이메일 형식(아이디@도메인.최상위) 검사.
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value ?? '')
}

// 휴대폰 번호에서 숫자만 남긴다. 하이픈을 넣거나 빼고 입력해도 같은 값이 된다.
export function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '')
}

// 휴대폰 형식(010·011·016~019로 시작하는 10~11자리) 검사.
export function isValidPhone(value) {
  return /^01[016-9]\d{7,8}$/.test(normalizePhone(value))
}

// 아이디 형식 검사. TODO 팀 확정 전 임시 규칙: 영문 소문자로 시작하는 4~20자 영문 소문자·숫자.
export function isValidLoginId(value) {
  return /^[a-z][a-z0-9]{3,19}$/.test(value ?? '')
}
// 화면 안내·오류 문구에 쓰는 아이디 규칙 설명.
export const LOGIN_ID_RULE_TEXT ='영문 소문자로 시작하는 4~20자 영문 소문자·숫자'

// 새 비밀번호와 확인 값을 검사해 { password?, passwordConfirm? } 오류 객체를 돌려준다(재설정 화면과 가입 화면이 함께 쓴다).
export function validateNewPassword(password, passwordConfirm) {
  const errors = {}
  if (!password) errors.password = '비밀번호를 입력해 주세요.'
  else if (!isValidPassword(password)) errors.password = '비밀번호 규칙을 모두 지켜 주세요.'
  if (!passwordConfirm) errors.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요.'
  else if (password !== passwordConfirm) errors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
  return errors
}

// N-02 가입 입력값 전체를 검사해 항목별 오류 객체를 돌려준다. 오류가 없으면 빈 객체.
export function validateSignup(form, { emailVerified }) {
  const errors = {}
  if (!form.loginId) errors.loginId = '아이디를 입력해 주세요.'
  else if (!isValidLoginId(form.loginId)) errors.loginId = `아이디는 ${LOGIN_ID_RULE_TEXT}로 입력해 주세요.`

  if (!form.name.trim()) errors.name = '이름을 입력해 주세요.'

  if (!form.phone) errors.phone = '휴대폰 번호를 입력해 주세요.'
  else if (!isValidPhone(form.phone)) errors.phone = '휴대폰 번호 형식이 올바르지 않습니다. 예) 010-1234-5678'

  if (!form.email) errors.email = '이메일을 입력해 주세요.'
  else if (!isValidEmail(form.email)) errors.email = '이메일 형식이 올바르지 않습니다. 예) name@example.com'
  else if (!emailVerified) errors.email = '이메일 인증을 완료해 주세요.'

  Object.assign(errors, validateNewPassword(form.password, form.passwordConfirm))

  if (!form.ageGroup) errors.ageGroup = '연령대를 선택해 주세요.'
  if (!form.agreeCreditInfo) errors.agreeCreditInfo = '필수 동의 항목입니다.'
  return errors
}
