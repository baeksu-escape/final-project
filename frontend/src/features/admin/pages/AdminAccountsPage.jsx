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

// 표의 열 수 — 열람 사유 줄이 표 전체 너비를 차지하게 할 때 쓴다. FP-273 [닉네임] 열을 더해 10열.
const COLUMN_COUNT = 10

// N-27·N-35-1 계정·권한 관리(/admin/accounts) — 회원 목록 검색·필터(권한·상태·직군)·쪽 넘기기, 사유를 남기고 회원 상세 열람, 계정 잠금·해제.
// 회원 정보는 서버가 가린 값만 보여 준다. 회원을 관리자로 바꾸는 기능은 두지 않는다(N-27-2).
// FP-273 ACCT-04 통합 관리자로 운영하기로 해(11/26) 관리자 계정 추가(N-27-4) 카드는 화면에서 감췄다.
// AddAdminForm.jsx·createAdminAccount(ADM-07)·서버 코드는 그대로 남겨 두었다.
export default function AdminAccountsPage() {
  const { user } = useAuth()
  const handleAdminError = useAdminErrorHandler()
  const [searchText, setSearchText] = useState('')
  // 서버에 보낼 조건. reloadKey는 같은 조건으로 다시 부를 때 올린다.
  const [query, setQuery] = useState({ q: '', role: '', status: '', workerType: '', page: ADMIN_FIRST_PAGE, reloadKey: 0 })
  const [data, setData] = useState(null)
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
      setDetail({ reason, data: result })
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
      <>
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
      </>
    )
  }

  return (
    <section>
      <h1>계정·권한 관리</h1>
      <p>회원 정보는 가려서 보여 줍니다. 자세히 보려면 사유를 남겨야 하고, 남긴 기록은 열람 감사 로그에 쌓입니다.</p>

      <Card>
        <form onSubmit={handleSearch} role="search" noValidate>
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
        {data && <Chip>{data.totalCount}명</Chip>}
      </Card>

      <Card title="회원 목록">
        {loadError && <p role="alert">{loadError}</p>}
        {!data && !loadError && <p>회원 목록을 불러오는 중입니다.</p>}
        {data && data.items.length === 0 && <p>조건에 맞는 계정이 없습니다.</p>}
        {data && data.items.length > 0 && (
          <>
            <table>
              <thead>
                <tr>
                  <th scope="col">아이디</th>
                  <th scope="col">이름</th>
                  <th scope="col">닉네임</th>
                  <th scope="col">권한</th>
                  <th scope="col">직군</th>
                  <th scope="col">최근 대안 점수</th>
                  <th scope="col">상태</th>
                  <th scope="col">작성 글 신고</th>
                  <th scope="col">가입일</th>
                  <th scope="col">관리</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <Fragment key={row.userId}>
                    <tr>
                      <td>{row.loginId}</td>
                      <td>{row.maskedName}</td>
                      {/* FP-273 닉네임 — 탈퇴 회원은 서버가 준 표시값('탈퇴'+회원 번호) 그대로 */}
                      <td>{row.nickname ?? EMPTY_TEXT}</td>
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
                      <tr>
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
                ))}
              </tbody>
            </table>
            <AdminPagination
              page={data.page}
              size={data.size}
              totalCount={data.totalCount}
              onChange={(page) => setQuery((prev) => ({ ...prev, page }))}
            />
          </>
        )}
      </Card>

      {detail && <MemberDetailPanel detail={detail} onClose={() => setDetail(null)} />}

      <LockReasonModal
        target={lockTarget}
        pending={lockPending}
        error={lockError}
        onConfirm={(reason) => saveLock(lockTarget, true, reason)}
        onClose={() => setLockTarget(null)}
      />
      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </section>
  )
}
