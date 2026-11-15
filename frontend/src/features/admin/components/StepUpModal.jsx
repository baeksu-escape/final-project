import { useState } from 'react'
import { Button, Modal, Notice, TextInput } from '../../../common/components/index.js'
import { USE_MOCK } from '../../../common/config/env.js'
import { MOCK_EMAIL_CODE } from '../../auth/mocks/authMockData.js'
import { sendStepUpCode, verifyStepUpCode } from '../api/adminAuthApi.js'
import { CODE_LENGTH, adminErrorMessage } from '../adminConstants.js'
import { useAdminErrorHandler } from '../useAdminErrorHandler.js'

// FP-80 관리자 재확인(step-up) 모달 — [번호 보내기] → 6자리 입력 → 받은 stepUpToken을 onVerified로 넘긴다.
// 토큰은 상태에도 저장하지 않고 바로 넘긴다. 부르는 쪽은 그 요청 한 번에만 쓰고 버린다.
// 사용 예: <StepUpModal open={open} purpose="관리자 계정을 만들기 전에" onVerified={(token) => save(token)} onClose={() => setOpen(false)} />
export default function StepUpModal({ open, purpose, onVerified, onClose }) {
  return (
    <Modal open={open} title="본인 재확인" onClose={onClose}>
      {/* 열 때마다 입력 상태를 새로 시작하도록 열려 있을 때만 그린다. */}
      {open && <StepUpBody purpose={purpose} onVerified={onVerified} onClose={onClose} />}
    </Modal>
  )
}

// 재확인 모달 안쪽 — 번호 보내기와 확인을 맡는다.
function StepUpBody({ purpose, onVerified, onClose }) {
  const handleAdminError = useAdminErrorHandler()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  // 업무 이메일로 재확인 번호를 보낸다. 다시 누르면 새 번호를 보낸다.
  const handleSend = async () => {
    setPending(true)
    setError('')
    try {
      await sendStepUpCode()
      setSent(true)
      setCode('')
    } catch (sendError) {
      if (await handleAdminError(sendError)) return
      setError(adminErrorMessage(sendError))
    } finally {
      setPending(false)
    }
  }

  // 번호를 확인하고 받은 토큰을 바로 넘긴다.
  const handleVerify = async (event) => {
    event.preventDefault()
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
      setError(`${CODE_LENGTH}자리 번호를 넣어 주세요.`)
      return
    }
    setPending(true)
    setError('')
    try {
      const { stepUpToken } = await verifyStepUpCode(code)
      onVerified(stepUpToken)
    } catch (verifyError) {
      if (await handleAdminError(verifyError)) return
      setError(adminErrorMessage(verifyError))
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleVerify} noValidate>
      <p>{purpose} 본인을 한 번 더 확인합니다. 업무 이메일로 받은 {CODE_LENGTH}자리 번호를 넣어 주세요.</p>
      <Button onClick={handleSend} disabled={pending}>
        {sent ? '번호 다시 보내기' : '번호 보내기'}
      </Button>
      {sent && (
        <>
          <Notice type="info">번호를 보냈습니다. 5분 안에 넣어 주세요.</Notice>
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
          <Button type="submit" variant="primary" disabled={pending}>
            확인
          </Button>
        </>
      )}
      {!sent && error && <p role="alert">{error}</p>}
      <Button onClick={onClose}>취소</Button>
    </form>
  )
}
