import { useId } from 'react'
import { useCountUp, useInView } from './vizHooks.js'
import '../styles/viz.css'

// UI 리뉴얼 — 화면 곳곳에서 쓰는 움직이는 시각화 부품(숫자 올라가기, 점수 링, 추이 곡선, 항목 막대).

export function CountUp({ value, duration, className = 'num' }) {
  return <span className={className}>{useCountUp(value, duration).toLocaleString('ko-KR')}</span>
}

// 화면에 들어왔는지(한 번 들어오면 true 유지) — 들어올 때 애니메이션을 시작하려고 쓴다.
// 점수 링(0~max) — 그려지면서 차오른다. 가운데에 숫자.
export function ScoreRing({ value, max = 1000, size = 180, label, sub, tone = 'var(--acc)' }) {
  const [ref, seen] = useInView()
  const r = (size - 20) / 2
  const c = 2 * Math.PI * r
  const ratio = value == null ? 0 : Math.max(0, Math.min(1, value / max))
  return (
    <div ref={ref} className="viz-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${label ?? '점수'} ${value ?? '-'}점`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="viz-ring__track" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          className="viz-ring__value"
          style={{ stroke: tone, strokeDasharray: c, strokeDashoffset: seen ? c * (1 - ratio) : c }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="viz-ring__center">
        {label && <span className="viz-ring__label">{label}</span>}
        <b className="num">{seen && value != null ? <CountUp value={value} /> : '-'}</b>
        {sub && <span className="viz-ring__sub">{sub}</span>}
      </div>
    </div>
  )
}

// 점수 추이 곡선 — points: [{ label, value }]. 선이 왼쪽부터 그려지고 점이 차례로 나타난다.
export function TrendArea({ points, ...rest }) {
  const valid = points.filter((p) => p.value != null)
  if (valid.length < 2) return <p className="hint">추이를 그리려면 기록이 2건 이상 필요해요.</p>
  // 데이터가 생긴 뒤에 그래프를 새로 붙여야 화면 진입 감지가 그 그래프를 본다
  return <TrendSvg key={valid.length} valid={valid} {...rest} />
}

function TrendSvg({ valid, height = 220, unit = '점', tone = 'var(--acc)', ariaLabel = '추이 그래프' }) {
  const [ref, seen] = useInView()
  const gradId = useId()
  const W = 640
  const H = height
  const pad = { l: 16, r: 16, t: 36, b: 34 }
  const vals = valid.map((p) => p.value)
  const lo = Math.min(...vals) - 20
  const hi = Math.max(...vals) + 20
  const x = (i) => pad.l + (i * (W - pad.l - pad.r)) / (valid.length - 1)
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b)
  // 부드러운 곡선(가운데 점 기준 베지어)
  const d = valid.map((p, i) => {
    if (i === 0) return `M${x(0)},${y(p.value)}`
    const px = x(i - 1)
    const py = y(valid[i - 1].value)
    const cx = (px + x(i)) / 2
    return `C${cx},${py} ${cx},${y(p.value)} ${x(i)},${y(p.value)}`
  }).join(' ')
  const area = `${d} L${x(valid.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`
  return (
    <svg ref={ref} className={`viz-trend${seen ? ' is-in' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ '--tone': tone }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={pad.l} x2={W - pad.r} y1={pad.t + g * (H - pad.t - pad.b)} y2={pad.t + g * (H - pad.t - pad.b)} className="viz-trend__grid" />)}
      <path d={area} fill={`url(#${gradId})`} className="viz-trend__area" />
      <path d={d} className="viz-trend__line" pathLength="1" />
      {valid.map((p, i) => (
        <g key={`${p.label}-${i}`} className="viz-trend__pt" style={{ '--i': i }}>
          <circle cx={x(i)} cy={y(p.value)} r={i === valid.length - 1 ? 6 : 4} />
          <text x={x(i)} y={y(p.value) - 14} textAnchor="middle" className={i === valid.length - 1 ? 'is-last' : ''}>{p.value}{i === valid.length - 1 ? unit : ''}</text>
          <text x={x(i)} y={H - 10} textAnchor="middle" className="viz-trend__x">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

// 가점·감점 막대 — items: [{ label, value, tag }]. 화면에 들어오면 0에서 늘어난다.
export function FactorBars({ items, unit = '점' }) {
  const [ref, seen] = useInView()
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)))
  return (
    <ul ref={ref} className={`viz-bars${seen ? ' is-in' : ''}`}>
      {items.map((item, i) => (
        <li key={item.label} style={{ '--i': i }}>
          <span className="viz-bars__label">{item.tag && <em>{item.tag}</em>}{item.label}</span>
          <span className="viz-bars__track">
            <i className={item.value < 0 ? 'is-down' : 'is-up'} style={{ '--w': `${(Math.abs(item.value) / max) * 100}%` }} />
          </span>
          <b className={`num ${item.value < 0 ? 'is-down' : 'is-up'}`}>{item.value > 0 ? '+' : ''}{item.value}{unit}</b>
        </li>
      ))}
    </ul>
  )
}
