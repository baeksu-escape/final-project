import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CountUp, ScoreRing } from '../../../common/components/viz.jsx'
import { PATHS } from '../../../common/config/navigation.js'
import { fetchDiagnosisHistory } from '../api/diagnosisHistoryApi.js'

const GRADE_TEXT = { GOOD: '좋음', STANDARD: '보통', CAUTION: '주의' }
const GRADE_TIP = {
  GOOD: '지금 상태를 유지하면 좋아요. 납부 기록을 꾸준히 이어 가세요.',
  STANDARD: '조금만 더 올리면 좋음 등급이에요. 시뮬레이터에서 방법을 찾아보세요.',
  CAUTION: '점수를 깎은 항목부터 확인해 보세요. 리포트에서 이유를 볼 수 있어요.',
}

// UI 리뉴얼(FP-252) — 마이페이지 [진단내역] 탭의 "신용 기록 요약": 최근 대안 점수(링)와 숫자 타일(진단 횟수·최고 점수·첫 진단 대비).
// 진단 내역(MEM-06) 응답만 쓴다. 점수가 없는 평가는 빼고 계산한다. 점수 변화 그래프는 아래 진단 내역 카드(FP-222)에 있다.
// FP-259 인사말(○○님의 신용 기록)은 탭 위에 남기려고 MyPage로 옮겼다.
export default function MyCreditSummary() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    let active = true
    fetchDiagnosisHistory().then(({ items: list }) => { if (active) setItems(list ?? []) }).catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [])

  const scored = (items ?? []).filter((item) => item.alternativeScore != null)
  const latest = scored[0]
  const oldest = scored[scored.length - 1]
  const best = scored.reduce((max, item) => Math.max(max, item.alternativeScore), 0)
  const growth = latest && oldest ? latest.alternativeScore - oldest.alternativeScore : null

  return (
    <section className="my-summary" aria-label="내 신용 한눈에">
      <div className="my-summary__grid">
        <article className="my-summary__card my-summary__ring">
          <h2>최근 대안 점수</h2>
          {latest ? <ScoreRing value={latest.alternativeScore} size={200} label="대안 모델" sub={new Date(latest.calculatedAt).toLocaleDateString('ko-KR')} /> : <p className="hint">아직 진단 기록이 없어요.</p>}
          {latest && (
            <>
              <dl className="my-summary__facts">
                <div><dt>기존 모델</dt><dd className="num">{latest.existingScore ?? '-'}<small>점</small></dd></div>
                <div><dt>등급</dt><dd>{GRADE_TEXT[latest.grade] ?? latest.grade ?? '-'}</dd></div>
                <div><dt>지난 진단보다</dt><dd className={`num ${latest.alternativeScoreChange > 0 ? 'is-up' : latest.alternativeScoreChange < 0 ? 'is-down' : ''}`}>{latest.alternativeScoreChange == null ? '-' : `${latest.alternativeScoreChange > 0 ? '+' : ''}${latest.alternativeScoreChange}`}<small>점</small></dd></div>
              </dl>
              {GRADE_TIP[latest.grade] && <p className="my-summary__tip">{GRADE_TIP[latest.grade]}</p>}
            </>
          )}
          <div className="my-summary__links">
            <Link to={PATHS.REPORT} className="my-summary__link">신용 리포트 →</Link>
            <Link to={PATHS.SIMULATOR} className="my-summary__link">점수 올리기 →</Link>
          </div>
        </article>

        <div className="my-summary__tiles">
          <article className="my-summary__card">
            <h2>진단 횟수</h2>
            <b>{items == null ? '-' : <CountUp value={items.length} />}<small>회</small></b>
          </article>
          <article className="my-summary__card">
            <h2>최고 대안 점수</h2>
            <b>{best ? <CountUp value={best} /> : '-'}<small>점</small></b>
          </article>
          <article className="my-summary__card">
            <h2>첫 진단보다</h2>
            <b className={growth > 0 ? 'is-up' : growth < 0 ? 'is-down' : ''}>
              {growth == null ? '-' : <>{growth > 0 ? '+' : ''}<CountUp value={growth} /></>}<small>점</small>
            </b>
          </article>
        </div>
      </div>
    </section>
  )
}
