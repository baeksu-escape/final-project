import { PROMO_AXIS } from './landingExample.js'

const WIDTH = 460
const HEIGHT = 150
const X0 = 34
const X1 = WIDTH - 10
const Y0 = 10
const Y1 = HEIGHT - 24
const MONTH_LABELS = [
  { label: '가입', index: 0, anchor: 'start' },
  { label: '6개월', index: 6, anchor: 'middle' },
  { label: '12개월', index: 12, anchor: 'end' },
]

// N-10-2 12개월 점수 추이 그래프 — 데모 v2 promoChart를 옮긴 SVG다. tone은 'before'(회색)·'after'(민트), markIndex가 있으면 그 달에 'Standard 진입'을 표시한다.
export default function PromoTrendChart({ values, tone = 'before', markIndex }) {
  const { min, max, ticks, standardLine } = PROMO_AXIS
  const y = (v) => Y1 - ((v - min) / (max - min)) * (Y1 - Y0)
  const x = (i) => X0 + (i * (X1 - X0)) / (values.length - 1)
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = values.length - 1

  return (
    <svg
      className={`promo-chart promo-chart--${tone}`}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`12개월 점수 추이 ${values[0]}점에서 ${values[last]}점`}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            className={t === standardLine ? 'promo-chart__grid promo-chart__grid--standard' : 'promo-chart__grid'}
            x1={X0}
            x2={X1}
            y1={y(t)}
            y2={y(t)}
          />
          <text className="promo-chart__label" x={X0 - 6} y={y(t) + 4} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      <text className="promo-chart__label" x={X1} y={y(standardLine) - 5} textAnchor="end">
        Standard {standardLine}
      </text>
      <polygon className="promo-chart__area" points={`${X0},${Y1} ${points} ${X1},${Y1}`} />
      <polyline className="promo-chart__line" points={points} />
      <circle className="promo-chart__dot" cx={x(last)} cy={y(values[last])} r="4" />
      {markIndex != null && (
        <>
          <circle className="promo-chart__mark" cx={x(markIndex)} cy={y(values[markIndex])} r="4" />
          <text className="promo-chart__mark-label" x={x(markIndex) + 8} y={y(values[markIndex]) + 14}>
            Standard 진입
          </text>
        </>
      )}
      {MONTH_LABELS.map(({ label, index, anchor }) => (
        <text key={label} className="promo-chart__label" x={x(index)} y={HEIGHT - 6} textAnchor={anchor}>
          {label}
        </text>
      ))}
    </svg>
  )
}
