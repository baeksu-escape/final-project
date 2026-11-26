// N-21-9 예측 결과 요약 — 예측 기간 누적 여유 자금, 가장 빠듯한 달, 월 지출 구성(CASH-04). 예상 점수 카드는 11/25 팀 결정으로 뺐다.
const signed = (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(Math.round(v)).toLocaleString('ko-KR')}`
const monthLabel = (baseMonth) => `${Number(String(baseMonth).slice(5, 7))}월`

const won = (v) => (Number.isFinite(v) ? `${Math.round(v).toLocaleString('ko-KR')}원` : '—')

// N-21-5 월 지출 구성 — 월 고정 지출(조건 값)·월 원리금(대출 상환)·할부·정기결제(기타 지출 기준값)와 합계를 보여 준다. 간편결제는 합계에 넣지 않는다.
// 월 고정 지출은 마지막으로 예측에 적용된 조건의 값이다. 서버 baseOtherExpenseAmount는 "월 지출 합계 − 고정지출(할부·정기결제·기타)"이라 할부·정기결제·기타 칸에 쓴다. 값이 하나라도 없으면 합계는 "—"이다. 조건이 바뀌어 결과가 이전 조건 기준이면 그래프처럼 흐리게 보인다.
function ExpenseBreakdown({ baseline, fixedExpenseAmount, stale }) {
  const parts = [fixedExpenseAmount, baseline?.monthlyPaymentAmount, baseline?.otherExpenseAmount]
  const total = parts.every(Number.isFinite) ? parts.reduce((sum, v) => sum + v, 0) : null
  return (
    <div className={stale ? 'cf-summary__item cf-summary__item--wide cf-chart-wrap--stale' : 'cf-summary__item cf-summary__item--wide'}>
      <span className="cf-hint">월 지출 구성</span>
      <strong className="cf-big">{won(total)}</strong>
      <div className="cf-breakdown">
        <span className="cf-hint">월 고정 지출 <b className="num">{won(fixedExpenseAmount)}</b></span>
        <span className="cf-hint">월 원리금(대출 상환) <b className="num">{won(baseline?.monthlyPaymentAmount)}</b></span>
        <span className="cf-hint">할부·정기결제·기타 <b className="num">{won(baseline?.otherExpenseAmount)}</b></span>
      </div>
    </div>
  )
}

export default function CashFlowSummary({ result, baseline, fixedExpenseAmount, stale }) {
  const { cumulativeSurplusAmount, tightestMonth } = result
  const deficit = baseline?.pastDeficitMonthsCount
  return (
    <div className="cf-summary">
      <div className="cf-summary__item">
        <span className="cf-hint">예측 기간 누적 여유 자금</span>
        <strong className={cumulativeSurplusAmount < 0 ? 'cf-big cf-neg' : 'cf-big cf-pos'}>{signed(cumulativeSurplusAmount)}원</strong>
      </div>
      <div className="cf-summary__item">
        <span className="cf-hint">가장 빠듯한 달</span>
        <strong className="cf-big">{tightestMonth ? `${monthLabel(tightestMonth.baseMonth)} ${signed(tightestMonth.netAmount)}원` : '—'}</strong>
      </div>
      <ExpenseBreakdown baseline={baseline} fixedExpenseAmount={fixedExpenseAmount} stale={stale} />
      {/* N-21-6 서버가 대출 원리금을 뺀 월 지출로 센 값이라 위 지출 구성 합계와 기준이 다르다. 줄은 값이 없어도 자리를 유지한다. */}
      <span className="cf-hint cf-summary__item--wide">최근 12개월 중 소득이 월 지출(대출 상환 제외)보다 적었던 달 {Number.isFinite(deficit) ? `${deficit}개월` : '—'}</span>
    </div>
  )
}
