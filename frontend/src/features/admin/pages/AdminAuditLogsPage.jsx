import { useEffect, useState } from 'react'
import { Card, Chip, Notice, SegmentedControl } from '../../../common/components/index.js'
import { fetchAccessLogs, fetchSystemLogs } from '../api/adminApi.js'
import { ADMIN_FIRST_PAGE, ADMIN_PAGE_SIZE, LOG_TAB_OPTIONS, LOG_TABS, SYSTEM_LOG_TYPE_OPTIONS, adminErrorMessage } from '../adminConstants.js'
import { formatDateTime } from '../adminFormat.js'
import AdminPagination from '../components/AdminPagination.jsx'
import { useAdminErrorHandler } from '../useAdminErrorHandler.js'

// 열람한 화면·데이터 코드(ACCESS_AUDIT_LOG.ACCESSED_RESOURCE) → 화면 이름. 모르는 코드는 그대로 보여 준다.
// 작업 7 백엔드는 ADM-08 열람을 MEMBER_DETAIL로 남긴다. CREDIT_DATA는 이전 mock 기록용으로 남겨 둔다.
const RESOURCE_LABELS = Object.freeze({ MEMBER_DETAIL: '회원 신용정보 상세', CREDIT_DATA: '회원 신용정보 상세' })

// 로그 목록을 부르는 훅 — fetchLogs({ type, page, size })를 쪽(page)·구분(type)이 바뀔 때마다 다시 부른다. { data, error }를 돌려준다.
function useAdminLogs(fetchLogs, page, type) {
  const handleAdminError = useAdminErrorHandler()
  const [state, setState] = useState({ data: null, error: '' })

  useEffect(() => {
    let cancelled = false
    fetchLogs({ type, page, size: ADMIN_PAGE_SIZE })
      .then((data) => {
        if (!cancelled) setState({ data, error: '' })
      })
      .catch(async (error) => {
        if (cancelled || (await handleAdminError(error))) return
        setState((prev) => ({ ...prev, error: adminErrorMessage(error) }))
      })
    return () => {
      cancelled = true
    }
  }, [fetchLogs, page, type, handleAdminError])

  return state
}

// N-35-2 열람 감사 로그(ADM-09) — 관리자가 회원 상세를 연 기록을 최신순으로 보여 준다. 고치거나 지우는 기능은 없다.
function AccessLogSection() {
  const [page, setPage] = useState(ADMIN_FIRST_PAGE)
  const { data, error } = useAdminLogs(fetchAccessLogs, page, '')

  return (
    <Card title="열람 감사 로그">
      <Chip>기록은 고치거나 지울 수 없습니다</Chip>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>로그를 불러오는 중입니다.</p>}
      {data && data.items.length === 0 && <p>기록이 없습니다.</p>}
      {data && data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">열람 시각</th>
              <th scope="col">열람자 ID</th>
              <th scope="col">대상 회원</th>
              <th scope="col">열람 화면</th>
              <th scope="col">사유</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((log, index) => (
              <tr key={`${log.accessedAt}-${index}`}>
                <td>{formatDateTime(log.accessedAt)}</td>
                <td>{log.viewerLoginId}</td>
                <td>{log.targetLabel}</td>
                <td>{RESOURCE_LABELS[log.resource] ?? log.resource}</td>
                <td>{log.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && <AdminPagination page={page} size={data.size} totalCount={data.totalCount} onChange={setPage} />}
      <p>계정·권한 관리에서 회원 상세를 열면 사유와 함께 자동으로 남습니다.</p>
    </Card>
  )
}

// N-28-2 시스템 로그(ADM-10) — AUTH·INFO·WARN으로 걸러 최신순으로 보여 준다.
function SystemLogSection() {
  const [type, setType] = useState('')
  const [page, setPage] = useState(ADMIN_FIRST_PAGE)
  const { data, error } = useAdminLogs(fetchSystemLogs, page, type)

  // 구분을 바꾸면 첫 쪽부터 본다.
  const changeType = (nextType) => {
    setType(nextType)
    setPage(ADMIN_FIRST_PAGE)
  }

  return (
    <Card title="시스템 로그">
      <SegmentedControl label="로그 구분" options={SYSTEM_LOG_TYPE_OPTIONS} value={type} onChange={changeType} />
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>로그를 불러오는 중입니다.</p>}
      {data && data.items.length === 0 && <p>기록이 없습니다.</p>}
      {data && data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">시각</th>
              <th scope="col">구분</th>
              <th scope="col">내용</th>
              <th scope="col">출처</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((log, index) => (
              <tr key={`${log.createdAt}-${index}`}>
                <td>{formatDateTime(log.createdAt)}</td>
                <td>
                  <Chip>{log.type}</Chip>
                </td>
                <td>{log.message}</td>
                <td>{log.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && <AdminPagination page={page} size={data.size} totalCount={data.totalCount} onChange={setPage} />}
    </Card>
  )
}

// N-28·N-35-2 접근·감사 로그(/admin/audit-logs) — 탭 2개: 열람 감사 로그, 시스템 로그.
export default function AdminAuditLogsPage() {
  const [tab, setTab] = useState(LOG_TABS.ACCESS)
  return (
    <section>
      <h1>접근·감사 로그</h1>
      <p>열람 감사 로그는 관리자가 회원 정보를 열어 본 기록을, 시스템 로그는 로그인·배치·오류 기록을 보여 줍니다.</p>
      <SegmentedControl label="로그 종류" options={LOG_TAB_OPTIONS} value={tab} onChange={setTab} />
      <Notice type="info">최신 기록이 위에 옵니다.</Notice>
      {tab === LOG_TABS.ACCESS ? <AccessLogSection /> : <SystemLogSection />}
    </section>
  )
}
