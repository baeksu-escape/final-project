import { useEffect, useState } from 'react'
import { Card, Chip, Notice, Select, Slider } from '../../../common/components/index.js'
import { fetchModelPerformance, fetchModelRoc } from '../api/modelPerformanceApi.js'
import JobRejectBars from '../components/JobRejectBars.jsx'
import ModelMetricTable from '../components/ModelMetricTable.jsx'
import RocCurveChart from '../components/RocCurveChart.jsx'
import { CUTOFF, DEFAULT_GROUP, MODEL_GROUPS } from '../modelPerformanceCodes.js'

// 슬라이더를 끄는 동안 요청이 몰리지 않게, 손을 멈추고 이 시간이 지나면 다시 계산을 요청한다
const CUTOFF_WAIT_MS = 250

// N-25 모형 성능 비교 (관리자) — 고객 집단·컷오프(N-25-1)를 고르면 기존·대안 모형의 지표 비교 표(N-25-2),
// ROC 곡선(N-25-3), 직군별 우량 고객 오거절률(N-25-4)을 보여 준다. 대안이 더 나쁜 지표·직군도 숨기지 않는다.
export default function ModelPerformancePage() {
  const [group, setGroup] = useState(DEFAULT_GROUP)
  const [cutoff, setCutoff] = useState(CUTOFF.initial)
  const [perf, setPerf] = useState({ data: null, error: '' })
  const [roc, setRoc] = useState({ data: null, error: '' })

  // ADM-01 지표 비교 — 집단·컷오프가 바뀌면 잠깐 기다렸다가 다시 읽는다
  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      fetchModelPerformance({ group, cutoff })
        .then((data) => alive && setPerf({ data, error: '' }))
        .catch((err) => alive && setPerf((prev) => ({ ...prev, error: err.message })))
    }, CUTOFF_WAIT_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [group, cutoff])

  // ADM-02 ROC 곡선 — 컷오프와 무관해 집단이 바뀔 때만 읽는다
  useEffect(() => {
    let alive = true
    fetchModelRoc(group)
      .then((data) => alive && setRoc({ data, error: '' }))
      .catch((err) => alive && setRoc((prev) => ({ ...prev, error: err.message })))
    return () => {
      alive = false
    }
  }, [group])

  const groupLabel = MODEL_GROUPS.find((item) => item.value === group)?.label ?? group
  const data = perf.data

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-head__title">모형 성능 비교</h1>
          <p className="page-head__lead">
            기존 모형(금융 이력만)과 대안 모형(금융 이력 + 대안 데이터)을 같은 검증 표본으로 비교합니다. 합성 데이터로 만든 교육용 결과입니다.
          </p>
        </div>
      </div>

      <section className="card l-g2" aria-label="비교 조건">
        <Select label="고객 집단" value={group} onChange={(value) => setGroup(value ?? DEFAULT_GROUP)} options={MODEL_GROUPS} />
        <Slider
          label="승인 기준 점수 (컷오프)"
          value={cutoff}
          onChange={setCutoff}
          min={CUTOFF.min}
          max={CUTOFF.max}
          step={CUTOFF.step}
          unit="점"
        />
        <div>{data && <Chip>검증 표본 {data.sampleCount.toLocaleString()}명</Chip>}</div>
      </section>

      {perf.error && <Notice type="warn">{perf.error}</Notice>}

      <div className="l-cols">
        <Card title={`지표 비교 · ${groupLabel} · 컷오프 ${cutoff}점`} className="l-cols__main">
          {data ? (
            <ModelMetricTable legacy={data.legacy} alternative={data.alternative} />
          ) : (
            !perf.error && <p className="hint">지표를 계산하는 중입니다…</p>
          )}
          <p className="hint">
            컷오프를 올리면 부도 고객 오승인은 줄고 우량 고객 오거절은 늘어납니다. 오분류 비용은 부도 오승인을 5배로 보고 계산합니다.
          </p>
        </Card>
        <Card title="ROC 곡선">
          {roc.error && <Notice type="warn">{roc.error}</Notice>}
          {roc.data ? (
            <RocCurveChart legacy={roc.data.legacy} alternative={roc.data.alternative} groupLabel={groupLabel} />
          ) : (
            !roc.error && <p className="hint">곡선을 불러오는 중입니다…</p>
          )}
        </Card>
      </div>

      <Card title={`직군별 우량 고객 오거절률 · 컷오프 ${cutoff}점`}>
        {data && <JobRejectBars rows={data.byJob} />}
        <p className="hint">우량 고객인데 승인 기준에 못 미쳐 거절된 비율입니다. 낮을수록 좋습니다.</p>
      </Card>
    </>
  )
}
