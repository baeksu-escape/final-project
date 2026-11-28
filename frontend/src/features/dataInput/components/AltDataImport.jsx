import { useEffect, useRef, useState } from 'react'
import { Button, Card, Checkbox, FieldError, Modal, ProgressBar } from '../../../common/components/index.js'
import { formatWithComma } from '../../../common/utils/number.js'
import { agreeConsent, fetchConsents, importAltData, withdrawConsent } from '../api/dataInputApi.js'
import {
  ALT_DATA_CONSENT_TERMS,
  ALT_DATA_CONSENT_TYPE,
  ALT_DATA_MONTHS,
  ALT_DATA_SOURCES,
  ALT_DATA_TITLE,
  PAYMENT_STATUS_LABELS,
} from '../config/altDataSources.js'

// 동의 창에서 필수 체크를 하지 않고 [동의하고 불러오기]를 눌렀을 때의 문구. FP-227부터 체크 전에는 버튼이 꺼져 있어 안전장치로만 쓴다.
const CONSENT_REQUIRED_MESSAGE = '필수 동의에 체크해 주세요.'
// 전체 불러오기의 종류별 진행 상태 글자.
const BULK_STATUS_TEXT = { wait: '대기', run: '불러오는 중', done: '완료', fail: '실패' }
// [연결 해제]가 끝났을 때의 안내 문구.
const DISCONNECTED_MESSAGE = '연결을 해제하고 동의를 거뒀습니다.'

// 표의 칸 값을 형식에 맞춰 글자로 바꾼다.
function formatCell(value, format) {
  if (format === 'money') return `${formatWithComma(value)}원`
  if (format === 'count') return `${formatWithComma(value)}건`
  if (format === 'paymentStatus') return PAYMENT_STATUS_LABELS[value] ?? value
  return value
}

// 동의 목록의 체크 표시 — 상자 없이 체크만(체크하면 진하게)
function CheckMark({ on }) {
  return (
    <svg className={`alt-consent__check${on ? ' is-on' : ''}`} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

// 납부 상태의 의미 — 정상(좋음)·연체·미납(나쁨)·그 밖(주의). 코드(paymentStatusCode)가 있으면 코드로, 없으면 글자로 본다.
const STATUS_TONE = { ON_TIME: 'ok', LATE: 'bad', UNPAID: 'bad', PARTIAL: 'warn', NOT_DUE: 'muted' }
function statusTone(row) {
  if (row.paymentStatusCode && STATUS_TONE[row.paymentStatusCode]) return STATUS_TONE[row.paymentStatusCode]
  const text = String(row.paymentStatus ?? '')
  if (/정상|정시/.test(text)) return 'ok'
  if (/연체|미납/.test(text)) return 'bad'
  return 'warn'
}
const isStatusColumn = (column) => /^paymentStatus/.test(column.key)

// 카드 위 요약 한 줄 — 납부 내역은 '12개월 중 정상 납부 n건 · 월 평균 금액', 이용 내역(간편결제)은 '12개월 · 이용 n건 · 월 평균 금액'
function summarize(source, rows) {
  const money = source.columns.find((column) => column.format === 'money')
  const average = money && rows.length ? Math.round(rows.reduce((sum, row) => sum + (Number(row[money.key]) || 0), 0) / rows.length) : 0
  const averageText = `월 평균 ${formatWithComma(average)}원`
  if (source.columns.some(isStatusColumn)) {
    const okCount = rows.filter((row) => statusTone(row) === 'ok').length
    return `${rows.length}개월 중 정상 납부 ${okCount}건 · ${averageText}`
  }
  const count = source.columns.find((column) => column.format === 'count')
  const countText = count ? ` · 이용 ${formatWithComma(rows.reduce((sum, row) => sum + (Number(row[count.key]) || 0), 0))}건` : ''
  return `${rows.length}개월${countText} · ${averageText}`
}

// 서버 시각 문자열(2026-11-12T05:30:00.000Z)에서 날짜(2026-11-12)만 보여 준다.
function formatDate(isoText) {
  return isoText ? isoText.slice(0, 10) : ''
}

// 이 종류(제공 기관·항목)의 유효한 동의를 찾는다 — 거두지 않았고 만료되지 않은 동의. 없으면 undefined.
function findActiveConsent(consents, source) {
  return consents.find(
    (consent) =>
      consent.consentTypeCode === ALT_DATA_CONSENT_TYPE &&
      consent.providerCode === source.consent.providerCode &&
      consent.itemCode === source.consent.itemCode &&
      !consent.withdrawnAt &&
      (!consent.expiresAt || new Date(consent.expiresAt) > new Date()),
  )
}

// N-05 대안 데이터 모의 연동 — [전체 불러오기]로 한 번에(동의 → 차례로 조회 → 실패만 다시 시도), 또는 종류마다 [불러오기]를 누르면 더미 데이터를 받아 표로 보여 준다. 실제 외부 기관은 호출하지 않는다.
// N-05-9 항목별 정보 제공 동의 — 유효한 동의가 없으면 [불러오기] 전에 동의 창을 띄우고, 동의한 종류는 동의일과 [연결 해제]를 보여 준다.
// imported: { [종류 key]: { importedAt, rows } }   onImported(key, { importedAt, rows }): 불러오기에 성공하면 부모에 알린다.
// onDisconnected(key): [연결 해제]에 성공하면 부모에 알린다(부모는 그 종류의 표와 완료 현황을 비운다).
export default function AltDataImport({ baseMonth, imported, onImported, onDisconnected }) {
  const [pendingKey, setPendingKey] = useState(null)
  const [errors, setErrors] = useState({})
  const [notices, setNotices] = useState({})
  const [consents, setConsents] = useState([])
  const [consentLoadError, setConsentLoadError] = useState('')
  const [consentSource, setConsentSource] = useState(null)
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentError, setConsentError] = useState('')
  // N-05-6·N-05-9 동의 목록(토스 약관 방식) — 체크한 종류(하나씩 또는 전체 동의)·[보기]로 펼친 종류·종류별 진행 상태(null이면 아직 안 함)·진행 중 여부
  const [bulkPicked, setBulkPicked] = useState([])
  const [openTerms, setOpenTerms] = useState(null)
  const [bulkStatus, setBulkStatus] = useState(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  // FP-260 일괄 불러오기의 필수 동의 창 — 불러올 종류 전체(sources)와 그중 동의가 없는 종류(needConsent), 창에서 체크한 종류 key
  const [bulkConsent, setBulkConsent] = useState(null)
  const [bulkConsentChecked, setBulkConsentChecked] = useState([])
  const busy = pendingKey !== null || bulkRunning
  const sectionRef = useRef(null)
  const progressRef = useRef(null)
  // [동의하고 불러오기]를 누르면, 그리고 다 불러오면 아래 [다음] 버튼까지 부드럽게 내려간다(버튼 줄이 없으면 이 영역 끝까지)
  useEffect(() => {
    if (bulkStatus === null) return
    const next = sectionRef.current?.parentElement?.querySelector('.fin-actions') ?? sectionRef.current
    next?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [bulkRunning, bulkStatus === null]) // eslint-disable-line react-hooks/exhaustive-deps

  // 화면에 들어오면 이미 한 동의를 불러와, 동의한 종류는 [연결 해제] 상태로 보여 준다.
  useEffect(() => {
    let cancelled = false
    fetchConsents()
      .then(({ items }) => {
        if (!cancelled) setConsents(items ?? [])
      })
      .catch((error) => {
        if (!cancelled) setConsentLoadError(`동의 내역을 불러오지 못했습니다. (${error.message})`)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 종류 하나의 오류·안내 문구를 한꺼번에 바꾼다.
  const setMessages = (key, { error = '', notice = '' }) => {
    setErrors((prev) => ({ ...prev, [key]: error }))
    setNotices((prev) => ({ ...prev, [key]: notice }))
  }

  // 동의 번호로 종류 하나를 불러온다. 불러오는 동안 다른 버튼은 막고, 실패하면 그 종류 아래에 오류를 보여 준다.
  // 서버가 동의가 없다고(409 CONSENT_REQUIRED) 막으면 동의 목록을 다시 받아 화면을 서버와 맞춘다.
  const runImport = async (source, consentId) => {
    setPendingKey(source.key)
    setMessages(source.key, {})
    try {
      const { importedAt, rows, notice } = await importAltData(source, baseMonth, consentId)
      onImported(source.key, { importedAt, rows })
      // 기관 기록이 없는 계정이면 서버가 안내 문구(notice)를 보낸다 — 기존 안내 자리(표 위)에 보여 준다.
      if (notice) setMessages(source.key, { notice })
      return true
    } catch (error) {
      setMessages(source.key, { error: error.message })
      if (error.data?.code === 'CONSENT_REQUIRED') {
        fetchConsents()
          .then(({ items }) => setConsents(items ?? []))
          .catch(() => {})
      }
      return false
    } finally {
      setPendingKey(null)
    }
  }

  // 전체 불러오기 — 고른 종류를 차례로 처리한다. 동의가 없는 종류는 동의를 저장한 뒤 불러오고, 종류마다 진행 상태를 바꾼다.
  // 한 종류가 실패해도 나머지는 계속하고, 끝나면 실패한 종류만 [다시 시도]할 수 있다.
  // FP-260 동의 저장은 필수 동의 창에서 모두 체크한 뒤에만 이 함수로 온다(startBulk가 먼저 확인한다).
  const importMany = async (sources) => {
    setBulkRunning(true)
    setBulkStatus((prev) => ({ ...(prev ?? {}), ...Object.fromEntries(sources.map((source) => [source.key, 'wait'])) }))
    let known = consents
    for (const source of sources) {
      setBulkStatus((prev) => ({ ...prev, [source.key]: 'run' }))
      let consent = findActiveConsent(known, source)
      if (!consent) {
        try {
          const result = await agreeConsent(source.consent)
          consent = { consentId: result.consentId, consentTypeCode: ALT_DATA_CONSENT_TYPE, ...source.consent, agreedAt: result.agreedAt, withdrawnAt: null }
          known = [...known.filter((item) => item.consentId !== consent.consentId), consent]
          setConsents(known)
        } catch (error) {
          setMessages(source.key, { error: error.message })
          setBulkStatus((prev) => ({ ...prev, [source.key]: 'fail' }))
          continue
        }
      }
      const ok = await runImport(source, consent.consentId)
      setBulkStatus((prev) => ({ ...prev, [source.key]: ok ? 'done' : 'fail' }))
    }
    setBulkRunning(false)
  }

  // 불러올 종류 목록 — 줄마다 고르거나 [전체 선택]으로 모두 고른 뒤 [동의하고 불러오기]. 하나 이상 골라야 버튼이 켜진다.
  const pickedSources = ALT_DATA_SOURCES.filter((source) => bulkPicked.includes(source.key))
  const allPicked = bulkPicked.length === ALT_DATA_SOURCES.length
  const togglePick = (key) => setBulkPicked((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
  const toggleAll = () => setBulkPicked(allPicked ? [] : ALT_DATA_SOURCES.map((source) => source.key))

  // FP-260 N-05-9 일괄 불러오기 시작 — 고른 종류 중 유효한 동의가 없는 종류가 있으면 필수 동의 창을 먼저 띄운다.
  // 모두 이미 동의했으면 창 없이 바로 불러온다. [실패한 항목만 다시 시도]도 같은 확인을 거친다.
  const startBulk = (sources) => {
    const needConsent = sources.filter((source) => !findActiveConsent(consents, source))
    if (needConsent.length === 0) {
      importMany(sources)
      return
    }
    setBulkConsent({ sources, needConsent })
    setBulkConsentChecked([])
  }
  const handleBulkStart = (event) => {
    event.preventDefault()
    if (pickedSources.length === 0) return
    startBulk(pickedSources)
  }

  // 일괄 동의 창 — 종류마다 [필수] 체크, [전체 동의]로 한꺼번에. 모두 체크해야 [동의하고 불러오기]가 켜진다.
  const bulkConsentKeys = bulkConsent ? bulkConsent.needConsent.map((source) => source.key) : []
  const bulkConsentAll = bulkConsentKeys.length > 0 && bulkConsentKeys.every((key) => bulkConsentChecked.includes(key))
  const toggleBulkConsent = (key, checked) =>
    setBulkConsentChecked((prev) => (checked ? [...prev.filter((item) => item !== key), key] : prev.filter((item) => item !== key)))
  // [취소]·Esc·배경 클릭 — 아무것도 저장하지 않고 닫는다.
  const closeBulkConsent = () => setBulkConsent(null)
  // [동의하고 불러오기] — 창을 닫고 동의 저장 → 불러오기를 종류마다 차례로 한다(importMany).
  const handleBulkAgree = (event) => {
    event.preventDefault()
    if (!bulkConsent || !bulkConsentAll) return
    const { sources } = bulkConsent
    setBulkConsent(null)
    importMany(sources)
  }
  const failedSources = ALT_DATA_SOURCES.filter((source) => bulkStatus?.[source.key] === 'fail')
  const bulkKeys = bulkStatus ? Object.keys(bulkStatus) : []
  const bulkDone = bulkKeys.filter((key) => bulkStatus[key] === 'done' || bulkStatus[key] === 'fail').length

  // [불러오기] — 유효한 동의가 있으면 바로 불러오고, 없으면 동의 창을 연다.
  const handleImport = (source) => {
    const consent = findActiveConsent(consents, source)
    if (consent) {
      runImport(source, consent.consentId)
      return
    }
    setConsentSource(source)
    setConsentChecked(false)
    setConsentError('')
  }

  // 동의 창 닫기([취소]·Esc·배경 클릭).
  const closeConsent = () => setConsentSource(null)

  // 동의 창의 [동의하고 불러오기] — 필수 체크를 확인하고 동의를 저장한 뒤, 받은 동의 번호로 불러온다.
  const handleAgree = async (event) => {
    event.preventDefault()
    if (!consentChecked) {
      setConsentError(CONSENT_REQUIRED_MESSAGE)
      return
    }
    const source = consentSource
    setPendingKey(source.key)
    let consentId
    try {
      const result = await agreeConsent(source.consent)
      consentId = result.consentId
      setConsents((prev) => [
        ...prev.filter((consent) => consent.consentId !== consentId),
        { consentId, consentTypeCode: ALT_DATA_CONSENT_TYPE, ...source.consent, agreedAt: result.agreedAt, withdrawnAt: null },
      ])
    } catch (error) {
      setConsentError(error.message)
      setPendingKey(null)
      return
    }
    setConsentSource(null)
    await runImport(source, consentId)
  }

  // [연결 해제] — 동의를 거두고, 성공하면 부모에 알려 그 종류의 표를 비운다.
  const handleDisconnect = async (source, consent) => {
    setPendingKey(source.key)
    setMessages(source.key, {})
    try {
      const { withdrawnAt } = await withdrawConsent(consent.consentId)
      setConsents((prev) => prev.map((item) => (item.consentId === consent.consentId ? { ...item, withdrawnAt } : item)))
      onDisconnected(source.key)
      setMessages(source.key, { notice: DISCONNECTED_MESSAGE })
    } catch (error) {
      setMessages(source.key, { error: error.message })
    } finally {
      setPendingKey(null)
    }
  }

  return (
    <section className="alt-data" ref={sectionRef}>
      <h2 className="alt-data__title">{ALT_DATA_TITLE}</h2>
      <p className="alt-data__notice">
        실제 외부 기관에 연결하지 않고, 기준월을 포함한 최근 {ALT_DATA_MONTHS}개월의 더미 데이터를 불러옵니다.
      </p>
      <FieldError message={consentLoadError} />
      {/* N-05-6·N-05-9 불러올 종류 고르기 — [전체 선택] 또는 줄마다 고르고, [보기]로 제공 기관·항목·목적·보관 기간을 펼친다.
          FP-260 동의가 없는 종류가 있으면 필수 동의 창에서 모두 체크한 뒤에만 동의를 저장하고 차례로 불러온다. 종류별 [불러오기]·[연결 해제]는 아래 카드에 그대로 둔다. */}
      <form className="alt-data__bulk alt-consent" onSubmit={handleBulkStart} noValidate>
        <button type="button" className="alt-consent__all" role="checkbox" aria-checked={allPicked} onClick={toggleAll} disabled={busy}>
          <CheckMark on={allPicked} />
          <b>전체 선택</b>
          <span>아래 종류를 모두 불러올게요.</span>
        </button>
        <ul className="alt-consent__list">
          {ALT_DATA_SOURCES.map((source) => {
            const on = bulkPicked.includes(source.key)
            const agreed = Boolean(findActiveConsent(consents, source))
            return (
              <li key={source.key}>
                <div className="alt-consent__row">
                  <button type="button" className="alt-consent__pick" role="checkbox" aria-checked={on} onClick={() => togglePick(source.key)} disabled={busy}>
                    <CheckMark on={on} />
                    <em>{agreed ? '동의함' : '동의 전'}</em>
                    <span>{source.label} 불러오기 ({source.consent.providerName})</span>
                  </button>
                  <button
                    type="button"
                    className="alt-consent__view"
                    aria-expanded={openTerms === source.key}
                    onClick={() => setOpenTerms((prev) => (prev === source.key ? null : source.key))}
                  >
                    보기
                  </button>
                </div>
                {openTerms === source.key && (
                  <dl className="alt-consent__terms">
                    <dt>불러오는 항목</dt>
                    <dd>기준월을 포함한 최근 {ALT_DATA_MONTHS}개월의 {source.consent.itemsText}</dd>
                    <dt>이용 목적</dt>
                    <dd>{ALT_DATA_CONSENT_TERMS.purpose}</dd>
                    <dt>보관 기간</dt>
                    <dd>{ALT_DATA_CONSENT_TERMS.retention}</dd>
                  </dl>
                )}
              </li>
            )
          })}
        </ul>
        <button type="submit" className="auth-form__submit alt-consent__submit" disabled={!baseMonth || busy || pickedSources.length === 0}>
          {bulkRunning ? '불러오는 중…' : pickedSources.length > 0 ? `동의하고 불러오기 (${pickedSources.length}개)` : '동의하고 불러오기'}
        </button>
        {bulkStatus && (
          <div className="alt-data__progress" aria-live="polite" ref={progressRef}>
            <ProgressBar label="전체 불러오기 진행" value={bulkDone} max={bulkKeys.length} />
            <p className="hint">{bulkKeys.length}개 중 {bulkDone}개 처리{failedSources.length > 0 && !bulkRunning ? ` · 실패 ${failedSources.length}개` : ''}</p>
            <ul className="alt-data__progress-list">
              {ALT_DATA_SOURCES.filter((source) => bulkStatus[source.key]).map((source) => (
                <li key={source.key} className={`is-${bulkStatus[source.key]}`}>{source.label} <b>{BULK_STATUS_TEXT[bulkStatus[source.key]]}</b></li>
              ))}
            </ul>
            {failedSources.length > 0 && !bulkRunning && (
              <Button size="sm" onClick={() => startBulk(failedSources)}>실패한 항목만 다시 시도</Button>
            )}
          </div>
        )}
      </form>
      {ALT_DATA_SOURCES.map((source) => {
        const result = imported?.[source.key]
        const consent = findActiveConsent(consents, source)
        // 불러온 기관 — 한 줄 머리(기관명 + 연동 완료 배지 | 다시 불러오기·연결 해제), 요약 박스, 높이를 고정한 월별 표
        if (result) {
          return (
            <Card key={source.key} className={`alt-data-source alt-data-source--${source.key} is-imported`}>
              <div className="alt-data-source__head">
                <div className="alt-data-source__name">
                  <b>{source.label}</b>
                  <span className="alt-data-source__badge">연동 완료</span>
                </div>
                <div className="alt-data-source__links">
                  <button type="button" className="alt-data-source__text-btn" onClick={() => handleImport(source)} disabled={!baseMonth || busy} aria-label={`${source.label} 다시 불러오기`}>
                    다시 불러오기
                  </button>
                  {consent && (
                    <button type="button" className="alt-data-source__text-btn is-muted" onClick={() => handleDisconnect(source, consent)} disabled={busy} aria-label={`${source.label} 연결 해제`}>
                      연결 해제
                    </button>
                  )}
                </div>
              </div>
              <p className="alt-data-source__summary">{summarize(source, result.rows)}</p>
              {notices[source.key] && (
                <p className="alt-data-source__result" role="status">
                  {notices[source.key]}
                </p>
              )}
              <FieldError message={errors[source.key]} />
              <div className="alt-data-source__scroll" tabIndex={0} aria-label={`${source.label} 월별 내역`}>
                <table className="alt-data-table">
                  <thead>
                    <tr>
                      {source.columns.map((column) => (
                        <th key={column.key} scope="col">
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, index) => (
                      <tr key={`${row.month ?? row.billMonth}-${index}`}>
                        {source.columns.map((column) => (
                          <td key={column.key}>
                            {isStatusColumn(column) ? (
                              <span className={`alt-data-status is-${statusTone(row)}`}>{formatCell(row[column.key], column.format)}</span>
                            ) : (
                              formatCell(row[column.key], column.format)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        }
        return (
          <Card key={source.key} title={source.label} className={`alt-data-source alt-data-source--${source.key}`}>
            <button
              type="button"
              className="alt-data-source__import"
              onClick={() => handleImport(source)}
              disabled={!baseMonth || busy}
              aria-label={`${source.label} 불러오기`}
            >
              불러오기
            </button>
            {consent && (
              <>
                <p className="alt-data-source__consent-date">동의일: {formatDate(consent.agreedAt)}</p>
                <button
                  type="button"
                  className="alt-data-source__disconnect"
                  onClick={() => handleDisconnect(source, consent)}
                  disabled={busy}
                  aria-label={`${source.label} 연결 해제`}
                >
                  연결 해제
                </button>
              </>
            )}
            {notices[source.key] && (
              <p className="alt-data-source__result" role="status">
                {notices[source.key]}
              </p>
            )}
            <FieldError message={errors[source.key]} />
          </Card>
        )
      })}

      {/* N-05-9 정보 제공 동의 창 — 제공 기관·불러오는 항목·이용 목적·보관 기간을 보여 주고 [필수] 체크를 받는다. */}
      <Modal open={consentSource !== null} title={`${consentSource?.label ?? ''} 정보 제공 동의`} onClose={closeConsent}>
        {consentSource && (
          <form className="alt-data-consent" onSubmit={handleAgree} noValidate>
            <dl className="alt-data-consent__terms">
              <dt>제공 기관</dt>
              <dd>{consentSource.consent.providerName}</dd>
              <dt>불러오는 항목</dt>
              <dd>
                기준월을 포함한 최근 {ALT_DATA_MONTHS}개월의 {consentSource.consent.itemsText}
              </dd>
              <dt>이용 목적</dt>
              <dd>{ALT_DATA_CONSENT_TERMS.purpose}</dd>
              <dt>보관 기간</dt>
              <dd>{ALT_DATA_CONSENT_TERMS.retention}</dd>
            </dl>
            <Checkbox
              label="[필수] 위 내용으로 정보 제공에 동의합니다."
              checked={consentChecked}
              onChange={(checked) => {
                setConsentChecked(checked)
                if (checked) setConsentError('')
              }}
              error={consentError}
            />
            {/* FP-227 필수 동의에 체크하기 전에는 [동의하고 불러오기]를 꺼 두고 안내를 보인다(위 오류 문구는 안전장치로만 남긴다). */}
            {!consentChecked && <p className="hint">필수 동의에 체크하면 불러올 수 있습니다.</p>}
            <Button type="submit" variant="primary" disabled={pendingKey !== null || !consentChecked}>
              동의하고 불러오기
            </Button>
            <Button onClick={closeConsent}>취소</Button>
          </form>
        )}
      </Modal>

      {/* FP-260 N-05-9 일괄 불러오기 동의 창 — 동의가 없는 종류만 모아 종류별 창과 같은 항목·문구로 보여 주고, 종류마다 [필수] 체크를 받는다. */}
      <Modal open={bulkConsent !== null} title={`정보 제공 동의 (${bulkConsentKeys.length}개)`} onClose={closeBulkConsent}>
        {bulkConsent && (
          <form className="alt-data-consent" onSubmit={handleBulkAgree} noValidate>
            <Checkbox
              label="[필수] 아래 기관의 정보 제공에 모두 동의합니다."
              checked={bulkConsentAll}
              onChange={(checked) => setBulkConsentChecked(checked ? bulkConsentKeys : [])}
            />
            {bulkConsent.needConsent.map((source) => (
              <div key={source.key}>
                <dl className="alt-data-consent__terms">
                  <dt>제공 기관</dt>
                  <dd>{source.consent.providerName}</dd>
                  <dt>불러오는 항목</dt>
                  <dd>
                    기준월을 포함한 최근 {ALT_DATA_MONTHS}개월의 {source.consent.itemsText}
                  </dd>
                  <dt>이용 목적</dt>
                  <dd>{ALT_DATA_CONSENT_TERMS.purpose}</dd>
                  <dt>보관 기간</dt>
                  <dd>{ALT_DATA_CONSENT_TERMS.retention}</dd>
                </dl>
                <Checkbox
                  label={`[필수] 위 내용으로 ${source.label} 정보 제공에 동의합니다.`}
                  checked={bulkConsentChecked.includes(source.key)}
                  onChange={(checked) => toggleBulkConsent(source.key, checked)}
                />
              </div>
            ))}
            {!bulkConsentAll && <p className="hint">필수 동의에 모두 체크하면 불러올 수 있습니다.</p>}
            <Button type="submit" variant="primary" disabled={busy || !bulkConsentAll}>
              동의하고 불러오기
            </Button>
            <Button onClick={closeBulkConsent}>취소</Button>
          </form>
        )}
      </Modal>
    </section>
  )
}
