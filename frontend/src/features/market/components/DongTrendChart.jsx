// N-24-5 최근 4분기 추이 — 점포당 분기 매출(막대, 왼쪽 축·백만원)과 분기 폐업률(선, 오른쪽 축)을 겹쳐 그린다.
// points: [{ quarter, salesPerStore(원), closeRate(%) }] 시간 순. 값이 없으면 null.
const W = 360
const H = 150
const L = 40
const R = 40
const B = 24
const T = 12

const toMillion = (v) => (v == null ? null : v / 1000000)

export default function DongTrendChart({ points }) {
  const sales = points.map((p) => toMillion(p.salesPerStore))
  const close = points.map((p) => p.closeRate)
  const smax = Math.max(...sales.filter((v) => v != null), 1) * 1.15
  const cmax = Math.max(...close.filter((v) => v != null), 1) * 1.3
  const slot = (W - L - R) / points.length
  const bx = (i) => L + i * slot + 10
  const bw = slot - 20
  const ys = (v) => H - B - (v / smax) * (H - B - T)
  const yc = (v) => H - B - (v / cmax) * (H - B - T)
  const line = close
    .map((v, i) => (v == null ? null : `${bx(i) + bw / 2},${yc(v)}`))
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="최근 4분기 점포당 매출과 폐업률 추이">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={ys(smax * f)} y2={ys(smax * f)} className="market-chart__grid" />
            <text x={L - 6} y={ys(smax * f) + 3} fontSize="9.5" textAnchor="end" className="market-chart__tick">
              {Math.round(smax * f)}
            </text>
            <text x={W - R + 6} y={yc(cmax * f) + 3} fontSize="9.5" className="market-chart__tick market-chart__tick--close">
              {(cmax * f).toFixed(1)}%
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={p.quarter}>
            {sales[i] != null && (
              <>
                <rect
                  x={bx(i)}
                  y={ys(sales[i])}
                  width={bw}
                  height={H - B - ys(sales[i])}
                  rx="3"
                  className={i === points.length - 1 ? 'market-trend__bar market-trend__bar--last' : 'market-trend__bar'}
                />
                <text x={bx(i) + bw / 2} y={ys(sales[i]) - 4} fontSize="9.5" textAnchor="middle" className="market-chart__value">
                  {sales[i].toFixed(1)}
                </text>
              </>
            )}
            <text x={bx(i) + bw / 2} y={H - 8} fontSize="10" textAnchor="middle" className="market-chart__tick">
              {p.quarter}
            </text>
          </g>
        ))}
        <polyline points={line} fill="none" strokeWidth="2" className="market-trend__line" />
        {close.map((v, i) =>
          v == null ? null : (
            <circle key={i} cx={bx(i) + bw / 2} cy={yc(v)} r={i === points.length - 1 ? 4 : 3} className="market-trend__dot" />
          ),
        )}
      </svg>
      <p className="market-hint">
        <i className="market-dot market-dot--sales" aria-hidden="true" />
        점포당 분기 매출(백만원, 왼쪽) <i className="market-dot market-dot--close" aria-hidden="true" />
        분기 폐업률(오른쪽)
      </p>
    </>
  )
}
