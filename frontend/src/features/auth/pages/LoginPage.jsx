import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { TextInput } from '../../../common/components/index.js'
// 로그인 mock 응답(잠긴 계정·가입자 포함)을 등록하기 위해 불러온다.
import '../api/authFeatureApi.js'
import { ACCOUNT_LOCKED_MESSAGE, AUTH_ERROR_CODES, LOGIN_FAILED_MESSAGE } from '../authConstants.js'
import AuthLinks from '../components/AuthLinks.jsx'
import SocialLoginButtons from '../components/SocialLoginButtons.jsx'

// 로그인 실패 원인을 화면 문구로 바꾼다. 아이디·비밀번호 중 무엇이 틀렸는지는 알려 주지 않는다.
function toLoginErrorMessage(error) {
  if (error?.data?.code === AUTH_ERROR_CODES.ACCOUNT_LOCKED) return ACCOUNT_LOCKED_MESSAGE
  // 관리자 로그인 준비 중 안내는 서버 문구를 그대로 보여 준다(비밀번호가 틀렸다고 잘못 보이지 않게).
  if (error?.data?.code === AUTH_ERROR_CODES.ADMIN_2FA_NOT_READY) return error.message
  if (error?.status === 0) return error.message
  return LOGIN_FAILED_MESSAGE
}

// N-01 로그인 화면 — 성공하면 공통 인증 구조가 토큰을 저장하고, GuestOnlyRoute가 역할에 맞는 첫 화면으로 보낸다.
export default function LoginPage() {
  const { login } = useAuth()
  // N-01-6 소셜 로그인 콜백이 돌려보내며 넘긴 안내 문구(관리자 차단·잠금·취소·오류).
  const socialMessage = useLocation().state?.socialMessage
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!loginId.trim()) errors.loginId = '아이디를 입력해 주세요.'
    if (!password) errors.password = '비밀번호를 입력해 주세요.'
    setFieldErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    setPending(true)
    try {
      await login(loginId.trim(), password)
    } catch (error) {
      setPassword('')
      setFormError(toLoginErrorMessage(error))
      setPending(false)
    }
  }

  return (
    <section className="auth-page login-page">
      <h1 className="auth-page__title">로그인</h1>
      {socialMessage && (
        <p className="login-page__social-message" role="alert">
          {socialMessage}
        </p>
      )}
      <form className="auth-form login-form" onSubmit={handleSubmit} noValidate>
        <TextInput label="아이디" value={loginId} onChange={setLoginId} error={fieldErrors.loginId} autoComplete="username" />
        <TextInput
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="current-password"
        />
        {formError && (
          <p className="auth-form__error" role="alert">
            {formError}
          </p>
        )}
        <button type="submit" className="auth-form__submit" disabled={pending}>
          {pending ? '로그인 중…' : '로그인'}
        </button>
      </form>
      <SocialLoginButtons />
      <AuthLinks />
    </section>
  )
}
