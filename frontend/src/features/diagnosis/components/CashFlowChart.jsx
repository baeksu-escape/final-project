// N-21-9 실적·전망 차트 — 최근 12개월 실적 막대 뒤에 예측 막대(연한 색·점선)를 잇고, 월 지출선을 겹쳐 그린다. 예상 점수선은 11/25 팀 결정으로 뺐다.
// 공통 차트로는 막대·선·보조축을 한 그림에 겹칠 수 없어 이 화면 전용 SVG로 그린다.
const W = 960, H = 300, X0 = 84, X1 = 900, Y0 = 36, Y1 = 270

const monthLabel = (baseMonth) => `${Number(String(baseMonth).slice(5, 7))}월`
const won = (v) => Math.round(Number(v) || 0).toLocaleString('ko-KR')

export default function CashFlowChart({ actualMonths, forecastMonths, monthlyExpenseAmount }) {
  const bars = [...actualMonths.map((row) => ({ ...row, forecast: false })), ...forecastMonths.map((row) => ({ ...row, forecast: true }))]
  const n = bars.length
  const step = (X1 - X0) / n
  const bw = step * 0.62
  const top = Math.max(...bars.map((row) => row.incomeAmount ?? 0), monthlyExpenseAmount ?? 0, 1_000_000)
  const ymax = Math.ceil((top * 1.15) / 1_000_000) * 1_000_000
  const y = (v) => Y1 - (Math.min(v, ymax) / ymax) * (Y1 - Y0)
  const xMid = (i) => X0 + i * step + step / 2

  const splitX = X0 + actualMonths.length * step
  const label = `최근 ${actualMonths.length}개월 소득과 앞으로 ${forecastMonths.length}개월 예측 소득, 월 지출 ${won(monthlyExpenseAmount)}원`

  return (
    <svg className="cf-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, ymax / 2, ymax].map((t) => (
        <g key={t}>
          <line x1={X0} x2={X1} y1={y(t)} y2={y(t)} className="cf-chart__grid" />
          <text x={X0 - 8} y={y(t) + 4} className="cf-chart__axis" textAnchor="end">{won(t)}</text>
        </g>
      ))}
      {bars.map((row, i) => {
        if (row.incomeAmount == null) return null
        const yTop = y(row.incomeAmount)
        const deficit = Number.isFinite(monthlyExpenseAmount) && row.incomeAmount < monthlyExpenseAmount
        const cls = `cf-chart__bar${deficit ? ' cf-chart__bar--deficit' : ''}${row.forecast ? ' cf-chart__bar--forecast' : ''}`
        return <rect key={row.baseMonth} x={X0 + i * step + (step - bw) / 2} y={yTop} width={bw} height={Y1 - yTop} rx="2" className={cls} />
      })}
      {Number.isFinite(monthlyExpenseAmount) && (
        <>
          <line x1={X0} x2={X1} y1={y(monthlyExpenseAmount)} y2={y(monthlyExpenseAmount)} className="cf-chart__expense-halo" />
          <line x1={X0} x2={X1} y1={y(monthlyExpenseAmount)} y2={y(monthlyExpenseAmount)} className="cf-chart__expense" />
          <text x={X0 + 6} y={y(monthlyExpenseAmount) - 8} className="cf-chart__expense-label">월 지출 {won(monthlyExpenseAmount)}</text>
        </>
      )}
      <line x1={splitX} x2={splitX} y1={Y0 - 14} y2={Y1} className="cf-chart__split" />
      <text x={splitX - 6} y={Y0 - 2} textAnchor="end" className="cf-chart__split-label">◀ 지난 {actualMonths.length}개월 (실제)</text>
      <text x={splitX + 6} y={Y0 - 2} className="cf-chart__split-label">앞으로 {forecastMonths.length}개월 (예측 · 연한 색) ▶</text>
      {bars.map((row, i) => ((n <= 18 || i % 2 === 0)
        ? <text key={`l-${row.baseMonth}`} x={xMid(i)} y={Y1 + 18} textAnchor="middle" className="cf-chart__axis">{monthLabel(row.baseMonth)}</text>
        : null))}
    </svg>
  )
}
