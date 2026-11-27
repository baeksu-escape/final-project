import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import ScoreRoad from '../components/ScoreRoad.jsx'
import Button from '../components/Button.jsx'
import { FactorBars, TrendArea } from '../components/viz.jsx'
import { NAV_GROUPS, PATHS } from '../config/navigation.js'
import { ROLES } from '../config/roles.js'
import { getHomePath } from '../auth/accessRules.js'
import { fetchDiagnosisHistory } from '../../features/auth/api/diagnosisHistoryApi.js'
import { fetchCreditReport } from '../../features/credit/api/creditApi.js'
import './home.css'

// UI 리뉴얼 — 로그인 후 홈. 내 점수(링)·점수 추이(곡선)·점수를 움직인 항목(막대)·다음 할 일·분류 바로가기를 넓게 보여 준다.
export default function HomePage() {
  const { user } = useAuth()
  const [report, setReport] = useState(null)
  const [reportError, setReportError] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState(false)
  // [다시 시도]를 누르면 1씩 올려 다시 불러온다
  const [reloadKey, setReloadKey] = useState(0)
  const [historyReloadKey, setHistoryReloadKey] = useState(0)

  // 가입 직후처럼 직군이나 점수가 아직 없으면 점수·추이를 부르지 않고 시작 안내만 보여 준다
  const needsStart = user?.role === ROLES.USER && (!user.jobType || user.hasScore === false)

  // 점수(RPT-02)를 불러온다. 조회가 실패하면 로딩에 머물지 않고 안내와 [다시 시도]를 보여 준다(FP-252 검수 반영).
  useEffect(() => {
    if (needsStart) return undefined
    let active = true
    fetchCreditReport()
      .then((data) => { if (active) { setReport(data); setReportError(false) } })
      .catch(() => { if (active) setReportError(true) })
    return () => { active = false }
  }, [reloadKey, needsStart])

  // N-12-4 점수 추이 내역을 불러온다. 실패 안내와 재시도는 추이 카드 안에서만 처리한다.
  useEffect(() => {
    if (needsStart) return undefined
    let active = true
    fetchDiagnosisHistory()
      .then(({ items }) => { if (active) { setHistory(items ?? []); setHistoryLoading(false) } })
      .catch(() => { if (active) { setHistoryError(true); setHistoryLoading(false) } })
    return () => { active = false }
  }, [historyReloadKey, needsStart])

  const retry = () => {
    setReportError(false)
    setReport(null)
    setReloadKey((key) => key + 1)
  }

  const alt = report?.alternative
  const scored = report?.gradeStatusCode === 'SCORED' && alt?.score != null
  const scoredHistory = [...history]
    .filter((item) => item.gradeStatusCode === 'SCORED' && item.alternativeScore != null && item.calculatedAt && !Number.isNaN(new Date(item.calculatedAt).getTime()))
    .sort((a, b) => new Date(a.calculatedAt) - new Date(b.calculatedAt))
  const visibleHistory = scoredHistory.slice(-6)
  const trend = visibleHistory
    .map((item) => ({ label: `${new Date(item.calculatedAt).getMonth() + 1}월`, value: item.alternativeScore }))
  // 축하 화면용 지난 평가 점수 — 지금 점수가 가장 최근 평가이고 같은 모델 버전일 때만(모델이 바뀌면 점수 차이에 모델 효과가 섞인다)
  const latestScored = scoredHistory.at(-1)
  const priorScored = scoredHistory.at(-2)
  const roadPrevious = latestScored?.alternativeScore === alt?.score && priorScored?.modelVersion === latestScored?.modelVersion ? priorScored?.alternativeScore : undefined
  const modelChanges =visibleHistory.slice(1).filter((item, index) => item.modelVersion !== visibleHistory[index].modelVersion)
  const latestModelChange = modelChanges.at(-1)
  const factors = [...(report?.shap?.factors ?? [])]
    .filter((factor) => factor.shapScore !== 0)
    .sort((a, b) => Math.abs(b.shapScore) - Math.abs(a.shapScore))
    .slice(0, 6)
    .map((factor) => ({ label: factor.featureName, value: factor.shapScore, tag: factor.alternativeYn === 'Y' ? '대안' : undefined }))
  const groups = NAV_GROUPS.filter((group) => group.items.length > 0)

  return (
    <div className="dash">
      <header className="dash-head">
        <p className="dash-head__eyebrow">{user?.name ? `${user.name}님의 신용` : '내 신용'}</p>
        <h1 className="dash-head__title">오늘의 내 신용을<br />한눈에</h1>
      </header>

      {needsStart ? (
        <section className="dash-card dash-start" aria-label="시작 안내">
          <h2>아직 내 신용점수가 없어요</h2>
          <p className="hint">세 단계만 거치면 기존 모델과 대안 모델 점수를 함께 볼 수 있어요.</p>
          <ol className="dash-start__steps">
            <li className={user.jobType ? 'is-done' : 'is-on'}><b>1</b>직군 선택</li>
            <li className={user.jobType ? 'is-on' : ''}><b>2</b>소득·자산·대출 입력</li>
            <li><b>3</b>점수 산출</li>
          </ol>
          <Link to={getHomePath(user)} className="button button--primary">{user.jobType ? '정보 입력하고 점수 받기' : '직군 선택하고 시작하기'}</Link>
        </section>
      ) : (
        <>
        <section className="dash-grid dash-grid--top">
          {/* UI 시안: 점수 링 대신 캐릭터 아비 — 내 점수·다음 구간까지 남은 점수·단계를 한 카드에 */}
          <article className="dash-card dash-road" aria-label="내 신용의 길">
            <div className="dash-card__head"><h2>내 신용의 길</h2><Link to={PATHS.REPORT} className="dash-more">리포트 보기 →</Link></div>
            {scored ? (
              <>
                <ScoreRoad score={alt.score} previous={roadPrevious} seenKey={latestScored?.calculatedAt} />
                <p className="hint">남은 점수는 지금 점수와 등급 경계의 차이를 알려 주는 안내이며, 점수가 오른다는 보장이 아니에요.</p>
              </>
            ) : reportError ? (
              <div className="dash-error" role="alert">
                <p>점수를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
                <button type="button" className="button button--weak button--sm" onClick={retry}>다시 시도</button>
              </div>
            ) : (
              <p className="hint">{report ? '아직 표시할 점수가 없어요.' : '점수를 불러오는 중이에요'}</p>
            )}
          </article>

          {/* 자리 비워 둠: 다음에 해 볼 것 등 나중에 채울 카드 자리 */}
          <article className="dash-card" aria-hidden="true" />
        </section>

        <section className="dash-grid dash-grid--mid">
          <article className="dash-card">
            <div className="dash-card__head"><h2>점수를 움직인 항목</h2><Link to={PATHS.REPORT} className="dash-more">전체 보기 →</Link></div>
            {factors.length > 0 ? <FactorBars items={factors} /> : <p className="hint">표시할 항목이 없어요.</p>}
          </article>

          <article className="dash-card dash-trend">
            <div className="dash-card__head"><h2>대안 점수 추이</h2><Link to={PATHS.MY_PAGE} className="dash-more">진단 내역 →</Link></div>
            {historyError ? (
              <div role="alert">
                <p className="hint">점수 추이를 불러오지 못했습니다.</p>
                <Button size="sm" onClick={() => { setHistoryError(false); setHistoryLoading(true); setHistoryReloadKey((key) => key + 1) }}>다시 시도</Button>
              </div>
            ) : historyLoading ? (
              <p className="hint">불러오는 중…</p>
            ) : trend.length <= 1 ? (
              <p className="hint">평가가 2번 이상 쌓이면 추이가 보여요.</p>
            ) : (
              <>
                <TrendArea points={trend} height={250} ariaLabel="최근 대안 점수 추이" />
                {latestModelChange && <p className="hint">{new Date(latestModelChange.calculatedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}부터 모델이 바뀌어, 점수 차이에 모델 변경 효과가 섞여 있을 수 있어요.</p>}
              </>
            )}
          </article>
        </section>
        </>
      )}

      <section className="dash-groups" aria-label="서비스 바로가기">
        {groups.map((group) => (
          <Link key={group.key} to={group.items.length > 1 ? group.path : group.items[0].path} className={`dash-group dash-group--${group.key}`}>
            <span className="dash-group__label">{group.label}</span>
            <b>{group.description}</b>
            <span className="dash-group__items">{group.items.map((tab) => tab.label).join(' · ')}</span>
            <span className="dash-group__arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </section>
    </div>
  )
}
