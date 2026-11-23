import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CountUp, FactorBars, ScoreRing, TrendArea } from '../components/viz.jsx'
import { GRADE_BOUNDARIES } from '../config/grades.js'
import { NAV_GROUPS } from '../config/navigation.js'
import ScoreGauge from '../../features/credit/components/ScoreGauge.jsx'
import '../../features/credit/credit.css'
import './hub.css'

// 예시 게이지의 등급 경계 — 지금 서비스 등급 구간(CUT-0.3, grades.js GRADE_BOUNDARIES)과 같게
const SAMPLE_BANDS = [
  { gradeBandCode: 'CAUTION', minScore: 0, maxScore: GRADE_BOUNDARIES.STANDARD - 1 },
  { gradeBandCode: 'STANDARD', minScore: GRADE_BOUNDARIES.STANDARD, maxScore: GRADE_BOUNDARIES.GOOD - 1 },
  { gradeBandCode: 'GOOD', minScore: GRADE_BOUNDARIES.GOOD, maxScore: 1000 },
]

// 시뮬레이터 미리보기 — 카드 사용률을 90 → 60 → 30%로 스스로 옮기며 예상 점수가 따라 오른다(예시 값)
const SIM_STEPS = [{ util: 90, score: 701 }, { util: 60, score: 708 }, { util: 30, score: 716 }]
function SimPreview() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setI((n) => (n + 1) % SIM_STEPS.length), 1800)
    return () => clearInterval(timer)
  }, [])
  const step = SIM_STEPS[i]
  return (
    <div className="hub-sim">
      <div className="hub-sim__control">
        <span>카드 한도 사용률</span>
        <b className="num">{step.util}%</b>
        <div className="hub-sim__track"><i style={{ width: `${step.util}%` }} /></div>
      </div>
      <div className="hub-sim__result">
        <span>예상 대안 점수</span>
        <b className="num"><CountUp key={step.score} value={step.score} duration={700} /><small>점</small></b>
        <em className="num">{step.score > 701 ? `+${step.score - 701}점` : '지금 점수'}</em>
      </div>
    </div>
  )
}

// 기능마다 큰 제목·설명·미리보기(예시 값). 미리보기는 실제 내 값이 아니라 기능 모양을 보여 주는 예시다.
const COPY = {
  report: {
    headline: '두 모델이 본 내 점수를\n한 화면에서 비교해요',
    body: '금융 이력만 보는 기존 모델과, 통신비·연금 같은 납부 기록까지 보는 대안 모델. 두 점수의 차이와 그 차이를 만든 항목을 함께 보여 줍니다.',
    preview: () => (
      <div className="hub-preview__pair">
        <div><p>기존 모델</p><ScoreGauge score={612} bands={SAMPLE_BANDS} label="기존 모델 예시" /></div>
        <div><p>대안 모델</p><ScoreGauge score={701} bands={SAMPLE_BANDS} label="대안 모델 예시" alternative /></div>
      </div>
    ),
  },
  simulator: {
    headline: '무엇을 바꾸면\n점수가 오를까요',
    body: '카드 사용률, 연체 횟수, 납부 기간을 움직여 보면 예상 점수와 받을 수 있는 대출이 바로 달라집니다. 실제 점수는 바뀌지 않으니 마음껏 시험해 보세요.',
    preview: () => (
      <>
        <SimPreview />
        <FactorBars items={[
          { label: '카드 사용률 90% → 30%', value: 15 },
          { label: '연체 1회 → 0회', value: 12 },
          { label: '통신비 정시 납부 6 → 12개월', value: 9 },
        ]} />
      </>
    ),
  },
  comparison: {
    headline: '나와 비슷한 사람들은\n어느 정도일까요',
    body: '같은 직군·연령대의 평균과 내 점수를 나란히 놓고 봅니다. 어디가 앞서고 어디가 부족한지 한눈에 알 수 있어요. (준비 중)',
    preview: () => (
      <div className="hub-preview__rings">
        <ScoreRing value={701} label="나" sub="대안 점수" />
        <ScoreRing value={668} label="같은 직군 평균" sub="예시" tone="var(--line2)" />
      </div>
    ),
  },
  'asset-debt': {
    headline: '가진 것과 갚을 것,\n건강한 균형인가요',
    body: '총자산·연소득·총부채로 상환 부담률(DSR), 자산 대비 부채, 순자산 대비 부채를 계산하고 안전·주의·위험으로 알려 줍니다.',
    preview: () => (
      <div className="hub-preview__rings">
        <ScoreRing value={17} max={100} label="상환 부담률" sub="안전 · 17%" tone="var(--mint)" size={160} />
        <ScoreRing value={50} max={100} label="자산 대비 부채" sub="주의 · 50%" tone="var(--warn)" size={160} />
        <ScoreRing value={100} max={100} label="순자산 대비" sub="위험 · 100%" tone="var(--bad)" size={160} />
      </div>
    ),
  },
  'cash-flow': {
    headline: '들어오고 나가는 돈,\n흔들림까지 봅니다',
    body: '월별 수입·지출과 적자가 난 달을 그래프로 보고, 소득이 얼마나 들쭉날쭉한지(변동성)도 계산합니다. 프리랜서·자영업자에게 특히 중요해요.',
    preview: () => (
      <TrendArea tone="var(--mint)" unit="만" ariaLabel="월 수입 예시 추이" points={[
        { label: '6월', value: 280 }, { label: '7월', value: 340 }, { label: '8월', value: 210 },
        { label: '9월', value: 300 }, { label: '10월', value: 260 }, { label: '11월', value: 320 },
      ]} />
    ),
  },
  scenario: {
    headline: '금리가 오르거나\n소득이 줄면 버틸 수 있을까요',
    body: '금리 상승·소득 감소 같은 상황을 골라 보면 매달 갚을 돈과 상환 여력(소득 대비 상환 부담)이 어떻게 바뀌는지 계산합니다. 나빠질 때와 좋아질 때를 모두 볼 수 있어요.',
    preview: () => (
      <div className="hub-preview__rings">
        <ScoreRing value={17} max={100} label="지금" sub="상환 부담 17%" tone="var(--mint)" size={160} />
        <ScoreRing value={23} max={100} label="금리 +2%p" sub="상환 부담 23%" tone="var(--warn)" size={160} />
        <ScoreRing value={28} max={100} label="소득 -15%" sub="상환 부담 28%" tone="var(--bad)" size={160} />
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
  useHubReveal()
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
        return (
          <section key={tab.key} id={`hub-${tab.key}`} className="hub-section" aria-labelledby={`hub-title-${tab.key}`}>
            <p className="hub-section__tag"><span className="num">0{index + 1}</span>{tab.label}</p>
            <div className="hub-section__body">
              <h2 id={`hub-title-${tab.key}`} className="hub-section__title" data-hub-reveal>{copy?.headline ?? tab.label}</h2>
              <p className="hub-section__text" data-hub-reveal>{copy?.body ?? tab.description}</p>
              <Link to={tab.path} className="hub-section__cta" data-hub-reveal>{tab.label} 바로가기 <span aria-hidden="true">›</span></Link>
              {copy && (
                <div className="hub-preview" data-hub-reveal>
                  <span className="hub-preview__badge">예시 화면</span>
                  {copy.preview()}
                </div>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
