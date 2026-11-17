import { formatDateTime, labelOf, REPORT_STATUSES } from '../../community/config/communityCodes.js'

const OPEN = ['RECEIVED', 'IN_REVIEW']

// 신고 대상 한 줄 이름 — 글은 제목, 댓글은 앞부분
function targetLabel(group) {
  if (group.targetType === 'POST') return group.targetText ?? '(제목 없음)'
  const text = group.targetText ?? ''
  return `댓글: "${text.length > 24 ? `${text.slice(0, 24)}…` : text}"`
}

// 처리 상태 칩 — 미처리인데 숨겨진 대상은 '자동 숨김 · 접수'처럼 앞에 붙인다
export function StatusChip({ statusCode, targetStatus }) {
  const autoHidden = targetStatus === 'HIDDEN_BY_REPORT' && OPEN.includes(statusCode)
  return (
    <span className={`report-status report-status--${statusCode.toLowerCase()}`}>
      {autoHidden && '자동 숨김 · '}
      {labelOf(REPORT_STATUSES, statusCode)}
    </span>
  )
}

// N-34-1 신고 묶음 목록 — 같은 글·댓글의 신고를 한 줄로 묶어 누적 건수·최근 접수 시각을 보여 준다. 숨김 대상이 먼저 온다(서버 정렬).
export default function AdminReportList({ items, selectedId, onSelect }) {
  if (items.length === 0) return <p className="hint">조건에 맞는 신고가 없습니다.</p>
  return (
    <ul className="report-list">
      {items.map((group) => (
        <li key={`${group.targetType}:${group.targetId}`}>
          <button type="button" className="report-list__item" aria-pressed={group.reportId === selectedId} onClick={() => onSelect(group.reportId)}>
            <span className="report-list__top">
              <span className="report-list__title">{targetLabel(group)}</span>
              <StatusChip statusCode={group.statusCode} targetStatus={group.targetStatus} />
            </span>
            <span className="lounge-meta">
              <span>{group.targetType === 'POST' ? '게시글' : '댓글'}</span>
              <span>누적 {group.reportCount}건</span>
              <span>{formatDateTime(group.lastReportedAt).slice(5)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
