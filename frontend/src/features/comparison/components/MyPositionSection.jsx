import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice } from '../../../common/components/index.js'
import { DATA_INPUT_PATHS } from '../../dataInput/dataInputPaths.js'
import { getScorePercentile } from '../api/scorePercentileApi.js'
import MyPositionCard from './MyPositionCard.jsx'

// N-13-4 비교 분석 '내 위치' — 같은 직군·연령대·직군+연령대 안에서의 내 대안 점수 위치를 카드 3개로 보여 준다(RPT-05, FP-251).
export default function MyPositionSection() {
  const [state, setState] = useState({ position: null, error: null })

  // 화면에 들어올 때 한 번 읽는다.
  useEffect(() => {
    let alive = true
    getScorePercentile()
      .then((position) => alive && setState({ position, error: null }))
      .catch((error) => alive && setState({ position: null, error }))
    return () => {
      alive = false
    }
  }, [])

  const { position, error } = state
  if (error) return <PositionError error={error} />
  if (!position) {
    return (
      <p className="hint" role="status">
        내 위치를 불러오는 중입니다…
      </p>
    )
  }

  return (
    <section className="l-stack" aria-labelledby="my-position-title">
      <h2 id="my-position-title" className="my-position__title">
        내 위치
        <span className="hint">
          내 대안 점수 <b className="num">{position.myScore}점</b> 기준
        </span>
      </h2>
      <div className="l-grid3">
        {position.groups.map((group) => (
          <MyPositionCard key={group.groupType} group={group} position={position} />
        ))}
      </div>
      <p className="hint">
        서비스에 쓰는 모델({position.modelVersion})로 점수를 낸 회원끼리 비교합니다(본인 포함, 탈퇴 회원 제외). 직군·연령대는 점수를 낼 때의 값이며,
        합성 데이터로 만든 참고 값입니다.
      </p>
    </section>
  )
}

// 지금 모델로 낸 점수가 없으면(옛 모델 점수만 있어도) 점수 산출을 안내하고, 그 밖의 실패는 오류로 알린다.
function PositionError({ error }) {
  if (error.status === 404 && error.data?.code === 'ASSESSMENT_NOT_FOUND') {
    return (
      <Notice>
        지금 쓰는 모델로 낸 점수가 없어 내 위치를 보여 드릴 수 없습니다.{' '}
        <Link to={DATA_INPUT_PATHS.DATA_INPUT}>입력 후 점수를 산출해 주세요.</Link>
      </Notice>
    )
  }
  return <Notice type="warn">내 위치를 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.</Notice>
}
