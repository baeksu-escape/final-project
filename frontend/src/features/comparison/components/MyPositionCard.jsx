import { Card } from '../../../common/components/index.js'
import { POSITION_RANGE, diffText, formatNumber, groupName, groupTag, positionPct } from '../comparisonCodes.js'

// N-13-4 내 위치 카드 1개 — 상위 n%, 평균 대비 점수, 위치 막대(가운데 = 집단 평균). 인원이 적어 값이 null이면 안내만 보여 준다.
export default function MyPositionCard({ group, position }) {
  const name = groupName(group.groupType, position.workerTypeCode, position.ageBandCode)
  return (
    <Card className="my-position-card">
      <div>
        <p className="hint">{groupTag(group.groupType)}</p>
        <h3 className="my-position-card__name">
          {name} <span className="num">{group.memberCount.toLocaleString('ko-KR')}</span>명 중
        </h3>
      </div>
      {group.topPct === null ? (
        <p className="panel-sunk">
          표본이 적어요. 같은 집단이 {group.memberCount}명이라 비교 값을 보여 주지 않습니다({position.minGroupSize}명부터 표시).
        </p>
      ) : (
        <>
          <div>
            <p className="my-position-card__top">
              상위 <b className="num">{formatNumber(group.topPct)}%</b>
            </p>
            <p className="my-position-card__diff">{diffText(group.diffFromAvg)}</p>
          </div>
          <PositionBar name={name} myScore={position.myScore} avgScore={group.avgScore} diff={group.diffFromAvg} />
        </>
      )}
    </Card>
  )
}

// 위치 막대 — 평균을 가운데 두고 내 점수를 점수 차이만큼 왼쪽(하위)·오른쪽(상위)에 찍는다.
function PositionBar({ name, myScore, avgScore, diff }) {
  return (
    <div className="position-bar" role="img" aria-label={`${name} 평균 ${formatNumber(avgScore)}점, 내 점수 ${myScore}점, ${diffText(diff)}`}>
      <div className="position-bar__track">
        <span className="position-bar__avg" />
        <span className="position-bar__me" style={{ '--pos': `${positionPct(diff)}%` }} />
      </div>
      <div className="position-bar__labels">
        <span>
          하위 <span className="num">-{POSITION_RANGE}점</span>
        </span>
        <span>
          평균 <b className="num">{formatNumber(avgScore)}점</b>
        </span>
        <span>
          상위 <span className="num">+{POSITION_RANGE}점</span>
        </span>
      </div>
    </div>
  )
}
