import { useEffect, useState } from 'react'
import { Button, Card, Checkbox, FieldError, Modal } from '../../../common/components/index.js'
import { formatWithComma } from '../../../common/utils/number.js'
import { agreeConsent, fetchConsents, importAltData, withdrawConsent } from '../api/dataInputApi.js'
import {
  ALT_DATA_CONSENT_TERMS,
  ALT_DATA_CONSENT_TYPE,
  ALT_DATA_MONTHS,
  ALT_DATA_SOURCES,
  PAYMENT_STATUS_LABELS,
} from '../config/altDataSources.js'

// 동의 창에서 필수 체크를 하지 않고 [동의하고 불러오기]를 눌렀을 때의 문구.
const CONSENT_REQUIRED_MESSAGE = '필수 동의에 체크해 주세요.'
// [연결 해제]가 끝났을 때의 안내 문구.
const DISCONNECTED_MESSAGE = '연결을 해제하고 동의를 거뒀습니다.'

// 표의 칸 값을 형식에 맞춰 글자로 바꾼다.
function formatCell(value, format) {
  if (format === 'money') return `${formatWithComma(value)}원`
  if (format === 'count') return `${formatWithComma(value)}건`
  if (format === 'paymentStatus') return PAYMENT_STATUS_LABELS[value] ?? value
  return value
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

// N-05 대안 데이터 모의 연동 — 종류마다 [불러오기]를 누르면 더미 데이터를 받아 표로 보여 준다. 실제 외부 기관은 호출하지 않는다.
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
      const { importedAt, rows } = await importAltData(source, baseMonth, consentId)
      onImported(source.key, { importedAt, rows })
    } catch (error) {
      setMessages(source.key, { error: error.message })
      if (error.data?.code === 'CONSENT_REQUIRED') {
        fetchConsents()
          .then(({ items }) => setConsents(items ?? []))
          .catch(() => {})
      }
    } finally {
      setPendingKey(null)
    }
  }

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
    <section className="alt-data">
      <h2 className="alt-data__title">대안 데이터 불러오기 (모의 연동)</h2>
      <p className="alt-data__notice">
        실제 외부 기관에 연결하지 않고, 기준월을 포함한 최근 {ALT_DATA_MONTHS}개월의 더미 데이터를 불러옵니다.
      </p>
      <FieldError message={consentLoadError} />
      {ALT_DATA_SOURCES.map((source) => {
        const result = imported?.[source.key]
        const consent = findActiveConsent(consents, source)
        return (
          <Card key={source.key} title={source.label} className={`alt-data-source alt-data-source--${source.key}`}>
            <button
              type="button"
              className="alt-data-source__import"
              onClick={() => handleImport(source)}
              disabled={!baseMonth || pendingKey !== null}
              aria-label={`${source.label} 불러오기`}
            >
              {result ? '다시 불러오기' : '불러오기'}
            </button>
            {consent && (
              <>
                <p className="alt-data-source__consent-date">동의일: {formatDate(consent.agreedAt)}</p>
                <button
                  type="button"
                  className="alt-data-source__disconnect"
                  onClick={() => handleDisconnect(source, consent)}
                  disabled={pendingKey !== null}
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
            {result && (
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
                        <td key={column.key}>{formatCell(row[column.key], column.format)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
            <Button type="submit" variant="primary" disabled={pendingKey !== null}>
              동의하고 불러오기
            </Button>
            <Button onClick={closeConsent}>취소</Button>
          </form>
        )}
      </Modal>
    </section>
  )
}
