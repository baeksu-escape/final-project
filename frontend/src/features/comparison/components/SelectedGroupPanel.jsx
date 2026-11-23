import { Card } from '../../../common/components/index.js'
import GradeDistributionBars from '../../admin/components/GradeDistributionBars.jsx'
import { formatPct, formatScore, formatTradToAlt, formatUplift } from '../../admin/adminStatsCodes.js'
import { ageName, cellName, diffOf, formatDiff, jobName } from '../groupComparisonCodes.js'

// 한 줄 비교 — 왼쪽 이름, 오른쪽 값(11/06 UI의 대비 목록).
function Row({ label, children }) {
  return (
    <p>
      <span className="hint">{label}</span> <b className="num">{children}</b>
    </p>
  )
}

// N-26-6 선택한 집단 — 격자에서 고른 칸의 인원(전체 대비 %), 평균 점수 기존 → 대안, 전체·같은 직군·같은 연령대 평균 대비,
// 내 점수와 비교, 보통 이상 비율, 등급 분포. 평균 대비 차이는 대안 평균끼리 빼며, 어느 한쪽이 5명 미만으로 숨겨졌으면 '—'다.
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

  return (
    <Card title="선택한 집단">
      <div>
        <h3>{cellName(workerTypeCode, ageBandCode)}</h3>
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
      <Row label="전체 평균 대비">{formatDiff(diffOf(avg, data.overall.avgAltScore))}</Row>
      <Row label={`${jobName(workerTypeCode)} 평균 대비`}>{formatDiff(diffOf(avg, sameWorkerType?.avgAltScore))}</Row>
      <Row label={`${ageName(ageBandCode)} 평균 대비`}>{formatDiff(diffOf(avg, sameAgeBand?.avgAltScore))}</Row>
      {me && (
        <Row label="내 점수와 비교">
          나 {me.altScore}점{myDiff !== null && ` · ${myDiff === 0 ? '같음' : `${Math.abs(myDiff).toFixed(1)}점 ${myDiff > 0 ? '높음' : '낮음'}`}`}
        </Row>
      )}
      <Row label="보통 이상 (기존 → 대안)">
        {formatTradToAlt(stats.tradStandardOrAboveRatePct, stats.standardOrAboveRatePct, formatPct)}
      </Row>
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
