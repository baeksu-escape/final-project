import { useState } from 'react'
import { resolveEmailDomain } from './emailParts.js'
import useBlurCheck from './useBlurCheck.js'
import { joinEmail, validateEmailParts } from './validation.js'

// FP-258 N-03-1·N-03-2 찾기 화면 이메일 칸(기존 이메일) — 앞부분·도메인 선택·직접 입력 값과 합친 email, 묶음을 벗어날 때의 기본 형식 검사.
// 사용 예: const emailField = useExistingEmailParts() → <div onBlur={emailField.onBlur}><SplitEmailField {...emailField.fieldProps} purpose={…} … /></div>
export default function useExistingEmailParts() {
  const [parts, setParts] = useState({ emailLocal: '', emailDomainChoice: '', emailCustomDomain: '' })
  const domain = resolveEmailDomain(parts.emailDomainChoice, parts.emailCustomDomain)
  const check = useBlurCheck(
    () => validateEmailParts(parts.emailLocal, domain, 'existing'),
    () => Boolean(parts.emailLocal || parts.emailCustomDomain),
  )
  return {
    email: joinEmail(parts.emailLocal, domain),
    onBlur: check.onBlur,
    // SplitEmailField에 그대로 넘길 칸 값·변경·오류
    fieldProps: {
      rule: 'existing',
      local: parts.emailLocal,
      domainChoice: parts.emailDomainChoice,
      customDomain: parts.emailCustomDomain,
      onChange: (patch) => setParts((prev) => ({ ...prev, ...patch })),
      error: check.error,
    },
  }
}
