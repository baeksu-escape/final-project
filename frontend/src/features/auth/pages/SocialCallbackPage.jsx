import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../common/auth/useAuth.js'
import { exchangeSocialCode } from '../api/socialLoginApi.js'
import { AUTH_PATHS } from '../authPaths.js'
import {
  SOCIAL_CANCEL_ERROR,
  SOCIAL_CANCELLED_MESSAGE,
  SOCIAL_EXCHANGE_RESULTS,
  SOCIAL_FAILED_MESSAGE,
  SOCIAL_PATHS,
  toSocialErrorMessage,
} from '../socialLoginConfig.js'

// N-01-6 소셜 로그인 콜백 — 일회용 코드를 토큰으로 바꾸고 결과에 따라 화면을 나눈다.
// 연결된 계정이면 로그인 상태가 바뀌면서 GuestOnlyRoute가 역할별 첫 화면으로 보낸다.
export default function SocialCallbackPage() {
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const startedRef = useRef(false)

  useEffect(() => {
    // 일회용 코드는 한 번만 보낸다(개발 모드의 이중 실행 방지).
    if (startedRef.current) return
    startedRef.current = true

    const backToLogin = (message) => navigate(AUTH_PATHS.LOGIN, { replace: true, state: { socialMessage: message } })
    const code = searchParams.get('code')
    if (!code) {
      backToLogin(searchParams.get('error') === SOCIAL_CANCEL_ERROR ? SOCIAL_CANCELLED_MESSAGE : SOCIAL_FAILED_MESSAGE)
      return
    }

    // 새로고침해도 같은 코드를 다시 쓰지 않도록 교환 전에 주소창에서 지운다.
    setSearchParams({}, { replace: true })
    exchangeSocialCode(code)
      .then((response) => {
        if (response.result === SOCIAL_EXCHANGE_RESULTS.LINKED) {
          loginWithToken(response.accessToken, response.user)
        } else if (response.result === SOCIAL_EXCHANGE_RESULTS.LINK_REQUIRED) {
          const { linkKey, provider, profile } = response
          navigate(SOCIAL_PATHS.LINK, { replace: true, state: { linkKey, provider, profile } })
        } else {
          backToLogin(SOCIAL_FAILED_MESSAGE)
        }
      })
      .catch((error) => backToLogin(toSocialErrorMessage(error, SOCIAL_FAILED_MESSAGE)))
  }, [searchParams, setSearchParams, navigate, loginWithToken])

  return <p className="social-callback__message">소셜 로그인을 처리하는 중입니다.</p>
}
