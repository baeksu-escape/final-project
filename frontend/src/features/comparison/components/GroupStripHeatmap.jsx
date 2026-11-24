import { HeatmapGrid } from '../../../common/components/index.js'
import { STRIP_COLUMNS } from '../groupComparisonCodes.js'

// N-26-7 직군별·연령대별 한눈에 보기 — 행은 집단(직군 3 또는 연령대 4), 열은 고른 지표의 기존 → 대안(상승폭은 1열)이다.
// 격자 보기와 같은 공통 HeatmapGrid로 색 진하기를 보여 주고, 행을 누르면 그 집단을 고른다(onSelect(groupCode)).
// '나'와 선택 테두리는 마지막 열(대안) 칸에 붙인다. 인원은 마지막 열에만 적는다. 숨긴 값은 '—'.
export default function GroupStripHeatmap({ groups, groupName, metric, myCode, selectedCode, onSelect }) {
  const columns = STRIP_COLUMNS[metric.value] ?? STRIP_COLUMNS.ALT_SCORE
  const last = columns.length - 1
  const myRow = groups.findIndex((group) => group.groupCode === myCode)
  const selectedRow = groups.findIndex((group) => group.groupCode === selectedCode)

  return (
    <HeatmapGrid
      rows={groups.map((group) => groupName(group.groupCode))}
      columns={columns.map((column) => column.label)}
      data={groups.map((group) =>
        columns.map((column, index) => ({ value: group[column.field] ?? null, count: index === last ? group.memberCount : null })),
      )}
      myCell={myRow >= 0 ? [myRow, last] : null}
      selectedCell={selectedRow >= 0 ? [selectedRow, last] : null}
      onSelectCell={(row) => onSelect(groups[row].groupCode)}
      formatValue={metric.formatValue}
    />
  )
}
