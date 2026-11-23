import { useEffect, useState } from 'react'
import { Card, HeatmapGrid, Notice, SegmentedControl } from '../../../common/components/index.js'
import { getGroupComparison } from '../api/groupComparisonApi.js'
import {
  AGE_BAND_ORDER,
  CELL_METRICS,
  DEFAULT_CELL_METRIC,
  DEFAULT_VIEW,
  VIEW_OPTIONS,
  WORKER_TYPE_ORDER,
  ageName,
  jobName,
} from '../groupComparisonCodes.js'
import GroupBarsCompare from './GroupBarsCompare.jsx'
import SelectedGroupPanel from './SelectedGroupPanel.jsx'

// FP-164 N-26-5~7 비교 분석 '같은 집단과 나란히 보기' 구역 — 동주 님 화면 틀(ComparisonPage, FP-253)의 내 위치 카드 아래에 둔다.
// ADM-04를 한 번 불러 보기 전환(직군 × 연령 격자 / 직군별 / 연령대별)마다 다시 부르지 않는다. 집계 기준은 관리자 통계·내 위치와 같다.
// 격자는 11/06 UI처럼 공통 HeatmapGrid(색 진하기·'나'·점선 평균)로 그리고, 칸에 표시할 값(대안 점수·상승폭·보통 이상)을 고른다.
export default function GroupCompareSection() {
  const [state, setState] = useState({ data: null, error: null })
  const [view, setView] = useState(DEFAULT_VIEW)
  const [metricKey, setMetricKey] = useState(DEFAULT_CELL_METRIC)
  // 격자에서 고른 칸. 아직 고르지 않았으면 내 칸(없으면 첫 칸)을 보여 준다.
  const [picked, setPicked] = useState(null)

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
  if (error) return <Notice type="warn">같은 집단 비교를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.</Notice>
  if (!data) {
    return (
      <p className="hint" role="status">
        같은 집단 비교를 불러오는 중입니다…
      </p>
    )
  }
  if (!data.modelVersion) return <Notice>서비스에 쓰는 모델이 없어 집단 비교를 보여 드릴 수 없습니다.</Notice>

  const selected =
    picked ??
    (data.me
      ? { workerTypeCode: data.me.workerTypeCode, ageBandCode: data.me.ageBandCode }
      : { workerTypeCode: WORKER_TYPE_ORDER[0], ageBandCode: AGE_BAND_ORDER[0] })
  const metric = CELL_METRICS.find((item) => item.value === metricKey) ?? CELL_METRICS[0]
  const pick = (stats) => stats?.[metric.field] ?? null
  const statsOf = (workerTypeCode, ageBandCode) =>
    data.grid.find((cell) => cell.workerTypeCode === workerTypeCode && cell.ageBandCode === ageBandCode)?.stats
  const indexOf = (code) => ({ row: WORKER_TYPE_ORDER.indexOf(code.workerTypeCode), col: AGE_BAND_ORDER.indexOf(code.ageBandCode) })
  const mine = data.me ? indexOf(data.me) : null
  const chosen = indexOf(selected)

  return (
    <section className="l-stack" aria-labelledby="group-compare-title">
      <h2 id="group-compare-title">같은 집단과 나란히 보기</h2>
      <SegmentedControl label="비교 보기" options={VIEW_OPTIONS} value={view} onChange={setView} />
      <p className="hint">
        개인 점수가 드러나지 않도록 값마다 계산에 들어간 인원이 {data.minGroupSize}명보다 적으면 숨깁니다(—).
        {!data.me && " 내 점수가 없어 '나' 표시 없이 보여 드립니다."}
      </p>

      {view === 'GRID' ? (
        <div className="l-cols">
          <Card title="직군 × 연령 한눈에 보기" className="l-cols__main">
            <SegmentedControl label="칸에 표시할 값" options={CELL_METRICS} value={metric.value} onChange={setMetricKey} />
            <HeatmapGrid
              rows={WORKER_TYPE_ORDER.map(jobName)}
              columns={AGE_BAND_ORDER.map(ageName)}
              data={WORKER_TYPE_ORDER.map((workerTypeCode) =>
                AGE_BAND_ORDER.map((ageBandCode) => {
                  const stats = statsOf(workerTypeCode, ageBandCode)
                  return { value: pick(stats), count: stats?.memberCount ?? 0 }
                }),
              )}
              myCell={mine ? [mine.row, mine.col] : null}
              selectedCell={[chosen.row, chosen.col]}
              onSelectCell={(row, col) => setPicked({ workerTypeCode: WORKER_TYPE_ORDER[row], ageBandCode: AGE_BAND_ORDER[col] })}
              rowSummary={WORKER_TYPE_ORDER.map((code) => pick(data.byWorkerType.find((group) => group.groupCode === code)))}
              colSummary={AGE_BAND_ORDER.map((code) => pick(data.byAgeBand.find((group) => group.groupCode === code)))}
              totalSummary={pick(data.overall)}
              formatValue={metric.formatValue}
            />
            <p className="hint">
              칸이 진할수록 값이 높습니다. 칸을 누르면 오른쪽에 자세한 내용이 나옵니다. 점선 칸은 직군 평균·연령 평균·전체 평균이고, '—'는 인원이
              적어 숨긴 값입니다.
            </p>
          </Card>
          <SelectedGroupPanel data={data} selected={selected} />
        </div>
      ) : (
        <GroupBarsCompare data={data} view={view} />
      )}
    </section>
  )
}
