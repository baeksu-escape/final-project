import { Card } from '../../../common/components/index.js'

const won = (value) => (Number.isFinite(value) ? `${Math.round(value).toLocaleString('ko-KR')}원` : '—')
const signedWon = (value) => (Number.isFinite(value)
  ? `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Math.round(value)).toLocaleString('ko-KR')}원` : '—')
const pct = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}%` : '—')
const tone = (value) => (!Number.isFinite(value) || value === 0 ? '' : value < 0 ? 'sc-neg' : 'sc-pos')
// (시안) 빚 갚는 비율은 색을 '변화 방향'으로 보여 주고, 단계(N-16-2·N-20-4와 같은 30·40 기준)는 글자로 덧붙인다.
const dsrStep = (value) => (!Number.isFinite(value) ? '' : value >= 40 ? ' · 위험' : value >= 30 ? ' · 주의' : '')
const dsrTone = (before, after) => (!Number.isFinite(before) || !Number.isFinite(after) || before === after ? '' : after > before ? 'sc-neg' : 'sc-pos')

const ROWS = [
  { key: 'monthlyIncomeAmount', label: '월 소득' },
  { key: 'monthlyExpenseAmount', label: '월 지출 (할부·정기결제 포함)' },
  { key: 'monthlyPaymentAmount', label: '대출 갚는 돈' },
  { key: 'monthlySurplusAmount', label: '한 달에 남는 돈', surplus: true },
]

// N-17-5 (시안·쉬운 화면) 답 한 문장 → 큰 숫자 2개 → 작은 줄 2개 → 지금과 이 상황 비교(막대)·계산 가정 순서로 모두 펼쳐 보여 준다.
// 숫자와 계산은 바꾸지 않고 보여 주는 순서와 말만 바꾼다.
export default function ScenarioResult({ result, assumptions, stale, calcError }) {
  const { current, changed } = result
  const max = Math.max(1, ...ROWS.flatMap((row) => [current[row.key], changed[row.key]]).filter(Number.isFinite).map(Math.abs))
  const width = (value) => `${Number.isFinite(value) ? Math.min(100, (Math.abs(value) / max) * 100) : 0}%`
  const interest = result.monthlyInterestChangeAmount
  return (
    <Card title="결과" className="sc-result">
      {/* 안내가 나타나도 화면이 밀리지 않게 자리를 둔다. */}
      <p className="sc-warn" aria-live="polite">{calcError ? '계산하지 못해 이전 조건 결과를 보여 주고 있어요.' : stale ? '아래 결과는 이전 조건 기준이에요. 왼쪽 [예상 시나리오 계산하기]를 누르면 바뀌어요.' : ' '}</p>
      <Answer result={result} />
      <div className="sc-pair">
        <div className="sc-kpi">
          <span className="sc-hint">한 달에 남는 돈</span>
          <strong className={`sc-big sc-big--xl ${tone(changed.monthlySurplusAmount)}`}>{signedWon(changed.monthlySurplusAmount)}</strong>
          <span className="sc-hint">지금 {signedWon(current.monthlySurplusAmount)}</span>
        </div>
        <div className="sc-kpi">
          <span className="sc-hint">지금보다</span>
          <strong className={`sc-big sc-big--xl ${tone(result.surplusDiffAmount)}`}>{signedWon(result.surplusDiffAmount)}</strong>
          <span className="sc-hint">{!Number.isFinite(result.surplusDiffAmount) || result.surplusDiffAmount === 0 ? '지금과 같아요' : result.surplusDiffAmount < 0 ? '매달 덜 남아요' : '매달 더 남아요'}</span>
        </div>
      </div>
      <dl className="sc-lines">
        <div>
          <dt>소득 중 빚 갚는 비율</dt>
          <dd className={dsrTone(current.dsrPct, changed.dsrPct)}>{pct(current.dsrPct)} → <strong>{pct(changed.dsrPct)}</strong>{dsrStep(changed.dsrPct)}</dd>
        </div>
        <div>
          <dt>금리 때문에 바뀌는 이자</dt>
          <dd className={interest > 0 ? 'sc-neg' : interest < 0 ? 'sc-pos' : ''}>월 <strong>{signedWon(interest)}</strong></dd>
        </div>
      </dl>
      <section className="sc-detail" aria-label="지금과 이 상황 비교">
        <p className="sc-detail__title">지금과 이 상황 비교</p>
        <div className="sc-bars">
          {ROWS.map((row) => (
            <div key={row.key} className="sc-bar-row">
              <span className="sc-bar-row__title">{row.label}</span>
              <span className="sc-hint">지금</span>
              <span className="sc-track"><i className="sc-fill sc-fill--current" style={{ width: width(current[row.key]) }} /></span>
              <span className="sc-hint sc-num">{won(current[row.key])}</span>
              <span>이 상황</span>
              <span className="sc-track"><i className={`sc-fill ${row.surplus ? (changed[row.key] < 0 ? 'sc-fill--neg' : 'sc-fill--pos') : 'sc-fill--changed'}`} style={{ width: width(changed[row.key]) }} /></span>
              <strong className="sc-num">{won(changed[row.key])}</strong>
            </div>
          ))}
        </div>
        <p className="sc-hint">단위 원 · 대출 갚는 돈은 입력한 대출 기준이에요. 시연용 계산이며 실제 심사 결과가 아니에요.</p>
        {assumptions.length > 0 && <ul className="sc-hint">{assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul>}
      </section>
    </Card>
  )
}

// N-17-4 (시안) 답 한 문장 — 모자라면 버틸 수 있는 개월 수, 좋아지면 늘어나는 돈을 맨 위에 크게 보여 준다.
function Answer({ result }) {
  const { changed } = result
  if (result.verdict === 'SHORTFALL') {
    return (
      <p className="sc-answer sc-box--warn">
        이 상황이면 매달 <strong>{won(-changed.monthlySurplusAmount)}</strong>이 모자라요.{' '}
        {Number.isInteger(result.survivableMonths)
          ? <>모아 둔 돈으로 약 <strong>{result.survivableMonths}개월</strong> 버틸 수 있어요.</>
          : '총자산 정보가 없어 버틸 수 있는 기간은 계산하지 않아요.'}
      </p>
    )
  }
  if (result.verdict === 'IMPROVED') {
    return (
      <p className="sc-answer sc-box--ok">
        지금보다 매달 <strong>{won(result.surplusDiffAmount)}</strong> 더 남아요. 한 달에 <strong>{won(changed.monthlySurplusAmount)}</strong>이 남아요.
      </p>
    )
  }
  if (result.verdict === 'STILL_POSITIVE') {
    return (
      <p className="sc-answer sc-box--ok">
        이 상황에서도 매달 <strong>{won(changed.monthlySurplusAmount)}</strong>이 남아요
        {result.surplusDiffAmount < 0 ? ` (지금보다 ${won(-result.surplusDiffAmount)} 적어요)` : ''}.
      </p>
    )
  }
  return <p className="sc-answer">판정에 필요한 값이 없어 결과를 판정하지 않아요.</p>
}
