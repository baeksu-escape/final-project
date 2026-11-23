import { CompareBar } from '../../../common/components/index.js'
import { GRADE_ORDER, gradeLabel } from '../adminStatsCodes.js'

// 값은 이미 % 단위다. CompareBar가 unit '%'를 붙이므로 숫자만 낸다.
const formatPercentNumber = (value) => value.toFixed(1)

// 등급 코드로 분포 행을 찾는다(서버는 0명 등급도 보내지만 없을 때를 대비해 0으로 본다).
function rateOf(distribution, code) {
  return distribution.find((row) => row.gradeBandCode === code)?.ratePct ?? 0
}

function countOf(distribution, code) {
  return distribution.find((row) => row.gradeBandCode === code)?.count ?? 0
}

// N-26-3 등급 분포(기존 → 대안) — 등급마다 기존·대안 비율 막대를 공통 CompareBar로 나란히 보여 준다(JobRejectBars와 같은 방식).
// alt: 대안 분포(gradeDistribution), trad: 기존 분포(tradGradeDistribution). 계산 인원이 5명 미만이면 서버가 null로 숨긴다.
// 대안만 있고 기존이 숨겨졌으면(기존 모델 산출자 부족) 0%로 그리지 않고 대안 인원·비율만 글자로 보여 준다.
export default function GradeDistributionBars({ alt, trad, minGroupSize, tradScoredMemberCount }) {
  if (!alt) {
    return <p className="hint">평가 인원이 {minGroupSize}명보다 적어 등급 분포를 숨겼습니다.</p>
  }
  if (!trad) {
    return (
      <div className="l-stack">
        {GRADE_ORDER.map((code) => (
          <p key={code}>
            {gradeLabel(code)} · 대안 <b className="num">{formatPercentNumber(rateOf(alt, code))}%</b> ({countOf(alt, code)}명)
          </p>
        ))}
        <p className="hint">
          기존 모델로 산출된 회원이 {tradScoredMemberCount}명이라({minGroupSize}명 미만) 기존 분포는 숨겼습니다.
        </p>
      </div>
    )
  }
  return (
    <div className="l-stack">
      {GRADE_ORDER.map((code) => (
        <CompareBar
          key={code}
          label={`${gradeLabel(code)} · 대안 ${countOf(alt, code)}명 · 기존 ${countOf(trad, code)}명`}
          myValue={rateOf(alt, code)}
          avgValue={rateOf(trad, code)}
          maxValue={100}
          myLabel="대안"
          avgLabel="기존"
          unit="%"
          formatValue={formatPercentNumber}
        />
      ))}
    </div>
  )
}
