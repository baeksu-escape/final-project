import { Button } from '../../../common/components/index.js'
import { formatScore } from '../../admin/adminStatsCodes.js'
import { AGE_BAND_ORDER, WORKER_TYPE_ORDER, ageName, jobName } from '../groupComparisonCodes.js'

// 평균과 인원 두 줄 — 요약 칸(직군 평균·연령 평균·전체)에 쓴다.
function SummaryCell({ stats }) {
  return (
    <td className="is-num num">
      {formatScore(stats?.avgAltScore ?? null)}
      <div className="hint">{stats?.memberCount ?? 0}명</div>
    </td>
  )
}

// N-26-6 직군 × 연령 격자 — 칸마다 대안 평균 점수와 인원, 오른쪽 끝 열은 직군 평균, 맨 아래 행은 연령 평균, 오른쪽 아래는 전체 평균.
// 값마다 계산 인원이 5명 미만이면 서버가 null로 보내 '—'로 보인다. 공통 HeatmapGrid는 null을 0점으로 그려서 표로 만들었다(11/23 광희 결정).
// 칸 버튼을 누르면 그 집단을 고른다(onSelect). 내 칸에는 '나', 고른 칸에는 '선택'을 글자로 붙인다.
export default function GroupGridTable({ data, selected, onSelect }) {
  const me = data.me
  const cellOf = (workerTypeCode, ageBandCode) =>
    data.grid.find((cell) => cell.workerTypeCode === workerTypeCode && cell.ageBandCode === ageBandCode)

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">직군 \ 연령대</th>
            {AGE_BAND_ORDER.map((ageBandCode) => (
              <th key={ageBandCode} scope="col" className="is-num">
                {ageName(ageBandCode)}
              </th>
            ))}
            <th scope="col" className="is-num">
              직군 평균
            </th>
          </tr>
        </thead>
        <tbody>
          {WORKER_TYPE_ORDER.map((workerTypeCode) => (
            <tr key={workerTypeCode}>
              <th scope="row">{jobName(workerTypeCode)}</th>
              {AGE_BAND_ORDER.map((ageBandCode) => {
                const stats = cellOf(workerTypeCode, ageBandCode)?.stats
                const isMine = me?.workerTypeCode === workerTypeCode && me?.ageBandCode === ageBandCode
                const isSelected = selected.workerTypeCode === workerTypeCode && selected.ageBandCode === ageBandCode
                return (
                  <td key={ageBandCode} className="is-num" aria-current={isSelected ? 'true' : undefined}>
                    <Button size="sm" onClick={() => onSelect({ workerTypeCode, ageBandCode })}>
                      {formatScore(stats?.avgAltScore ?? null)}
                    </Button>
                    <div className="hint">
                      {stats?.memberCount ?? 0}명{isMine && ' · 나'}
                      {isSelected && ' · 선택'}
                    </div>
                  </td>
                )
              })}
              <SummaryCell stats={data.byWorkerType.find((group) => group.groupCode === workerTypeCode)} />
            </tr>
          ))}
          <tr>
            <th scope="row">연령 평균</th>
            {AGE_BAND_ORDER.map((ageBandCode) => (
              <SummaryCell key={ageBandCode} stats={data.byAgeBand.find((group) => group.groupCode === ageBandCode)} />
            ))}
            <SummaryCell stats={data.overall} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
