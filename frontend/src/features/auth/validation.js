// N-02 비밀번호 규칙 — 영문과 숫자를 섞어 8자 이상, 기호는 요구하지 않는다(decisions.md 1-2). 가입·비밀번호 찾기·마이페이지가 함께 쓴다.
// 입력하는 동안 PasswordRuleList가 이 목록으로 충족 여부를 보여 준다.
// FP-258 13차 N-02-4 새 비밀번호 최대 길이 — 서버 AccountRules.PASSWORD_MAX와 같다(BCrypt 72바이트 안).
export const PASSWORD_MAX = 64
// FP-258 PR #173 64자를 넘은 새 비밀번호의 칸 오류 — 서버 AccountRules.PASSWORD_TOO_LONG_MESSAGE와 같다(잘라 내지 않고 알린다).
export const PASSWORD_TOO_LONG_MESSAGE = `비밀번호는 ${PASSWORD_MAX}자 이하로 입력해 주세요.`

export const PASSWORD_RULES = Object.freeze([
  { key: 'length', label: '8자 이상', test: (value) => value.length >= 8 },
  { key: 'letter', label: '영문 포함', test: (value) => /[A-Za-z]/.test(value) },
  { key: 'number', label: '숫자 포함', test: (value) => /\d/.test(value) },
  // FP-258 PR #173 길이 상한도 목록에 보여 준다(넘으면 이 줄만 안 지킨 것으로 보인다).
  { key: 'max', label: `${PASSWORD_MAX}자 이하`, test: (value) => value.length <= PASSWORD_MAX },
])

// 비밀번호가 모든 규칙을 지키는지 돌려준다. FP-258 13차 64자 이하·ASCII 출력 문자만(서버 isValidPassword와 같음).
export function isValidPassword(value) {
  const text = value ?? ''
  return PASSWORD_RULES.every((rule) => rule.test(text)) && /^[\x20-\x7E]*$/.test(text)
}

// FP-258 PR #173 새 비밀번호 칸 오류 문구 — 64자를 넘으면 길이 안내, 그 밖의 규칙 위반이면 ruleMessage, 맞으면 ''(서버 newPasswordError와 같은 순서).
export function newPasswordError(value, ruleMessage = '비밀번호 규칙을 모두 지켜 주세요.') {
  const text = value ?? ''
  if (text.length > PASSWORD_MAX) return PASSWORD_TOO_LONG_MESSAGE
  return isValidPassword(text) ? '' : ruleMessage
}

// FP-258 N-02-1 이메일 형식 — 소문자로 바꾼 값을 '앞부분@도메인'으로 나눠 판정한다(서버 AccountRules.isValidEmail과 같은 규칙, 전체 100자 이하).
// 앞부분: a-z0-9 . _ - 만, 처음·끝은 a-z0-9, 점 연속 불가. 도메인: 점으로 나눈 덩어리마다 a-z0-9로 시작·끝(가운데 - 가능), 마지막은 영문 2자 이상.
export const EMAIL_MAX = 100
export const EMAIL_LOCAL_MAX = 64
export function isValidEmailLocal(local) {
  const text = String(local ?? '')
  return /^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$/.test(text) && !text.includes('..')
}
export function isValidEmailDomain(domain) {
  const labels = String(domain ?? '').split('.')
  return (
    labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)) &&
    /^[a-z]{2,}$/.test(labels[labels.length - 1])
  )
}
// FP-258 N-03-1·N-03-2 기존 이메일 기본 형식(새 규칙 전 develop 규칙, 100자 이하) — 아이디·비밀번호 찾기는 + 같은 글자가 든 기존 이메일도 찾도록 이것만 본다.
// 서버 AccountRules.isBasicEmail과 같다.
export function isBasicEmail(value) {
  const text = String(value ?? '')
  return text.length <= EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)
}
export function isValidEmail(value) {
  const text = String(value ?? '').toLowerCase()
  const parts = text.split('@')
  return text.length <= EMAIL_MAX && parts.length === 2 && isValidEmailLocal(parts[0]) && isValidEmailDomain(parts[1])
}

// FP-258 N-02-1 서버(AccountRules.normalizeEmail·normalizeLoginId)와 같이 앞뒤 공백을 빼고 소문자로 바꾼다. mock이 요청 값을 이 함수로 정리한 뒤 쓴다.
export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase()
}
export function normalizeLoginId(value) {
  return String(value ?? '').trim().toLowerCase()
}

// ===== FP-258 N-02-1 칸별 걸러내기 — 입력·붙여넣기 모두 onChange에서 이 함수를 거친다. 판정(isValid…·validate…)은 따로 한다. =====
// 한글 칸은 조합 중인 자모(ㄱ-ㅎ, ㅏ-ㅣ)를 남기므로 값이 바뀌지 않아 한글 조합이 끊기지 않는다.

// FP-258 N-02-1 새 비밀번호: ASCII 출력 문자(영문·숫자·키보드 기호)와 공백만 남긴다. 보기 상태(type=text)에서 켜진 한글 IME 입력·붙여넣기를 막는다.
// 공백은 지금 비밀번호 규칙(PASSWORD_RULES, 서버 isValidPassword)이 막지 않으므로 남긴다.
// FP-258 PR #173 길이는 자르지 않는다 — 64자를 넘게 붙여 넣으면 칸 오류(PASSWORD_TOO_LONG_MESSAGE)로 알리고 제출을 막는다(말없이 잘리면 다른 비밀번호로 저장된다).
export function filterPassword(value) {
  return String(value ?? '').replace(/[^\x20-\x7E]/g, '')
}
// FP-258 N-02-1 두벌식 자판 기준으로 한글을 그 자리의 영문 키로 바꾼다(예: 가→rk, ㅂ→q). 가린 칸은 브라우저가 한글 IME를 끄므로, 보기 상태에서 친 한글도 같은 값이 되게 한다.
const CHO_KEYS = ['r', 'R', 's', 'e', 'E', 'f', 'a', 'q', 'Q', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g']
const JUNG_KEYS = ['k', 'o', 'i', 'O', 'j', 'p', 'u', 'P', 'h', 'hk', 'ho', 'hl', 'y', 'n', 'nj', 'np', 'nl', 'b', 'm', 'ml', 'l']
const JONG_KEYS = ['', 'r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg', 'a', 'q', 'qt', 't', 'T', 'd', 'w', 'c', 'z', 'x', 'v', 'g']
// 낱자 자모 ㄱ(U+3131)~ㅣ(U+3163) 순서. 자음 30자(겹받침 포함) 뒤에 모음 21자(중성 순서와 같음)가 온다.
const JAMO_KEYS = [
  'r', 'R', 'rt', 's', 'sw', 'sg', 'e', 'E', 'f', 'fr', 'fa', 'fq', 'ft', 'fx', 'fv', 'fg',
  'a', 'q', 'Q', 'qt', 't', 'T', 'd', 'w', 'W', 'c', 'z', 'x', 'v', 'g',
  ...JUNG_KEYS,
]
export function hangulToQwerty(value) {
  return Array.from(String(value ?? ''), (char) => {
    const code = char.codePointAt(0)
    if (code >= 0xac00 && code <= 0xd7a3) {
      const index = code - 0xac00
      return CHO_KEYS[Math.floor(index / 588)] + JUNG_KEYS[Math.floor(index / 28) % 21] + JONG_KEYS[index % 28]
    }
    if (code >= 0x3131 && code <= 0x3163) return JAMO_KEYS[code - 0x3131]
    return char
  }).join('')
}
// N-02-1 가입 아이디: 소문자로 바꾸고 a-z0-9만, 20자.
export function filterSignupLoginId(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)
}
// N-01-1·N-03-2 로그인·비밀번호 찾기 아이디: 시드(demo_employee)·관리자 아이디에 밑줄이 있어 _도 남긴다. 20자.
export function filterLoginId(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
}
// N-02-1 이름: 한글 완성형과 조합 중 자모만, 20자. 판정은 NAME_PATTERN(완성형 2~20자).
export function filterName(value) {
  return String(value ?? '').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, '').slice(0, 20)
}
// N-02-1 이메일 앞부분: 소문자로 바꾸고 a-z0-9 . _ - 만, 64자.
export function filterEmailLocal(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, EMAIL_LOCAL_MAX)
}
// N-02-1 이메일 도메인(직접 입력): 소문자로 바꾸고 a-z0-9 . - 만.
export function filterEmailDomain(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9.-]/g, '')
}
// FP-258 N-03-1·N-03-2 찾기 화면 이메일 앞부분(기존 이메일): 예전 규칙으로 가입한 이메일(+ ' 등 기호)도 찾도록 공백과 @만 지우고 나머지 글자는 그대로 둔 채 소문자로 바꾼다.
// FP-258 PR #173 예전에는 a-z0-9 . _ % + - 밖의 기호를 지워 o'brien이 obrien이 됐다. 판정은 isBasicEmail 그대로. 직접 입력 도메인은 가입과 같은 filterEmailDomain을 쓴다.
export function filterExistingEmailLocal(value) {
  return String(value ?? '').toLowerCase().replace(/[\s@]/g, '').slice(0, EMAIL_LOCAL_MAX)
}
// N-04-3 한 칸 이메일(마이페이지 이메일 변경): 첫 @ 앞뒤를 따로 거르고 @는 하나만 남긴다.
export function filterEmail(value) {
  const text = String(value ?? '')
  const at = text.indexOf('@')
  if (at < 0) return filterEmailLocal(text)
  return `${filterEmailLocal(text.slice(0, at))}@${filterEmailDomain(text.slice(at + 1))}`
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

// N-02-1 가입 닉네임 검사 규칙 — 한글(완성형)·영문·숫자 2~7자(11/18 화면 확인 후속, 서버 AccountRules와 같은 규칙·문구).
// DDL v0.3.2 APP_USER.NICKNAME(CK_APU_NICKNAME_LEN 2~12자)보다 좁게 막는 것이라 DDL은 그대로이고, 새로 가입할 때만 적용한다(기존 회원·관리자 자동 닉네임은 그대로).
// '탈퇴'로 시작하는 닉네임은 탈퇴 회원 표시값으로 예약돼 일반 회원이 쓸 수 없다(CK_APU_PII_BY_STATUS). 중복 여부(UK_APU_NICKNAME)는 서버(mock)가 본다.
export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 7
export const NICKNAME_PATTERN = /^[A-Za-z0-9가-힣]{2,7}$/
export const NICKNAME_RULE_MESSAGE = '닉네임은 한글·영문·숫자 2~7자로 입력해 주세요.'
export const WITHDRAWN_NICKNAME_PREFIX = '탈퇴'

// FP-258 N-02-1 닉네임 걸러내기: 한글(조합 중 자모 포함)·영문·숫자만, 7자. 판정은 validateNickname.
export function filterNickname(value) {
  return String(value ?? '').replace(/[^가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]/g, '').slice(0, NICKNAME_MAX)
}

// 닉네임을 앞뒤 공백을 뺀 값으로 검사해 오류 문구를 돌려준다. 문제가 없으면 ''. 가입 화면과 가입·닉네임 확인 mock이 같은 규칙을 쓴다.
// 공백·기호·자음/모음만(ㄱ, ㅏ)은 거절한다.
export function validateNickname(value) {
  const text = String(value ?? '').trim()
  if (!text) return '닉네임을 넣어 주세요.'
  if (!NICKNAME_PATTERN.test(text)) return NICKNAME_RULE_MESSAGE
  if (text.startsWith(WITHDRAWN_NICKNAME_PREFIX)) return '쓸 수 없는 닉네임입니다.'
  return ''
}

// ===== 11/18 1차 시연 후속: 회원가입 칸별 검사 =====
// 칸마다 오류 문구를 돌려준다(문제가 없으면 ''). 가입 화면은 입력할 때마다 칸 하나씩, [가입하기]에서는 validateSignup으로 전부 부른다. 가입 mock도 같은 함수를 쓴다.

// N-02 아이디 — 규칙은 isValidLoginId 그대로다. FP-258 중복은 4단계 [중복 확인](AUTH-16)으로 묻고, 가입할 때 서버가 한 번 더 막는다.
export function validateLoginId(value) {
  if (!value) return '아이디를 입력해 주세요.'
  if (!isValidLoginId(value)) return `아이디는 ${LOGIN_ID_RULE_TEXT}로 입력해 주세요.`
  return ''
}

// N-02 이름 — 완성형 한글 2~20자만 받는다(숫자·영문·기호·공백·자음만 입력은 오류). 서버 AccountRules.nameError와 같은 규칙·문구.
// 입력 칸은 filterName으로 한글(조합 중 자모 포함) 외를 지우고, 규칙에 맞지 않는 값(자모만 등)은 문구로 알린다.
export const NAME_PATTERN = /^[가-힣]{2,20}$/
export const NAME_RULE_MESSAGE = '이름은 한글 2~20자로 입력해 주세요. (숫자·영문·기호 불가)'
// FP-258 "홍길ㄷ"처럼 조합 중 자모가 남은 이름은 따로 알린다(서버 AccountRules.nameError는 같은 경우 NAME_RULE_MESSAGE).
export const NAME_INCOMPLETE_MESSAGE = '이름을 완성해 입력해 주세요.'
export function validateName(value) {
  const text = String(value ?? '')
  if (!text.trim()) return '이름을 입력해 주세요.'
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(text)) return NAME_INCOMPLETE_MESSAGE
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
// FP-258 rule이 'existing'(아이디·비밀번호 찾기)이면 기본 형식(isBasicEmail)만 본다.
export function validateEmailParts(local, domain, rule) {
  if (!String(local ?? '').trim()) return '이메일을 입력해 주세요.'
  if (!String(domain ?? '').trim()) return '이메일 도메인을 선택하거나 입력해 주세요.'
  const email = joinEmail(local, domain)
  if (!(rule === 'existing' ? isBasicEmail(email) : isValidEmail(email))) return '이메일 형식이 올바르지 않습니다. 예) name@example.com'
  return ''
}

// N-02-1 생일 — 연·월·일 숫자 칸(DateSelect)으로 받을 수 있는 범위. 하한은 DB BIRTH_YEAR 하한(1930)과 같고,
// 상한은 팀 결정 A안 '올해 20세가 되는 해까지'(올해 − 20년 12월 31일)다. 연도는 실행 시점의 올해로 계산한다.
// 서버로는 연도(birthYear)만 보낸다. 월·일은 저장하지 않는다(생일 전체 저장은 DDL 변경·팀 승인이 필요).
export function getBirthDateRange() {
  return { min: `${BIRTH_YEAR_MIN}-01-01`, max: `${getMaxBirthYear()}-12-31` }
}
export function validateBirthDate(value) {
  const text = String(value ?? '')
  if (!text) return '생일을 선택해 주세요.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '생일의 연·월·일을 모두 입력해 주세요.'
  // 숫자 칸이라 13월·99일도 들어가므로, 실제로 있는 날짜인지 본다(윤년의 2월 29일은 허용, 평년은 거절). 월·일은 서버가 검사하지 않아 화면이 막는다.
  const [year, month, day] = text.split('-').map(Number)
  if (month < 1 || month > 12) return '월은 1~12 사이로 입력해 주세요.'
  if (day < 1 || day > new Date(year, month, 0).getDate()) return `${month}월은 ${new Date(year, month, 0).getDate()}일까지 있습니다.`
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
  else if (newPasswordError(password)) errors.password = newPasswordError(password)
  if (!passwordConfirm) errors.passwordConfirm = '비밀번호를 한 번 더 입력해 주세요.'
  else if (password !== passwordConfirm) errors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
  return errors
}

// 가입 화면에서 [가입하기]를 누르기 전에는 띄우지 않는 문구(중복 확인·인증을 아직 안 한 상태). 입력하는 도중에는 형식 오류만 보인다.
export const SIGNUP_PENDING_MESSAGES = Object.freeze({
  loginId: '아이디 중복 확인을 해 주세요.',
  nickname: '닉네임 중복 확인을 해 주세요.',
  phone: '휴대폰 인증을 완료해 주세요.',
  email: '이메일 인증을 완료해 주세요.',
})

// N-02 가입 입력값 전체를 검사해 항목별 오류 객체를 돌려준다. 오류가 없으면 빈 객체.
// form: { loginId, name, nickname, phoneMiddle, phoneLast, emailLocal, emailDomain, password, passwordConfirm, birthDate, agreeTerms, agreePrivacy }
//   emailDomain은 '직접 입력'까지 반영한 최종 도메인이다. 키 순서가 화면 칸 순서와 같아서, 첫 오류 칸을 찾을 때 이 순서를 쓴다.
export function validateSignup(form, { emailVerified = false, phoneVerified = false, nicknameChecked = false, loginIdChecked = false } = {}) {
  const errors = {}
  const put = (key, message) => {
    if (message) errors[key] = message
  }
  put('loginId', validateLoginId(form.loginId) || (loginIdChecked ? '' : SIGNUP_PENDING_MESSAGES.loginId))
  put('name', validateName(form.name))
  put('nickname', validateNickname(form.nickname) || (nicknameChecked ? '' : SIGNUP_PENDING_MESSAGES.nickname))
  put('phone', validatePhoneParts(form.phoneMiddle, form.phoneLast) || (phoneVerified ? '' : SIGNUP_PENDING_MESSAGES.phone))
  put('email', validateEmailParts(form.emailLocal, form.emailDomain) || (emailVerified ? '' : SIGNUP_PENDING_MESSAGES.email))
  put('password', validateNewPassword(form.password, form.passwordConfirm).password)
  put('passwordConfirm', validatePasswordConfirm(form.password, form.passwordConfirm))
  put('birthDate', validateBirthDate(form.birthDate))
  // FP-258 13차 N-02-2 필수 동의 2개(이용약관·개인정보 수집·이용)를 모두 체크해야 한다. 선택 동의(agreeMarketing)는 보지 않는다.
  if (!form.agreeTerms || !form.agreePrivacy) errors.agreements = '필수 동의 항목에 모두 동의해 주세요.'
  return errors
}
