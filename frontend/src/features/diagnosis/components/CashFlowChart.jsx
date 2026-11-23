// N-21-9 실적·전망 차트 — 최근 12개월 실적 막대 뒤에 예측 막대(연한 색·점선)를 잇고, 월 지출선과 예상 점수선(오른쪽 축)을 겹쳐 그린다.
// 공통 차트로는 막대·선·보조축을 한 그림에 겹칠 수 없어 이 화면 전용 SVG로 그린다.
const W = 960, H = 300, X0 = 84, X1 = 900, Y0 = 36, Y1 = 270

const monthLabel = (baseMonth) => `${Number(String(baseMonth).slice(5, 7))}월`
const won = (v) => Math.round(Number(v) || 0).toLocaleString('ko-KR')

export default function CashFlowChart({ actualMonths, forecastMonths, monthlyExpenseAmount, scorePath, currentScore }) {
  const bars = [...actualMonths.map((row) => ({ ...row, forecast: false })), ...forecastMonths.map((row) => ({ ...row, forecast: true }))]
  const n = bars.length
  const step = (X1 - X0) / n
  const bw = step * 0.62
  const top = Math.max(...bars.map((row) => row.incomeAmount ?? 0), monthlyExpenseAmount ?? 0, 1_000_000)
  const ymax = Math.ceil((top * 1.15) / 1_000_000) * 1_000_000
  const y = (v) => Y1 - (Math.min(v, ymax) / ymax) * (Y1 - Y0)
  const xMid = (i) => X0 + i * step + step / 2

  // 점수 축은 현재·예상 점수 범위에 맞춘다(0~1000 안에서 위아래 20점 여유).
  const scores = currentScore == null ? [] : [currentScore, ...scorePath.map((row) => row.score)].filter((s) => Number.isInteger(s))
  const sMin = scores.length ? Math.max(0, Math.min(...scores) - 20) : 0
  const sMax = scores.length ? Math.min(1000, Math.max(...scores) + 20) : 1000
  const sy = (s) => Y1 - ((s - sMin) / (sMax - sMin || 1)) * (Y1 - Y0)
  // 서버가 예상 점수를 1개만 주므로 현재 점수(마지막 실적 달)와 예상 점수(예측 기간 마지막 달) 두 점을 직선으로 잇는다.
  const scorePoints = scores.length
    ? [[xMid(actualMonths.length - 1), sy(currentScore)], ...scorePath.map((row, i) => [xMid(actualMonths.length - 1 + Math.round(forecastMonths.length * (i + 1) / scorePath.length)), sy(row.score)])]
    : []
  const last = scorePoints[scorePoints.length - 1]
  const splitX = X0 + actualMonths.length * step
  const label = `최근 ${actualMonths.length}개월 소득과 앞으로 ${forecastMonths.length}개월 예측 소득, 월 지출 ${won(monthlyExpenseAmount)}원`
    + (scores.length ? `, 예상 점수 ${currentScore}점에서 ${scorePath[scorePath.length - 1]?.score}점` : '')

  return (
    <svg className="cf-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {[0, ymax / 2, ymax].map((t) => (
        <g key={t}>
          <line x1={X0} x2={X1} y1={y(t)} y2={y(t)} className="cf-chart__grid" />
          <text x={X0 - 8} y={y(t) + 4} className="cf-chart__axis" textAnchor="end">{won(t)}</text>
        </g>
      ))}
      {scores.length > 0 && [sMin, Math.round((sMin + sMax) / 2), sMax].map((t) => (
        <text key={t} x={X1 + 8} y={sy(t) + 4} className="cf-chart__score-axis">{t}</text>
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
      {scorePoints.length > 1 && (
        <>
          <polyline points={scorePoints.map((p) => p.join(',')).join(' ')} className="cf-chart__score-halo" />
          <polyline points={scorePoints.map((p) => p.join(',')).join(' ')} className="cf-chart__score" />
          <circle cx={last[0]} cy={last[1]} r="5.5" className="cf-chart__score-dot" />
          <text x={last[0] - 8} y={last[1] - 12} textAnchor="end" className="cf-chart__score-label">예상 {scorePath[scorePath.length - 1].score}점</text>
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
