// N-02 비밀번호 규칙 — 영문과 숫자를 섞어 8자 이상, 기호는 요구하지 않는다(decisions.md 1-2). 가입·비밀번호 찾기·마이페이지가 함께 쓴다.
// 입력하는 동안 PasswordRuleList가 이 목록으로 충족 여부를 보여 준다.
export const PASSWORD_RULES = Object.freeze([
  { key: 'length', label: '8자 이상', test: (value) => value.length >= 8 },
  { key: 'letter', label: '영문 포함', test: (value) => /[A-Za-z]/.test(value) },
  { key: 'number', label: '숫자 포함', test: (value) => /\d/.test(value) },
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

// N-02-1 가입 출생연도 검사 규칙.
// 팀 결정(A안) — 출생연도만 받으므로 생일 경과는 따지지 않고 '올해 20세가 되는 해까지'로 판단한다
// 하한 1930은 DDL v0.3.2 APP_USER.BIRTH_YEAR CHECK(1930~2006)와 같다.
// TODO DDL CHECK의 상한은 2006으로 고정돼 있어, 2027년부터는 화면 상한(올해 − 20)과 달라진다. DB 담당과 CHECK 상한을 맞춰야 한다.
export const BIRTH_YEAR_MIN = 1930
export const MIN_SIGNUP_AGE = 20

// 가입할 수 있는 가장 늦은 출생연도(올해 − 20). 연도를 코드에 박지 않고 실행 시점의 올해로 계산한다.
export function getMaxBirthYear() {
  return new Date().getFullYear() - MIN_SIGNUP_AGE
}

// 출생연도를 검사해 오류 문구를 돌려준다. 문제가 없으면 ''. 가입 화면과 가입 mock이 같은 규칙을 쓴다.
// 4자리 정수이고 1930 ≤ 출생연도 ≤ (올해 − 20)이어야 한다.
export function validateBirthYear(value) {
  const text = String(value ?? '').trim()
  if (!text) return '출생연도를 넣어 주세요.'
  const maxYear = getMaxBirthYear()
  const year = Number(text)
  if (!/^\d{4}$/.test(text) || year < BIRTH_YEAR_MIN || year > maxYear) {
    return `올해 기준 ${MIN_SIGNUP_AGE}세 이상(${maxYear}년생까지)만 가입할 수 있습니다. 출생연도를 확인해 주세요.`
  }
  return ''
}

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

  const birthYearError = validateBirthYear(form.birthYear)
  if (birthYearError) errors.birthYear = birthYearError
  if (!form.agreeCreditInfo) errors.agreeCreditInfo = '필수 동의 항목입니다.'
  return errors
}
