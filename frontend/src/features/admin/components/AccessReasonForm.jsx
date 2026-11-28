import { useState } from 'react'
import { Button, Select, TextInput } from '../../../common/components/index.js'
import { AUDIT_REASONS, CUSTOM_REASON, REASON_MAX_LENGTH } from '../adminConstants.js'

// 열람 사유 선택 상자 보기 — 확정 UI의 5개 + 직접 입력.
const REASON_OPTIONS = [...AUDIT_REASONS.map((reason) => ({ value: reason, label: reason })), { value: CUSTOM_REASON, label: '직접 입력' }]

// N-35-1 열람 사유 입력 — 사유를 고르거나 직접 넣고 [사유 남기고 열기]를 누르면 onSubmit(사유)를 부른다. 사유 없이는 열 수 없다.
// 사용 예: <AccessReasonForm viewerLoginId="admin" pending={opening} error={openError} onSubmit={open} onCancel={close} />
export default function AccessReasonForm({ viewerLoginId, pending, error, onSubmit, onCancel }) {
  const [choice, setChoice] = useState(AUDIT_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    const reason = choice === CUSTOM_REASON ? customReason.trim() : choice
    if (!reason) {
      setReasonError('열람 사유를 넣어 주세요.')
      return
    }
    setReasonError('')
    onSubmit(reason)
  }

  // FP-273 5차 [열람 사유](직접 입력이면 사유 칸) → [사유 남기고 열기] → [취소]를 한 줄에 같은 높이로 붙이고, 안내는 그 아래 한 줄.
  // 좁은 화면에서는 버튼 두 개가 함께 아래 줄로 내려간다(admin.css admin-reason).
  return (
    <form className="admin-reason" onSubmit={handleSubmit} noValidate>
      <div className="admin-reason__row">
        <Select label="열람 사유" options={REASON_OPTIONS} value={choice} onChange={(value) => setChoice(value ?? AUDIT_REASONS[0])} />
        {choice === CUSTOM_REASON && (
          <TextInput label="사유 직접 입력" value={customReason} onChange={setCustomReason} error={reasonError} maxLength={REASON_MAX_LENGTH} />
        )}
        <div className="admin-reason__actions">
          <Button type="submit" variant="primary" disabled={pending}>
            사유 남기고 열기
          </Button>
          <Button onClick={onCancel}>취소</Button>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <p className="hint">이 열람은 {viewerLoginId ? `${viewerLoginId} 이름으로 ` : ''}감사 로그에 남습니다.</p>
    </form>
  )
}
