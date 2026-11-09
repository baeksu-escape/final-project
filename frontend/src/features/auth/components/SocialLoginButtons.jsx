import { useNavigate } from 'react-router-dom'
import { startSocialLogin } from '../api/socialLoginApi.js'
import { SOCIAL_PROVIDERS } from '../socialLoginConfig.js'

// N-01-6 소셜 로그인 버튼 — 설정의 제공자 목록대로 글자 버튼을 그린다.
export default function SocialLoginButtons() {
  const navigate = useNavigate()
  return (
    <div className="social-login">
      {SOCIAL_PROVIDERS.map((provider) => (
        <button
          key={provider.key}
          type="button"
          className={`social-login__button social-login__button--${provider.key}`}
          onClick={() => startSocialLogin(provider.key, navigate)}
        >
          {provider.name}로 로그인
        </button>
      ))}
    </div>
  )
}
