import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { requestLogin } from '../../../common/api/authApi.js'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button, TextInput, Toast } from '../../../common/components/index.js'
import { pickAccessToken } from '../../admin/api/adminAuthApi.js'
import AdminPasswordSetupForm from '../../admin/components/AdminPasswordSetupForm.jsx'
import AdminTwoFactorStep from '../components/AdminTwoFactorStep.jsx'
// 로그인 mock 응답(잠긴 계정·가입자 포함)을 등록하기 위해 불러온다.
import '../api/authFeatureApi.js'
import { ACCOUNT_LOCKED_MESSAGE, AUTH_ERROR_CODES, LOGIN_FAILED_MESSAGE } from '../authConstants.js'
import { AUTH_PATHS } from '../authPaths.js'
import AuthLinks from '../components/AuthLinks.jsx'
import PasswordField from '../components/PasswordField.jsx'
import SocialLoginButtons from '../components/SocialLoginButtons.jsx'
import useImeSafeFilter from '../useImeSafeFilter.js'
import usePasswordReveal from '../usePasswordReveal.js'
import { filterLoginId } from '../validation.js'
import '../auth.css'

// 로그인 실패 원인을 화면 문구로 바꾼다. 아이디·비밀번호 중 무엇이 틀렸는지는 알려 주지 않는다.
function toLoginErrorMessage(error) {
  if (error?.data?.code === AUTH_ERROR_CODES.ACCOUNT_LOCKED) return ACCOUNT_LOCKED_MESSAGE
  // 관리자 로그인 준비 중 안내는 서버 문구를 그대로 보여 준다(비밀번호가 틀렸다고 잘못 보이지 않게).
  if (error?.data?.code === AUTH_ERROR_CODES.ADMIN_2FA_NOT_READY) return error.message
  // FP-80 관리자 인증번호를 1분 안에 다시 요청하면 429 — 서버 문구(잠시 뒤 다시 시도)를 그대로 보여 준다.
  // FP-258 로그인 5회 실패 뒤 5분 제한(429 LOGIN_TEMPORARILY_BLOCKED)도 남은 분이 담긴 서버 문구를 그대로 보여 준다.
  if (error?.status === 0 || error?.status === 429) return error.message
  return LOGIN_FAILED_MESSAGE
}

// N-01 로그인 화면 — 성공하면 공통 인증 구조가 토큰을 저장하고, GuestOnlyRoute가 역할에 맞는 첫 화면으로 보낸다.
// FP-80 관리자는 비밀번호가 맞으면 같은 화면에서 2단계 인증(6자리) 단계로, 첫 로그인이면 이어서 비밀번호 설정 단계로 바뀐다.
//   1회용 토큰(challengeToken·passwordSetupToken)과 [다시 보내기]용 비밀번호는 이 화면 상태에만 두고 저장하지 않는다.
export default function LoginPage() {
  const { loginWithToken, notice: pendingNotice, clearNotice } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  // N-01-6 소셜 로그인 콜백이 돌려보내며 넘긴 안내 문구(관리자 차단·잠금·취소·오류).
  const socialMessage = location.state?.socialMessage
  // N-04-7 로그아웃할 때 맡겨 둔 알림(예: 회원 탈퇴 뒤 '탈퇴를 마쳤습니다.'). 들어올 때 이 화면 상태로 옮겨 토스트로 잠깐 보여 준다.
  const [notice, setNotice] = useState(pendingNotice)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [pending, setPending] = useState(false)
  // FP-80 관리자 2단계 인증 정보 { challengeToken, maskedEmail }. null이면 아이디·비밀번호 단계다.
  const [challenge, setChallenge] = useState(null)
  // FP-80 첫 비밀번호 설정 토큰. 있으면 비밀번호 설정 단계다.
  const [passwordSetupToken, setPasswordSetupToken] = useState(null)
  // FP-258 2차 비밀번호 [보기] 상태. 로그인 요청 직전에 가린다.
  const { reveal, hideAll } = usePasswordReveal()
  // FP-258 3차 한글 조합 중에는 거르지 않고 조합이 끝날 때 한 번 거른다(useImeSafeFilter). 공통 TextInput 대신 감싼 div가 조합 이벤트를 받는다.
  const loginIdInput = useImeSafeFilter()(setLoginId, filterLoginId)

  // 맡아 둔 알림은 한 번만 쓴다. 꺼낸 뒤 바로 비워서 다음 로그아웃 때 다시 뜨지 않게 한다.
  useEffect(() => {
    if (pendingNotice) clearNotice()
  }, [pendingNotice, clearNotice])

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
      const result = await requestLogin(loginId.trim(), password)
      // FP-258 2차 성공해 다음 화면(관리자 2단계 인증·첫 화면)으로 넘어가기 직전에만 가린다. 실패하면 보기 상태를 그대로 둔다.
      hideAll()
      if (result.twoFactorRequired) {
        setChallenge({ challengeToken: result.challengeToken, maskedEmail: result.maskedEmail })
        setPending(false)
        return
      }
      loginWithToken(result.accessToken, result.user)
    } catch (error) {
      setPassword('')
      setFormError(toLoginErrorMessage(error))
      setPending(false)
    }
  }

  // FP-80 [다시 보내기] — 같은 아이디·비밀번호로 로그인(AUTH-01)을 다시 불러 새 번호를 받는다. 실패하면 오류를 그대로 던진다(429 포함).
  const handleResend = async () => {
    const result = await requestLogin(loginId.trim(), password)
    setChallenge({ challengeToken: result.challengeToken, maskedEmail: result.maskedEmail })
    setNotice('인증번호를 다시 보냈습니다.')
  }

  // FP-80 2단계 인증 성공 — 첫 로그인이면 비밀번호 설정 단계로, 아니면 받은 토큰으로 로그인한다(관리자 첫 화면으로 이동).
  const handleVerified = (result) => {
    setChallenge(null)
    if (result.passwordChangeRequired) {
      setPasswordSetupToken(result.passwordSetupToken)
      return
    }
    setPassword('')
    loginWithToken(pickAccessToken(result), result.user)
  }

  // FP-80 첫 비밀번호 설정 성공 — 받은 토큰으로 로그인을 마친다.
  const handlePasswordSetupDone = (result) => {
    setPasswordSetupToken(null)
    setPassword('')
    loginWithToken(pickAccessToken(result), result.user)
  }

  // FP-80 [처음으로] — 1회용 토큰과 비밀번호를 버리고 아이디·비밀번호 단계로 돌아간다.
  const handleRestart = () => {
    setChallenge(null)
    setPasswordSetupToken(null)
    setPassword('')
    setFormError('')
  }

  if (passwordSetupToken) {
    return (
      <section className="auth-page login-page">
        <h1 className="auth-page__title">관리자 비밀번호 설정</h1>
        <AdminPasswordSetupForm passwordSetupToken={passwordSetupToken} onDone={handlePasswordSetupDone} onRestart={handleRestart} />
      </section>
    )
  }

  if (challenge) {
    return (
      <section className="auth-page login-page">
        <h1 className="auth-page__title">관리자 2단계 인증</h1>
        <AdminTwoFactorStep
          key={challenge.challengeToken}
          challenge={challenge}
          onVerified={handleVerified}
          onResend={handleResend}
          onRestart={handleRestart}
        />
        <Toast message={notice} onClose={() => setNotice('')} />
      </section>
    )
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
        <div {...loginIdInput.compositionProps}>
          <TextInput
            label="아이디"
            value={loginId}
            onChange={loginIdInput.onChange}
            error={fieldErrors.loginId}
            autoComplete="username"
          />
        </div>
        <PasswordField
          label="비밀번호"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="current-password"
          {...reveal('password')}
        />
        {formError && (
          <p className="auth-form__error" role="alert">
            {formError}
          </p>
        )}
        {/* FP-258 잠긴 계정은 비밀번호 재설정으로 풀린다 — 안내 바로 아래에 비밀번호 찾기로 가는 글자 링크를 둔다. */}
        {formError === ACCOUNT_LOCKED_MESSAGE && (
          <Link to={AUTH_PATHS.FIND_PASSWORD} className="text-link">
            비밀번호 찾기
          </Link>
        )}
        {/* 11/18 1차 시연 후속: 헤더 버튼을 하나로 합쳐서, 회원가입은 [로그인] 옆 보조 버튼으로 들어간다(좌우 한 줄, 아주 좁은 창에서만 위아래). 아래 링크 줄에서는 [회원가입]을 뺀다. */}
        <div className="login-form__actions">
          <button type="submit" className="auth-form__submit" disabled={pending}>
            {pending ? '로그인 중…' : '로그인'}
          </button>
          <Button onClick={() => navigate(AUTH_PATHS.SIGNUP)}>회원가입</Button>
        </div>
      </form>
      <SocialLoginButtons />
      <AuthLinks exclude={[AUTH_PATHS.SIGNUP]} />
      <Toast message={notice} onClose={() => setNotice('')} />
    </section>
  )
}
