import { useEffect, useState } from 'react'
import { useAuth } from '../../../common/auth/useAuth.js'
import { Button, Card, MoneyInput, Notice } from '../../../common/components/index.js'
import { JOB_TYPE_LABELS } from '../../../common/config/jobTypes.js'
import { calculateAssetDebtPreview, getAssetDebtData } from '../api/financeApi.js'
import AssetDebtLoans from '../components/AssetDebtLoans.jsx'
import AssetDebtPeerComparison from '../components/AssetDebtPeerComparison.jsx'
import AssetDebtRatios from '../components/AssetDebtRatios.jsx'
import '../styles/assetDebt.css'

const FIELDS = [
  { key: 'totalAssetAmount', label: '총자산' },
  { key: 'annualIncomeAmount', label: '연소득' },
  { key: 'totalDebtAmount', label: '총부채' },
]
const PREVIEW_DELAY_MS = 300

// N-16-1·N-16-2·N-16-3 회원의 저장 기준값으로 건전성을 비교한다. 입력 변경은 저장하지 않는다.
export default function AssetDebtPage() {
  const { user } = useAuth()
  const [revision, setRevision] = useState(0)
  const [load, setLoad] = useState({ key: null, data: null, error: '' })
  const [draft, setDraft] = useState({ key: null, values: null })
  const [preview, setPreview] = useState({ key: null, signature: '', result: null, error: '' })
  const key = JSON.stringify([user?.userId, user?.jobType, revision])

  // N-16-1 회원·직군·재조회마다 범위를 구분해 이전 회원의 값과 늦은 응답을 표시하지 않는다.
  useEffect(() => {
    let active = true
    getAssetDebtData(user?.userId, user?.jobType).then(
      (data) => { if (active) setLoad({ key, data, error: '' }) },
      (error) => { if (active) setLoad({ key, data: null, error: error.message }) },
    )
    return () => { active = false }
  }, [key, user?.userId, user?.jobType])

  const baseline = load.key === key && !load.error ? load.data : null
  const values = !baseline ? null : draft.key === key ? draft.values : Object.fromEntries(FIELDS.map(({ key: field }) => [field, baseline[field]]))
  const invalid = Boolean(values) && FIELDS.some(({ key: field }) => values[field] != null && (!Number.isSafeInteger(values[field]) || values[field] < 0))
  const valuesSignature = JSON.stringify(values)

  // N-16-3 입력이 바뀌면 약 300ms 뒤 건전성 계산 API를 부르고, 그사이 값이 또 바뀌면 늦게 온 이전 응답은 버린다.
  useEffect(() => {
    if (!baseline || invalid) return undefined
    let active = true
    const timer = setTimeout(() => {
      calculateAssetDebtPreview(baseline, JSON.parse(valuesSignature)).then(
        (result) => { if (active) setPreview({ key, signature: valuesSignature, result, error: '' }) },
        (error) => { if (active) setPreview({ key, signature: valuesSignature, result: null, error: error.message }) },
      )
    }, PREVIEW_DELAY_MS)
    return () => { active = false; clearTimeout(timer) }
  }, [baseline, invalid, key, valuesSignature])

  if (load.key !== key) return <p role="status">자산·부채 자료를 불러오는 중입니다.</p>
  if (load.error) return <Notice type="warn">{load.error} <Button onClick={() => setRevision((value) => value + 1)}>다시 시도</Button></Notice>
  const errors = Object.fromEntries(FIELDS.map(({ key: field }) => [field,
    values[field] == null ? ''
      : !Number.isSafeInteger(values[field]) || values[field] < 0 ? '0원 이상의 안전한 원 단위 정수로 입력해 주세요.' : '',
  ]))
  // 다시 계산하는 동안에는 직전 결과를 그대로 두고, 현재 입력과 맞는 응답이 오면 안내 문구를 지운다.
  const previewInScope = !invalid && preview.key === key
  const result = previewInScope ? preview.result : null
  const calculationError = previewInScope ? preview.error : ''
  const calculating = !invalid && !(previewInScope && preview.signature === valuesSignature)
  const workerLabel = JOB_TYPE_LABELS[user?.jobType] ?? '내 직군'
  return <div className="ad-page">
    <header className="ad-heading"><h1>자산·부채 건전성</h1><p>{workerLabel} 기준으로 부채 부담을 살펴봅니다. 숫자를 바꾸면 바로 다시 계산하며 저장된 값에는 반영되지 않습니다.</p></header>
    <div className="ad-top-grid">
      <Card title="내 재무 상태" className="ad-inputs">
        {FIELDS.map(({ key: field, label }) => <MoneyInput key={field} label={label} value={values[field]} error={errors[field]}
          onChange={(value) => setDraft({ key, values: { ...values, [field]: value } })} />)}
        {FIELDS.some(({ key: field }) => values[field] == null) && <p className="ad-hint" role="status">미입력: {FIELDS.filter(({ key: field }) => values[field] == null).map(({ label }) => label).join(' · ')}. 관련 값은 0원으로 대체하지 않고 계산 불가로 표시합니다.</p>}
        <p className="ad-summary-values">순자산 <strong>{formatAmount(result?.totalNetAssetAmount)}</strong> · 연 상환액 <strong>{formatAmount(result?.annualPaymentAmount)}</strong>{calculating && <span className="ad-hint" role="status"> · 계산하는 중</span>}</p>
        {invalid && <Notice type="warn">금액 형식을 확인해 주세요. 잘못된 입력으로 계산하지 않습니다.</Notice>}{calculationError && <Notice type="warn">{calculationError}</Notice>}
        <Button onClick={() => setDraft({ key: null, values: null })}>내 데이터로 되돌리기</Button>
        <Notice>상환액 변화는 시연 가정입니다. 실제 신용평가·대출 심사 결과가 아닙니다.</Notice>
        {Array.isArray(result?.assumptions) && result.assumptions.length > 0 && <ul className="ad-hint">{result.assumptions.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul>}
      </Card>
      <div><AssetDebtRatios result={result} /></div>
    </div>
    <div className="ad-bottom-grid"><AssetDebtPeerComparison values={values} peer={baseline.peer} workerLabel={workerLabel} /><AssetDebtLoans loans={baseline.loans} /></div>
  </div>
}

// N-16-1 순자산의 음수는 그대로 표시하고 미산출을 0원으로 바꾸지 않는다.
function formatAmount(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('ko-KR')}원` : '—'
}
