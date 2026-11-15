import { useEffect, useState } from 'react'
import { Button, TextInput } from '../../../common/components/index.js'
import { USE_MOCK } from '../../../common/config/env.js'
import { verifyAdminLoginCode } from '../../admin/api/adminAuthApi.js'
import { CODE_LENGTH, RESEND_WAIT_SECONDS, adminErrorMessage } from '../../admin/adminConstants.js'
import { MOCK_EMAIL_CODE } from '../mocks/authMockData.js'

// N-01-1 관리자 로그인 2단계 인증 — 업무 이메일로 받은 6자리 번호를 넣는다(로그인 화면 안의 단계).
// challenge: { challengeToken, maskedEmail }. 부모가 key={challengeToken}으로 넘겨, 다시 보내면 입력과 대기 시간이 새로 시작된다.
//   onVerified(AUTH-11 응답): 번호 확인 성공. onResend(): 같은 아이디·비밀번호로 로그인을 다시 부른다(1분에 1번). onRestart(): 처음 로그인 칸으로.
export default function AdminTwoFactorStep({ challenge, onVerified, onResend, onRestart }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [canResend, setCanResend] = useState(false)

  // 번호를 보낸 뒤 1분이 지나야 [다시 보내기]를 누를 수 있다(서버는 더 빨리 부르면 429).
  useEffect(() => {
    const timer = setTimeout(() => setCanResend(true), RESEND_WAIT_SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
      setError(`${CODE_LENGTH}자리 번호를 넣어 주세요.`)
      return
    }
    setPending(true)
    setError('')
    try {
      const result = await verifyAdminLoginCode(challenge.challengeToken, code)
      onVerified(result)
    } catch (verifyError) {
      setError(adminErrorMessage(verifyError))
      setPending(false)
    }
  }

  const handleResend = async () => {
    setPending(true)
    setError('')
    try {
      await onResend()
    } catch (resendError) {
      setError(adminErrorMessage(resendError))
      setPending(false)
    }
  }

  return (
    <form className="auth-form login-form" onSubmit={handleSubmit} noValidate>
      <p>
        업무 이메일({challenge.maskedEmail})로 보낸 {CODE_LENGTH}자리 번호를 넣어 주세요.
      </p>
      {USE_MOCK && <p>개발용 mock 인증번호: {MOCK_EMAIL_CODE}</p>}
      <TextInput
        label={`인증번호 ${CODE_LENGTH}자리`}
        value={code}
        onChange={(value) => setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        error={error}
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={CODE_LENGTH}
      />
      <button type="submit" className="auth-form__submit" disabled={pending}>
        {pending ? '확인 중…' : '확인'}
      </button>
      <Button onClick={handleResend} disabled={!canResend || pending}>
        다시 보내기
      </Button>
      {!canResend && <p>번호를 다시 받으려면 1분 뒤에 [다시 보내기]를 눌러 주세요.</p>}
      <Button onClick={onRestart}>처음으로</Button>
    </form>
  )
}
