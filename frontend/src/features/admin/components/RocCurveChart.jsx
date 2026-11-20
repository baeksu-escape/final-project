// 그림 크기 — 정사각형 그림판(PLOT) 왼쪽·아래에 축 이름 자리를 둔다
const PAD = 40
const PLOT = 260
const WIDTH = PAD + PLOT + 20
const HEIGHT = 20 + PLOT + 30
const GRID = [0.25, 0.5, 0.75]

const toX = (fpr) => PAD + fpr * PLOT
const toY = (tpr) => 20 + (1 - tpr) * PLOT
// ADM-02 점은 % 단위(0~100)라 0~1로 나눠 그린다
const toPolyline = (points) => points.map(({ fpr, tpr }) => `${toX(fpr / 100).toFixed(1)},${toY(tpr / 100).toFixed(1)}`).join(' ')

// ADM-02 점은 기준 점수 0, 10, …, 1010 순서다. 컷오프(10점 간격)에 해당하는 점을 고른다.
const ROC_STEP = 10
const pointAt = (points, cutoff) => points[Math.round(cutoff / ROC_STEP)]

// 지금 컷오프 위치 점 — x = 우량 고객 오거절률, y = 불량 고객을 거른 비율(100 − 부도 고객 오승인률)
function CutoffDot({ point, color }) {
  if (!point) return null
  return <circle cx={toX(point.fpr / 100)} cy={toY(point.tpr / 100)} r="4.5" fill={color} stroke="var(--bg)" strokeWidth="1.5" />
}

// N-25-3 ROC 곡선 — 기존·대안 모형의 곡선을 한 그림에 그린다. 공통 차트에 x·y 곡선이 없어 SVG로 직접 그린다.
// 곡선은 평가 표(시드 1개)로 그리고 AUC 숫자는 비교 표(5개 시드 평균)에만 둔다 — 한 화면에 서로 다른 AUC가 보이지 않게(11/19).
// legacy·alternative: { points: [{ fpr, tpr }] } (ADM-02 응답), cutoff: 슬라이더 컷오프(점으로 표시, 11/20), caption: 화면 낭독용 집단·라벨 이름
export default function RocCurveChart({ legacy, alternative, cutoff, caption }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label={`${caption} ROC 곡선, 기존과 대안 모형 비교, 컷오프 ${cutoff}점 위치 표시`}
    >
      <rect x={PAD} y={20} width={PLOT} height={PLOT} fill="none" stroke="var(--line2)" />
      {GRID.map((v) => (
        <g key={v}>
          <line x1={toX(v)} x2={toX(v)} y1={toY(0)} y2={toY(1)} stroke="var(--line)" />
          <line x1={toX(0)} x2={toX(1)} y1={toY(v)} y2={toY(v)} stroke="var(--line)" />
        </g>
      ))}
      {/* 무작위로 고른 경우(AUC 0.5) 기준선 */}
      <line x1={toX(0)} y1={toY(0)} x2={toX(1)} y2={toY(1)} stroke="var(--mut)" strokeDasharray="4 4" />
      {/* 곡선·점 색: 기존 --mut2, 대안 --vio2 (11/20 동주 결정, 두 선 구분이 잘 되도록) */}
      <polyline points={toPolyline(legacy.points)} fill="none" stroke="var(--mut2)" strokeWidth="2" />
      <polyline points={toPolyline(alternative.points)} fill="none" stroke="var(--vio2)" strokeWidth="2.5" />
      <CutoffDot point={pointAt(legacy.points, cutoff)} color="var(--mut2)" />
      <CutoffDot point={pointAt(alternative.points, cutoff)} color="var(--vio2)" />
      <text x={toX(0.5)} y={HEIGHT - 6} fontSize="11" fill="var(--mut2)" textAnchor="middle">
        거짓 양성률
      </text>
      <text x={14} y={toY(0.5)} fontSize="11" fill="var(--mut2)" textAnchor="middle" transform={`rotate(-90 14 ${toY(0.5)})`}>
        참 양성률
      </text>
      <text x={toX(1) - 4} y={toY(0.07)} fontSize="11" fill="var(--mut)" textAnchor="end">
        기존 모형
      </text>
      <text x={toX(1) - 4} y={toY(0.13)} fontSize="11" fill="var(--mint)" textAnchor="end">
        대안 모형
      </text>
    </svg>
  )
}
