import { useNavigate } from 'react-router-dom'
import { startSocialLogin } from '../api/socialLoginApi.js'
import { SOCIAL_PROVIDERS } from '../socialLoginConfig.js'

// 제공자별 작은 브랜드 아이콘(18px) — 버튼은 모두 같은 흰 바탕·얇은 테두리이고 브랜드 색은 아이콘에만 쓴다
const ICONS = {
  google: (
    <>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </>
  ),
  kakao: (
    <>
      <rect width="24" height="24" rx="6" fill="#FEE500" />
      <path fill="#191600" d="M12 6c-3.9 0-7 2.4-7 5.4 0 1.9 1.3 3.6 3.2 4.6l-.7 2.6 3-2c.5.1 1 .1 1.5.1 3.9 0 7-2.4 7-5.3S15.9 6 12 6z" />
    </>
  ),
  naver: (
    <>
      <rect width="24" height="24" rx="6" fill="#03C75A" />
      <path fill="#ffffff" d="M13.6 12.4 10.2 7.5H7.5v9h2.9v-4.9l3.4 4.9h2.7v-9h-2.9z" />
    </>
  ),
}

// N-01-6 소셜 로그인 버튼 — 설정의 제공자 목록대로 아이콘 + 글자 버튼을 그린다.
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
          {ICONS[provider.key] && (
            <svg className="social-login__icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              {ICONS[provider.key]}
            </svg>
          )}
          {provider.name}로 로그인
        </button>
      ))}
    </div>
  )
}
