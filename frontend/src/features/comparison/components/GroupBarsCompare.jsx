import { Card, CompareBar } from '../../../common/components/index.js'
import AdminStatsTable from '../../admin/components/AdminStatsTable.jsx'
import GradeDistributionBars from '../../admin/components/GradeDistributionBars.jsx'
import { formatScore, groupLabel } from '../../admin/adminStatsCodes.js'

// 값은 점수다. CompareBar가 unit '점'을 붙이므로 숫자만 낸다.
const formatScoreNumber = (value) => value.toFixed(1)

// N-26-7 직군별·연령별 비교 — 집단마다 기존·대안 평균 점수를 공통 CompareBar로 나란히 보여 준다(관리자 JobRejectBars와 같은 방식).
// 명세의 점 그래프(내 점수 세로선)는 공통 부품이 없어 막대로 대신하고, 내 점수는 글자·'내 집단' 표시로 보여 준다(11/23 광희 결정).
// 아래에 요약표(전체 행 포함, 관리자 통계 표 재사용)와 전체 등급 분포를 둔다. view: 'WORKER_TYPE' 또는 'AGE_BAND'.
export default function GroupBarsCompare({ data, view }) {
  const groups = view === 'AGE_BAND' ? data.byAgeBand : data.byWorkerType
  const me = data.me
  const myCode = me ? (view === 'AGE_BAND' ? me.ageBandCode : me.workerTypeCode) : null
  const title = view === 'AGE_BAND' ? '연령대별' : '직군별'
  // 막대 100% 기준은 보이는 평균 중 가장 큰 값 — 집단끼리 길이를 비교할 수 있게 한다.
  const max = Math.max(
    ...groups.flatMap((group) => [group.avgAltScore, group.avgTradScore]).filter((value) => value !== null),
    1,
  )

  return (
    <>
      <Card title={`${title} 평균 점수 (기존 · 대안)`}>
        {me && (
          <p className="hint">
            내 대안 점수 <b className="num">{me.altScore}점</b> · 내 집단은 "(내 집단)"으로 표시합니다.
          </p>
        )}
        <div className="l-stack">
          {groups.map((group) => {
            const name = `${groupLabel(view, group.groupCode)}${group.groupCode === myCode ? ' (내 집단)' : ''} · ${group.memberCount}명`
            if (group.avgAltScore === null) {
              return (
                <p key={group.groupCode} className="hint">
                  {name} — 인원이 {data.minGroupSize}명보다 적어 값을 숨겼습니다.
                </p>
              )
            }
            if (group.avgTradScore === null) {
              return (
                <p key={group.groupCode}>
                  {name} · 대안 <b className="num">{formatScore(group.avgAltScore)}점</b>
                  <span className="hint">
                    {' '}
                    (기존 모델 산출 {group.tradScoredMemberCount}명이라 기존 평균은 숨겼습니다)
                  </span>
                </p>
              )
            }
            return (
              <CompareBar
                key={group.groupCode}
                label={name}
                myValue={group.avgAltScore}
                avgValue={group.avgTradScore}
                maxValue={max}
                myLabel="대안"
                avgLabel="기존"
                unit="점"
                formatValue={formatScoreNumber}
              />
            )
          })}
        </div>
      </Card>

      <Card title={`${title} 요약표`}>
        <AdminStatsTable groupBy={view} groups={[...groups, data.overall]} />
        <p className="hint">괄호 안 인원은 기존 모델로 산출된 회원 수입니다. 값마다 계산 인원이 {data.minGroupSize}명보다 적으면 숨깁니다(—).</p>
      </Card>

      <Card title="전체 등급 분포 (기존 → 대안)">
        <GradeDistributionBars
          alt={data.overall.gradeDistribution}
          trad={data.overall.tradGradeDistribution}
          minGroupSize={data.minGroupSize}
          tradScoredMemberCount={data.overall.tradScoredMemberCount}
        />
      </Card>
    </>
  )
}
