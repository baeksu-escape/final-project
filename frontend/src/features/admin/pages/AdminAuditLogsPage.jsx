import { useEffect, useState } from 'react'
import { Card, Chip, Notice, SegmentedControl } from '../../../common/components/index.js'
import { fetchAccessLogs, fetchSystemLogs } from '../api/adminApi.js'
import { ADMIN_FIRST_PAGE, ADMIN_PAGE_SIZE, LOG_TAB_OPTIONS, LOG_TABS, SYSTEM_LOG_TYPE_OPTIONS, adminErrorMessage } from '../adminConstants.js'
import { formatDateTime } from '../adminFormat.js'
import AdminPagination from '../components/AdminPagination.jsx'
import { useAdminErrorHandler } from '../useAdminErrorHandler.js'
import '../admin.css'

// 열람한 화면·데이터 코드(ACCESS_AUDIT_LOG.ACCESSED_RESOURCE) → 화면 이름. 모르는 코드는 그대로 보여 준다.
// 작업 7 백엔드는 ADM-08 열람을 MEMBER_DETAIL로 남긴다. CREDIT_DATA는 이전 mock 기록용으로 남겨 둔다.
const RESOURCE_LABELS = Object.freeze({ MEMBER_DETAIL: '회원 신용정보 상세', CREDIT_DATA: '회원 신용정보 상세' })

// FP-275 두 로그 표의 열 — className은 admin.css의 고정 열 너비(사유·내용 열은 남은 너비 전부).
const ACCESS_LOG_COLUMNS = Object.freeze([
  { key: 'time', label: '열람 시각', className: 'admin-log__col--time' },
  { key: 'viewer', label: '열람자 ID', className: 'admin-log__col--id' },
  { key: 'target', label: '대상 회원', className: 'admin-log__col--target' },
  { key: 'resource', label: '열람 화면', className: 'admin-log__col--resource' },
  { key: 'reason', label: '사유', className: 'admin-log__col--rest' },
])
const SYSTEM_LOG_COLUMNS = Object.freeze([
  { key: 'time', label: '시각', className: 'admin-log__col--time' },
  { key: 'type', label: '구분', className: 'admin-log__col--type' },
  { key: 'message', label: '내용', className: 'admin-log__col--rest' },
  { key: 'source', label: '출처', className: 'admin-log__col--source' },
])

// 로그 목록을 부르는 훅 — fetchLogs({ type, page, size })를 쪽(page)·구분(type)이 바뀔 때마다 다시 부른다. { data, error, busy }를 돌려준다(busy는 쪽을 넘기는 동안 true).
function useAdminLogs(fetchLogs, page, type) {
  const handleAdminError = useAdminErrorHandler()
  const [state, setState] = useState({ data: null, error: '', loadedKey: '' })
  const key = `${type}:${page}`

  useEffect(() => {
    let cancelled = false
    fetchLogs({ type, page, size: ADMIN_PAGE_SIZE })
      .then((data) => {
        if (!cancelled) setState({ data, error: '', loadedKey: `${type}:${page}` })
      })
      .catch(async (error) => {
        if (cancelled || (await handleAdminError(error))) return
        setState((prev) => ({ ...prev, error: adminErrorMessage(error) }))
      })
    return () => {
      cancelled = true
    }
  }, [fetchLogs, page, type, handleAdminError])

  // busy: 지금 쪽·구분의 응답을 아직 받지 못했다(지난 쪽을 그대로 보여 주는 중).
  return { data: state.data, error: state.error, busy: state.data !== null && state.loadedKey !== key && !state.error }
}

// FP-275 로그 표 — 높이(한 쪽 줄 수)와 열 너비를 고정하고 긴 칸은 말줄임한다(전체 글은 title).
// 안내 문구도 상자 안에 두어 줄 수가 적어도 [이전]/[다음] 위치가 같고, 쪽을 넘기는 동안 지난 쪽을 흐리게 둔다.
function AdminLogTable({ caption, columns, rows, renderRow, message, busy }) {
  return (
    <div className="data-table-wrap admin-log" style={{ '--admin-log-rows': ADMIN_PAGE_SIZE }} aria-busy={busy || undefined}>
      <table className="data-table admin-log__table">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} className={column.className} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
      {message && (
        <p className="admin-log__message" role={message.alert ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </div>
  )
}

// 표 상자 안에 보여 줄 안내 — 오류, 처음 불러오는 중, 기록 없음. 줄이 있으면 null.
function logMessage(data, error) {
  if (error && !data) return { text: error, alert: true }
  if (!data) return { text: '로그를 불러오는 중입니다.' }
  if (data.items.length === 0) return { text: '기록이 없습니다.' }
  return null
}

// 열람 감사 로그 카드의 Chip·안내 문장.
const ACCESS_LOG_CHIP = '기록은 고치거나 지울 수 없습니다'
const ACCESS_LOG_FOOTNOTE = '계정·권한 관리에서 회원 상세를 열면 사유와 함께 자동으로 남습니다.'

// FP-273 5차 로그 카드 틀 — 두 탭이 같은 뼈대(제목 · Chip 줄 · 표 · 쪽 넘기기 자리 · 안내 줄)를 쓰게 해, 탭을 바꿔도 카드 높이와 [이전]/[다음] 위치가 같다.
// 시스템 로그 카드(ghost)는 열람 감사 카드의 Chip·안내를 보이지 않게(visibility hidden, 화면 낭독기 제외) 두어 같은 높이만 차지한다.
// 쪽 넘기기 자리는 불러오는 동안에도 높이를 남겨 둔다.
function AdminLogCard({ title, ghost = false, error, data, page, onPageChange, children }) {
  const ghostClass = ghost ? ' admin-log-card__ghost' : ''
  return (
    <Card title={title} className="admin-log-card">
      <div className={`admin-log-card__meta${ghostClass}`} aria-hidden={ghost || undefined}>
        <Chip>{ACCESS_LOG_CHIP}</Chip>
      </div>
      {error && data && <p role="alert">{error}</p>}
      {children}
      <div className="admin-log-card__pager">
        {data && <AdminPagination page={page} size={data.size} totalCount={data.totalCount} onChange={onPageChange} />}
      </div>
      <p className={`hint${ghostClass}`} aria-hidden={ghost || undefined}>
        {ACCESS_LOG_FOOTNOTE}
      </p>
    </Card>
  )
}

// N-35-2 열람 감사 로그(ADM-09) — 관리자가 회원 상세를 연 기록을 최신순으로 보여 준다. 고치거나 지우는 기능은 없다.
function AccessLogSection() {
  const [page, setPage] = useState(ADMIN_FIRST_PAGE)
  const { data, error, busy } = useAdminLogs(fetchAccessLogs, page, '')

  return (
    <AdminLogCard title="열람 감사 로그" error={error} data={data} page={page} onPageChange={setPage}>
      <AdminLogTable
        caption="열람 감사 로그"
        columns={ACCESS_LOG_COLUMNS}
        rows={data?.items ?? []}
        message={logMessage(data, error)}
        busy={busy}
        renderRow={(log, index) => {
          const resource = RESOURCE_LABELS[log.resource] ?? log.resource
          return (
            <tr key={`${log.accessedAt}-${index}`}>
              <td>{formatDateTime(log.accessedAt)}</td>
              <td title={log.viewerLoginId}>{log.viewerLoginId}</td>
              <td title={log.targetLabel}>{log.targetLabel}</td>
              <td title={resource}>{resource}</td>
              <td title={log.reason}>{log.reason}</td>
            </tr>
          )
        }}
      />
    </AdminLogCard>
  )
}

// N-28-2 시스템 로그(ADM-10) — AUTH·INFO·WARN으로 걸러 최신순으로 보여 준다. 구분(type)·쪽(page)은 페이지가 들고 있다(구분 탭이 위 탭 줄에 있다).
function SystemLogSection({ type, page, onPageChange }) {
  const { data, error, busy } = useAdminLogs(fetchSystemLogs, page, type)

  return (
    <AdminLogCard title="시스템 로그" ghost error={error} data={data} page={page} onPageChange={onPageChange}>
      <AdminLogTable
        caption="시스템 로그"
        columns={SYSTEM_LOG_COLUMNS}
        rows={data?.items ?? []}
        message={logMessage(data, error)}
        busy={busy}
        renderRow={(log, index) => (
          <tr key={`${log.createdAt}-${index}`}>
            <td>{formatDateTime(log.createdAt)}</td>
            <td>
              <Chip>{log.type}</Chip>
            </td>
            <td title={log.message}>{log.message}</td>
            <td title={log.source}>{log.source}</td>
          </tr>
        )}
      />
    </AdminLogCard>
  )
}

// N-28·N-35-2 접근·감사 로그(/admin/audit-logs) — 탭 2개: 열람 감사 로그, 시스템 로그.
export default function AdminAuditLogsPage() {
  const [tab, setTab] = useState(LOG_TABS.ACCESS)
  const [systemType, setSystemType] = useState('')
  const [systemPage, setSystemPage] = useState(ADMIN_FIRST_PAGE)

  // 시스템 로그 구분을 바꾸면 첫 쪽부터 본다.
  const changeSystemType = (nextType) => {
    setSystemType(nextType)
    setSystemPage(ADMIN_FIRST_PAGE)
  }

  // FP-273 4차 UI v2 공통 틀 — 머리는 .page-head, 탭은 통계 화면의 구분 줄처럼 section.card.l-g2에 둔다.
  // FP-273 5차 순서는 머리 → Notice → 탭 줄 → 로그 카드. 시스템 로그 구분은 탭 줄 오른쪽 칸에 두고, 열람 감사 탭에서는 그 칸을 같은 높이로 비워 둔다.
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-head__title">접근·감사 로그</h1>
          <p className="page-head__lead">
            열람 감사 로그는 관리자가 회원 정보를 열어 본 기록을, 시스템 로그는 로그인·배치·오류 기록을 보여 줍니다.
          </p>
        </div>
      </div>
      <Notice type="info">최신 기록이 위에 옵니다.</Notice>
      <section className="card l-g2 admin-log-tabs" aria-label="로그 종류와 구분">
        <SegmentedControl label="로그 종류" options={LOG_TAB_OPTIONS} value={tab} onChange={setTab} />
        <div className="admin-log-tabs__filter">
          {tab === LOG_TABS.SYSTEM && (
            <SegmentedControl label="로그 구분" options={SYSTEM_LOG_TYPE_OPTIONS} value={systemType} onChange={changeSystemType} />
          )}
        </div>
      </section>
      {tab === LOG_TABS.ACCESS ? (
        <AccessLogSection />
      ) : (
        <SystemLogSection type={systemType} page={systemPage} onPageChange={setSystemPage} />
      )}
    </>
  )
}
