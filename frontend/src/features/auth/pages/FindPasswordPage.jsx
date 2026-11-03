import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TextInput } from '../../../common/components/index.js'
import { requestPasswordReset } from '../api/authFeatureApi.js'
import { EMAIL_PURPOSES } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import EmailVerification from '../components/EmailVerification.jsx'
import PasswordRuleList from '../components/PasswordRuleList.jsx'
import { validateNewPassword } from '../validation.js'

// N-03 비밀번호 찾기 화면 — ① 아이디·이메일 인증 → ② 새 비밀번호 재설정 → ③ 완료 순서로 진행한다.
export default function FindPasswordPage() {
  const [step, setStep] = useState('verify')
  const [loginId, setLoginId] = useState('')
  const [email, setEmail] = useState('')
  const [verification, setVerification] = useState(null) // { loginId, email, verificationToken }
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordErrors, setPasswordErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  // 인증받은 뒤 아이디나 이메일을 바꾸면 인증이 풀린 것으로 본다.
  const verified = verification !== null && verification.loginId === loginId.trim() && verification.email === email

  const handleReset = async (event) => {
    event.preventDefault()
    const errors = validateNewPassword(password, passwordConfirm)
    setPasswordErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    setPending(true)
    try {
      await requestPasswordReset({
        loginId: verification.loginId,
        email: verification.email,
        emailVerificationToken: verification.verificationToken,
        newPassword: password,
      })
      setStep('done')
    } catch (error) {
      setFormError(error.message)
    } finally {
      setPending(false)
    }
  }

  if (step === 'done') {
    return (
      <section className="auth-page find-password-page find-password-page--done">
        <h1 className="auth-page__title">비밀번호 재설정 완료</h1>
        <p className="auth-page__message" role="status">
          새 비밀번호로 로그인해 주세요.
        </p>
        <Link to={AUTH_PATHS.LOGIN} className="auth-page__primary-link">
          로그인하러 가기
        </Link>
      </section>
    )
  }

  if (step === 'reset') {
    return (
      <section className="auth-page find-password-page">
        <h1 className="auth-page__title">비밀번호 재설정</h1>
        <form className="auth-form reset-password-form" onSubmit={handleReset} noValidate>
          <TextInput
            label="새 비밀번호"
            type="password"
            value={password}
            onChange={setPassword}
            error={passwordErrors.password}
            autoComplete="new-password"
          />
          <PasswordRuleList password={password} />
          <TextInput
            label="새 비밀번호 확인"
            type="password"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            error={passwordErrors.passwordConfirm}
            autoComplete="new-password"
          />
          {formError && (
            <p className="auth-form__error" role="alert">
              {formError}
            </p>
          )}
          <button type="submit" className="auth-form__submit" disabled={pending}>
            비밀번호 변경
          </button>
        </form>
      </section>
    )
  }

  return (
    <section className="auth-page find-password-page">
      <h1 className="auth-page__title">비밀번호 찾기</h1>
      <div className="auth-form find-password-form">
        <TextInput label="아이디" value={loginId} onChange={setLoginId} autoComplete="username" />
        <TextInput label="이메일" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <EmailVerification
          email={email}
          purpose={EMAIL_PURPOSES.RESET_PASSWORD}
          extraBody={{ loginId: loginId.trim() }}
          disabled={!loginId.trim()}
          verified={verified}
          onVerified={({ verificationToken }) => setVerification({ loginId: loginId.trim(), email, verificationToken })}
        />
        <button type="button" className="auth-form__submit" onClick={() => setStep('reset')} disabled={!verified}>
          다음
        </button>
      </div>
      <AuthLinks />
    </section>
  )
}
