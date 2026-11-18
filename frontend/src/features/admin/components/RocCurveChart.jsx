// 그림 크기 — 정사각형 그림판(PLOT) 왼쪽·아래에 축 이름 자리를 둔다
const PAD = 40
const PLOT = 260
const WIDTH = PAD + PLOT + 20
const HEIGHT = 20 + PLOT + 30
const GRID = [0.25, 0.5, 0.75]

const toX = (fpr) => PAD + fpr * PLOT
const toY = (tpr) => 20 + (1 - tpr) * PLOT
const toPolyline = (points) => points.map(({ fpr, tpr }) => `${toX(fpr).toFixed(1)},${toY(tpr).toFixed(1)}`).join(' ')

// N-25-3 ROC 곡선 — 기존·대안 모형의 곡선과 AUC를 한 그림에 그린다. 공통 차트에 x·y 곡선이 없어 SVG로 직접 그린다.
// legacy·alternative: { auc, points: [{ fpr, tpr }] } (ADM-02 응답), groupLabel: 화면 낭독용 집단 이름
export default function RocCurveChart({ legacy, alternative, groupLabel }) {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      role="img"
      aria-label={`${groupLabel} ROC 곡선, 기존 AUC ${legacy.auc.toFixed(3)}, 대안 AUC ${alternative.auc.toFixed(3)}`}
    >
      <rect x={PAD} y={20} width={PLOT} height={PLOT} fill="none" stroke="var(--line2)" />
      {GRID.map((v) => (
        <g key={v}>
          <line x1={toX(v)} x2={toX(v)} y1={toY(0)} y2={toY(1)} stroke="var(--line)" />
          <line x1={toX(0)} x2={toX(1)} y1={toY(v)} y2={toY(v)} stroke="var(--line)" />
        </g>
      ))}
      {/* 무작위로 고른 경우(AUC 0.5) 기준선 */}
      <line x1={toX(0)} y1={toY(0)} x2={toX(1)} y2={toY(1)} stroke="var(--mut2)" strokeDasharray="4 4" />
      <polyline points={toPolyline(legacy.points)} fill="none" stroke="var(--mut)" strokeWidth="2" />
      <polyline points={toPolyline(alternative.points)} fill="none" stroke="var(--vio)" strokeWidth="2.5" />
      <text x={toX(0.5)} y={HEIGHT - 6} fontSize="11" fill="var(--mut2)" textAnchor="middle">
        거짓 양성률
      </text>
      <text x={14} y={toY(0.5)} fontSize="11" fill="var(--mut2)" textAnchor="middle" transform={`rotate(-90 14 ${toY(0.5)})`}>
        참 양성률
      </text>
      <text x={toX(1) - 4} y={toY(0.07)} fontSize="11" fill="var(--mut)" textAnchor="end">
        기존 {legacy.auc.toFixed(3)}
      </text>
      <text x={toX(1) - 4} y={toY(0.13)} fontSize="11" fill="var(--vio)" textAnchor="end">
        대안 {alternative.auc.toFixed(3)}
      </text>
    </svg>
  )
}
