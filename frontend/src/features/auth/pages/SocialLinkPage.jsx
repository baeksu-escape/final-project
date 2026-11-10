import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { TextInput } from '../../../common/components/index.js'
import { linkSocialAccount } from '../api/socialLoginApi.js'
import { LOGIN_FAILED_MESSAGE } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import { SOCIAL_PROVIDERS, toSocialErrorMessage } from '../socialLoginConfig.js'

// N-01-6 처음 연결하는 소셜 계정 — 기존 계정에 연결하거나, 제공자에게 받은 이름·이메일을 채운 가입 화면으로 보낸다.
// 값은 화면 이동 상태로만 받으며, 이동 상태 없이 들어오면 로그인 화면으로 보낸다.
export default function SocialLinkPage() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)

  if (!state?.linkKey) return <Navigate to={AUTH_PATHS.LOGIN} replace />

  const providerName = SOCIAL_PROVIDERS.find((provider) => provider.key === state.provider)?.name ?? '소셜'

  // N-01-6 새로 가입 — 이름·이메일과 임시 연결 키를 화면 이동 상태로 가입 화면에 넘긴다.
  const handleSignup = () => {
    navigate(AUTH_PATHS.SIGNUP, {
      state: { socialSignup: { linkKey: state.linkKey, name: state.profile?.name, email: state.profile?.email } },
    })
  }

  // N-01-6 기존 계정에 연결 — 성공하면 로그인 상태가 되어 역할별 첫 화면으로 이동한다. 실패 문구는 무엇이 틀렸는지 알려 주지 않는다.
  const handleLink = async (event) => {
    event.preventDefault()
    const errors = {}
    if (!loginId.trim()) errors.loginId = '아이디를 입력해 주세요.'
    if (!password) errors.password = '비밀번호를 입력해 주세요.'
    setFieldErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    setPending(true)
    try {
      const { accessToken, user } = await linkSocialAccount({ linkKey: state.linkKey, loginId: loginId.trim(), password })
      loginWithToken(accessToken, user)
    } catch (error) {
      setPassword('')
      setFormError(toSocialErrorMessage(error, LOGIN_FAILED_MESSAGE))
      setPending(false)
    }
  }

  return (
    <section className="auth-page social-link-page">
      <h1 className="auth-page__title">소셜 계정 연결</h1>
      <p className="auth-page__message">{providerName} 계정을 처음 연결합니다. 진행할 방법을 골라 주세요.</p>
      <div className="social-link-page__choices">
        <button type="button" className="social-link-page__choice" onClick={() => setShowLinkForm(true)}>
          기존 계정에 연결
        </button>
        <button type="button" className="social-link-page__choice" onClick={handleSignup}>
          새로 가입
        </button>
      </div>
      {showLinkForm && (
        <form className="auth-form social-link-form" onSubmit={handleLink} noValidate>
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
            {pending ? '연결 중…' : '연결하고 로그인'}
          </button>
        </form>
      )}
    </section>
  )
}
