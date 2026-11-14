import { Card } from '../../../common/components/index.js'
import { DIST_BIN_COUNT } from '../config/marketConfig.js'
import { binOf, formatMetric, histogram, scoreOf } from '../utils/marketStats.js'

const W = 300
const H = 120
const LABEL_GAP = 70

// N-24-3 행정동 분포 — 고른 범위의 동 값을 14구간으로 나눠 막대로 그리고 서울 평균을 점선으로 표시한다.
export default function DongDistribution({ metric, stats, rows }) {
  const bins = histogram(rows, stats, DIST_BIN_COUNT)
  const cmax = Math.max(...bins.map((bin) => bin.count), 1)
  const span = stats.high - stats.low || 1
  const avgX = Math.min(W, Math.max(0, ((stats.seoul - stats.low) / span) * W))

  return (
    <Card title="행정동 분포" className="market-side-card">
      <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" role="img" aria-label={`행정동 ${metric.name} 분포`}>
        {bins.map((bin, i) => {
          const bh = (bin.count / cmax) * H
          const center = (bin.from + bin.to) / 2
          return (
            <rect
              key={i}
              x={(i * W) / DIST_BIN_COUNT + 1}
              y={H - bh}
              width={W / DIST_BIN_COUNT - 2}
              height={bh}
              rx="2"
              className={`market-chart__bar market-bin--${binOf(scoreOf(center, stats, metric))}`}
            >
              <title>{`${formatMetric(metric, bin.from)} ~ ${formatMetric(metric, bin.to)}: ${bin.count}곳`}</title>
            </rect>
          )
        })}
        <line x1={avgX} x2={avgX} y1="0" y2={H} strokeDasharray="3 3" className="market-chart__avg" />
        <text x={avgX} y={H + 14} fontSize="10" textAnchor="middle" className="market-chart__avg-text">
          평균 {formatMetric(metric, stats.seoul)}
        </text>
        {/* 평균 글자와 겹치면 양 끝 값은 숨긴다 */}
        {avgX > LABEL_GAP && (
          <text x="0" y={H + 14} fontSize="10" className="market-chart__tick">
            {formatMetric(metric, stats.low)}
            {stats.min < stats.low ? ' 이하' : ''}
          </text>
        )}
        {avgX < W - LABEL_GAP && (
          <text x={W} y={H + 14} fontSize="10" textAnchor="end" className="market-chart__tick">
            {formatMetric(metric, stats.high)}
            {stats.max > stats.high ? ' 이상' : ''}
          </text>
        )}
      </svg>
      <p className="market-hint">
        서울 행정동 값의 5~95% 범위를 그렸습니다. 양 끝 막대에는 그보다 낮거나 높은 동도 들어 있습니다(최저 {formatMetric(metric, stats.min)}, 최고{' '}
        {formatMetric(metric, stats.max)}).
      </p>
    </Card>
  )
}
