import { Card } from '../../../common/components/index.js'
import GradeDistributionBars from '../../admin/components/GradeDistributionBars.jsx'
import { formatPct, formatScore, formatTradToAlt, formatUplift } from '../../admin/adminStatsCodes.js'
import { ageName, cellName, diffOf, formatDiff, jobName } from '../groupComparisonCodes.js'

// N-26-6 선택한 집단 — 격자에서 고른 칸의 인원(전체 대비 %), 평균 점수 기존 → 대안, 전체·같은 직군·같은 연령대 평균 대비,
// 내 점수와 비교, 보통 이상 비율, 등급 분포. 평균 대비 차이는 대안 평균끼리 빼며, 어느 한쪽이 5명 미만으로 숨겨졌으면 '—'다.
// 11/06 UI처럼 비교 줄은 왼쪽 이름·오른쪽 값으로 둔다(기존 data-table 클래스).
export default function SelectedGroupPanel({ data, selected }) {
  const { workerTypeCode, ageBandCode } = selected
  const stats = data.grid.find((cell) => cell.workerTypeCode === workerTypeCode && cell.ageBandCode === ageBandCode)?.stats
  if (!stats) return null
  const sameWorkerType = data.byWorkerType.find((group) => group.groupCode === workerTypeCode)
  const sameAgeBand = data.byAgeBand.find((group) => group.groupCode === ageBandCode)
  const avg = stats.avgAltScore
  const me = data.me
  const total = data.overall.memberCount
  const share = total > 0 ? `${((stats.memberCount / total) * 100).toFixed(1)}%` : '—'
  const myDiff = me && avg !== null ? diffOf(me.altScore, avg) : null

  const rows = [
    ['전체 평균 대비', formatDiff(diffOf(avg, data.overall.avgAltScore))],
    [`${jobName(workerTypeCode)} 평균 대비`, formatDiff(diffOf(avg, sameWorkerType?.avgAltScore))],
    [`${ageName(ageBandCode)} 평균 대비`, formatDiff(diffOf(avg, sameAgeBand?.avgAltScore))],
  ]
  if (me) {
    const versus = myDiff === null ? '' : myDiff === 0 ? ' · 같음' : ` · ${Math.abs(myDiff).toFixed(1)}점 ${myDiff > 0 ? '높음' : '낮음'}`
    rows.push(['내 점수와 비교', `나 ${me.altScore}점${versus}`])
  }
  rows.push(['보통 이상', formatTradToAlt(stats.tradStandardOrAboveRatePct, stats.standardOrAboveRatePct, formatPct)])

  return (
    <Card>
      <div>
        <p className="hint">선택한 집단</p>
        <h2 className="card__title">{cellName(workerTypeCode, ageBandCode)}</h2>
        <p className="hint">
          {stats.memberCount.toLocaleString('ko-KR')}명 · 전체의 {share}
        </p>
      </div>
      <div className="panel-sunk">
        <p className="hint">평균 점수 기존 → 대안</p>
        <p className="num">
          <b>{formatTradToAlt(stats.avgTradScore, avg, formatScore)}</b>
        </p>
        <p className="hint">대안 모형으로 {formatUplift(stats.avgScoreUplift)}</p>
      </div>
      {avg === null && (
        <p className="hint">이 집단은 계산에 들어간 인원이 {data.minGroupSize}명보다 적어 점수·비율을 숨겼습니다.</p>
      )}
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
