import { Card } from '../../../common/components/index.js'
import { binOf, formatMetric } from '../utils/marketStats.js'

const WIDTH = 300
const ROW_H = 19

// N-24-3 구별 평균 가로 막대 — 25개 구를 좋은 구가 위로 오게 그린다. 막대를 누르면 그 구를 고른다.
// rows: 구별 평균(나쁜 순) { gu, value, score }
export default function GuAverageChart({ metric, rows, gu, onSelectGu }) {
  const height = rows.length * ROW_H + 6
  const mid = metric.signed ? 170 : 66
  const vmax = Math.max(...rows.map((row) => Math.abs(row.value)), 0.1)
  const scale = (v) => (v / vmax) * (WIDTH - mid - 40)
  const pick = (name) => onSelectGu(name === gu ? null : name)

  return (
    <Card title="구별 평균" className="market-side-card">
      <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" role="img" aria-label={`구별 ${metric.name} 평균 막대 그래프`}>
        {metric.signed && <line x1={mid} x2={mid} y1="0" y2={height} className="market-chart__axis" />}
        {[...rows].reverse().map((row, i) => {
          const y = i * ROW_H + 3
          const len = scale(row.value)
          const x0 = metric.signed && len < 0 ? mid + len : mid
          const selected = row.gu === gu
          return (
            <g
              key={row.gu}
              className="market-chart__hit"
              role="button"
              tabIndex={0}
              aria-label={`${row.gu} ${formatMetric(metric, row.value)}`}
              onClick={() => pick(row.gu)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  pick(row.gu)
                }
              }}
            >
              <text x="4" y={y + 12} fontSize="12" className={selected ? 'market-chart__label market-chart__label--on' : 'market-chart__label'}>
                {row.gu}
              </text>
              <rect
                x={x0}
                y={y + 2}
                width={Math.max(1, Math.abs(len))}
                height="13"
                rx="2"
                className={`market-chart__bar market-bin--${binOf(row.score)}${selected ? ' market-chart__bar--on' : ''}`}
              />
              <text x={(metric.signed ? Math.max(mid, mid + len) : mid + len) + 4} y={y + 12} fontSize="11" className="market-chart__value">
                {formatMetric(metric, row.value)}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="market-hint">막대를 누르면 그 구로 이동합니다. 위쪽이 좋은 구입니다.</p>
    </Card>
  )
}
