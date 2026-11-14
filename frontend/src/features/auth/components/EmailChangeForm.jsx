import { useState } from 'react'
import { TextInput } from '../../../common/components/index.js'
import { requestEmailChange } from '../api/myPageApi.js'
import { EMAIL_PURPOSES } from '../authConstants.js'
import EmailVerification from './EmailVerification.jsx'

// N-04-3 이메일 바꾸기 폼 — 새 이메일을 FP-87 이메일 인증(N-02-3)으로 확인한 경우에만 저장을 요청한다.
// 저장에 성공하면 onSaved(안내 문구)를 부르고, [취소]는 onCancel을 부른다.
export default function EmailChangeForm({ onSaved, onCancel }) {
  const [email, setEmail] = useState('')
  const [verification, setVerification] = useState(null) // { email, verificationToken }
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  // 인증받은 뒤 이메일을 고치면 인증이 풀린 것으로 본다.
  const verified = verification !== null && verification.email === email

  // 인증 토큰과 함께 새 이메일을 저장한다. 실패하면 인증을 다시 받을 수 있도록 인증 상태를 지운다.
  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!verified) {
      setError('새 이메일 인증을 완료해 주세요.')
      return
    }
    setPending(true)
    setError('')
    try {
      await requestEmailChange({ email: verification.email, emailVerificationToken: verification.verificationToken })
      onSaved('이메일을 바꿨습니다.')
    } catch (saveError) {
      setError(saveError.message)
      setVerification(null)
      setPending(false)
    }
  }

  return (
    <form className="account-form email-change-form" onSubmit={handleSubmit} noValidate>
      <TextInput label="새 이메일" type="email" value={email} onChange={setEmail} autoComplete="email" />
      <EmailVerification
        email={email}
        purpose={EMAIL_PURPOSES.CHANGE_EMAIL}
        verified={verified}
        onVerified={setVerification}
      />
      {error && (
        <p className="account-form__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="account-form__submit" disabled={!verified || pending}>
        이메일 저장
      </button>
      <button type="button" className="account-form__cancel" onClick={onCancel}>
        취소
      </button>
    </form>
  )
}
