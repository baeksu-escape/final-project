import { useState } from 'react'
import { Button, Modal, TextInput } from '../../../common/components/index.js'
import { REASON_MAX_LENGTH } from '../adminConstants.js'

// N-27-3 계정 잠금 사유 입력 모달 — 사유를 넣고 [잠그기]를 누르면 onConfirm(사유)를 부른다. 저장은 부르는 쪽이 한다.
// 사용 예: <LockReasonModal target={row} pending={saving} error={lockError} onConfirm={lock} onClose={close} />   // target: 잠글 목록 한 줄 | null
export default function LockReasonModal({ target, pending, error, onConfirm, onClose }) {
  return (
    <Modal open={Boolean(target)} title="계정 잠금" onClose={onClose}>
      {target && <LockReasonBody target={target} pending={pending} error={error} onConfirm={onConfirm} onClose={onClose} />}
    </Modal>
  )
}

// 모달 안쪽 — 열 때마다 사유 칸을 비운다.
function LockReasonBody({ target, pending, error, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!reason.trim()) {
      setReasonError('잠금 사유를 넣어 주세요.')
      return
    }
    setReasonError('')
    onConfirm(reason.trim())
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p>
        <strong>{target.loginId}</strong> 계정을 잠그면 이 계정으로 로그인할 수 없습니다. 잠금 기록은 시스템 로그에 남습니다.
      </p>
      <TextInput label="잠금 사유" value={reason} onChange={setReason} error={reasonError || error} maxLength={REASON_MAX_LENGTH} />
      <Button type="submit" variant="danger" disabled={pending}>
        잠그기
      </Button>
      <Button onClick={onClose}>취소</Button>
    </form>
  )
}
