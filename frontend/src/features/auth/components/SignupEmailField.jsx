import { useId, useState } from 'react'
import { FieldError, TextInput } from '../../../common/components/index.js'
import { USE_MOCK } from '../../../common/config/env.js'
import { requestEmailCode, verifyEmailCode } from '../api/authFeatureApi.js'
import { EMAIL_PURPOSES } from '../authConstants.js'
import { CUSTOM_EMAIL_DOMAIN, EMAIL_DOMAIN_OPTIONS, resolveEmailDomain } from '../emailParts.js'
import { MOCK_EMAIL_CODE } from '../mocks/authMockData.js'
import { joinEmail, validateEmailParts } from '../validation.js'

// N-02-3 회원가입 이메일 칸(11/18 1차 시연 후속) — `[앞부분] @ [도메인 선택] [인증코드 받기]` 한 줄과, 받은 뒤 열리는 코드 확인 칸.
// [인증코드 받기]를 이메일 줄에 두려고 가입 화면 전용으로 만들었다. 발송·확인 API와 흐름은 EmailVerification과 같다
// (EmailVerification은 비밀번호 찾기·마이 페이지에서 그대로 쓴다).
// 사용 예:
//   <SignupEmailField
//     local={form.emailLocal} domainChoice={form.emailDomainChoice} customDomain={form.emailCustomDomain}
//     onChange={(patch) => ...}                                   // { emailLocal?, emailDomainChoice?, emailCustomDomain? }
//     verified={verification?.email === email}
//     onVerified={setVerification}                                // { email, verificationToken }
//     error={errors.email}
//   />
export default function SignupEmailField({ local, domainChoice, customDomain, onChange, verified = false, onVerified, error }) {
  const id = useId()
  const [sentTo, setSentTo] = useState(null)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState(false)

  const domain = resolveEmailDomain(domainChoice, customDomain)
  const email = joinEmail(local, domain)
  const sent = sentTo !== null && sentTo === email
  const canSend = !verified && !pending && validateEmailParts(local, domain) === ''
  const purpose = EMAIL_PURPOSES.SIGNUP

  const handleSend = async () => {
    setPending(true)
    setActionError('')
    setNotice('')
    try {
      const { expiresInSeconds } = await requestEmailCode({ email, purpose })
      setSentTo(email)
      setCode('')
      setNotice(`인증코드를 보냈습니다. ${Math.ceil(expiresInSeconds / 60)}분 안에 입력해 주세요.`)
    } catch (sendError) {
      setActionError(sendError.message)
    } finally {
      setPending(false)
    }
  }

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setActionError('6자리 인증코드를 입력해 주세요.')
      return
    }
    setPending(true)
    setActionError('')
    try {
      const { verificationToken } = await verifyEmailCode({ email, code, purpose })
      onVerified({ email, verificationToken })
    } catch (verifyError) {
      setActionError(verifyError.message)
    } finally {
      setPending(false)
    }
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
          onChange={(event) => onChange({ emailLocal: event.target.value })}
          placeholder="이메일"
          autoComplete="email"
          aria-invalid={invalid}
        />
        <span className="signup-form__fixed">@</span>
        {domainChoice === CUSTOM_EMAIL_DOMAIN && (
          <input
            className="text-input__control signup-form__grow"
            value={customDomain}
            onChange={(event) => onChange({ emailCustomDomain: event.target.value })}
            placeholder="example.com"
            aria-label="이메일 도메인 직접 입력"
            aria-invalid={invalid}
          />
        )}
        <select
          className="select__control"
          value={domainChoice}
          onChange={(event) => onChange({ emailDomainChoice: event.target.value })}
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
            {sent ? '인증코드 다시 받기' : '인증코드 받기'}
          </button>
        )}
      </div>
      {verified ? (
        <p className="email-verification__done" role="status">
          이메일 인증이 완료되었습니다.
        </p>
      ) : (
        sent && (
          <div className="email-verification">
            {notice && (
              <p className="email-verification__notice" role="status">
                {notice}
              </p>
            )}
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
        )
      )}
      <FieldError message={error} />
      <FieldError message={actionError} />
    </div>
  )
}
