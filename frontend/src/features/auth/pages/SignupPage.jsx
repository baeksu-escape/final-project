import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Checkbox, FieldError, TextInput } from '../../../common/components/index.js'
import { checkNicknameAvailability, requestSignup } from '../api/authFeatureApi.js'
import { AUTH_ERROR_CODES, CREDIT_INFO_AGREEMENT_LABEL, EMAIL_PURPOSES, PHONE_PURPOSES, toAgeGroup } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import PasswordRuleList from '../components/PasswordRuleList.jsx'
import PhoneVerification from '../components/PhoneVerification.jsx'
import SplitEmailField from '../components/SplitEmailField.jsx'
import { resolveEmailDomain, splitEmail } from '../emailParts.js'
import {
  NICKNAME_MAX,
  SIGNUP_PENDING_MESSAGES,
  getBirthDateRange,
  joinEmail,
  joinPhone,
  normalizePhone,
  validateNickname,
  validateSignup,
} from '../validation.js'
import '../auth.css'

// 가입 화면 입력값의 처음 상태. 휴대폰은 010 뒤 가운데·끝 4자리, 이메일은 앞부분 + 도메인(선택 또는 직접 입력), 생일은 'YYYY-MM-DD'.
const EMPTY_FORM = {
  loginId: '',
  name: '',
  nickname: '',
  phoneMiddle: '',
  phoneLast: '',
  emailLocal: '',
  emailDomainChoice: '',
  emailCustomDomain: '',
  password: '',
  passwordConfirm: '',
  birthDate: '',
  agreeCreditInfo: false,
}

// 칸 순서(validateSignup 오류 키). [가입하기]에서 오류가 있으면 이 순서로 첫 오류 칸을 찾아 옮겨 간다.
const FIELD_ORDER = ['loginId', 'name', 'nickname', 'phone', 'email', 'password', 'passwordConfirm', 'birthDate', 'agreeCreditInfo']
// 폼 값 키 → 검사 오류 키(휴대폰·이메일은 여러 칸이 오류 하나를 같이 쓴다).
const ERROR_KEY_OF = {
  phoneMiddle: 'phone',
  phoneLast: 'phone',
  emailLocal: 'email',
  emailDomainChoice: 'email',
  emailCustomDomain: 'email',
}
// 서버 칸별 오류 field → 화면 오류 키. 서버는 생일 대신 출생연도(birthYear)로 검사한다.
const SERVER_FIELD_KEY = { birthYear: 'birthDate' }

// 칸을 감싸는 요소의 id. 첫 오류 칸으로 옮겨 갈 때 이 id로 찾는다.
const fieldWrapperId = (key) => `signup-field-${key}`

// [가입하기]에서 오류가 있으면 첫 오류 칸을 화면 가운데로 옮기고 그 칸의 입력에 포커스를 준다(1차 시연 기준 8행).
function moveToFirstError(errors) {
  const key = FIELD_ORDER.find((item) => errors[item])
  const wrapper = key && document.getElementById(fieldWrapperId(key))
  if (!wrapper) return
  wrapper.scrollIntoView({ block: 'center' })
  wrapper.querySelector('input, select, button')?.focus()
}

// N-02 회원가입 화면 — 형식 검사·닉네임 중복 확인·휴대폰 인증·이메일 인증·필수 동의를 거쳐 계정을 만든다. 직군은 가입 후 직군 선택 화면(FP-85)에서 받는다.
// 11/18 1차 시연 후속: 칸마다 한 번 입력했거나 칸을 벗어난 뒤부터 입력할 때마다 검사해 칸 아래에 바로 보여 준다(손대지 않은 칸은 [가입하기] 전까지 조용하다).
//   중복 확인·인증을 아직 안 했다는 문구(SIGNUP_PENDING_MESSAGES)는 [가입하기]를 누른 뒤에만 보인다.
export default function SignupPage() {
  // N-01-6 소셜 계정으로 새로 가입하면 화면 이동 상태로 이름·이메일·임시 연결 키를 받는다. 칸은 사용자가 고칠 수 있고, 인증은 그대로 거친다.
  // 미리 채운 칸은 처음부터 검사 문구를 보여 준다(예: 영문 이름이면 한글로 고쳐 쓰라는 안내). 값을 자동으로 바꾸지는 않는다.
  const socialSignup = useLocation().state?.socialSignup
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    name: socialSignup?.name ?? '',
    ...(socialSignup?.email ? splitEmail(socialSignup.email) : {}),
  }))
  const [touched, setTouched] = useState(() => ({ name: Boolean(socialSignup?.name), email: Boolean(socialSignup?.email) }))
  const [emailVerification, setEmailVerification] = useState(null)
  const [phoneVerification, setPhoneVerification] = useState(null)
  // 닉네임 중복 확인 결과 { nickname, available }. 닉네임을 고치면 nickname이 달라져 확인이 풀린 것으로 본다.
  const [nicknameCheck, setNicknameCheck] = useState(null)
  const [nicknameCheckError, setNicknameCheckError] = useState('')
  const [nicknameChecking, setNicknameChecking] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const [completed, setCompleted] = useState(false)

  const email = joinEmail(form.emailLocal, resolveEmailDomain(form.emailDomainChoice, form.emailCustomDomain))
  const phone = joinPhone(form.phoneMiddle, form.phoneLast)
  const nickname = form.nickname.trim()
  const emailVerified = emailVerification !== null && emailVerification.email === email
  const phoneVerified = phoneVerification !== null && phoneVerification.phone === phone
  const nicknameChecked = nicknameCheck?.nickname === nickname && nicknameCheck.available
  const nicknameTaken = nicknameCheck?.nickname === nickname && !nicknameCheck.available
  const checkContext = { emailVerified, phoneVerified, nicknameChecked }
  const validation = validateSignup(
    { ...form, emailDomain: resolveEmailDomain(form.emailDomainChoice, form.emailCustomDomain) },
    checkContext,
  )

  // 칸 하나에 보여 줄 오류. 서버 오류(중복 등)가 먼저이고, 검사 오류는 손댄 칸이거나 [가입하기]를 누른 뒤에만 보인다.
  const errorOf = (key) => {
    if (serverErrors[key]) return serverErrors[key]
    if (key === 'nickname' && nicknameTaken) return '이미 사용 중인 닉네임입니다.'
    if (!touched[key] && !submitted) return ''
    const message = validation[key] ?? ''
    if (!submitted && message === SIGNUP_PENDING_MESSAGES[key]) return ''
    return message
  }

  const markTouched = (key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }))

  // 칸 값을 바꾼다. 값이 비어 있지 않으면 손댄 칸으로 표시하고, 그 칸의 서버 오류(중복 등)는 지워서 형식 검사 오류를 가리지 않게 한다.
  const patchForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }))
    Object.entries(patch).forEach(([field, value]) => {
      const key = ERROR_KEY_OF[field] ?? field
      if (value !== '' && value !== false) markTouched(key)
      setServerErrors((prev) => {
        if (!(key in prev)) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    })
  }
  const update = (field) => (value) => patchForm({ [field]: value })

  // 칸을 감싼 요소. 안쪽 입력에서 포커스가 빠져나가면(blur는 감싼 요소까지 올라온다) 손댄 칸으로 표시한다.
  const fieldProps = (key) => ({ id: fieldWrapperId(key), onBlur: () => markTouched(key) })

  // N-02-1 [중복 확인] — 형식 검사를 통과한 닉네임만 서버에 묻는다. 결과는 그 닉네임에만 유효하다.
  const handleNicknameCheck = async () => {
    setNicknameChecking(true)
    setNicknameCheckError('')
    try {
      const { available } = await checkNicknameAvailability(nickname)
      setNicknameCheck({ nickname, available })
    } catch (error) {
      setNicknameCheck(null)
      setNicknameCheckError(error.message)
    } finally {
      setNicknameChecking(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFormError('')
    if (Object.keys(validation).length > 0) {
      moveToFirstError(validation)
      return
    }

    const birthYear = Number(form.birthDate.slice(0, 4))
    setPending(true)
    try {
      await requestSignup({
        loginId: form.loginId,
        name: form.name.trim(),
        nickname,
        phone: normalizePhone(phone),
        email,
        password: form.password,
        birthYear,
        ageGroup: toAgeGroup(birthYear),
        agreeCreditInfo: form.agreeCreditInfo,
        emailVerificationToken: emailVerification.verificationToken,
        phoneVerificationToken: phoneVerification.verificationToken,
        ...(socialSignup?.linkKey ? { socialLinkKey: socialSignup.linkKey } : {}),
      })
      setCompleted(true)
    } catch (error) {
      const code = error?.data?.code
      const fieldErrors = error?.data?.fieldErrors
      let nextErrors = null
      if (code === AUTH_ERROR_CODES.DUPLICATE_LOGIN_ID) nextErrors = { loginId: error.message }
      else if (code === AUTH_ERROR_CODES.DUPLICATE_EMAIL) nextErrors = { email: error.message }
      else if (code === AUTH_ERROR_CODES.DUPLICATE_NICKNAME) {
        // 확인한 뒤 다른 사람이 같은 닉네임으로 먼저 가입한 경우 — 확인 결과도 풀어서 다시 확인하게 한다.
        setNicknameCheck(null)
        nextErrors = { nickname: error.message }
      }
      // 서버가 칸별 오류(fieldErrors [{ field, message }])를 주면 그 칸 아래에 보여 준다(예: 출생연도 → 생일 칸).
      else if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        nextErrors = Object.fromEntries(fieldErrors.map(({ field, message }) => [SERVER_FIELD_KEY[field] ?? field, message]))
      } else setFormError(error.message)
      if (nextErrors) {
        // 휴대폰·이메일 칸 오류(인증 토큰 만료 등)면 그 인증 결과를 비워서, 완료 문구 대신 오류와 [받기] 버튼이 보이게 한다.
        if (nextErrors.phone) setPhoneVerification(null)
        if (nextErrors.email) setEmailVerification(null)
        setServerErrors(nextErrors)
        moveToFirstError(nextErrors)
      }
    } finally {
      setPending(false)
    }
  }

  if (completed) {
    return (
      <section className="auth-page signup-page signup-page--completed">
        <h1 className="auth-page__title">회원가입 완료</h1>
        <p className="auth-page__message" role="status">
          가입이 완료되었습니다. 로그인한 뒤 직군을 선택해 주세요.
        </p>
        <Link to={AUTH_PATHS.LOGIN} className="auth-page__primary-link">
          로그인하러 가기
        </Link>
      </section>
    )
  }

  return (
    <section className="auth-page signup-page">
      <h1 className="auth-page__title">회원가입</h1>
      <form className="auth-form signup-form" onSubmit={handleSubmit} noValidate>
        <div {...fieldProps('loginId')}>
          <TextInput
            label="아이디"
            value={form.loginId}
            onChange={update('loginId')}
            error={errorOf('loginId')}
            placeholder="영문 소문자로 시작, 4~20자"
            autoComplete="username"
            maxLength={20}
          />
        </div>
        <div {...fieldProps('name')}>
          <TextInput
            label="이름"
            value={form.name}
            onChange={update('name')}
            error={errorOf('name')}
            placeholder="한글 이름"
            autoComplete="name"
            maxLength={20}
          />
        </div>
        {/* N-02-1 닉네임 — 한글·영문·숫자 2~7자(DDL 2~12자보다 좁게, 새 가입에만), 중복 불가. [중복 확인]은 형식이 맞을 때만 눌린다. 가입할 때 서버가 한 번 더 막는다. */}
        {/* auth-field: 칸 밖의 성공·오류 문구가 TextInput 안 오류와 같은 간격(5px)에 놓이게 묶는다. */}
        <div {...fieldProps('nickname')} className="auth-field">
          <div className="signup-form__row">
            <TextInput
              label="닉네임"
              value={form.nickname}
              onChange={update('nickname')}
              placeholder={`2~${NICKNAME_MAX}자`}
              autoComplete="nickname"
              maxLength={NICKNAME_MAX}
            />
            <button
              type="button"
              className="signup-form__check"
              onClick={handleNicknameCheck}
              disabled={nicknameChecking || validateNickname(form.nickname) !== ''}
            >
              중복 확인
            </button>
          </div>
          <p className="form-field__hint">한글·영문·숫자, 신용 라운지에 작성자로 보입니다</p>
          {nicknameChecked && (
            <p className="auth-message auth-message--success" role="status">
              사용할 수 있는 닉네임입니다.
            </p>
          )}
          <FieldError message={errorOf('nickname')} />
          <FieldError message={nicknameCheckError} />
        </div>
        <div {...fieldProps('phone')}>
          <PhoneVerification
            middle={form.phoneMiddle}
            last={form.phoneLast}
            onChange={({ middle, last }) => patchForm({ phoneMiddle: middle, phoneLast: last })}
            purpose={PHONE_PURPOSES.SIGNUP}
            verified={phoneVerified}
            onVerified={setPhoneVerification}
            error={errorOf('phone')}
          />
        </div>
        <div {...fieldProps('email')}>
          <SplitEmailField
            local={form.emailLocal}
            domainChoice={form.emailDomainChoice}
            customDomain={form.emailCustomDomain}
            onChange={patchForm}
            purpose={EMAIL_PURPOSES.SIGNUP}
            verified={emailVerified}
            onVerified={setEmailVerification}
            error={errorOf('email')}
          />
        </div>
        <div {...fieldProps('password')}>
          <TextInput
            label="비밀번호"
            type="password"
            value={form.password}
            onChange={update('password')}
            error={errorOf('password')}
            placeholder="비밀번호"
            autoComplete="new-password"
          />
        </div>
        <PasswordRuleList password={form.password} />
        <div {...fieldProps('passwordConfirm')} className="auth-field">
          <TextInput
            label="비밀번호 확인"
            type="password"
            value={form.passwordConfirm}
            onChange={update('passwordConfirm')}
            error={errorOf('passwordConfirm')}
            placeholder="비밀번호 다시 입력"
            autoComplete="new-password"
          />
          {form.passwordConfirm && form.password === form.passwordConfirm && (
            <p className="auth-message auth-message--success" role="status">
              비밀번호가 일치합니다.
            </p>
          )}
        </div>
        {/* N-02-1 생일 — 브라우저 달력으로 고른다. 서버에는 연도(birthYear)만 보내고 월·일은 저장하지 않는다. */}
        <div {...fieldProps('birthDate')}>
          <div className="form-field text-input">
            <label htmlFor="signup-birth-date" className="form-field__label">
              생일
            </label>
            <input
              id="signup-birth-date"
              type="date"
              className="text-input__control"
              value={form.birthDate}
              onChange={(event) => update('birthDate')(event.target.value)}
              min={getBirthDateRange().min}
              max={getBirthDateRange().max}
              autoComplete="bday"
              aria-invalid={errorOf('birthDate') ? true : undefined}
              aria-describedby="signup-birth-date-hint"
            />
            <p id="signup-birth-date-hint" className="form-field__hint">
              연령대별 비교 기준을 정하는 데 씁니다.
            </p>
            <FieldError message={errorOf('birthDate')} />
          </div>
        </div>
        <div {...fieldProps('agreeCreditInfo')}>
          <Checkbox
            label={CREDIT_INFO_AGREEMENT_LABEL}
            checked={form.agreeCreditInfo}
            onChange={update('agreeCreditInfo')}
            error={errorOf('agreeCreditInfo')}
          />
        </div>
        {formError && (
          <p className="auth-form__error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="auth-form__submit" disabled={!form.agreeCreditInfo || pending}>
          {pending ? '가입 처리 중…' : '가입하기'}
        </button>
      </form>
      <AuthLinks />
    </section>
  )
}
