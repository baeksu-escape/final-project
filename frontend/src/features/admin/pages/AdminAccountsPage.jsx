import { Fragment, useEffect, useState } from 'react'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button, Card, Chip, Select, TextInput, Toast } from '../../../common/components/index.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { ROLES } from '../../../common/config/roles.js'
import { fetchAdminUsers, openMemberCreditData, setUserLock } from '../api/adminApi.js'
import {
  ACCOUNT_STATUS,
  ACCOUNT_STATUS_LABELS,
  ADMIN_FIRST_PAGE,
  ADMIN_PAGE_SIZE,
  ROLE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  WORKER_TYPE_FILTER_OPTIONS,
  adminErrorMessage,
} from '../adminConstants.js'
import { EMPTY_TEXT, formatDate } from '../adminFormat.js'
import AccessReasonForm from '../components/AccessReasonForm.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import LockReasonModal from '../components/LockReasonModal.jsx'
import MemberDetailPanel from '../components/MemberDetailPanel.jsx'
import { useAdminErrorHandler } from '../useAdminErrorHandler.js'
import '../admin.css'

// FP-273 5차 계정 목록 열 — className은 admin.css의 고정 열 너비(아이디·닉네임은 남은 너비를 나눠 쓴다).
const ACCOUNT_COLUMNS = Object.freeze([
  { key: 'loginId', label: '아이디', className: 'admin-accounts__col--auto' },
  { key: 'name', label: '이름', className: 'admin-accounts__col--name' },
  { key: 'nickname', label: '닉네임', className: 'admin-accounts__col--auto' },
  { key: 'role', label: '권한', className: 'admin-accounts__col--role' },
  { key: 'job', label: '직군', className: 'admin-accounts__col--job' },
  { key: 'score', label: '최근 대안 점수', className: 'admin-accounts__col--score' },
  { key: 'status', label: '상태', className: 'admin-accounts__col--status' },
  { key: 'reports', label: '작성 글 신고', className: 'admin-accounts__col--reports' },
  { key: 'joined', label: '가입일', className: 'admin-accounts__col--date' },
  { key: 'actions', label: '관리', className: 'admin-accounts__col--actions' },
])
// 표의 열 수 — 열람 사유 줄이 표 전체 너비를 차지하게 할 때 쓴다.
const COLUMN_COUNT = ACCOUNT_COLUMNS.length

// 표 상자 안에 보여 줄 안내 — 오류, 처음 불러오는 중, 조건에 맞는 계정 없음. 줄이 있으면 null.
function listMessage(data, error) {
  if (error && !data) return { text: error, alert: true }
  if (!data) return { text: '회원 목록을 불러오는 중입니다.' }
  if (data.items.length === 0) return { text: '조건에 맞는 계정이 없습니다.' }
  return null
}

// 고정 메뉴 줄(.app-header) 아래 16px에 요소 맨 위가 오도록 스크롤한다(움직임 줄이기 설정이면 바로 옮긴다).
function scrollBelowHeader(element) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const headerHeight = document.querySelector('.app-header')?.getBoundingClientRect().height ?? 0
  const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - 16
  window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
}

// N-27·N-35-1 계정·권한 관리(/admin/accounts) — 회원 목록 검색·필터(권한·상태·직군)·쪽 넘기기, 사유를 남기고 회원 상세 열람, 계정 잠금·해제.
// 회원 정보는 서버가 가린 값만 보여 준다. 회원을 관리자로 바꾸는 기능은 두지 않는다(N-27-2).
// FP-273 ACCT-04 통합 관리자 운영(11/26)이라 관리자 계정 추가(N-27-4) 카드는 두지 않는다(AddAdminForm·ADM-07은 남겨 둔다).
export default function AdminAccountsPage() {
  const { user } = useAuth()
  const handleAdminError = useAdminErrorHandler()
  const [searchText, setSearchText] = useState('')
  // 서버에 보낼 조건.
  const [query, setQuery] = useState({ q: '', role: '', status: '', workerType: '', page: ADMIN_FIRST_PAGE })
  const [data, setData] = useState(null)
  // 마지막으로 받은 응답의 조건 — 지금 조건과 다르면 새 쪽을 불러오는 중이다(지난 쪽을 흐리게 둔다).
  const [loadedQuery, setLoadedQuery] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [reasonFor, setReasonFor] = useState(null) // 열람 사유를 고르는 중인 회원 userId
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState('')
  const [detail, setDetail] = useState(null) // { reason, data: ADM-08 응답 }
  const [lockTarget, setLockTarget] = useState(null)
  const [lockError, setLockError] = useState('')
  const [lockPending, setLockPending] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // 조건이 바뀔 때마다 목록을 부른다.
  useEffect(() => {
    let cancelled = false
    fetchAdminUsers({
      q: query.q,
      role: query.role,
      status: query.status,
      workerType: query.workerType,
      page: query.page,
      size: ADMIN_PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return
        setData(result)
        setLoadedQuery(query)
        setLoadError('')
      })
      .catch(async (error) => {
        if (cancelled || (await handleAdminError(error))) return
        setLoadError(adminErrorMessage(error))
      })
    return () => {
      cancelled = true
    }
  }, [query, handleAdminError])

  // 조건 하나를 바꾸고 첫 쪽부터 다시 본다.
  const changeQuery = (patch) => setQuery((prev) => ({ ...prev, ...patch, page: ADMIN_FIRST_PAGE }))

  const handleSearch = (event) => {
    event.preventDefault()
    changeQuery({ q: searchText.trim() })
  }

  // 바뀐 한 줄(ADM-06 응답)로 목록의 같은 회원을 바꾼다.
  const replaceRow = (row) =>
    setData((prev) => ({ ...prev, items: prev.items.map((item) => (item.userId === row.userId ? row : item)) }))

  // N-35-1 사유를 남기고 회원 상세를 연다. 서버가 감사 로그를 남긴 뒤 상세를 돌려준다.
  const handleOpenDetail = async (userId, reason) => {
    setOpening(true)
    setOpenError('')
    try {
      const result = await openMemberCreditData(userId, reason)
      setDetail({ userId, reason, data: result })
      setReasonFor(null)
      setToastMessage('열람 기록을 감사 로그에 남겼습니다.')
    } catch (error) {
      if (await handleAdminError(error)) return
      setOpenError(adminErrorMessage(error))
    } finally {
      setOpening(false)
    }
  }

  // N-27-3 잠금(사유 필요)·잠금 해제를 저장한다.
  const saveLock = async (row, locked, reason) => {
    setLockPending(true)
    setLockError('')
    try {
      const updated = await setUserLock(row.userId, { locked, reason })
      replaceRow(updated)
      setLockTarget(null)
      setToastMessage(`${row.loginId} 계정을 ${locked ? '잠갔습니다' : '풀었습니다'}.`)
    } catch (error) {
      if (await handleAdminError(error)) return
      if (locked) setLockError(adminErrorMessage(error))
      else setToastMessage(adminErrorMessage(error))
    } finally {
      setLockPending(false)
    }
  }

  const openReasonForm = (userId) => {
    setOpenError('')
    setReasonFor(userId)
  }

  // FP-273 5차 상세 패널을 닫으면 보던 줄로 돌아가 그 줄의 [상세 보기]에 포커스를 둔다(쪽을 넘겨 줄이 없으면 그대로 둔다).
  const closeDetail = () => {
    const userId = detail?.userId
    setDetail(null)
    requestAnimationFrame(() => {
      const row = document.querySelector(`tr[data-user-id="${CSS.escape(String(userId))}"]`)
      if (!row) return
      scrollBelowHeader(row)
      row.querySelector('button')?.focus({ preventScroll: true })
    })
  }

  const openLockModal = (row) => {
    setLockError('')
    setLockTarget(row)
  }

  // 관리 칸 — 일반 회원은 [상세 보기], 본인은 "본인", 탈퇴 계정은 잠금 버튼 없음.
  const renderActions = (row) => {
    const self = String(row.userId) === String(user?.userId)
    const withdrawn = row.status === ACCOUNT_STATUS.WITHDRAWN
    const locked = row.status === ACCOUNT_STATUS.LOCKED
    return (
      <div className="admin-accounts__actions">
        {row.role === ROLES.USER && (
          <Button size="sm" onClick={() => openReasonForm(row.userId)}>
            상세 보기
          </Button>
        )}
        {self && <span>본인</span>}
        {!self && !withdrawn && locked && (
          <Button size="sm" disabled={lockPending} onClick={() => saveLock(row, false, '')}>
            잠금 해제
          </Button>
        )}
        {!self && !withdrawn && !locked && (
          <Button size="sm" variant="danger" onClick={() => openLockModal(row)}>
            잠금
          </Button>
        )}
      </div>
    )
  }

  const message = listMessage(data, loadError)
  const busy = data !== null && loadedQuery !== query && !loadError

  return (
    <>
      {/* FP-273 4차 UI v2 공통 머리(.page-head) */}
      <div className="page-head">
        <div>
          <h1 className="page-head__title">계정·권한 관리</h1>
          <p className="page-head__lead">
            회원 정보는 가려서 보여 줍니다. 자세히 보려면 사유를 남겨야 하고, 남긴 기록은 열람 감사 로그에 쌓입니다.
          </p>
        </div>
      </div>

      {/* 검색·필터 줄 — 공통 규칙(.card__body:has(> form[role='search']))으로 검색 칸·필터를 한 줄에 두고, 검색 칸과 [검색]은 admin-search로 붙인다. */}
      <Card>
        <form className="admin-search" onSubmit={handleSearch} role="search" noValidate>
          <TextInput label="아이디·닉네임 검색" value={searchText} onChange={setSearchText} placeholder="예: spam" />
          <Button type="submit">검색</Button>
        </form>
        <Select label="권한" options={ROLE_FILTER_OPTIONS} value={query.role} onChange={(value) => changeQuery({ role: value ?? '' })} />
        <Select label="상태" options={STATUS_FILTER_OPTIONS} value={query.status} onChange={(value) => changeQuery({ status: value ?? '' })} />
        <Select
          label="직군"
          options={WORKER_TYPE_FILTER_OPTIONS}
          value={query.workerType}
          onChange={(value) => changeQuery({ workerType: value ?? '' })}
        />
        {data && (
          <div className="admin-search__count">
            <Chip>{data.totalCount}명</Chip>
          </div>
        )}
      </Card>

      {/* FP-273 5차 회원 목록 — 접근·감사 로그 표(FP-275)처럼 열 너비·줄 높이를 고정하고, 표 상자는 한 쪽(ADMIN_PAGE_SIZE) 높이를 늘 차지한다.
          안내 문구는 상자 안에 두고, 새 쪽을 불러오는 동안 지난 쪽을 흐리게 둔다(쪽·검색 결과가 달라도 [이전]/[다음] 위치가 같다). */}
      <Card title="회원 목록">
        {loadError && data && <p role="alert">{loadError}</p>}
        <div
          className="data-table-wrap admin-accounts"
          style={{ '--admin-accounts-rows': ADMIN_PAGE_SIZE }}
          aria-busy={busy || undefined}
        >
          <table className="data-table admin-accounts__table">
            <caption className="sr-only">회원 목록</caption>
            <colgroup>
              {ACCOUNT_COLUMNS.map((column) => (
                <col key={column.key} className={column.className} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {ACCOUNT_COLUMNS.map((column) => (
                  <th key={column.key} scope="col">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((row) => {
                const name = row.maskedName
                const nickname = row.nickname ?? EMPTY_TEXT
                return (
                  <Fragment key={row.userId}>
                    <tr
                      data-user-id={row.userId}
                      className={detail?.userId === row.userId ? 'admin-accounts__row--open' : undefined}
                    >
                      <td title={row.loginId}>{row.loginId}</td>
                      <td title={name}>{name}</td>
                      <td title={nickname}>{nickname}</td>
                      <td>{row.role === ROLES.ADMIN ? <Chip accent>관리자</Chip> : '일반'}</td>
                      <td>{JOB_TYPE_LABELS[row.workerTypeCode] ?? EMPTY_TEXT}</td>
                      <td>{row.latestAltScore ?? EMPTY_TEXT}</td>
                      <td>
                        <Chip>{ACCOUNT_STATUS_LABELS[row.status] ?? row.status}</Chip>
                      </td>
                      <td>{row.reportedPostCount ?? 0}</td>
                      <td>{formatDate(row.createdAt)}</td>
                      <td>{renderActions(row)}</td>
                    </tr>
                    {reasonFor === row.userId && (
                      <tr className="admin-accounts__reason-row">
                        <td colSpan={COLUMN_COUNT}>
                          <AccessReasonForm
                            viewerLoginId={user?.loginId}
                            pending={opening}
                            error={openError}
                            onSubmit={(reason) => handleOpenDetail(row.userId, reason)}
                            onCancel={() => setReasonFor(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {message && (
            <p className="admin-accounts__message" role={message.alert ? 'alert' : 'status'}>
              {message.text}
            </p>
          )}
        </div>
        {data && (
          <AdminPagination
            page={data.page}
            size={data.size}
            totalCount={data.totalCount}
            onChange={(page) => setQuery((prev) => ({ ...prev, page }))}
          />
        )}
      </Card>

      {detail && <MemberDetailPanel detail={detail} onClose={closeDetail} />}

      <LockReasonModal
        target={lockTarget}
        pending={lockPending}
        error={lockError}
        onConfirm={(reason) => saveLock(lockTarget, true, reason)}
        onClose={() => setLockTarget(null)}
      />
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </>
  )
}
