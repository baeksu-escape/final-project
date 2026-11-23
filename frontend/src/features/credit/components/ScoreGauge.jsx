import { useCountUp, useInView } from '../../../common/components/vizHooks.js'

const R = 112
const CX = 150
const CY = 150
const BAND_TONE = { CAUTION: 'caution', STANDARD: 'standard', GOOD: 'good' }
const BAND_TEXT = { CAUTION: '주의', STANDARD: '보통', GOOD: '좋음' }

// 점수 위치를 반원 위의 좌표로 바꾼다.
function point(score, radius) {
  const angle = Math.PI * (1 - Math.max(0, Math.min(1000, score)) / 1000)
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)]
}

// 반원 위 from~to 점수 구간의 호
function arc(from, to, radius) {
  const [x1, y1] = point(from, radius)
  const [x2, y2] = point(to, radius)
  return `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`
}

// N-12-6 반원 게이지 — 하나의 굵은 띠를 서버가 준 등급 구간(주의·보통·좋음)별 옅은 색으로 나누고,
// 그 위에 내 점수까지 같은 등급 색이 0점부터 차오른다. 가운데 숫자도 0부터 올라간다.
export default function ScoreGauge({ score, bands, label, alternative }) {
  const [ref, seen] = useInView()
  // SVG text 안에는 span을 못 넣어 숫자만 받아 쓴다
  const shown = useCountUp(seen ? score : 0)
  const clamped = Math.max(0, Math.min(1000, score))
  const sorted = [...(bands ?? [])].sort((a, b) => a.minScore - b.minScore)
  const myBand = sorted.find((band) => score >= band.minScore && score <= band.maxScore)
  const tone = BAND_TONE[myBand?.gradeBandCode] ?? 'standard'
  // 차오르는 호의 길이(점수 비율)만큼만 보이게 한다
  const fullLen = Math.PI * R
  return (
    <svg ref={ref} className={`credit-gauge credit-gauge--tone-${tone}${alternative ? ' credit-gauge--alternative' : ''}`} viewBox="0 0 300 190" role="img" aria-label={`${label} ${score}점, 0점부터 1000점, ${BAND_TEXT[myBand?.gradeBandCode] ?? ''} 구간`}>
      {sorted.map((band) => {
        const from = Math.max(0, band.minScore)
        const to = Math.min(1000, band.maxScore)
        const [lx, ly] = point((from + to) / 2, R + 28)
        return (
          <g key={band.gradeBandCode}>
            <path className={`credit-gauge__seg credit-gauge__seg--${BAND_TONE[band.gradeBandCode] ?? 'standard'}`} d={arc(from, to, R)} />
            <text className={`credit-gauge__band-label${band === myBand ? ' is-mine' : ''}`} x={lx} y={ly + 4} textAnchor="middle">{BAND_TEXT[band.gradeBandCode] ?? band.gradeBandCode}</text>
          </g>
        )
      })}
      <path
        className="credit-gauge__value"
        d={arc(0, 1000, R)}
        style={{ strokeDasharray: fullLen, strokeDashoffset: seen ? fullLen * (1 - clamped / 1000) : fullLen }}
      />
      {/* 등급이 바뀌는 경계 점수 — 띠 안쪽에 눈금과 숫자(몇 점부터 다음 등급인지) */}
      {sorted.filter((band) => band.minScore > 0 && band.minScore < 1000).map((band, index) => {
        const [ox, oy] = point(band.minScore, R + 11)
        const [ix, iy] = point(band.minScore, R - 11)
        // 경계가 가까워도 숫자가 겹치지 않게 첫 경계는 눈금 왼쪽 아래, 다음 경계는 오른쪽 아래에 붙인다
        const [nx, ny] = point(band.minScore, R - 24)
        const first = index === 0
        return (
          <g key={`tick-${band.gradeBandCode}`} className="credit-gauge__tick">
            <line x1={ox} y1={oy} x2={ix} y2={iy} />
            <text x={nx + (first ? -4 : 4)} y={ny + (first ? 2 : 10)} textAnchor={first ? 'end' : 'start'}>{band.minScore}</text>
          </g>
        )
      })}
      <text className="credit-gauge__score num" x={CX} y={CY - 10} textAnchor="middle">{shown}</text>
      <text className="credit-gauge__unit" x={CX} y={CY + 16} textAnchor="middle">/ 1000점</text>
    </svg>
  )
}
