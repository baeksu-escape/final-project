// N-02-3 회원가입 이메일 칸 도우미(11/18 1차 시연 후속) — 이메일을 앞부분 + 도메인(선택 상자 또는 직접 입력)으로 나눠 받는다.

// 도메인 선택지. CUSTOM을 고르면 도메인 입력 칸이 열린다.
export const EMAIL_DOMAIN_OPTIONS = Object.freeze(['naver.com', 'gmail.com'])
export const CUSTOM_EMAIL_DOMAIN = 'CUSTOM'

// 선택 상자 값과 직접 입력 값으로 최종 도메인을 정한다.
export function resolveEmailDomain(domainChoice, customDomain) {
  return domainChoice === CUSTOM_EMAIL_DOMAIN ? customDomain : domainChoice
}

// 미리 채워 온 이메일(간편 로그인 가입)을 앞부분·선택지·직접 입력 값으로 나눈다. 목록에 없는 도메인은 '직접 입력'으로 둔다.
export function splitEmail(email) {
  const text = String(email ?? '').trim()
  const at = text.lastIndexOf('@')
  if (!text || at < 0) return { emailLocal: text, emailDomainChoice: '', emailCustomDomain: '' }
  const domain = text.slice(at + 1)
  const known = EMAIL_DOMAIN_OPTIONS.includes(domain)
  return {
    emailLocal: text.slice(0, at),
    emailDomainChoice: known ? domain : CUSTOM_EMAIL_DOMAIN,
    emailCustomDomain: known ? '' : domain,
  }
}
