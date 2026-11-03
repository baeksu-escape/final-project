import { useState } from 'react'
import { FieldError, TextInput } from '../../../common/components/index.js'
import { USE_MOCK } from '../../../common/config/env.js'
import { requestEmailCode, verifyEmailCode } from '../api/authFeatureApi.js'
import { MOCK_EMAIL_CODE } from '../mocks/authMockData.js'
import { isValidEmail } from '../validation.js'

// N-02·N-03 이메일 인증코드 발송·확인 — 회원가입, 비밀번호 찾기, 마이페이지(FP-93) 이메일 변경에서 함께 쓴다.
// 이메일 입력 칸은 부모 화면이 갖고, 이 컴포넌트는 [인증코드 받기] → 코드 입력 → [확인]만 맡는다.
// 사용 예:
//   const [verification, setVerification] = useState(null)   // { email, verificationToken }
//   <EmailVerification
//     email={email}
//     purpose={EMAIL_PURPOSES.SIGNUP}                         // SIGNUP | RESET_PASSWORD | CHANGE_EMAIL
//     verified={verification?.email === email}               // 인증받은 이메일과 지금 이메일이 같을 때만 완료
//     onVerified={setVerification}
//   />
//   extraBody: 요청에 함께 보낼 값(예: 비밀번호 찾기의 { loginId }). disabled: 발송을 막을 때.
//   이메일이 바뀌면 발송 전 상태로 돌아가므로 부모가 따로 초기화하지 않아도 된다.
export default function EmailVerification({ email, purpose, extraBody, disabled = false, verified = false, onVerified }) {
  const [sentTo, setSentTo] = useState(null)
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (verified) {
    return (
      <div className="email-verification email-verification--verified">
        <p className="email-verification__done" role="status">
          이메일 인증이 완료되었습니다.
        </p>
      </div>
    )
  }

  // 코드를 보낸 이메일과 지금 입력된 이메일이 같을 때만 코드 입력 칸을 보여 준다.
  const sent = sentTo !== null && sentTo === email
  const canSend = !disabled && !pending && isValidEmail(email)

  const handleSend = async () => {
    setPending(true)
    setError('')
    setNotice('')
    try {
      const { expiresInSeconds } = await requestEmailCode({ ...extraBody, email, purpose })
      setSentTo(email)
      setCode('')
      setNotice(`인증코드를 보냈습니다. ${Math.ceil(expiresInSeconds / 60)}분 안에 입력해 주세요.`)
    } catch (sendError) {
      setError(sendError.message)
    } finally {
      setPending(false)
    }
  }

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('6자리 인증코드를 입력해 주세요.')
      return
    }
    setPending(true)
    setError('')
    try {
      const { verificationToken } = await verifyEmailCode({ ...extraBody, email, code, purpose })
      onVerified({ email, verificationToken })
    } catch (verifyError) {
      setError(verifyError.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="email-verification">
      <button type="button" className="email-verification__send" onClick={handleSend} disabled={!canSend}>
        {sent ? '인증코드 다시 받기' : '인증코드 받기'}
      </button>
      {sent && (
        <>
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
        </>
      )}
      <FieldError message={error} />
    </div>
  )
}
