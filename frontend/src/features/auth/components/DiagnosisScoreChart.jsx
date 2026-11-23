import { TrendLineChart } from '../../../common/components/index.js'
import { GRADE_STATUS } from '../../../common/config/scoreStatus.js'

// 그래프를 그리려면 필요한 점 수 — 점이 하나뿐이면 변화를 보여 줄 수 없어 안내로 대신한다.
const MIN_POINTS = 2

// FP-222 v2 N-04-6 점수 변화 그래프 — 진단 내역(MEM-06) 중 산출된 평가의 대안 점수를 오래된 순서로 잇는다.
// 산출 불가 평가와 대안 점수가 없는 평가는 그래프에서 빼고 표에만 남긴다. 공통 TrendLineChart는 선이 하나라 기존 점수는 표에서 본다.
export default function DiagnosisScoreChart({ items }) {
  const points = items
    .filter((item) => item.gradeStatusCode === GRADE_STATUS.SCORED && item.alternativeScore != null)
    .sort((a, b) => a.calculatedAt.localeCompare(b.calculatedAt))
    .map((item) => ({ label: item.calculatedAt.slice(5, 10), value: item.alternativeScore }))

  if (points.length < MIN_POINTS) {
    return <p className="hint">진단이 2번 이상 쌓이면 대안 점수 변화를 그래프로 보여 드립니다.</p>
  }
  return (
    <>
      <p className="hint">대안 점수 변화(오래된 순, 산출 불가 진단은 빼고 그립니다)</p>
      <TrendLineChart data={points} width={640} height={180} unit="점" ariaLabel="진단 일시별 대안 점수 변화 그래프" />
    </>
  )
}
