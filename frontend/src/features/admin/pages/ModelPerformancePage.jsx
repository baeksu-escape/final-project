import { useEffect, useState } from 'react'
import { Card, Chip, Notice, Select, Slider } from '../../../common/components/index.js'
import { fetchModelPerformance, fetchModelRoc } from '../api/modelPerformanceApi.js'
import JobRejectBars from '../components/JobRejectBars.jsx'
import ModelMetricTable from '../components/ModelMetricTable.jsx'
import RocCurveChart from '../components/RocCurveChart.jsx'
<<<<<<< HEAD
import { CUTOFF, DEFAULT_GROUP, DEFAULT_LABEL, MODEL_GROUPS, MODEL_LABELS } from '../modelPerformanceCodes.js'
=======
import { AUC_BASIS_LABELS, CUTOFF, DEFAULT_GROUP, DEFAULT_LABEL, MODEL_GROUPS, MODEL_LABELS } from '../modelPerformanceCodes.js'
>>>>>>> 5a3ee5e0b4a8374d3eb68ddcb44c18ce29f0cb32

// 슬라이더를 끄는 동안 요청이 몰리지 않게, 손을 멈추고 이 시간이 지나면 다시 계산을 요청한다
const CUTOFF_WAIT_MS = 250

// N-25 모형 성능 비교 (관리자) — 고객 집단·비교 라벨·컷오프(N-25-1)를 고르면 기존·대안 모형의 지표 비교 표(N-25-2),
// ROC 곡선(N-25-3), 직군별 우량 고객 오거절률(N-25-4)을 보여 준다. 대안이 더 나쁜 지표·직군도 숨기지 않는다.
// 11/19: 두 집단은 정답 라벨 생성 방식이 달라 집단별로만 보고('전체' 없음), 두 모형은 같은 라벨로 맞춰 비교한다.
export default function ModelPerformancePage() {
  const [group, setGroup] = useState(DEFAULT_GROUP)
  const [label, setLabel] = useState(DEFAULT_LABEL)
  const [cutoff, setCutoff] = useState(CUTOFF.initial)
  const [perf, setPerf] = useState({ data: null, error: '' })
  const [roc, setRoc] = useState({ data: null, error: '' })

  // ADM-01 지표 비교 — 집단·라벨·컷오프가 바뀌면 잠깐 기다렸다가 다시 읽는다
  useEffect(() => {
    let alive = true
    const timer = setTimeout(() => {
      fetchModelPerformance({ group, label, cutoff })
        .then((data) => alive && setPerf({ data, error: '' }))
        // 실패하면 이전 조건의 숫자를 지운다 — 제목은 새 조건인데 숫자가 남으면 새 결과로 오해한다
        .catch((err) => alive && setPerf({ data: null, error: err.message }))
    }, CUTOFF_WAIT_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [group, label, cutoff])

  // ADM-02 ROC 곡선 — 컷오프와 무관해 집단·라벨이 바뀔 때만 읽는다
  useEffect(() => {
    let alive = true
    fetchModelRoc({ group, label })
      .then((data) => alive && setRoc({ data, error: '' }))
      .catch((err) => alive && setRoc({ data: null, error: err.message }))
    return () => {
      alive = false
    }
  }, [group, label])

  const groupInfo = MODEL_GROUPS.find((item) => item.value === group) ?? MODEL_GROUPS[0]
  const labelName = MODEL_LABELS.find((item) => item.value === label)?.label ?? label
  const data = perf.data

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-head__title">모형 성능 비교</h1>
          <p className="page-head__lead">
            기존 모형(금융 이력만)과 대안 모형(금융 이력 + 대안 데이터)을 같은 평가 표본, 같은 정답 라벨로 비교합니다. 합성 데이터 기준이며 실제
            개선을 뜻하지 않습니다.
          </p>
        </div>
      </div>

      <section className="card l-g2" aria-label="비교 조건">
        <Select label="고객 집단" value={group} onChange={(value) => setGroup(value ?? DEFAULT_GROUP)} options={MODEL_GROUPS} />
        <Select label="비교 라벨 (정답)" value={label} onChange={(value) => setLabel(value ?? DEFAULT_LABEL)} options={MODEL_LABELS} />
        <Slider
          label="승인 기준 점수 (컷오프)"
          value={cutoff}
          onChange={setCutoff}
          min={CUTOFF.min}
          max={CUTOFF.max}
          step={CUTOFF.step}
          unit="점"
        />
        <div>
          {data && (
            <Chip>
              {groupInfo.basis} {data.sampleCount.toLocaleString()}명 · 불량 {data.badCount.toLocaleString()}명
            </Chip>
          )}
        </div>
      </section>

      {/* B조 요청(11/19): 씬파일 결과는 기존 집단으로 학습한 모델을 적용한 것이라 따로 알린다 */}
      {group === 'THINFILE' && (
        <Notice>
          금융 이력 부족 집단은 모형이 학습하지 않은 집단입니다. 기존 집단으로 학습한 모델을 적용한 결과이며(TRAIN+VALID 평가), 직군별로는 불량 수가 적어
          값이 흔들릴 수 있습니다.
        </Notice>
      )}
      {perf.error && <Notice type="warn">{perf.error}</Notice>}

      <div className="l-cols">
        <Card title={`지표 비교 · ${groupInfo.label} · ${labelName} · 컷오프 ${cutoff}점`} className="l-cols__main">
          {data ? (
<<<<<<< HEAD
            <ModelMetricTable legacy={data.legacy} alternative={data.alternative} aucNote={groupInfo.aucBasis} />
=======
            <ModelMetricTable
              legacy={data.legacy}
              alternative={data.alternative}
              aucNote={AUC_BASIS_LABELS[data.aucBasis] ?? groupInfo.aucBasis}
            />
>>>>>>> 5a3ee5e0b4a8374d3eb68ddcb44c18ce29f0cb32
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
            <RocCurveChart
              legacy={roc.data.legacy}
              alternative={roc.data.alternative}
              cutoff={cutoff}
              caption={`${groupInfo.label} ${labelName}`}
            />
          ) : (
            !roc.error && <p className="hint">곡선을 불러오는 중입니다…</p>
          )}
          <p className="hint">
            곡선은 평가 표본 점수로 그립니다. 점은 지금 컷오프({cutoff}점)의 위치입니다. AUC 값은 왼쪽 비교 표를 보세요.
          </p>
        </Card>
      </div>

      <Card title={`직군별 우량 고객 오거절률 · 컷오프 ${cutoff}점`}>
        {data && <JobRejectBars rows={data.byJob} />}
        <p className="hint">우량 고객인데 승인 기준에 못 미쳐 거절된 비율입니다. 낮을수록 좋습니다.</p>
      </Card>
    </>
  )
}
