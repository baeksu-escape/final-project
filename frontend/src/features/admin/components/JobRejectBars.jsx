import { CompareBar } from '../../../common/components/index.js'
import { formatRate, jobLabel } from '../modelPerformanceCodes.js'

// N-25-4 직군별 우량 고객 오거절률 — 직군마다 기존·대안 막대를 공통 CompareBar로 나란히 보여 준다.
// rows: ADM-01 응답의 byJob. 막대 100% 기준은 모든 직군 중 가장 큰 값으로 맞춰 직군끼리 비교할 수 있게 한다.
// 직군별은 불량(양성) 수가 적어 값이 흔들리므로 표본·불량 수를 함께 보여 준다(11/19 B조 요청).
export default function JobRejectBars({ rows }) {
  const max = Math.max(...rows.flatMap((row) => [row.legacyGoodRejectRate, row.alternativeGoodRejectRate]), 0.01)
  return (
    <div className="l-stack">
      {rows.map((row) => (
        <CompareBar
          key={row.jobType}
          label={`${jobLabel(row.jobType)} · 표본 ${row.sampleCount.toLocaleString()}명 · 불량 ${row.badCount.toLocaleString()}명`}
          myValue={row.alternativeGoodRejectRate}
          avgValue={row.legacyGoodRejectRate}
          maxValue={max}
          myLabel="대안"
          avgLabel="기존"
          unit="%"
          formatValue={formatRate}
        />
      ))}
    </div>
  )
}
