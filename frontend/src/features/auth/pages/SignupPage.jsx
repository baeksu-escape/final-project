import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Checkbox, TextInput } from '../../../common/components/index.js'
import { requestSignup } from '../api/authFeatureApi.js'
import { AUTH_ERROR_CODES, CREDIT_INFO_AGREEMENT_LABEL, EMAIL_PURPOSES, toAgeGroup } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import EmailVerification from '../components/EmailVerification.jsx'
import PasswordRuleList from '../components/PasswordRuleList.jsx'
import { LOGIN_ID_RULE_TEXT, MIN_SIGNUP_AGE, NICKNAME_MAX, getMaxBirthYear, normalizePhone, validateSignup } from '../validation.js'

// 가입 화면 입력값의 처음 상태. N-02-1 연령대 선택 대신 출생연도(4자리 숫자 글자)를 받는다.
const EMPTY_FORM = {
  loginId: '',
  name: '',
  nickname: '',
  phone: '',
  email: '',
  password: '',
  passwordConfirm: '',
  birthYear: '',
  agreeCreditInfo: false,
}

// N-02 회원가입 화면 — 형식 검사·이메일 인증·필수 동의를 거쳐 계정을 만든다. 직군은 가입 후 직군 선택 화면(FP-85)에서 받는다.
export default function SignupPage() {
  // N-01-6 소셜 계정으로 새로 가입하면 화면 이동 상태로 이름·이메일·임시 연결 키를 받는다. 칸은 사용자가 고칠 수 있고, 이메일 인증은 그대로 거친다.
  const socialSignup = useLocation().state?.socialSignup
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    name: socialSignup?.name ?? '',
    email: socialSignup?.email ?? '',
  }))
  const [verification, setVerification] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  const [completed, setCompleted] = useState(false)

  const emailVerified = verification !== null && verification.email === form.email
  // 처음 제출한 뒤부터는 입력할 때마다 다시 검사해 오류 문구를 바로 고쳐 보여 준다.
  const errors = { ...(submitted ? validateSignup(form, { emailVerified }) : {}), ...serverErrors }

  // 항목 하나를 바꾸는 함수를 만든다. 그 항목의 서버 오류(중복 등)는 키째 지워서 형식 검사 오류를 가리지 않게 한다.
  const update = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setServerErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFormError('')
    if (Object.keys(validateSignup(form, { emailVerified })).length > 0) return

    setPending(true)
    try {
      await requestSignup({
        loginId: form.loginId,
        name: form.name.trim(),
        nickname: form.nickname.trim(),
        phone: normalizePhone(form.phone),
        email: form.email,
        password: form.password,
        birthYear: Number(form.birthYear),
        ageGroup: toAgeGroup(form.birthYear),
        agreeCreditInfo: form.agreeCreditInfo,
        emailVerificationToken: verification.verificationToken,
        ...(socialSignup?.linkKey ? { socialLinkKey: socialSignup.linkKey } : {}),
      })
      setCompleted(true)
    } catch (error) {
      const code = error?.data?.code
      const fieldErrors = error?.data?.fieldErrors
      if (code === AUTH_ERROR_CODES.DUPLICATE_LOGIN_ID) setServerErrors({ loginId: error.message })
      else if (code === AUTH_ERROR_CODES.DUPLICATE_EMAIL) setServerErrors({ email: error.message })
      else if (code === AUTH_ERROR_CODES.DUPLICATE_NICKNAME) setServerErrors({ nickname: error.message })
      // 서버가 칸별 오류(fieldErrors [{ field, message }])를 주면 그 칸 옆에 보여 준다(예: 출생연도).
      else if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        setServerErrors(Object.fromEntries(fieldErrors.map(({ field, message }) => [field, message])))
      } else setFormError(error.message)
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
        <TextInput
          label="아이디"
          value={form.loginId}
          onChange={update('loginId')}
          error={errors.loginId}
          hint={LOGIN_ID_RULE_TEXT}
          autoComplete="username"
          maxLength={20}
        />
        <TextInput label="이름" value={form.name} onChange={update('name')} error={errors.name} autoComplete="name" />
        {/* N-02-1 닉네임 — DDL APP_USER.NICKNAME(2~12자, 중복 불가). 중복이면 서버 오류를 이 칸 아래에 보여 준다. */}
        <TextInput
          label="닉네임"
          value={form.nickname}
          onChange={update('nickname')}
          error={errors.nickname}
          hint="2~12자, 신용 라운지에 작성자로 보입니다"
          autoComplete="nickname"
          maxLength={NICKNAME_MAX}
        />
        <TextInput
          label="휴대폰"
          type="tel"
          value={form.phone}
          onChange={update('phone')}
          error={errors.phone}
          hint="하이픈(-) 없이 입력해도 됩니다."
          autoComplete="tel"
          inputMode="numeric"
        />
        <TextInput label="이메일" type="email" value={form.email} onChange={update('email')} error={errors.email} autoComplete="email" />
        <EmailVerification
          email={form.email}
          purpose={EMAIL_PURPOSES.SIGNUP}
          verified={emailVerified}
          onVerified={setVerification}
        />
        <TextInput
          label="비밀번호"
          type="password"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
          autoComplete="new-password"
        />
        <PasswordRuleList password={form.password} />
        <TextInput
          label="비밀번호 확인"
          type="password"
          value={form.passwordConfirm}
          onChange={update('passwordConfirm')}
          error={errors.passwordConfirm}
          autoComplete="new-password"
        />
        <TextInput
          label="출생연도"
          value={form.birthYear}
          onChange={update('birthYear')}
          error={errors.birthYear}
          hint={`연령대별 기준을 고르는 데 씁니다. 올해 기준 ${MIN_SIGNUP_AGE}세 이상(${getMaxBirthYear()}년생까지) 가입할 수 있습니다.`}
          autoComplete="bday-year"
          inputMode="numeric"
          maxLength={4}
        />
        <Checkbox
          label={CREDIT_INFO_AGREEMENT_LABEL}
          checked={form.agreeCreditInfo}
          onChange={update('agreeCreditInfo')}
          error={errors.agreeCreditInfo}
        />
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
