import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TextInput } from '../../../common/components/index.js'
import { requestPasswordReset } from '../api/authFeatureApi.js'
import { EMAIL_PURPOSES } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import PasswordField from '../components/PasswordField.jsx'
import PasswordRuleList from '../components/PasswordRuleList.jsx'
import SplitEmailField from '../components/SplitEmailField.jsx'
import { resolveEmailDomain } from '../emailParts.js'
import usePasswordReveal from '../usePasswordReveal.js'
import { filterLoginId, filterName, joinEmail, validateNewPassword } from '../validation.js'
import '../auth.css'

// N-03 비밀번호 찾기 화면 — ① 아이디·이메일 인증 → ② 새 비밀번호 재설정 → ③ 완료 순서로 진행한다.
// 11/18 화면 확인 후속: 이메일은 회원가입과 같은 한 줄 칸(SplitEmailField: 앞부분 @ 도메인 선택 [인증코드 받기])으로 받는다.
// FP-258 N-03-2 아이디·이름·이메일이 모두 같은 계정만 통과한다(코드 확인과 재설정 둘 다 서버가 확인, 다르면 같은 404 문구).
export default function FindPasswordPage() {
  const [step, setStep] = useState('verify')
  const [loginId, setLoginId] = useState('')
  const [name, setName] = useState('')
  // 이메일 앞부분·도메인 선택·직접 입력 도메인. 합친 값(email)으로 인증한다.
  const [emailParts, setEmailParts] = useState({ emailLocal: '', emailDomainChoice: '', emailCustomDomain: '' })
  const [verification, setVerification] = useState(null) // { loginId, name, email, verificationToken }
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordErrors, setPasswordErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  // FP-258 2차 새 비밀번호·확인 칸 [보기] 상태. 재설정 요청 직전에 가린다.
  const { reveal, hideAll } = usePasswordReveal()

  const email = joinEmail(emailParts.emailLocal, resolveEmailDomain(emailParts.emailDomainChoice, emailParts.emailCustomDomain))
  // 인증받은 뒤 아이디·이름·이메일을 바꾸면 인증이 풀린 것으로 본다.
  const verified =
    verification !== null && verification.loginId === loginId.trim() && verification.name === name.trim() && verification.email === email
  const ready = loginId.trim() !== '' && name.trim() !== ''

  const handleReset = async (event) => {
    event.preventDefault()
    const errors = validateNewPassword(password, passwordConfirm)
    setPasswordErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    setPending(true)
    hideAll()
    try {
      await requestPasswordReset({
        loginId: verification.loginId,
        name: verification.name,
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
          <PasswordField
            label="새 비밀번호"
            value={password}
            onChange={setPassword}
            error={passwordErrors.password}
            autoComplete="new-password"
            {...reveal('password')}
          />
          <PasswordRuleList password={password} />
          <PasswordField
            label="새 비밀번호 확인"
            value={passwordConfirm}
            onChange={setPasswordConfirm}
            error={passwordErrors.passwordConfirm}
            autoComplete="new-password"
            {...reveal('passwordConfirm')}
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
        <TextInput label="아이디" value={loginId} onChange={(value) => setLoginId(filterLoginId(value))} autoComplete="username" />
        <TextInput
          label="이름"
          value={name}
          onChange={(value) => setName(filterName(value))}
          autoComplete="name"
          hint="가입할 때 입력한 이름"
        />
        <SplitEmailField
          local={emailParts.emailLocal}
          domainChoice={emailParts.emailDomainChoice}
          customDomain={emailParts.emailCustomDomain}
          onChange={(patch) => setEmailParts((prev) => ({ ...prev, ...patch }))}
          purpose={EMAIL_PURPOSES.RESET_PASSWORD}
          extraBody={{ loginId: loginId.trim(), name: name.trim() }}
          disabled={!ready}
          verified={verified}
          onVerified={({ verificationToken }) => setVerification({ loginId: loginId.trim(), name: name.trim(), email, verificationToken })}
        />
        <button type="button" className="auth-form__submit" onClick={() => setStep('reset')} disabled={!verified}>
          다음
        </button>
      </div>
      <AuthLinks />
    </section>
  )
}
