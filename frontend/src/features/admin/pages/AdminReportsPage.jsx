import { useEffect, useState } from 'react'
import { Button, Notice, NumberInput, Select, Toast } from '../../../common/components/index.js'
import { fetchAdminReports, fetchSettings, updateSetting } from '../api/adminReportApi.js'
import AdminReportDetail from '../components/AdminReportDetail.jsx'
import AdminReportList from '../components/AdminReportList.jsx'
import { AUTO_HIDE_KEY, labelOf, REPORT_PERIODS, REPORT_RESULTS, REPORT_REASONS, REPORT_STATUSES } from '../../community/config/communityCodes.js'
import '../../community/community.css'

// 오늘에서 days일 전 날짜 'YYYY-MM-DD' (내 컴퓨터 날짜 기준)
function dateBefore(days) {
  const date = new Date(Date.now() - days * 86400000)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// N-34 신고 접수 (관리자) — 같은 글·댓글의 신고를 묶은 목록(N-34-1)에서 하나를 고르면 상세(N-34-2)와 처리(N-34-3)를 보여 준다.
// 상태·사유·기간으로 거르고, 자동 숨김 기준(N-33-2, ADM-14)을 3~10건 안에서 바꾼다.
export default function AdminReportsPage() {
  const [status, setStatus] = useState(null)
  const [reason, setReason] = useState(null)
  const [period, setPeriod] = useState('7')
  const [list, setList] = useState({ data: null, error: '' })
  const [listVersion, setListVersion] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [threshold, setThreshold] = useState({ value: null, min: 3, max: 10 })
  const [thresholdError, setThresholdError] = useState('')
  const [toast, setToast] = useState('')

  // 목록 — 필터가 바뀌거나 처리한 뒤에 다시 읽는다
  useEffect(() => {
    const days = REPORT_PERIODS.find((item) => item.value === period)?.days
    let alive = true
    fetchAdminReports({ status, reason, from: days ? dateBefore(days) : null, to: days ? dateBefore(0) : null })
      .then((data) => alive && setList({ data, error: '' }))
      .catch((err) => alive && setList({ data: null, error: err.message }))
    return () => {
      alive = false
    }
  }, [status, reason, period, listVersion])

  // 자동 숨김 기준 — 처음 한 번
  useEffect(() => {
    let alive = true
    fetchSettings()
      .then(({ settings }) => {
        const setting = settings.find((item) => item.settingKey === AUTO_HIDE_KEY)
        if (alive && setting) setThreshold({ value: setting.value, min: setting.min, max: setting.max })
      })
      .catch((err) => alive && setThresholdError(err.message))
    return () => {
      alive = false
    }
  }, [])

  const handleSaveThreshold = async () => {
    const { value, min, max } = threshold
    if (value == null || value < min || value > max) {
      setThresholdError(`${min}~${max}건 사이로 넣어 주세요.`)
      return
    }
    setThresholdError('')
    try {
      const saved = await updateSetting(AUTO_HIDE_KEY, value)
      setThreshold((prev) => ({ ...prev, value: saved.value }))
      setToast(`자동 숨김 기준을 ${saved.value}건으로 바꿨습니다.`)
      setListVersion((v) => v + 1)
    } catch (err) {
      setThresholdError(err.message)
    }
  }

  const handleProcessed = (done) => {
    setToast(`처리 결과를 저장했습니다 · ${labelOf(REPORT_RESULTS, done.resultCode)} · 신고 ${done.handledCount}건`)
    setListVersion((v) => v + 1)
  }

  const data = list.data
  const autoHide = data?.autoHideCount ?? threshold.value ?? '—'

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-head__title">신고 접수 게시판</h1>
          <p className="page-head__lead">같은 글·댓글에 들어온 신고를 묶어 보여 줍니다. 신고가 {autoHide}건 이상 쌓여 자동으로 숨겨진 대상이 먼저 나옵니다.</p>
        </div>
      </div>

      <section className="card l-g2 report-filters" aria-label="필터">
        <Select label="상태" value={status} onChange={setStatus} options={REPORT_STATUSES} placeholder="전체" />
        <Select label="사유" value={reason} onChange={setReason} options={REPORT_REASONS} placeholder="전체" />
        <Select label="기간" value={period} onChange={(value) => setPeriod(value ?? 'all')} options={REPORT_PERIODS} />
        <div className="report-filters__threshold">
          <NumberInput
            label="자동 숨김 기준"
            unit="건"
            value={threshold.value}
            min={threshold.min}
            max={threshold.max}
            onChange={(value) => setThreshold((prev) => ({ ...prev, value }))}
            error={thresholdError}
          />
          <Button onClick={handleSaveThreshold}>저장</Button>
        </div>
        <div className="form-field">
          <span className="form-field__label">미처리</span>
          <p className="report-filters__pending">{data ? `${data.pendingCount}건` : '—'}</p>
        </div>
      </section>

      {list.error && <Notice type="warn">{list.error}</Notice>}
      <div className="l-cols">
        <section className="card report-admin-page__list" aria-label="신고 목록">
          {data ? <AdminReportList items={data.items} selectedId={selectedId} onSelect={setSelectedId} /> : !list.error && <p className="hint">불러오는 중…</p>}
        </section>
        <section className="card l-cols__main" aria-label="신고 상세">
          {selectedId ? (
            <AdminReportDetail key={selectedId} reportId={selectedId} onProcessed={handleProcessed} />
          ) : (
            <p className="hint">왼쪽 목록에서 신고 대상을 고르세요.</p>
          )}
        </section>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </>
  )
}
