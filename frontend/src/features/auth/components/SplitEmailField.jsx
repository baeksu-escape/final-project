import { useId, useState } from 'react'
import { FieldError, TextInput } from '../../../common/components/index.js'
import { USE_MOCK } from '../../../common/config/env.js'
import { requestEmailCode, verifyEmailCode } from '../api/authFeatureApi.js'
import { CUSTOM_EMAIL_DOMAIN, EMAIL_DOMAIN_OPTIONS, resolveEmailDomain } from '../emailParts.js'
import { MOCK_EMAIL_CODE } from '../mocks/authMockData.js'
import useImeSafeFilter from '../useImeSafeFilter.js'
import { filterEmailDomain, filterEmailLocal, joinEmail, validateEmailParts } from '../validation.js'

// 발송·확인 흐름의 처음 상태. target은 이 상태가 가리키는 이메일이고, status는 'idle'(발송 전)·'sent'(코드 보냄)·'error'(실패) 중 하나다.
// codeOpen은 코드를 한 번 보내서 코드 칸이 열려 있는지다(실패해도 다시 입력할 수 있게 남긴다).
const IDLE_FLOW = { target: null, status: 'idle', message: '', codeOpen: false }

// N-02-3·N-03 이메일 한 줄 칸(11/18 1차 시연 후속) — `[앞부분] @ [도메인 선택] [인증코드 받기]` 한 줄과, 받은 뒤 열리는 코드 확인 칸.
// 회원가입과 비밀번호 찾기가 함께 쓴다. 발송·확인 API와 속성 이름(purpose·extraBody·disabled)은 EmailVerification과 같다
// (EmailVerification은 마이 페이지 이메일 변경에서 그대로 쓴다).
// 사용 예:
//   <SplitEmailField
//     local={form.emailLocal} domainChoice={form.emailDomainChoice} customDomain={form.emailCustomDomain}
//     onChange={(patch) => ...}                                   // { emailLocal?, emailDomainChoice?, emailCustomDomain? }
//     purpose={EMAIL_PURPOSES.SIGNUP}                             // SIGNUP | RESET_PASSWORD
//     extraBody={{ loginId }}                                     // 요청에 함께 보낼 값(비밀번호 찾기). disabled: 발송을 막을 때.
//     verified={verification?.email === email}
//     onVerified={setVerification}                                // { email, verificationToken }
//     error={errors.email}
//   />
//   FP-258 앞부분·직접 입력 도메인은 filterEmailLocal·filterEmailDomain으로 거른다(한글 조합은 끝날 때, useImeSafeFilter).
//   문구는 한 번에 하나만 보인다: 완료 / (실패 > 부모 오류 > 발송 안내). 이메일을 고치면 발송·코드·오류·안내를 모두 비운다.
//   FP-258 beforeRequest: [받기]·[확인] 요청 전에 부른다. false를 돌려주면 보내지 않는다(아이디·비밀번호 찾기의 이름 검사). 없으면 그대로 보낸다.
export default function SplitEmailField({
  local,
  domainChoice,
  customDomain,
  onChange,
  purpose,
  extraBody,
  disabled = false,
  verified = false,
  onVerified,
  error,
  beforeRequest,
}) {
  const id = useId()
  const [flow, setFlow] = useState(IDLE_FLOW)
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const bindFilter = useImeSafeFilter()
  const localInput = bindFilter((value) => handleEmailChange({ emailLocal: value }), filterEmailLocal)
  const domainInput = bindFilter((value) => handleEmailChange({ emailCustomDomain: value }), filterEmailDomain)

  const domain = resolveEmailDomain(domainChoice, customDomain)
  const email = joinEmail(local, domain)
  // 지금 이메일에 대한 상태만 쓴다. 다른 이메일에서 남은 안내·오류는 보이지 않는다.
  const current = flow.target === email ? flow : IDLE_FLOW
  const canSend = !verified && !disabled && !pending && validateEmailParts(local, domain) === ''

  // 이메일 칸(앞부분·도메인)을 고치면 발송·코드·오류·안내를 모두 비운다.
  const handleEmailChange = (patch) => {
    setFlow(IDLE_FLOW)
    setCode('')
    onChange(patch)
  }

  const handleSend = async () => {
    if (beforeRequest && !beforeRequest()) return
    setPending(true)
    try {
      const { expiresInSeconds } = await requestEmailCode({ ...extraBody, email, purpose })
      setCode('')
      setFlow({
        target: email,
        status: 'sent',
        message: `인증코드를 보냈습니다. ${Math.ceil(expiresInSeconds / 60)}분 안에 입력해 주세요.`,
        codeOpen: true,
      })
    } catch (sendError) {
      setFlow({ ...current, target: email, status: 'error', message: sendError.message })
    } finally {
      setPending(false)
    }
  }

  const handleVerify = async () => {
    if (beforeRequest && !beforeRequest()) return
    if (!/^\d{6}$/.test(code)) {
      setFlow({ ...current, status: 'error', message: '6자리 인증코드를 입력해 주세요.' })
      return
    }
    setPending(true)
    try {
      const { verificationToken } = await verifyEmailCode({ ...extraBody, email, code, purpose })
      setFlow(IDLE_FLOW)
      setCode('')
      onVerified({ email, verificationToken })
    } catch (verifyError) {
      setFlow({ ...current, status: 'error', message: verifyError.message })
    } finally {
      setPending(false)
    }
  }

  // 완료가 아닐 때 보일 문구 하나 — 이 칸의 실패가 먼저, 다음은 부모가 준 오류(형식·인증 필요·서버 칸 오류), 마지막이 발송 안내다.
  const renderMessage = () => {
    if (current.status === 'error') return <FieldError message={current.message} />
    if (error) return <FieldError message={error} />
    if (current.status === 'sent') {
      return (
        <p className="auth-message" role="status">
          {current.message}
        </p>
      )
    }
    return null
  }

  const invalid = error ? true : undefined
  return (
    <div className="form-field signup-email">
      <label htmlFor={`${id}-local`} className="form-field__label">
        이메일
      </label>
      <div className="signup-form__row">
        <input
          id={`${id}-local`}
          className="text-input__control signup-form__grow"
          value={local}
          onChange={(event) => localInput.onChange(event.target.value)}
          {...localInput.compositionProps}
          placeholder="이메일"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          aria-invalid={invalid}
        />
        <span className="signup-form__fixed">@</span>
        {domainChoice === CUSTOM_EMAIL_DOMAIN && (
          <input
            className="text-input__control signup-form__grow"
            value={customDomain}
            onChange={(event) => domainInput.onChange(event.target.value)}
            {...domainInput.compositionProps}
            placeholder="example.com"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            aria-label="이메일 도메인 직접 입력"
            aria-invalid={invalid}
          />
        )}
        <select
          className="select__control"
          value={domainChoice}
          onChange={(event) => handleEmailChange({ emailDomainChoice: event.target.value })}
          aria-label="이메일 도메인 선택"
          aria-invalid={invalid}
        >
          <option value="">도메인 선택</option>
          {EMAIL_DOMAIN_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={CUSTOM_EMAIL_DOMAIN}>직접 입력</option>
        </select>
        {!verified && (
          <button type="button" className="email-verification__send" onClick={handleSend} disabled={!canSend}>
            {current.codeOpen ? '인증코드 다시 받기' : '인증코드 받기'}
          </button>
        )}
      </div>
      {verified ? (
        <p className="auth-message auth-message--success" role="status">
          이메일 인증이 완료되었습니다.
        </p>
      ) : (
        <>
          {current.codeOpen && (
            <div className="email-verification">
              {USE_MOCK && <p className="email-verification__mock-hint">개발용 mock 인증코드: {MOCK_EMAIL_CODE}</p>}
              <TextInput
                label="인증코드"
                value={code}
                onChange={(value) => setCode(value.replace(/\D/g, ''))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
              <button type="button" className="email-verification__verify" onClick={handleVerify} disabled={pending}>
                인증코드 확인
              </button>
            </div>
          )}
          {renderMessage()}
        </>
      )}
    </div>
  )
}
