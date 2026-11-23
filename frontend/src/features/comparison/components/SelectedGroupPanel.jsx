import { Card } from '../../../common/components/index.js'
import GradeDistributionBars from '../../admin/components/GradeDistributionBars.jsx'
import { formatPct, formatScore, formatTradToAlt, formatUplift } from '../../admin/adminStatsCodes.js'
import { cellName, diffOf, formatDiff } from '../groupComparisonCodes.js'

// N-26-6 선택한 집단 — 격자에서 고른 칸의 기존 → 대안 평균, 전체·같은 직군·같은 연령대 평균 대비, 내 점수 대비, 보통 이상 비율, 등급 분포.
// 평균 대비 차이는 같은 필드(대안 평균)끼리 뺀다. 어느 한쪽이 5명 미만으로 숨겨졌으면 차이도 '—'다.
export default function SelectedGroupPanel({ data, selected }) {
  const { workerTypeCode, ageBandCode } = selected
  const stats = data.grid.find((cell) => cell.workerTypeCode === workerTypeCode && cell.ageBandCode === ageBandCode)?.stats
  if (!stats) return null
  const sameWorkerType = data.byWorkerType.find((group) => group.groupCode === workerTypeCode)
  const sameAgeBand = data.byAgeBand.find((group) => group.groupCode === ageBandCode)
  const avg = stats.avgAltScore
  const me = data.me

  return (
    <Card title={`${cellName(workerTypeCode, ageBandCode)} · ${stats.memberCount}명`}>
      {avg === null && (
        <p className="hint">이 집단은 계산에 들어간 인원이 {data.minGroupSize}명보다 적어 점수·비율을 숨겼습니다.</p>
      )}
      <p>
        평균 점수 (기존 → 대안) <b className="num">{formatTradToAlt(stats.avgTradScore, avg, formatScore)}</b>
        <span className="hint"> · 상승폭 {formatUplift(stats.avgScoreUplift)}</span>
      </p>
      <p>
        대안 평균 대비: 전체 <b className="num">{formatDiff(diffOf(avg, data.overall.avgAltScore))}</b> · 같은 직군{' '}
        <b className="num">{formatDiff(diffOf(avg, sameWorkerType?.avgAltScore))}</b> · 같은 연령대{' '}
        <b className="num">{formatDiff(diffOf(avg, sameAgeBand?.avgAltScore))}</b>
      </p>
      {me && avg !== null && (
        <p>
          내 대안 점수 <b className="num">{me.altScore}점</b>
          <span className="hint"> · 이 집단 평균보다 {formatDiff(diffOf(me.altScore, avg))}</span>
        </p>
      )}
      <p>
        보통 이상 비율 (기존 → 대안){' '}
        <b className="num">{formatTradToAlt(stats.tradStandardOrAboveRatePct, stats.standardOrAboveRatePct, formatPct)}</b>
      </p>
      <GradeDistributionBars
        alt={stats.gradeDistribution}
        trad={stats.tradGradeDistribution}
        minGroupSize={data.minGroupSize}
        tradScoredMemberCount={stats.tradScoredMemberCount}
      />
    </Card>
  )
}
