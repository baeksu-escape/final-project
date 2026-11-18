import { useEffect, useState } from 'react'
import { Button, Notice, ProgressBar, TextInput } from '../../../common/components/index.js'
import { fetchAdminReport, processReport } from '../api/adminReportApi.js'
import { DETAIL_MAX, formatDateTime, labelOf, REPORT_REASONS, REPORT_RESULTS } from '../../community/config/communityCodes.js'
import { StatusChip } from './AdminReportList.jsx'

const OPEN = ['RECEIVED', 'IN_REVIEW']

// N-34-2·3 신고 상세와 처리 — 원문·작성자, 사유별 건수, 가린 신고자 목록을 보여 주고
// 숨김 유지·삭제·반려 중 하나로 그 대상의 미처리 신고를 한 번에 닫는다. 부모가 key={reportId}로 새로 만든다.
// onProcessed(result): 처리하면 부모가 목록을 다시 읽는다. 처리 뒤 상세는 이 컴포넌트가 스스로 다시 읽는다.
export default function AdminReportDetail({ reportId, onProcessed }) {
  const [state, setState] = useState({ data: null, error: '' })
  const [version, setVersion] = useState(0)
  const [result, setResult] = useState('KEEP_HIDDEN')
  const [memo, setMemo] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetchAdminReport(reportId)
      .then((data) => alive && setState({ data, error: '' }))
      .catch((err) => alive && setState({ data: null, error: err.message }))
    return () => {
      alive = false
    }
  }, [reportId, version])

  if (state.error) return <Notice type="warn">{state.error}</Notice>
  if (!state.data) return <p className="hint">불러오는 중…</p>

  const detail = state.data
  const kind = detail.targetType === 'POST' ? '게시글' : '댓글'
  const openReports = detail.reports.filter((line) => OPEN.includes(line.statusCode))
  const handled = detail.reports.find((line) => line.resultCode)
  const groupStatus = openReports.length ? openReports[0].statusCode : detail.reports[0]?.statusCode
  const maxCount = Math.max(1, ...Object.values(detail.reasonCounts))

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    try {
      const done = await processReport(reportId, { resultCode: result, memo: memo.trim() || null })
      setMemo('')
      setVersion((v) => v + 1)
      onProcessed(done)
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="l-stack">
      <div className="lounge-detail__head">
        <div>
          <p className="tag">
            신고 #{detail.reportId} · {kind}
          </p>
          <h2 className="card__title">{detail.title ?? `${kind} 원문`}</h2>
        </div>
        {groupStatus && <StatusChip statusCode={groupStatus} targetStatus={detail.targetStatus} />}
      </div>

      <div className="panel-sunk l-stack">
        <p className="lounge-meta">
          <span>원문 · 작성자 {detail.authorNickname ?? '—'}</span>
          {detail.parentPostId && <span>글 번호 {detail.parentPostId}</span>}
          {detail.targetStatus === 'DELETED' && <span>삭제됨</span>}
        </p>
        <p className="lounge-detail__body">{detail.content}</p>
      </div>

      <div className="l-g2">
        <div className="l-stack">
          <p className="form-field__label">사유별 건수 · 누적 {detail.reportCount}건</p>
          {REPORT_REASONS.filter((reason) => detail.reasonCounts[reason.value] > 0).map((reason) => (
            <div key={reason.value} className="report-reason-row">
              <span>{reason.label}</span>
              <ProgressBar label={`${reason.label} 신고 건수`} value={detail.reasonCounts[reason.value]} max={maxCount} />
              <b>{detail.reasonCounts[reason.value]}</b>
            </div>
          ))}
        </div>
        <div className="l-stack">
          <p className="form-field__label">신고자 (가려서 표시)</p>
          <ul className="report-reporters">
            {detail.reports.map((line) => (
              <li key={line.reportId}>
                <span>{line.reporter}</span>
                <span className="lounge-meta">
                  <span>{labelOf(REPORT_REASONS, line.reasonCode)}</span>
                  <span>{formatDateTime(line.reportedAt)}</span>
                </span>
                {line.detailText && <span className="report-reporters__detail">{line.detailText}</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {handled && (
        <Notice type="success">
          처리 기록 · {labelOf(REPORT_RESULTS, handled.resultCode)} · {formatDateTime(handled.handledAt)}
          {handled.handlerMemo && ` · 메모: ${handled.handlerMemo}`}
        </Notice>
      )}

      {openReports.length > 0 && detail.targetStatus !== 'DELETED' ? (
        <div className="report-process">
          <fieldset className="report-process__options">
            <legend className="form-field__label">처리 결과 · 미처리 신고 {openReports.length}건을 함께 처리합니다</legend>
            {REPORT_RESULTS.map((item) => (
              <label key={item.value} className="report-option">
                <input type="radio" name="report-result" value={item.value} checked={result === item.value} onChange={() => setResult(item.value)} />
                <span className="report-option__text">
                  <b>{item.label}</b>
                  <span>{item.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <TextInput label="처리 메모" value={memo} onChange={setMemo} placeholder="처리 근거를 남겨 주세요" maxLength={DETAIL_MAX} />
          {formError && (
            <p className="field-error" role="alert">
              {formError}
            </p>
          )}
          <div className="l-row">
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              처리 결과 저장
            </Button>
          </div>
        </div>
      ) : (
        <p className="hint">미처리 신고가 없어 더 처리할 것이 없습니다.</p>
      )}
    </div>
  )
}
