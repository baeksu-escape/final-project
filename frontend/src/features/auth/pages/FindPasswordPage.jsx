import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TextInput } from '../../../common/components/index.js'
import { requestPasswordReset } from '../api/authFeatureApi.js'
import { AUTH_ERROR_CODES, EMAIL_PURPOSES } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import PasswordField from '../components/PasswordField.jsx'
import PasswordRuleList from '../components/PasswordRuleList.jsx'
import SplitEmailField from '../components/SplitEmailField.jsx'
import useExistingEmailParts from '../useExistingEmailParts.js'
import useFindNameField from '../useFindNameField.js'
import useImeSafeFilter from '../useImeSafeFilter.js'
import usePasswordReveal from '../usePasswordReveal.js'
import { filterLoginId, passwordTooLongError, validateNewPassword } from '../validation.js'
import '../auth.css'

// N-03 비밀번호 찾기 화면 — ① 아이디·이메일 인증 → ② 새 비밀번호 재설정 → ③ 완료 순서로 진행한다.
// 11/18 화면 확인 후속: 이메일은 회원가입과 같은 한 줄 칸(SplitEmailField: 앞부분 @ 도메인 선택 [인증코드 받기])으로 받는다.
// FP-258 N-03-2 아이디·이름·이메일이 모두 같은 계정만 통과한다(코드 확인과 재설정 둘 다 서버가 확인, 다르면 같은 404 문구).
export default function FindPasswordPage() {
  const [step, setStep] = useState('verify')
  const [loginId, setLoginId] = useState('')
  const [verification, setVerification] = useState(null) // { loginId, name, email, verificationToken }
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordErrors, setPasswordErrors] = useState({})
  const [formError, setFormError] = useState('')
  // FP-258 재설정 단계에서 인증이 풀려 되돌아왔을 때 인증 단계에 보이는 안내(다시 인증하면 지운다).
  const [verifyNotice, setVerifyNotice] = useState('')
  const [pending, setPending] = useState(false)
  const { reveal, hideAll } = usePasswordReveal()
  const bindFilter = useImeSafeFilter()
  const loginIdInput = bindFilter(setLoginId, filterLoginId)
  const nameField = useFindNameField(bindFilter)
  const { name, check: checkName } = nameField
  // 이메일 앞부분·도메인 선택·직접 입력 도메인을 합친 값(email)으로 인증한다(아이디 찾기와 같은 칸).
  const emailField = useExistingEmailParts()
  const { email } = emailField
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
    try {
      await requestPasswordReset({
        loginId: verification.loginId,
        name: verification.name,
        email: verification.email,
        emailVerificationToken: verification.verificationToken,
        newPassword: password,
      })
      hideAll()
      setStep('done')
    } catch (error) {
      // FP-258 재설정 중에 인증 토큰이 만료·사용됐으면 인증을 비우고 인증 단계로 되돌려, [인증코드 받기]부터 다시 하게 안내한다.
      if (error?.data?.code === AUTH_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED) {
        setVerification(null)
        setPasswordErrors({})
        setVerifyNotice(`${error.message} 인증코드를 다시 받아 확인한 뒤 [다음]을 눌러 주세요.`)
        setStep('verify')
        return
      }
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
            rule="new"
            value={password}
            onChange={setPassword}
            error={passwordTooLongError(password) || passwordErrors.password}
            autoComplete="new-password"
            {...reveal('password')}
          />
          <PasswordRuleList password={password} />
          <PasswordField
            label="새 비밀번호 확인"
            rule="new"
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
          {/* FP-259 12차 새 비밀번호가 64자를 넘으면 칸 오류와 함께 버튼을 끈다(마이페이지 비밀번호 변경과 같다). */}
          <button type="submit" className="auth-form__submit" disabled={pending || passwordTooLongError(password) !== ''}>
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
        <div {...loginIdInput.compositionProps}>
          <TextInput label="아이디" value={loginId} onChange={loginIdInput.onChange} autoComplete="username" />
        </div>
        <div {...nameField.compositionProps} onBlur={nameField.onBlur}>
          <TextInput
            label="이름"
            value={name}
            onChange={nameField.onChange}
            error={nameField.error}
            autoComplete="name"
            hint="가입할 때 입력한 이름"
          />
        </div>
        <div onBlur={emailField.onBlur}>
          <SplitEmailField
            {...emailField.fieldProps}
            purpose={EMAIL_PURPOSES.RESET_PASSWORD}
            extraBody={{ loginId: loginId.trim(), name: name.trim() }}
            disabled={!ready}
            verified={verified}
            beforeRequest={() => checkName()}
            onVerified={({ verificationToken }) => {
              setVerifyNotice('')
              setVerification({ loginId: loginId.trim(), name: name.trim(), email, verificationToken })
            }}
          />
        </div>
        {verifyNotice && (
          <p className="auth-form__error" role="alert">
            {verifyNotice}
          </p>
        )}
        <button type="button" className="auth-form__submit" onClick={() => checkName() && setStep('reset')} disabled={!verified}>
          다음
        </button>
      </div>
      <AuthLinks />
    </section>
  )
}
