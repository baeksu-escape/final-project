import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Modal, TextInput } from '../../../common/components/index.js'
import { REASON_MAX_LENGTH } from '../adminConstants.js'

// FP-273 5차 창을 body 바로 아래에 그린다 — 본문(.page-enter)은 들어오는 애니메이션(transform·filter, fill both) 때문에 fixed 창의 기준·층이 되어,
// 그 안에 그리면 스크롤한 만큼 창이 같이 올라가 위쪽 메뉴 줄에 가린다. 메뉴 줄 높이(폭마다 다름)는 창을 열 때 재서 그 아래에 창을 둔다.
function placeBelowHeader(layer) {
  if (!layer) return
  const headerBottom = document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 0
  layer.style.setProperty('--admin-header-bottom', `${Math.max(0, Math.round(headerBottom))}px`)
}

// N-27-3 계정 잠금 사유 입력 모달 — 사유를 넣고 [잠그기]를 누르면 onConfirm(사유)를 부른다. 저장은 부르는 쪽이 한다.
// 사용 예: <LockReasonModal target={row} pending={saving} error={lockError} onConfirm={lock} onClose={close} />   // target: 잠글 목록 한 줄 | null
export default function LockReasonModal({ target, pending, error, onConfirm, onClose }) {
  if (!target) return null
  return createPortal(
    <div ref={placeBelowHeader} className="admin-modal-layer">
      <Modal open title="계정 잠금" onClose={onClose}>
        <LockReasonBody target={target} pending={pending} error={error} onConfirm={onConfirm} onClose={onClose} />
      </Modal>
    </div>,
    document.body,
  )
}

// 모달 안쪽 — 열 때마다 사유 칸을 비운다. FP-273 5차 사유 칸은 한 줄 전체, 그 아래 [잠그기]·[취소]를 2칸으로 나란히 둔다.
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
    <form className="admin-lock-form" onSubmit={handleSubmit} noValidate>
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
