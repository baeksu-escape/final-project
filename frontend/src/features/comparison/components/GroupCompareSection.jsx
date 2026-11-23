import { useEffect, useState } from 'react'
import { Card, HeatmapGrid, Notice, SegmentedControl } from '../../../common/components/index.js'
import AdminStatsTable from '../../admin/components/AdminStatsTable.jsx'
import { groupLabel } from '../../admin/adminStatsCodes.js'
import { getGroupComparison } from '../api/groupComparisonApi.js'
import {
  AGE_BAND_ORDER,
  CELL_METRICS,
  DEFAULT_CELL_METRIC,
  DEFAULT_VIEW,
  VIEW_OPTIONS,
  WORKER_TYPE_ORDER,
  ageName,
  cellName,
  jobName,
} from '../groupComparisonCodes.js'
import GroupStripHeatmap from './GroupStripHeatmap.jsx'
import SelectedGroupPanel from './SelectedGroupPanel.jsx'

const VIEW_TITLES = Object.freeze({ GRID: '직군 × 연령 한눈에 보기', WORKER_TYPE: '직군별 한눈에 보기', AGE_BAND: '연령대별 한눈에 보기' })

// FP-164 N-26-5~7 비교 분석 '같은 집단과 나란히 보기' 구역 — 동주 님 화면 틀(ComparisonPage, FP-253)의 내 위치 카드 아래에 둔다.
// ADM-04를 한 번 불러 보기 전환(직군 × 연령 / 직군별 / 연령대별)마다 다시 부르지 않는다. 집계 기준은 관리자 통계·내 위치와 같다.
// 세 보기 모두 11/06 UI처럼 왼쪽은 공통 HeatmapGrid 색 칸(칸에 표시할 값: 대안 점수·상승폭·보통 이상), 오른쪽은 선택한 집단 패널이다.
// 직군별·연령대별은 아래에 요약표(전체 행 포함, 명세 N-26-7)를 둔다.
export default function GroupCompareSection() {
  const [state, setState] = useState({ data: null, error: null })
  const [view, setView] = useState(DEFAULT_VIEW)
  const [metricKey, setMetricKey] = useState(DEFAULT_CELL_METRIC)
  // 보기마다 고른 집단. 아직 고르지 않았으면 내 집단(없으면 첫 집단)을 보여 준다.
  const [pickedCell, setPickedCell] = useState(null)
  const [pickedWorkerType, setPickedWorkerType] = useState(null)
  const [pickedAgeBand, setPickedAgeBand] = useState(null)

  // 화면에 들어올 때 한 번 읽는다.
  useEffect(() => {
    let alive = true
    getGroupComparison()
      .then((data) => alive && setState({ data, error: null }))
      .catch((error) => alive && setState({ data: null, error }))
    return () => {
      alive = false
    }
  }, [])

  const { data, error } = state
  if (error) return <Notice type="warn">비교 정보를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</Notice>
  if (!data) {
    return (
      <p className="hint" role="status">
        비교 정보를 불러오는 중이에요…
      </p>
    )
  }
  if (!data.modelVersion) return <Notice>지금은 비교할 수 있는 점수가 없어요.</Notice>

  const me = data.me
  const metric = CELL_METRICS.find((item) => item.value === metricKey) ?? CELL_METRICS[0]
  const pick = (stats) => stats?.[metric.field] ?? null
  const findGroup = (groups, code) => groups.find((group) => group.groupCode === code)
  const cell = pickedCell ?? {
    workerTypeCode: me?.workerTypeCode ?? WORKER_TYPE_ORDER[0],
    ageBandCode: me?.ageBandCode ?? AGE_BAND_ORDER[0],
  }
  const workerTypeCode = pickedWorkerType ?? me?.workerTypeCode ?? WORKER_TYPE_ORDER[0]
  const ageBandCode = pickedAgeBand ?? me?.ageBandCode ?? AGE_BAND_ORDER[0]
  const overallComparison = ['전체 평균 대비', data.overall.avgAltScore]

  // 오른쪽 패널에 넘길 집단·이름·비교 대상
  let panel
  if (view === 'GRID') {
    panel = {
      stats: data.grid.find((item) => item.workerTypeCode === cell.workerTypeCode && item.ageBandCode === cell.ageBandCode)?.stats,
      title: cellName(cell.workerTypeCode, cell.ageBandCode),
      comparisons: [
        overallComparison,
        [`${jobName(cell.workerTypeCode)} 평균 대비`, findGroup(data.byWorkerType, cell.workerTypeCode)?.avgAltScore],
        [`${ageName(cell.ageBandCode)} 평균 대비`, findGroup(data.byAgeBand, cell.ageBandCode)?.avgAltScore],
      ],
    }
  } else if (view === 'WORKER_TYPE') {
    panel = { stats: findGroup(data.byWorkerType, workerTypeCode), title: jobName(workerTypeCode), comparisons: [overallComparison] }
  } else {
    panel = { stats: findGroup(data.byAgeBand, ageBandCode), title: ageName(ageBandCode), comparisons: [overallComparison] }
  }

  const indexOf = (code) => [WORKER_TYPE_ORDER.indexOf(code.workerTypeCode), AGE_BAND_ORDER.indexOf(code.ageBandCode)]
  const groups = view === 'AGE_BAND' ? data.byAgeBand : data.byWorkerType

  return (
    <section className="l-stack" aria-labelledby="group-compare-title">
      <h2 id="group-compare-title">같은 집단과 나란히 보기</h2>
      <SegmentedControl label="비교 보기" options={VIEW_OPTIONS} value={view} onChange={setView} />
      <p className="hint">
        {data.minGroupSize}명보다 적은 집단은 개인 점수가 드러나지 않게 숨겨요(—). 전체 평균 대안 점수는{' '}
        {data.overall.avgAltScore === null ? '—' : `${data.overall.avgAltScore.toFixed(1)}점`}이에요.
        {!me && " 내 점수가 없어 '나' 표시 없이 보여 드려요."}
      </p>

      <div className="l-cols">
        <Card title={VIEW_TITLES[view]} className="l-cols__main">
          <p className="hint">칸이 진할수록 값이 높아요. 칸을 누르면 오른쪽에 자세히 보여 드려요.</p>
          <div className="l-row">
            <span className="hint">칸에 표시할 값</span>
            <SegmentedControl label="칸에 표시할 값" options={CELL_METRICS} value={metric.value} onChange={setMetricKey} />
          </div>
          {view === 'GRID' ? (
            <HeatmapGrid
              rows={WORKER_TYPE_ORDER.map(jobName)}
              columns={AGE_BAND_ORDER.map(ageName)}
              data={WORKER_TYPE_ORDER.map((rowCode) =>
                AGE_BAND_ORDER.map((colCode) => {
                  const stats = data.grid.find((item) => item.workerTypeCode === rowCode && item.ageBandCode === colCode)?.stats
                  return { value: pick(stats), count: stats?.memberCount ?? 0 }
                }),
              )}
              myCell={me ? indexOf(me) : null}
              selectedCell={indexOf(cell)}
              onSelectCell={(row, col) => setPickedCell({ workerTypeCode: WORKER_TYPE_ORDER[row], ageBandCode: AGE_BAND_ORDER[col] })}
              rowSummary={WORKER_TYPE_ORDER.map((code) => pick(findGroup(data.byWorkerType, code)))}
              colSummary={AGE_BAND_ORDER.map((code) => pick(findGroup(data.byAgeBand, code)))}
              totalSummary={pick(data.overall)}
              formatValue={metric.formatValue}
            />
          ) : (
            <GroupStripHeatmap
              groups={groups}
              groupName={(code) => groupLabel(view, code)}
              metric={metric}
              myCode={me ? (view === 'AGE_BAND' ? me.ageBandCode : me.workerTypeCode) : null}
              selectedCode={view === 'AGE_BAND' ? ageBandCode : workerTypeCode}
              onSelect={view === 'AGE_BAND' ? setPickedAgeBand : setPickedWorkerType}
            />
          )}
          <p className="hint">
            낮음 → 높음(진할수록) · [나] 내 집단 · — 인원이 적어 숨긴 값{view === 'GRID' && ' · 점선 칸 = 평균'}
          </p>
        </Card>
        <SelectedGroupPanel data={data} stats={panel.stats} title={panel.title} comparisons={panel.comparisons} />
      </div>

      {view !== 'GRID' && (
        <Card title={`${view === 'AGE_BAND' ? '연령대별' : '직군별'} 요약표`}>
          <AdminStatsTable groupBy={view} groups={[...groups, data.overall]} />
          <p className="hint">괄호 안 인원은 기존 점수도 있는 회원 수예요.</p>
        </Card>
      )}
    </section>
  )
}
