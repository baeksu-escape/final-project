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

// N-02-1 가입 닉네임 검사 규칙 — DDL v0.3.2 APP_USER.NICKNAME VARCHAR2(12 CHAR) NOT NULL, CK_APU_NICKNAME_LEN(2~12자), UK_APU_NICKNAME(중복 불가).
// '탈퇴'로 시작하는 닉네임은 탈퇴 회원 표시값으로 예약돼 일반 회원이 쓸 수 없다(CK_APU_PII_BY_STATUS). 중복 여부는 서버(mock)가 본다.
export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 12
export const WITHDRAWN_NICKNAME_PREFIX = '탈퇴'

// 닉네임을 앞뒤 공백을 뺀 값으로 검사해 오류 문구를 돌려준다. 문제가 없으면 ''. 가입 화면과 가입 mock이 같은 규칙을 쓴다.
export function validateNickname(value) {
  const text = String(value ?? '').trim()
  if (!text) return '닉네임을 넣어 주세요.'
  if (text.length < NICKNAME_MIN || text.length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MIN}~${NICKNAME_MAX}자로 넣어 주세요.`
  if (text.startsWith(WITHDRAWN_NICKNAME_PREFIX)) return '쓸 수 없는 닉네임입니다.'
  return ''
}

// ===== 11/18 1차 시연 후속: 회원가입 칸별 검사 =====
// 칸마다 오류 문구를 돌려준다(문제가 없으면 ''). 가입 화면은 입력할 때마다 칸 하나씩, [가입하기]에서는 validateSignup으로 전부 부른다. 가입 mock도 같은 함수를 쓴다.

// N-02 아이디 — 규칙은 isValidLoginId 그대로다. 가입할 때 서버가 중복을 막는다(중복 확인 버튼은 이번 범위가 아님).
export function validateLoginId(value) {
  if (!value) return '아이디를 입력해 주세요.'
  if (!isValidLoginId(value)) return `아이디는 ${LOGIN_ID_RULE_TEXT}로 입력해 주세요.`
  return ''
}

// N-02 이름 — 완성형 한글 2~20자만 받는다(숫자·영문·기호·공백·자음만 입력은 오류). 서버 AccountRules.nameError와 같은 규칙·문구.
// 한글 조합 중 글자가 끊기지 않게 값을 고치지 않고 문구로만 알린다.
export const NAME_PATTERN = /^[가-힣]{2,20}$/
export const NAME_RULE_MESSAGE = '이름은 한글 2~20자로 입력해 주세요. (숫자·영문·기호 불가)'
export function validateName(value) {
  const text = String(value ?? '')
  if (!text.trim()) return '이름을 입력해 주세요.'
  if (!NAME_PATTERN.test(text)) return NAME_RULE_MESSAGE
  return ''
}

// N-02 휴대폰 앞자리는 010으로 고정하고, 가운데·끝 4자리씩 받는다.
export const PHONE_PREFIX = '010'
export function joinPhone(middle, last) {
  return `${PHONE_PREFIX}${middle ?? ''}${last ?? ''}`
}
export function validatePhoneParts(middle, last) {
  if (!middle && !last) return '휴대폰 번호를 입력해 주세요.'
  if (!/^\d{4}$/.test(middle ?? '') || !/^\d{4}$/.test(last ?? '')) return '휴대폰 번호 가운데·끝 자리를 숫자 4자리씩 입력해 주세요.'
  if (!isValidPhone(joinPhone(middle, last))) return '휴대폰 번호 형식이 올바르지 않습니다. 예) 010-1234-5678'
  return ''
}

// N-02 이메일은 앞부분과 도메인을 따로 받아 '앞부분@도메인'으로 합친다.
export function joinEmail(local, domain) {
  return `${String(local ?? '').trim()}@${String(domain ?? '').trim()}`
}
export function validateEmailParts(local, domain) {
  if (!String(local ?? '').trim()) return '이메일을 입력해 주세요.'
  if (!String(domain ?? '').trim()) return '이메일 도메인을 선택하거나 입력해 주세요.'
  if (!isValidEmail(joinEmail(local, domain))) return '이메일 형식이 올바르지 않습니다. 예) name@example.com'
  return ''
}

// N-02-1 생일 — 달력(<input type="date">)으로 고를 수 있는 범위. 하한은 DB BIRTH_YEAR 하한(1930)과 같고,
// 상한은 팀 결정 A안 '올해 20세가 되는 해까지'(올해 − 20년 12월 31일)다. 연도는 실행 시점의 올해로 계산한다.
// 서버로는 연도(birthYear)만 보낸다. 월·일은 저장하지 않는다(생일 전체 저장은 DDL 변경·팀 승인이 필요).
export function getBirthDateRange() {
  return { min: `${BIRTH_YEAR_MIN}-01-01`, max: `${getMaxBirthYear()}-12-31` }
}
export function validateBirthDate(value) {
  const text = String(value ?? '')
  if (!text) return '생일을 선택해 주세요.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '생일을 달력에서 골라 주세요.'
  const { min, max } = getBirthDateRange()
  if (text > max) return `올해 기준 ${MIN_SIGNUP_AGE}세 이상만 가입할 수 있습니다.`
  if (text < min) return `${BIRTH_YEAR_MIN}년 1월 1일 이후로 골라 주세요.`
  return ''
}

// N-02 비밀번호 확인 — 비밀번호 칸이 바뀌어도 다시 검사한다(가입 화면은 렌더마다 다시 부른다).
export function validatePasswordConfirm(password, passwordConfirm) {
  if (!passwordConfirm) return '비밀번호를 한 번 더 입력해 주세요.'
  if (password !== passwordConfirm) return '비밀번호가 일치하지 않습니다.'
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

// 가입 화면에서 [가입하기]를 누르기 전에는 띄우지 않는 문구(중복 확인·인증을 아직 안 한 상태). 입력하는 도중에는 형식 오류만 보인다.
export const SIGNUP_PENDING_MESSAGES = Object.freeze({
  nickname: '닉네임 중복 확인을 해 주세요.',
  phone: '휴대폰 인증을 완료해 주세요.',
  email: '이메일 인증을 완료해 주세요.',
})

// N-02 가입 입력값 전체를 검사해 항목별 오류 객체를 돌려준다. 오류가 없으면 빈 객체.
// form: { loginId, name, nickname, phoneMiddle, phoneLast, emailLocal, emailDomain, password, passwordConfirm, birthDate, agreeCreditInfo }
//   emailDomain은 '직접 입력'까지 반영한 최종 도메인이다. 키 순서가 화면 칸 순서와 같아서, 첫 오류 칸을 찾을 때 이 순서를 쓴다.
export function validateSignup(form, { emailVerified = false, phoneVerified = false, nicknameChecked = false } = {}) {
  const errors = {}
  const put = (key, message) => {
    if (message) errors[key] = message
  }
  put('loginId', validateLoginId(form.loginId))
  put('name', validateName(form.name))
  put('nickname', validateNickname(form.nickname) || (nicknameChecked ? '' : SIGNUP_PENDING_MESSAGES.nickname))
  put('phone', validatePhoneParts(form.phoneMiddle, form.phoneLast) || (phoneVerified ? '' : SIGNUP_PENDING_MESSAGES.phone))
  put('email', validateEmailParts(form.emailLocal, form.emailDomain) || (emailVerified ? '' : SIGNUP_PENDING_MESSAGES.email))
  put('password', validateNewPassword(form.password, form.passwordConfirm).password)
  put('passwordConfirm', validatePasswordConfirm(form.password, form.passwordConfirm))
  put('birthDate', validateBirthDate(form.birthDate))
  if (!form.agreeCreditInfo) errors.agreeCreditInfo = '필수 동의 항목입니다.'
  return errors
}
