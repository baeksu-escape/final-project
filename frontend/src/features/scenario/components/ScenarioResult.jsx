import { Card } from '../../../common/components/index.js'

const won = (value) => (Number.isFinite(value) ? `${Math.round(value).toLocaleString('ko-KR')}원` : '—')
const signedWon = (value) => (Number.isFinite(value)
  ? `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Math.round(value)).toLocaleString('ko-KR')}원` : '—')
const pct = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}%` : '—')
// 상환 부담률 색 단계(N-16-2·N-20-4와 같은 30·40 기준).
const dsrClass = (value) => (!Number.isFinite(value) ? '' : value >= 40 ? 'sc-neg' : value >= 30 ? 'sc-warn' : 'sc-pos')

const ROWS = [
  { key: 'monthlyIncomeAmount', label: '월 소득' },
  { key: 'monthlyExpenseAmount', label: '월 고정 지출' },
  { key: 'monthlyPaymentAmount', label: '월 원리금' },
  { key: 'monthlySurplusAmount', label: '월 여유 자금', surplus: true },
]

// N-17-1 현재 월 원리금에 포함된 대출을 받은 순서대로 구분해 펼쳐 보여 준다.
function loanItemLabels(items) {
  const names = items.map((item) => item.loanTypeName?.trim() || '대출')
  const counts = names.reduce((result, name) => ({ ...result, [name]: (result[name] ?? 0) + 1 }), {})
  const seen = {}
  return items.map((item, index) => {
    const name = names[index]
    seen[name] = (seen[name] ?? 0) + 1
    const numberedName = counts[name] > 1 ? `${name} ${seen[name]}` : name
    const rate = Number.isFinite(item.annualRatePct) ? `${item.annualRatePct}%` : '—'
    const rateType = item.rateTypeCode === 'FIXED' ? '고정' : item.rateTypeCode === 'VARIABLE' ? '변동' : '미확인'
    return { key: item.loanId ?? index, text: `${numberedName} ${rate} ${rateType} ${won(item.monthlyPaymentAmount)}` }
  })
}

// N-17-5 현재와 시나리오 결과 및 서버 계산 가정을 함께 보여 준다.
export default function ScenarioResult({ result, baseline, assumptions, stale, calcError }) {
  const { current, changed } = result
  const loanItems = result.loanItems ?? baseline?.loanItems ?? []
  const max = Math.max(1, ...ROWS.flatMap((row) => [current[row.key], changed[row.key]]).filter(Number.isFinite).map(Math.abs))
  const width = (value) => `${Number.isFinite(value) ? Math.min(100, (Math.abs(value) / max) * 100) : 0}%`
  return (
    <Card title="결과" className="sc-result">
      {/* 안내가 나타나도 화면이 밀리지 않게 자리를 둔다. */}
      <p className="sc-warn" aria-live="polite">{calcError ? '계산하지 못해 이전 조건 결과를 보여 주고 있습니다.' : stale ? '위 결과는 이전 조건 기준입니다. 계산이 끝나면 바뀝니다.' : '\u00a0'}</p>
      <div className="sc-kpis">
        <div className="sc-kpi">
          <span className="sc-hint">이 상황의 월 여유 자금</span>
          <strong className={`sc-big ${changed.monthlySurplusAmount < 0 ? 'sc-neg' : 'sc-pos'}`}>{signedWon(changed.monthlySurplusAmount)}</strong>
          <span className="sc-hint">지금보다 {signedWon(result.surplusDiffAmount)}</span>
        </div>
        <div className="sc-kpi">
          <span className="sc-hint">상환 부담률</span>
          <strong className={`sc-big ${dsrClass(changed.dsrPct)}`}>{pct(changed.dsrPct)}</strong>
          <span className="sc-hint">지금 {pct(current.dsrPct)}</span>
        </div>
        <div className="sc-kpi">
          <span className="sc-hint">월 이자 변화</span>
          <strong className={`sc-big ${result.monthlyInterestChangeAmount > 0 ? 'sc-neg' : result.monthlyInterestChangeAmount < 0 ? 'sc-pos' : ''}`}>{signedWon(result.monthlyInterestChangeAmount)}</strong>
        </div>
      </div>
      <div className="sc-bars">
        {ROWS.map((row) => (
          <div key={row.key} className="sc-bar-row">
            <span className="sc-bar-row__title">
              {row.key === 'monthlyPaymentAmount' && loanItems.length ? (
                <details><summary>{row.label} (보유 대출 {loanItems.length}건)</summary><ul>{loanItemLabels(loanItems).map((item) => <li key={item.key}>{item.text}</li>)}</ul></details>
              ) : row.label}
            </span>
            <span className="sc-hint">현재</span>
            <span className="sc-track"><i className="sc-fill sc-fill--current" style={{ width: width(current[row.key]) }} /></span>
            <span className="sc-hint sc-num">{won(current[row.key])}</span>
            <span>상황</span>
            <span className="sc-track"><i className={`sc-fill ${row.surplus ? (changed[row.key] < 0 ? 'sc-fill--neg' : 'sc-fill--pos') : 'sc-fill--changed'}`} style={{ width: width(changed[row.key]) }} /></span>
            <strong className="sc-num">{won(changed[row.key])}</strong>
          </div>
        ))}
      </div>
      <Verdict result={result} />
      <p className="sc-hint">단위 원 · 원리금은 입력한 대출 기준, 월 고정 지출에는 할부·정기결제를 포함합니다. 시연용 계산이며 실제 심사 결과가 아닙니다.</p>
      {assumptions.length > 0 && <ul className="sc-hint">{assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul>}
    </Card>
  )
}

// N-17-4 판정 문구 — 돈이 모자라면 버틸 수 있는 개월 수, 좋아지면 늘어나는 여유 자금을 보여 준다.
function Verdict({ result }) {
  const { changed, current } = result
  if (result.verdict === 'SHORTFALL') {
    return (
      <p className="sc-box sc-box--warn">
        이 상황이면 매달 <strong>{won(-changed.monthlySurplusAmount)}</strong>이 모자랍니다.{' '}
        {Number.isInteger(result.survivableMonths)
          ? <>약 <strong>{result.survivableMonths}개월</strong> 버틸 수 있습니다.</>
          : '총자산 정보가 없어 버틸 수 있는 기간은 계산하지 않습니다.'}
      </p>
    )
  }
  if (result.verdict === 'IMPROVED') {
    return (
      <p className="sc-box sc-box--ok">
        지금보다 매달 <strong>{won(result.surplusDiffAmount)}</strong> 더 남습니다(월 여유 자금 {won(changed.monthlySurplusAmount)}).
        {' '}상환 부담률은 {pct(current.dsrPct)} → {pct(changed.dsrPct)}입니다.
      </p>
    )
  }
  if (result.verdict === 'STILL_POSITIVE') {
    return (
      <p className="sc-box sc-box--ok">
        이 상황에서도 매달 <strong>{won(changed.monthlySurplusAmount)}</strong>이 남습니다
        {result.surplusDiffAmount < 0 ? `(지금보다 ${won(-result.surplusDiffAmount)} 적음)` : ''}.
      </p>
    )
  }
  return <p className="sc-box">판정에 필요한 값이 없어 결과를 판정하지 않습니다.</p>
}
