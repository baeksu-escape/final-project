import { Card } from '../../../common/components/index.js'
import GradeDistributionBars from '../../admin/components/GradeDistributionBars.jsx'
import { formatPct, formatScore, formatTradToAlt, formatUplift } from '../../admin/adminStatsCodes.js'
import { diffOf, formatDiff } from '../groupComparisonCodes.js'

// N-26-6·N-26-7 선택한 집단 — 격자 칸이나 직군·연령대 한 줄을 골랐을 때 오른쪽에 보여 준다(세 보기 공용).
// stats: ADM-04 집단 하나, title: 집단 이름, comparisons: [[이름, 비교할 대안 평균]] (격자는 전체·직군·연령대, 직군별·연령대별은 전체).
// 평균 대비 차이는 대안 평균끼리 빼며, 어느 한쪽이 5명 미만으로 숨겨졌으면 '—'다. 비교 줄은 왼쪽 이름·오른쪽 값(기존 data-table 클래스).
export default function SelectedGroupPanel({ data, stats, title, comparisons }) {
  if (!stats) return null
  const avg = stats.avgAltScore
  const me = data.me
  const total = data.overall.memberCount
  const share = total > 0 ? `${((stats.memberCount / total) * 100).toFixed(1)}%` : '—'
  const myDiff = me && avg !== null ? diffOf(me.altScore, avg) : null

  const rows = comparisons.map(([label, base]) => [label, formatDiff(diffOf(avg, base))])
  if (me) {
    const versus = myDiff === null ? '' : myDiff === 0 ? ' · 같음' : ` · ${Math.abs(myDiff).toFixed(1)}점 ${myDiff > 0 ? '높음' : '낮음'}`
    rows.push(['내 점수와 비교', `나 ${me.altScore}점${versus}`])
  }
  rows.push(['보통 이상', formatTradToAlt(stats.tradStandardOrAboveRatePct, stats.standardOrAboveRatePct, formatPct)])

  return (
    <Card>
      <div>
        <p className="hint">선택한 집단</p>
        <h2 className="card__title">{title}</h2>
        <p className="hint">
          {stats.memberCount.toLocaleString('ko-KR')}명 · 전체의 {share}
        </p>
      </div>
      <div className="panel-sunk">
        <p className="hint">평균 점수 기존 → 대안</p>
        <p className="num">
          <b>{formatTradToAlt(stats.avgTradScore, avg, formatScore)}</b>
        </p>
        <p className="hint">대안 점수로 보면 {formatUplift(stats.avgScoreUplift)}</p>
      </div>
      {avg === null && <p className="hint">인원이 {data.minGroupSize}명보다 적어 점수를 보여 드리지 않아요.</p>}
      <table className="data-table">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td className="is-num num">
                <b>{value}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">등급 분포</p>
      <GradeDistributionBars
        alt={stats.gradeDistribution}
        trad={stats.tradGradeDistribution}
        minGroupSize={data.minGroupSize}
        tradScoredMemberCount={stats.tradScoredMemberCount}
      />
    </Card>
  )
}
