import { useEffect, useState } from 'react'
import { Card, Notice, SegmentedControl } from '../../../common/components/index.js'
import { getGroupComparison } from '../api/groupComparisonApi.js'
import { AGE_BAND_ORDER, DEFAULT_VIEW, VIEW_OPTIONS, WORKER_TYPE_ORDER } from '../groupComparisonCodes.js'
import GroupBarsCompare from './GroupBarsCompare.jsx'
import GroupGridTable from './GroupGridTable.jsx'
import SelectedGroupPanel from './SelectedGroupPanel.jsx'

// FP-164 N-26-5~7 비교 분석 '같은 집단과 나란히 보기' 구역 — 동주 님 화면 틀(ComparisonPage, FP-253)의 내 위치 카드 아래에 둔다.
// ADM-04를 한 번 불러 보기 전환(직군 × 연령 격자 / 직군별 / 연령대별)마다 다시 부르지 않는다. 집계 기준은 관리자 통계·내 위치와 같다.
export default function GroupCompareSection() {
  const [state, setState] = useState({ data: null, error: null })
  const [view, setView] = useState(DEFAULT_VIEW)
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

  return (
    <section className="l-stack" aria-labelledby="group-compare-title">
      <h2 id="group-compare-title">같은 집단과 나란히 보기</h2>
      <SegmentedControl label="비교 보기" options={VIEW_OPTIONS} value={view} onChange={setView} />
      <p className="hint">
        서비스에 쓰는 모델({data.modelVersion})로 점수를 낸 회원끼리 비교합니다(탈퇴 회원 제외). 개인 점수가 드러나지 않도록 값마다 계산에 들어간
        인원이 {data.minGroupSize}명보다 적으면 숨깁니다(—).
        {!data.me && " 내 점수가 없어 '나' 표시 없이 보여 드립니다."}
      </p>

      {view === 'GRID' ? (
        <div className="l-cols">
          <Card title="직군 × 연령 대안 평균 점수" className="l-cols__main">
            <GroupGridTable data={data} selected={selected} onSelect={setPicked} />
            <p className="hint">칸을 누르면 그 집단을 자세히 봅니다. 오른쪽 끝은 직군 평균, 맨 아래는 연령 평균, 오른쪽 아래는 전체 평균입니다.</p>
          </Card>
          <SelectedGroupPanel data={data} selected={selected} />
        </div>
      ) : (
        <GroupBarsCompare data={data} view={view} />
      )}
    </section>
  )
}
