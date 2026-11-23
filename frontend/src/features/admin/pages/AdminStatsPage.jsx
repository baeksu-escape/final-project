import { useEffect, useState } from 'react'
import { Card, Chip, Notice, SegmentedControl } from '../../../common/components/index.js'
import { getAdminStats } from '../api/adminStatsApi.js'
import AdminStatsTable from '../components/AdminStatsTable.jsx'
import GradeDistributionBars from '../components/GradeDistributionBars.jsx'
import { adminErrorMessage } from '../adminConstants.js'
import { formatCount } from '../adminFormat.js'
import {
  DEFAULT_GROUP_BY,
  GROUP_BY_OPTIONS,
  formatPct,
  formatScore,
  formatTradToAlt,
  formatUplift,
} from '../adminStatsCodes.js'
import { useAdminErrorHandler } from '../useAdminErrorHandler.js'

// FP-162 N-26 직군·연령별 통계 (관리자) — 구분(N-26-1)을 고르면 요약 수치(N-26-2), 기존 → 대안 등급 분포(N-26-3),
// 직군별·연령대별 통계 표(N-26-4)를 보여 준다. D-26(11/06 확정 UI대로): 상자 그림·히트맵은 만들지 않는다.
// 데이터는 ADM-03(FP-161): 서비스 회원이 ACTIVE 모델로 낸 최근 평가, 탈퇴 제외(D-28). 값마다 계산 인원이 5명 미만이면 서버가 null로 숨긴다.
export default function AdminStatsPage() {
  const handleAdminError = useAdminErrorHandler()
  const [groupBy, setGroupBy] = useState(DEFAULT_GROUP_BY)
  // 결과가 어느 구분의 것인지 함께 둔다. 구분을 바꾼 직후에는 이전 구분의 숫자를 보여 주지 않는다(제목과 숫자가 어긋나지 않게).
  const [stats, setStats] = useState({ groupBy: null, data: null, error: '' })

  // ADM-03 — 구분이 바뀌면 다시 읽는다.
  useEffect(() => {
    let alive = true
    getAdminStats({ groupBy })
      .then((data) => alive && setStats({ groupBy, data, error: '' }))
      .catch(async (error) => {
        if (!alive || (await handleAdminError(error))) return
        setStats({ groupBy, data: null, error: adminErrorMessage(error) })
      })
    return () => {
      alive = false
    }
  }, [groupBy, handleAdminError])

  const current = stats.groupBy === groupBy
  const data = current ? stats.data : null
  const error = current ? stats.error : ''
  const summary = data?.summary
  const groupByLabel = GROUP_BY_OPTIONS.find((option) => option.value === groupBy)?.label ?? ''

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-head__title">직군·연령별 통계</h1>
          <p className="page-head__lead">
            서비스 회원의 최근 평가로 기존 모형과 대안 모형의 점수·등급을 직군별 또는 연령대별로 비교합니다. 탈퇴 회원은 빼고 셉니다.
          </p>
        </div>
      </div>

      <section className="card l-g2" aria-label="통계 구분">
        <SegmentedControl label="통계 구분" options={GROUP_BY_OPTIONS} value={groupBy} onChange={setGroupBy} />
        <div>{data?.modelVersion && <Chip>모델 {data.modelVersion} 기준</Chip>}</div>
      </section>

      <Notice>
        지금 서비스에 쓰는 모델(ACTIVE)로 낸 평가만 셉니다. 값마다 계산에 들어간 인원이 {data?.minGroupSize ?? 5}명보다 적으면 개인 점수가
        드러나지 않도록 그 값을 숨깁니다(—).
      </Notice>
      {/* 리뷰 반영(11/23): 등급은 평가 당시 등급 구간으로 저장되고 ADM-03은 등급 구간 버전을 거르지 않는다(api_spec_c.md N-26 알려진 한계) */}
      <p className="hint">
        등급은 평가 당시의 등급 구간 기준으로 저장되므로, 기준이 바뀌기 전의 평가가 남아 있으면 등급 분포·Standard 이상 비율에 이전 기준이 섞여 있을 수 있습니다.
      </p>
      {error && <Notice type="warn">{error}</Notice>}
      {!data && !error && <p className="hint">통계를 불러오는 중입니다…</p>}
      {data && !data.modelVersion && <Notice type="warn">서비스에 쓰는 모델(ACTIVE)이 없어 통계를 낼 수 없습니다.</Notice>}
      {data?.modelVersion && summary.assessedMemberCount === 0 && (
        <Notice>아직 이 모델로 평가한 회원이 없습니다.</Notice>
      )}

      {data && (
        <>
          <div className="l-kpis">
            <Card title="평가 고객 수">
              <p className="num">
                <b>{formatCount(summary.assessedMemberCount, '명')}</b>
              </p>
              <p className="hint">가입 회원 {formatCount(summary.registeredMemberCount, '명')}</p>
            </Card>
            <Card title="평균 점수 (기존 → 대안)">
              <p className="num">
                <b>{formatTradToAlt(summary.avgTradScore, summary.avgAltScore, formatScore)}</b>
              </p>
              <p className="hint">상승폭 {formatUplift(summary.avgScoreUplift)}</p>
            </Card>
            <Card title="Standard 이상 비율 (기존 → 대안)">
              <p className="num">
                <b>{formatTradToAlt(summary.tradStandardOrAboveRatePct, summary.standardOrAboveRatePct, formatPct)}</b>
              </p>
              <p className="hint">기존은 기존 모델 산출 {formatCount(summary.tradScoredMemberCount, '명')} 기준</p>
            </Card>
            <Card title="오늘 산출">
              <p className="num">
                <b>{formatCount(summary.todayScoredCount, '건')}</b>
              </p>
              <p className="hint">오늘 0시 이후 저장된 평가</p>
            </Card>
          </div>

          <Card title="전체 등급 분포 (기존 → 대안)">
            <GradeDistributionBars
              alt={data.gradeDistribution}
              trad={data.tradGradeDistribution}
              minGroupSize={data.minGroupSize}
              tradScoredMemberCount={summary.tradScoredMemberCount}
            />
            <p className="hint">비율의 분모는 대안은 평가 고객 전체, 기존은 기존 모델로 산출된 회원입니다.</p>
          </Card>

          <Card title={`${groupByLabel} 통계`}>
            <AdminStatsTable groupBy={data.groupBy} groups={data.groups} />
            <p className="hint">
              괄호 안 인원은 기존 모델로 산출된 회원 수입니다. 그 인원이 {data.minGroupSize}명보다 적으면 기존 값과 상승폭만 숨깁니다.
            </p>
          </Card>
        </>
      )}
    </>
  )
}
