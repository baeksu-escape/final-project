// N-21-9 예측 결과 요약 카드 3개 — 예측 기간 누적 잉여, 가장 빠듯한 달, n개월 뒤 예상 점수.
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v)).toLocaleString('ko-KR')}`
const monthLabel = (baseMonth) => `${Number(String(baseMonth).slice(5, 7))}월`

export default function CashFlowSummary({ result, months }) {
  const { cumulativeSurplusAmount, tightestMonth, currentScore, endScore } = result
  return (
    <div className="cf-summary">
      <div className="cf-summary__item">
        <span className="cf-hint">예측 기간 누적 잉여</span>
        <strong className={cumulativeSurplusAmount < 0 ? 'cf-big cf-neg' : 'cf-big cf-pos'}>{signed(cumulativeSurplusAmount)}원</strong>
      </div>
      <div className="cf-summary__item">
        <span className="cf-hint">가장 빠듯한 달</span>
        <strong className="cf-big">{tightestMonth ? `${monthLabel(tightestMonth.baseMonth)} · ${signed(tightestMonth.netAmount)}원` : '—'}</strong>
      </div>
      <div className="cf-summary__item">
        <span className="cf-hint">{months}개월 뒤 예상 점수</span>
        <strong className="cf-big">
          {Number.isInteger(endScore) ? endScore : '—'}
          {Number.isInteger(endScore) && Number.isInteger(currentScore) && <span className="cf-hint"> ({signed(endScore - currentScore)})</span>}
        </strong>
      </div>
    </div>
  )
}
