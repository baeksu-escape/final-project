import {
  GRADE_ORDER,
  formatPct,
  formatScore,
  formatTradToAlt,
  formatUplift,
  gradeLabel,
  groupLabel,
} from '../adminStatsCodes.js'
import { EMPTY_TEXT } from '../adminFormat.js'

// 대안 등급 분포를 "Caution 2 · Standard 3 · Good 1"처럼 한 줄로 — 숨겨졌으면(null) '—'
function formatDistribution(distribution) {
  if (!distribution) return EMPTY_TEXT
  return GRADE_ORDER.map((code) => {
    const count = distribution.find((row) => row.gradeBandCode === code)?.count ?? 0
    return `${gradeLabel(code)} ${count}`
  }).join(' · ')
}

// N-26-4 직군별·연령대별 통계 표 — 그룹마다 인원, 평균 점수·Standard 이상 비율(기존 → 대안), 상승폭, 대안 등급 분포.
// groups: ADM-03 응답의 groups(0명 그룹도 고정 순서로 온다). 값마다 계산 인원이 5명 미만이면 서버가 null로 보내 '—'로 보인다.
export default function AdminStatsTable({ groupBy, groups }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">{groupBy === 'AGE_BAND' ? '연령대' : '직군'}</th>
            <th scope="col" className="is-num">
              평가 인원 (기존 산출)
            </th>
            <th scope="col" className="is-num">
              평균 점수 (기존 → 대안)
            </th>
            <th scope="col" className="is-num">
              상승폭
            </th>
            <th scope="col" className="is-num">
              보통 이상 (기존 → 대안)
            </th>
            <th scope="col">대안 등급 분포 (명)</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.groupCode}>
              <td>{groupLabel(groupBy, group.groupCode)}</td>
              <td className="is-num num">
                {group.memberCount}명 ({group.tradScoredMemberCount}명)
              </td>
              <td className="is-num num">{formatTradToAlt(group.avgTradScore, group.avgAltScore, formatScore)}</td>
              <td className="is-num num">{formatUplift(group.avgScoreUplift)}</td>
              <td className="is-num num">
                {formatTradToAlt(group.tradStandardOrAboveRatePct, group.standardOrAboveRatePct, formatPct)}
              </td>
              <td>{formatDistribution(group.gradeDistribution)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
