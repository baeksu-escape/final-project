import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CountUp, ScoreRing, TrendArea } from '../components/viz.jsx'
import { NAV_GROUPS, PATHS } from '../config/navigation.js'
import { useAuth } from '../auth/useAuth.js'
import Button from '../components/Button.jsx'
import ScoreGauge from '../../features/credit/components/ScoreGauge.jsx'
import { fetchCreditReport } from '../../features/credit/api/creditApi.js'
import { getScorePercentile } from '../../features/comparison/api/scorePercentileApi.js'
import { getCreditCareBase } from '../../features/simulation/api/simulationApi.js'
import { calculateAssetDebtPreview, getAssetDebtData, getCashFlowData } from '../../features/diagnosis/api/financeApi.js'
import { getScenarioBase, recalculateMemberScenario } from '../../features/diagnosis/api/diagnosisApi.js'
import { ASSET_DEBT_RISK_THRESHOLDS } from '../../features/diagnosis/utils/financeCalculations.js'
import { DATA_INPUT_PATHS } from '../../features/dataInput/dataInputPaths.js'
import '../../features/credit/credit.css'
import './hub.css'

// N-18 시뮬레이터 소개에는 SIM-01 현재 점수만 표시하고 예상 계산은 기능 화면으로 안내한다.
function SimPreview({ score }) {
  return (
    <div className="hub-sim">
      <div className="hub-sim__result">
        <span>현재 대안 점수</span>
        <b className="num"><CountUp key={score} value={score} duration={700} /><small>점</small></b>
        <p className="hint">조건을 바꿔 예상 점수를 계산해 보세요.</p>
      </div>
    </div>
  )
}

// 큰 분류 화면의 기능별 제목·설명과 연결된 실제 자료 미리보기 정의.
const COPY = {
  report: {
    headline: '두 모델이 본 내 점수를\n한 화면에서 비교해요',
    body: '금융 이력만 보는 기존 모델과, 통신비·연금 같은 납부 기록까지 보는 대안 모델. 두 점수의 차이와 그 차이를 만든 항목을 함께 보여 줍니다.',
    preview: ({ traditionalScore, alternativeScore, bands }) => (
      <div className="hub-preview__pair">
        <div><p>기존 모델</p><ScoreGauge score={traditionalScore} bands={bands} label="기존 모델" /></div>
        <div><p>대안 모델</p><ScoreGauge score={alternativeScore} bands={bands} label="대안 모델" alternative /></div>
      </div>
    ),
  },
  simulator: {
    headline: '무엇을 바꾸면\n점수가 오를까요',
    body: '카드 사용률, 연체 횟수, 납부 기간을 움직여 보면 예상 점수와 받을 수 있는 대출이 바로 달라집니다. 실제 점수는 바뀌지 않으니 마음껏 시험해 보세요.',
    preview: ({ score }) => <SimPreview score={score} />,
  },
  comparison: {
    headline: '나와 비슷한 사람들은\n어느 정도일까요',
    body: '같은 직군·연령대의 평균과 내 점수를 나란히 놓고 봅니다. 어디가 앞서고 어디가 부족한지 한눈에 알 수 있어요. (준비 중)',
    preview: ({ myScore, topPct, avgScore }) => (
      <div className="hub-preview__rings">
        <ScoreRing value={myScore} label="나" sub="대안 점수" />
        <ScoreRing value={avgScore} label="같은 직군 평균" sub={`나는 상위 ${topPct.toFixed(1)}%`} tone="var(--line2)" />
      </div>
    ),
  },
  'asset-debt': {
    headline: '가진 것과 갚을 것,\n건강한 균형인가요',
    body: '총자산·연소득·총부채로 상환 부담률(DSR), 자산 대비 부채, 순자산 대비 부채를 계산하고 안전·주의·위험으로 알려 줍니다.',
    preview: ({ ratios }) => (
      <>
        <div className="hub-preview__rings">
          {['dsr', 'debtToAsset', 'debtToNetAsset'].map((key, index) => Number.isFinite(ratios[key])
            ? <ScoreRing key={key} value={ratios[key]} max={100} label={['상환 부담률', '자산 대비 부채', '순자산 대비'][index]} sub={formatPct(ratios[key])} tone={riskTone(ratios[key], ['dsr', 'debtToAsset', 'debtToNetAsset'][index])} size={160} />
            : <p key={key} className="hint" role="status">미입력</p>)}
        </div>
        {['dsr', 'debtToAsset', 'debtToNetAsset'].some((key) => !Number.isFinite(ratios[key])) && <p className="hint">입력하지 않은 항목이 있어요. <Link to={PATHS.ASSET_DEBT}>자산·부채 화면으로 이동</Link></p>}
      </>
    ),
  },
  'cash-flow': {
    headline: '들어오고 나가는 돈,\n흔들림까지 봅니다',
    body: '월별 수입·지출과 적자가 난 달을 그래프로 보고, 소득이 얼마나 들쭉날쭉한지(변동성)도 계산합니다. 프리랜서·자영업자에게 특히 중요해요.',
    preview: ({ points }) => (
      <TrendArea tone="var(--mint)" unit="만" ariaLabel="최근 6개월 월 수입 추이" points={points} />
    ),
  },
  scenario: {
    headline: '금리가 오르거나\n소득이 줄면 버틸 수 있을까요',
    body: '금리 상승·소득 감소 같은 상황을 골라 보면 매달 갚을 돈과 상환 여력(소득 대비 상환 부담)이 어떻게 바뀌는지 계산합니다. 나빠질 때와 좋아질 때를 모두 볼 수 있어요.',
    preview: ({ ratios }) => (
      <div className="hub-preview__rings">
        {ratios.map((ratio, index) => <ScoreRing key={index} value={ratio} max={100} label={['지금', '금리 +2%p', '소득 -15%'][index]} sub={`상환 부담 ${formatPct(ratio)}`} tone={riskTone(ratio, 'dsr')} size={160} />)}
      </div>
    ),
  },
  market: {
    headline: '창업 전, 동네 상권부터\n살펴보세요',
    body: '서울 행정동별로 업종의 폐업률·개업률·매출 변화·유동인구를 지도에서 비교합니다. 자영업자의 위험을 미리 가늠할 수 있어요.',
    preview: () => (
      <div className="hub-preview__heat" aria-hidden="true">
        {Array.from({ length: 48 }, (_, i) => <i key={i} style={{ '--v': ((i * 37) % 100) / 100, '--i': i }} />)}
      </div>
    ),
  },
}

// N-16·N-17·N-21 소개 수치의 표시는 각 기능 카드와 같은 소수 첫째 자리 기준으로 맞춘다.
function formatPct(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : '—'
}

// N-16 위험 단계 기준을 재사용해 점수 링의 의미 색을 정한다.
function riskTone(value, key) {
  const thresholds = ASSET_DEBT_RISK_THRESHOLDS[key]
  const risk = value >= thresholds.danger ? 'danger' : value >= thresholds.caution ? 'caution' : 'safe'
  return ({ safe: 'var(--mint)', caution: 'var(--warn)', danger: 'var(--bad)' })[risk]
}

// N-12·N-13·N-16·N-17·N-18·N-21 조회 실패는 이 목록에만 적용한다.
function isMissingData(error) {
  return error?.status === 404 || ['ASSESSMENT_NOT_FOUND', 'INPUT_INCOMPLETE'].includes(error?.data?.code)
}

// N-08 묶음이나 회원이 바뀌면 이전 응답 대신 로딩 상태를 보여 준다.
function stateForScope(state, scope) {
  return state?.scope === scope ? state : { status: 'loading', data: null }
}

// 화면에 들어오면 data-hub-reveal에 is-in을 붙인다.
function useHubReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll('[data-hub-reveal]')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.15 })
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

// UI 리뉴얼 — 큰 분류(내 신용·재무 진단) 첫 화면. 기능마다 화면 폭을 크게 쓰는 구간: 왼쪽 이름표, 오른쪽 큰 제목·설명·미리보기·바로가기.
export default function GroupHubPage({ groupKey }) {
  const group = NAV_GROUPS.find((item) => item.key === groupKey)
  const { user } = useAuth()
  const scope = `${groupKey}:${user?.userId ?? ''}`
  const [reportState, setReportState] = useState(null)
  const [percentileState, setPercentileState] = useState(null)
  const [simulationState, setSimulationState] = useState(null)
  const [assetState, setAssetState] = useState(null)
  const [cashFlowState, setCashFlowState] = useState(null)
  const [scenarioState, setScenarioState] = useState(null)
  const [retries, setRetries] = useState({ report: 0, percentile: 0, simulation: 0, asset: 0, cashFlow: 0, scenario: 0 })
  useHubReveal()
  // N-12-6 리포트 점수와 등급 구간은 점수 산출에 성공했을 때만 표시한다.
  useEffect(() => {
    if (groupKey !== 'credit') return undefined
    let active = true
    fetchCreditReport().then((report) => {
      const traditionalScore = report.traditional?.score
      const alternativeScore = report.alternative?.score
      const bands = report.gradeBands?.bands
      if (!active) return
      if (report.gradeStatusCode !== 'SCORED' || !Number.isInteger(traditionalScore)
        || !Number.isInteger(alternativeScore) || !Array.isArray(bands) || bands.length === 0) {
        setReportState({ scope, status: 'empty' })
        return
      }
      setReportState({ scope, status: 'ready', data: { traditionalScore, alternativeScore, bands } })
    }).catch((error) => {
      if (active) setReportState({ scope, status: isMissingData(error) ? 'empty' : 'error' })
    })
    return () => { active = false }
  }, [groupKey, scope, retries.report])
  // N-13-1 RPT-05 직군 비교는 회원 수가 기준 미만이면 순위값 대신 안내한다.
  useEffect(() => {
    if (groupKey !== 'credit') return undefined
    let active = true
    getScorePercentile().then((response) => {
      if (!active) return
      const workerGroup = response.groups?.find((item) => item.groupType === 'WORKER_TYPE')
      if (!workerGroup) {
        setPercentileState({ scope, status: 'error' })
      } else if (workerGroup.topPct == null || workerGroup.avgScore == null || workerGroup.memberCount < response.minGroupSize) {
        setPercentileState({ scope, status: 'smallGroup' })
      } else if (!Number.isInteger(response.myScore) || !Number.isFinite(workerGroup.topPct) || !Number.isFinite(workerGroup.avgScore)) {
        setPercentileState({ scope, status: 'error' })
      } else {
        setPercentileState({ scope, status: 'ready', data: { myScore: response.myScore, topPct: workerGroup.topPct, avgScore: workerGroup.avgScore } })
      }
    }).catch((error) => {
      if (active) setPercentileState({ scope, status: isMissingData(error) ? 'empty' : 'error' })
    })
    return () => { active = false }
  }, [groupKey, scope, retries.percentile])
  // N-18 SIM-01 현재 점수가 있을 때만 시뮬레이터 소개값을 보여 준다.
  useEffect(() => {
    if (groupKey !== 'credit') return undefined
    let active = true
    getCreditCareBase().then((response) => {
      if (!active) return
      if (!Number.isInteger(response?.score) || response.score < 0 || response.score > 1000) setSimulationState({ scope, status: 'empty' })
      else setSimulationState({ scope, status: 'ready', data: { score: response.score } })
    }).catch((error) => {
      if (active) setSimulationState({ scope, status: isMissingData(error) ? 'empty' : 'error' })
    })
    return () => { active = false }
  }, [groupKey, scope, retries.simulation])
  // N-16-1·2 DIAG-03-1 저장값과 공통 재계산 결과가 모두 있을 때 세 비율을 표시한다.
  useEffect(() => {
    if (groupKey !== 'finance') return undefined
    let active = true
    getAssetDebtData(user?.userId).then((baseline) => calculateAssetDebtPreview(baseline, {
      totalAssetAmount: baseline.totalAssetAmount,
      annualIncomeAmount: baseline.annualIncomeAmount,
      totalDebtAmount: baseline.totalDebtAmount,
    })).then((result) => {
      if (!active) return
      const ratios = result?.ratios
      if (!['dsr', 'debtToAsset', 'debtToNetAsset'].some((key) => Number.isFinite(ratios?.[key]?.value))) {
        setAssetState({ scope, status: 'empty' })
      } else {
        setAssetState({ scope, status: 'ready', data: { ratios: {
          dsr: ratios.dsr?.value ?? null, debtToAsset: ratios.debtToAsset?.value ?? null, debtToNetAsset: ratios.debtToNetAsset?.value ?? null,
        } } })
      }
    }).catch((error) => {
      if (active) setAssetState({ scope, status: isMissingData(error) ? 'empty' : 'error' })
    })
    return () => { active = false }
  }, [groupKey, scope, user?.userId, retries.asset])
  // N-21 DIAG-08-1 실적이 있는 최근 6개월만 만 원 단위로 반올림해 표시한다.
  useEffect(() => {
    if (groupKey !== 'finance') return undefined
    let active = true
    getCashFlowData(user?.userId).then((data) => {
      if (!active) return
      const recentMonths = data.months.slice(-6)
      if (recentMonths.length !== 6 || recentMonths.some((month) => !Number.isFinite(month.incomeAmount))) {
        setCashFlowState({ scope, status: 'empty' })
        return
      }
      const points = recentMonths.map((month) => ({ label: `${Number(month.baseMonth.slice(5, 7))}월`, value: Math.round(month.incomeAmount / 10000) }))
      setCashFlowState({ scope, status: 'ready', data: { points } })
    }).catch((error) => {
      if (active) setCashFlowState({ scope, status: isMissingData(error) ? 'empty' : 'error' })
    })
    return () => { active = false }
  }, [groupKey, scope, user?.userId, retries.cashFlow])
  // N-17 DIAG-04 기준과 재계산 응답이 모두 유효할 때만 현재·조건별 상환 부담률을 표시한다.
  useEffect(() => {
    if (groupKey !== 'finance') return undefined
    let active = true
    getScenarioBase().then(async (baseline) => {
      if (!active) return
      if (!Number.isSafeInteger(baseline?.monthlyIncomeAmount) || baseline.monthlyIncomeAmount <= 0
        || !Number.isSafeInteger(baseline?.monthlyPaymentAmount) || baseline.monthlyPaymentAmount < 0) {
        setScenarioState({ scope, status: 'empty' })
        return
      }
      const scenarios = await Promise.allSettled([
        recalculateMemberScenario({ ratePctPoint: 2, incomePct: 0, expensePct: 0 }),
        recalculateMemberScenario({ ratePctPoint: 0, incomePct: -15, expensePct: 0 }),
      ])
      if (!active) return
      const baseRatio = scenarios.find((result) => result.status === 'fulfilled')?.value?.current?.dsrPct
      const changedRatios = scenarios.map((result) => result.status === 'fulfilled' ? result.value?.changed?.dsrPct : null)
      if (!Number.isFinite(baseRatio) || changedRatios.some((value) => !Number.isFinite(value))) {
        const missing = scenarios.some((result) => result.status === 'rejected' && isMissingData(result.reason))
        setScenarioState({ scope, status: missing ? 'empty' : 'error' })
      } else setScenarioState({ scope, status: 'ready', data: { ratios: [baseRatio, ...changedRatios] } })
    }).catch((error) => {
      if (active) setScenarioState({ scope, status: isMissingData(error) ? 'empty' : 'error' })
    })
    return () => { active = false }
  }, [groupKey, scope, retries.scenario])
  const states = {
    report: stateForScope(reportState, scope),
    comparison: stateForScope(percentileState, scope),
    simulator: stateForScope(simulationState, scope),
    'asset-debt': stateForScope(assetState, scope),
    'cash-flow': stateForScope(cashFlowState, scope),
    scenario: stateForScope(scenarioState, scope),
  }
  const stateSetters = {
    report: setReportState, comparison: setPercentileState, simulator: setSimulationState,
    'asset-debt': setAssetState, 'cash-flow': setCashFlowState, scenario: setScenarioState,
  }
  // N-12·N-13·N-16·N-17·N-18·N-21 각 소개 미리보기는 해당 요청만 다시 불러온다.
  const retryPreview = (key) => {
    stateSetters[key]({ scope, status: 'loading' })
    const retryKey = ({ comparison: 'percentile', simulator: 'simulation', 'asset-debt': 'asset', 'cash-flow': 'cashFlow' })[key] ?? key
    setRetries((current) => ({ ...current, [retryKey]: current[retryKey] + 1 }))
  }
  if (!group) return null
  return (
    <div className="hub">
      <header className="hub-hero">
        <p className="hub-hero__eyebrow">{group.label}</p>
        <h1 className="hub-hero__title">{group.description}</h1>
        <nav className="hub-hero__index" aria-label={`${group.label} 기능 목록`}>
          {group.items.map((tab, index) => (
            <a key={tab.key} href={`#hub-${tab.key}`}><span className="num">0{index + 1}</span>{tab.label}</a>
          ))}
        </nav>
      </header>

      {group.items.map((tab, index) => {
        const copy = COPY[tab.key]
        const view = states[tab.key]
        const inputPath = ({
          report: DATA_INPUT_PATHS.DATA_INPUT, comparison: DATA_INPUT_PATHS.DATA_INPUT, simulator: DATA_INPUT_PATHS.DATA_INPUT,
          'asset-debt': PATHS.ASSET_DEBT, 'cash-flow': PATHS.CASH_FLOW, scenario: PATHS.SCENARIO,
        })[tab.key]
        return (
          <section key={tab.key} id={`hub-${tab.key}`} className="hub-section" aria-labelledby={`hub-title-${tab.key}`}>
            <p className="hub-section__tag"><span className="num">0{index + 1}</span>{tab.label}</p>
            <div className="hub-section__body">
              <h2 id={`hub-title-${tab.key}`} className="hub-section__title" data-hub-reveal>{copy?.headline ?? tab.label}</h2>
              <p className="hub-section__text" data-hub-reveal>{copy?.body ?? tab.description}</p>
              <Link to={tab.path} className="hub-section__cta" data-hub-reveal>{tab.label} 바로가기 <span aria-hidden="true">›</span></Link>
              {copy && (
                <div className="hub-preview" data-hub-reveal>
                  <span className="hub-preview__badge">미리보기</span>
                  {!view ? copy.preview({}) : view.status === 'ready' ? copy.preview(view.data) : view.status === 'loading' ? (
                    <p className="hint" role="status">불러오는 중…</p>
                  ) : view.status === 'smallGroup' ? (
                    <p className="hint" role="status">비교할 회원이 아직 적어요.</p>
                  ) : view.status === 'empty' ? (
                    <p className="hint" role="status">
                      {['report', 'comparison', 'simulator'].includes(tab.key) ? '아직 점수가 없어요. ' : '입력하지 않은 항목이 있어요. '}
                      <Link to={inputPath}>{['report', 'comparison', 'simulator'].includes(tab.key) ? '데이터 입력하기' : '해당 기능 화면으로 이동'}</Link>
                    </p>
                  ) : (
                    <p className="hint" role="status">불러오지 못했어요. <Button size="sm" onClick={() => retryPreview(tab.key)}>다시 시도</Button></p>
                  )}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
