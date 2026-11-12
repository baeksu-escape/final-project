// 점수 위치를 반원 위의 좌표로 바꾼다.
function point(score, radius) {
  const angle = Math.PI * (1 - Math.max(0, Math.min(1000, score)) / 1000)
  return [150 + radius * Math.cos(angle), 140 - radius * Math.sin(angle)]
}

// N-12-6 서버가 준 등급 경계를 눈금으로 표시한다.
export default function ScoreGauge({ score, bands, label, alternative }) {
  const [x, y] = point(score, 110)
  const arc = `M 40 140 A 110 110 0 0 1 ${x} ${y}`
  return (
    <svg className={`credit-gauge${alternative ? ' credit-gauge--alternative' : ''}`} viewBox="0 0 300 175" role="img" aria-label={`${label} ${score}점, 0점부터 1000점`}>
      <path className="credit-gauge__track" d="M 40 140 A 110 110 0 0 1 260 140" />
      {score > 0 && <path className="credit-gauge__value" d={arc} />}
      {bands.filter((band) => band.minScore > 0 && band.minScore < 1000).map((band) => {
        const [tx, ty] = point(band.minScore, 110)
        const [lx, ly] = point(band.minScore, 133)
        return <g key={band.gradeBandCode}><circle className="credit-gauge__tick" cx={tx} cy={ty} r="4" /><text className="credit-gauge__label" x={lx} y={ly + 4} textAnchor="middle">{band.minScore}</text></g>
      })}
      <text className="credit-gauge__score" x="150" y="138" textAnchor="middle">{score}</text>
      <text className="credit-gauge__label" x="40" y="164" textAnchor="middle">0</text>
      <text className="credit-gauge__label" x="260" y="164" textAnchor="middle">1000</text>
    </svg>
  )
}
