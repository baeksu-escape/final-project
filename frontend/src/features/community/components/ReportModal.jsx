import { useState } from 'react'
import { Button, Modal } from '../../../common/components/index.js'
import { DETAIL_MAX, REASON_OTHER, REPORT_REASONS } from '../config/communityCodes.js'
import { submitReport } from '../api/reportApi.js'

// N-33-1 신고 창 — 사유 5개 중 하나를 고르고, '기타'일 때만 자세한 내용을 받는다.
// 본인 글·이미 신고함·하루 3번 초과는 서버가 막고, 그 문구를 창 안에 보여 준다.
// target: { targetType: 'POST'|'COMMENT', targetId } · onDone(result): 신고가 접수되면 { reportId, targetHidden }을 넘긴다.
export default function ReportModal({ target, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const kind = target?.targetType === 'COMMENT' ? '댓글' : '글'

  const handleSubmit = async () => {
    if (!reason) {
      setError('신고 사유를 하나 골라 주세요.')
      return
    }
    setSending(true)
    setError('')
    try {
      const result = await submitReport({
        targetType: target.targetType,
        targetId: target.targetId,
        reasonCode: reason,
        detailText: reason === REASON_OTHER && detail.trim() ? detail.trim() : null,
      })
      onDone(result)
    } catch (err) {
      setError(err.message)
      setSending(false)
    }
  }

  return (
    <Modal open={Boolean(target)} title={`이 ${kind} 신고`} onClose={onClose}>
      <div className="report-modal">
        <fieldset className="report-modal__reasons">
          <legend className="form-field__label">신고 사유를 골라 주세요</legend>
          {REPORT_REASONS.map((item) => (
            <label key={item.value} className="report-option">
              <input type="radio" name="report-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} />
              <span>{item.label}</span>
            </label>
          ))}
        </fieldset>
        {reason === REASON_OTHER && (
          <div className="form-field">
            <label htmlFor="report-detail" className="form-field__label">
              자세한 내용 (선택)
            </label>
            <textarea
              id="report-detail"
              className="lounge-textarea lounge-textarea--short"
              value={detail}
              maxLength={DETAIL_MAX}
              onChange={(event) => setDetail(event.target.value)}
            />
          </div>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <p className="report-modal__hint">
          작성자가 아니라 이 {kind} 자체를 신고합니다. 신고가 쌓이면 관리자 확인 전에 자동으로 숨겨집니다. 신고한 사람은 공개되지 않습니다. 신고는 하루 3번까지 할 수 있습니다.
        </p>
        <div className="lounge-actions">
          <Button variant="primary" size="sm" onClick={handleSubmit} disabled={sending}>
            신고하기
          </Button>
          <Button size="sm" onClick={onClose}>
            취소
          </Button>
        </div>
      </div>
    </Modal>
  )
}
