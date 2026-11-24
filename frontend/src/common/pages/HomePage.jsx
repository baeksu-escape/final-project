import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth.js'
import Button from '../components/Button.jsx'
import { FactorBars, ScoreRing, TrendArea } from '../components/viz.jsx'
import { NAV_GROUPS, PATHS } from '../config/navigation.js'
import { fetchDiagnosisHistory } from '../../features/auth/api/diagnosisHistoryApi.js'
import { fetchCreditReport } from '../../features/credit/api/creditApi.js'
import { DATA_INPUT_PATHS } from '../../features/dataInput/dataInputPaths.js'
import './home.css'

const GRADE_TEXT = { GOOD: '좋음', STANDARD: '보통', CAUTION: '주의' }

const NEXT_ACTIONS = [
  { to: PATHS.SIMULATOR, title: '점수 올리기 연습', text: '카드 사용률·연체를 바꾸면 몇 점 오를까' },
  { to: DATA_INPUT_PATHS.DATA_INPUT, title: '입력 정보 새로 고치기', text: '소득·부채가 바뀌었다면 다시 입력하고 점수 산출' },
  { to: PATHS.LOANS, title: '내 점수로 대출 살펴보기', text: '지금 점수로 알아볼 수 있는 상품 비교' },
]

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

  // 점수(RPT-02)를 불러온다. 조회가 실패하면 로딩에 머물지 않고 안내와 [다시 시도]를 보여 준다(FP-252 검수 반영).
  useEffect(() => {
    let active = true
    fetchCreditReport()
      .then((data) => { if (active) { setReport(data); setReportError(false) } })
      .catch(() => { if (active) setReportError(true) })
    return () => { active = false }
  }, [reloadKey])

  // N-12-4 점수 추이 내역을 불러온다. 실패 안내와 재시도는 추이 카드 안에서만 처리한다.
  useEffect(() => {
    let active = true
    fetchDiagnosisHistory()
      .then(({ items }) => { if (active) { setHistory(items ?? []); setHistoryLoading(false) } })
      .catch(() => { if (active) { setHistoryError(true); setHistoryLoading(false) } })
    return () => { active = false }
  }, [historyReloadKey])

  const retry = () => {
    setReportError(false)
    setReport(null)
    setReloadKey((key) => key + 1)
  }

  const alt = report?.alternative
  const scored = report?.gradeStatusCode === 'SCORED' && alt?.score != null
  const diff = report?.comparison?.scoreDiff
  const scoredHistory = [...history]
    .filter((item) => item.gradeStatusCode === 'SCORED' && item.alternativeScore != null && item.calculatedAt && !Number.isNaN(new Date(item.calculatedAt).getTime()))
    .sort((a, b) => new Date(a.calculatedAt) - new Date(b.calculatedAt))
  const visibleHistory = scoredHistory.slice(-6)
  const trend = visibleHistory
    .map((item) => ({ label: `${new Date(item.calculatedAt).getMonth() + 1}월`, value: item.alternativeScore }))
  const modelChanges = visibleHistory.slice(1).filter((item, index) => item.modelVersion !== visibleHistory[index].modelVersion)
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

      <section className="dash-grid dash-grid--top">
        <Link to={PATHS.REPORT} className="dash-card dash-score">
          <div className="dash-card__head"><h2>내 대안 신용점수</h2><span className="dash-more">리포트 보기 →</span></div>
          {scored ? (
            <div className="dash-score__body">
              <ScoreRing value={alt.score} size={210} label="대안 모델" sub={GRADE_TEXT[alt.gradeBandCode] ?? ''} />
              <dl className="dash-score__facts">
                <div><dt>기존 모델</dt><dd className="num">{report.traditional?.score ?? '-'}<small>점</small></dd></div>
                <div><dt>두 모델 점수 차이</dt><dd className={`num ${diff >= 0 ? 'is-up' : 'is-down'}`}>{diff == null ? '-' : `${diff > 0 ? '+' : ''}${diff}`}<small>점</small></dd></div>
                <div><dt>등급</dt><dd>{GRADE_TEXT[alt.gradeBandCode] ?? '-'}</dd></div>
              </dl>
            </div>
          ) : reportError ? (
            <div className="dash-error" role="alert">
              <p>점수를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
              {/* 카드 전체가 링크라 버튼을 누를 때 리포트로 이동하지 않게 막는다 */}
              <button type="button" className="button button--weak button--sm" onClick={(event) => { event.preventDefault(); retry() }}>다시 시도</button>
            </div>
          ) : (
            <p className="hint">{report ? '아직 표시할 점수가 없어요.' : '점수를 불러오는 중이에요'}</p>
          )}
        </Link>

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

      <section className="dash-grid dash-grid--mid">
        <article className="dash-card">
          <div className="dash-card__head"><h2>점수를 움직인 항목</h2><Link to={PATHS.REPORT} className="dash-more">전체 보기 →</Link></div>
          {factors.length > 0 ? <FactorBars items={factors} /> : <p className="hint">표시할 항목이 없어요.</p>}
        </article>
        <article className="dash-card">
          <div className="dash-card__head"><h2>다음에 해 볼 것</h2></div>
          <ul className="dash-actions">
            {NEXT_ACTIONS.map((action) => (
              <li key={action.title}>
                <Link to={action.to}>
                  <span><b>{action.title}</b><small>{action.text}</small></span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </article>
      </section>

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
