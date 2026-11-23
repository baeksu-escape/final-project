import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PATHS } from '../config/navigation.js'
import ScoreGauge from '../../features/credit/components/ScoreGauge.jsx'
// 게이지 모양(credit- 접두어 클래스)
import '../../features/credit/credit.css'
import { PROMO_AFTER, PROMO_BEFORE, PROMO_GRADE_BANDS } from './landingExample.js'
import './landing.css'

// 고정 무대 안에서 스크롤로 바뀌는 장면 — 왼쪽 두 줄 문구 + 오른쪽 휴대폰 화면
const SCENES = [
  { line1: '몇 가지만 입력하면', line2: '두 개의 점수가 나란히', text: '금융 이력만 보는 기존 모델과, 납부 기록까지 보는 대안 모델 점수를 한 번에 봅니다.' },
  { line1: '숫자 하나가 아니라', line2: '점수의 이유까지', text: '어떤 기록이 점수를 올리고 내렸는지 항목별로 보여 줍니다.' },
  { line1: '무엇을 바꾸면', line2: '몇 점이 오를까', text: '카드 사용률이나 연체를 바꿔 보면 예상 점수가 바로 계산됩니다.' },
  { line1: '내 점수로', line2: '알아보는 대출', text: '지금 점수로 알아볼 수 있는 상품의 금리·한도를 비교합니다.' },
]

// 우리가 무엇을 하는지 — 왼쪽 이름표 · 오른쪽 제목/설명
const MISSION = [
  { tag: '문제', title: '성실해도, 기록이 짧으면 점수가 낮습니다', text: '사회초년생·프리랜서·자영업자처럼 대출·카드 이력이 짧은 사람은 기존 신용평가에서 판단할 근거가 부족해 낮은 점수를 받기 쉽습니다.' },
  { tag: '우리의 답', title: '매달 낸 생활 기록까지 함께 봅니다', text: '통신비·공과금·간편결제·국민연금·건강보험 납부 기록을 더한 대안 모델로 점수를 다시 매기고, 금융 이력만 본 기존 모델과 나란히 비교합니다.' },
  { tag: '시각화', title: '왜 그 점수인지, 그림으로 보여 줍니다', text: '점수를 움직인 항목, 자산·부채와 현금흐름 진단, 조건을 바꿔 보는 시뮬레이터까지. 숫자 하나가 아니라 이유와 방법을 함께 봅니다.' },
]

// 기울어진 카드 콜라주 — 대안 데이터 5종(광고용 예시 값)
const RECORDS = [
  { tag: '통신비', value: '18개월', text: '연속 정시 납부', tone: 'blue', tilt: -6 },
  { tag: '국민연금', value: '48개월', text: '꾸준히 납부', tone: 'green', tilt: 4 },
  { tag: '간편결제', value: '월 12회', text: '규칙적인 사용', tone: 'violet', tilt: -3 },
  { tag: '건강보험', value: '100%', text: '정시 납부율', tone: 'orange', tilt: 5 },
  { tag: '공과금', value: '0회', text: '최근 1년 미납', tone: 'sky', tilt: -5 },
]

const clamp = (v) => Math.min(1, Math.max(0, v))

// 버튼으로 옮겨 갈 무대 위치(진행률) — 첫 화면, 장면 4개 각각의 가운데
const STOPS = [0, ...SCENES.map((_, i) => 0.26 + ((i + 0.5) / SCENES.length) * 0.62)]
const AUTO_MS = 4000

// 무대 안 진행률 p 위치로 부드럽게 스크롤한다
function scrollToProgress(el, p) {
  const top = el.getBoundingClientRect().top + window.scrollY
  const total = el.offsetHeight - window.innerHeight
  window.scrollTo({ top: top + total * p, behavior: 'smooth' })
}

function currentProgress(el) {
  const total = el.offsetHeight - window.innerHeight
  return total > 0 ? clamp(-el.getBoundingClientRect().top / total) : 0
}

// 화면에 들어오면 data-reveal 요소에 is-in을 붙인다(한 번만).
function useReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll('[data-reveal]')
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.2 })
    targets.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

// 무대 스크롤 진행률(0~1)을 단계별 CSS 변수로 넘긴다. 리렌더 없이 style만 바꾸고, 장면 번호가 바뀔 때만 state를 바꾼다.
//   --a 첫 화면 글자가 흐려지며 사라짐 · --b 화면이 둥근 카드로 줄고 휴대폰이 올라옴 · --d 마지막에 카드가 사라지고 마무리 문구
function useStage(ref) {
  const [scene, setScene] = useState(0)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const p = total > 0 ? clamp(-rect.top / total) : 0
      el.style.setProperty('--a', clamp(p / 0.14).toFixed(3))
      el.style.setProperty('--b', clamp((p - 0.12) / 0.14).toFixed(3))
      el.style.setProperty('--d', clamp((p - 0.88) / 0.12).toFixed(3))
      const c = clamp((p - 0.26) / 0.62)
      setScene(Math.min(SCENES.length - 1, Math.floor(c * SCENES.length)))
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref])
  return scene
}

function PhoneScreen({ scene }) {
  if (scene === 0) {
    return (
      <div className="phone-screen">
        <p className="phone-screen__label">내 대안 신용점수</p>
        <ScoreGauge score={PROMO_AFTER.score} bands={PROMO_GRADE_BANDS} label="대안 모델" alternative />
        <div className="phone-row"><span>기존 모델</span><b className="num">{PROMO_BEFORE.score}점</b></div>
        <div className="phone-row"><span>대안 모델</span><b className="num is-blue">{PROMO_AFTER.score}점</b></div>
      </div>
    )
  }
  if (scene === 1) {
    const bars = [['통신비 연속 정시 납부', 31], ['공과금 연속 정시 납부', 16], ['국민연금 납부 기간', 12], ['소득 변동 정도', -17]]
    return (
      <div className="phone-screen">
        <p className="phone-screen__label">점수를 움직인 항목</p>
        {bars.map(([name, v]) => (
          <div key={name} className="phone-bar">
            <span>{name}</span>
            <i style={{ '--w': `${Math.abs(v) * 2.6}%` }} className={v < 0 ? 'is-down' : ''} />
            <b className={`num ${v < 0 ? 'is-red' : 'is-green'}`}>{v > 0 ? '+' : ''}{v}</b>
          </div>
        ))}
      </div>
    )
  }
  if (scene === 2) {
    return (
      <div className="phone-screen">
        <p className="phone-screen__label">카드 한도 사용률</p>
        <div className="phone-slider"><i style={{ '--p': '30%' }} /></div>
        <div className="phone-row"><span>90% → 30%</span><b className="num is-blue">바꿔 보기</b></div>
        <div className="phone-result">
          <span>예상 대안 점수</span>
          <b className="num">701 <em>→</em> 716</b>
          <small className="num is-green">+15점</small>
        </div>
      </div>
    )
  }
  return (
    <div className="phone-screen">
      <p className="phone-screen__label">내 점수로 알아볼 수 있는 대출</p>
      {[['예시 은행 A', '연 5.1%', '최대 3,000만'], ['예시 저축은행 B', '연 7.4%', '최대 2,000만'], ['예시 정책상품 C', '연 3.9%', '최대 1,500만']].map(([n, r, l]) => (
        <div key={n} className="phone-loan"><b>{n}</b><span className="num">{r} · {l}</span></div>
      ))}
    </div>
  )
}

// N-10 메인(홍보) 페이지 — 위쪽은 하나의 고정 무대(스크롤하면 장면이 바뀜), 아래는 우리가 하는 일·기록 카드·마지막 버튼.
export default function LandingPage() {
  const stageRef = useRef(null)
  const afterRef = useRef(null)
  const scene = useStage(stageRef)
  // 메인에 들어오면 자동 넘기기가 바로 켜진다. 화면 아무 곳이나 누르면 멈추고, 다시 누르면 다시 켜진다
  const [auto, setAuto] = useState(true)
  useReveal()
  const current = SCENES[scene]

  // 지금 위치 다음(또는 이전) 멈춤 지점으로. 마지막 장면 다음은 무대 아래로 넘어간다
  const go = (dir) => {
    const el = stageRef.current
    if (!el) return
    const p = currentProgress(el)
    if (dir > 0) {
      const next = STOPS.find((stop) => stop > p + 0.02)
      if (next == null) afterRef.current?.scrollIntoView({ behavior: 'smooth' })
      else scrollToProgress(el, next)
    } else {
      const prev = [...STOPS].reverse().find((stop) => stop < p - 0.02)
      scrollToProgress(el, prev ?? 0)
    }
  }
  const skip = () => { setAuto(false); afterRef.current?.scrollIntoView({ behavior: 'smooth' }) }

  // 화면 아무 곳이나 누르면 자동 넘기기를 멈추고, 다시 누르면 다시 켠다(버튼·링크를 누를 때는 그대로 둔다)
  useEffect(() => {
    const toggle = (event) => {
      if (event.target.closest?.('a, button, input, select, textarea')) return
      setAuto((on) => !on)
    }
    document.addEventListener('pointerdown', toggle)
    return () => document.removeEventListener('pointerdown', toggle)
  }, [])

  // 자동 넘기기 — 4초마다 다음 장면. 무대를 다 지나면 스스로 멈춘다
  useEffect(() => {
    if (!auto) return undefined
    const timer = setInterval(() => {
      const el = stageRef.current
      if (!el || currentProgress(el) >= STOPS[STOPS.length - 1] - 0.02) {
        setAuto(false)
        afterRef.current?.scrollIntoView({ behavior: 'smooth' })
        return
      }
      go(1)
    }, AUTO_MS)
    return () => clearInterval(timer)
  })

  return (
    <div className="landing">
      <section className="stage" ref={stageRef} aria-label="Avenue 소개">
        <div className="stage__view">
          <div className="stage__bg" aria-hidden="true">
            <span className="stage__blob stage__blob--1" />
            <span className="stage__blob stage__blob--2" />
            <span className="stage__blob stage__blob--3" />
          </div>

          <div className="stage__intro">
            <p className="stage__eyebrow">연령·직군별 대안 신용평가</p>
            <h1 className="stage__title">성실한 기록이<br />신용이 되는 곳</h1>
            <p className="stage__brand">Avenue</p>
          </div>
          {/* 아래 화살표 — 누르면 다음 장면 */}
          <button type="button" className="stage__arrow" onClick={() => go(1)} aria-label="다음 장면 보기" />
          {/* 오른쪽 위 건너뛰기 */}
          <button type="button" className="stage__skip" onClick={skip}>SKIP</button>
          <div className="stage__dots" aria-hidden="true">
            {SCENES.map((item, index) => <i key={item.line2} className={index === scene ? 'is-on' : ''} />)}
          </div>

          <div className="stage__copy" aria-live="polite">
            <div key={scene} className="stage__copy-inner">
              <p className="stage__line">{current.line1}</p>
              <p className="stage__line stage__line--2">{current.line2}</p>
              <p className="stage__text">{current.text}</p>
            </div>
          </div>

          <div className="stage__phone">
            <div className="landing-phone">
              <div className="landing-phone__notch" />
              <div key={scene} className="landing-phone__screen">
                <PhoneScreen scene={scene} />
              </div>
            </div>
          </div>

        </div>
      </section>

      <section className="landing-mission" ref={afterRef} aria-labelledby="landing-mission-title">
        <div className="landing-mission__head" data-reveal>
          <p className="landing-mission__eyebrow">우리가 하는 일</p>
          <h2 id="landing-mission-title" className="landing-mission__title">Credit, beyond<br />the thin file</h2>
          <p className="landing-mission__sub">금융 이력이 짧은 사람에게도 공정한 신용을, Avenue</p>
        </div>
        {MISSION.map((row, index) => (
          <div key={row.tag} className="landing-mission__row" data-reveal style={{ '--delay': `${index * 80}ms` }}>
            <p className="landing-mission__tag">{row.tag}</p>
            <div>
              <h3>{row.title}</h3>
              <p>{row.text}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="landing-collage" aria-labelledby="landing-collage-title">
        <h2 id="landing-collage-title" data-reveal>매달 낸 기록이<br />점수의 재료가 됩니다</h2>
        <div className="landing-collage__cards">
          {RECORDS.map((record, index) => (
            <article key={record.tag} className={`record-card record-card--${record.tone}`} style={{ '--tilt': `${record.tilt}deg`, '--delay': `${index * 90}ms` }} data-reveal>
              <span className="record-card__tag">{record.tag}</span>
              <b className="num">{record.value}</b>
              <span>{record.text}</span>
            </article>
          ))}
        </div>
        <div className="landing-stats" data-reveal>
          <div><b className="num">3</b><span>직군별 평가<br /><small>급여소득자 · 자영업자 · 프리랜서</small></span></div>
          <div><b className="num">5종</b><span>대안 데이터<br /><small>통신 · 공과금 · 간편결제 · 연금 · 건강보험</small></span></div>
          <div><b className="num">38개</b><span>점수에 쓰는 항목<br /><small>금융 이력 + 납부 기록</small></span></div>
        </div>
        <p className="hint landing-collage__note">광고용 예시 값입니다. 실제 고객 결과가 아니며, 교육용 합성 데이터로 학습한 시연 화면입니다.</p>
      </section>

      {/* 마무리 — 페이지 맨 아래 */}
      <section className="landing-final" data-reveal>
        <p className="landing-final__eyebrow">Avenue</p>
        <h2>이제, 내 기록으로<br />다시 평가받아 보세요</h2>
        <Link to={PATHS.LOGIN} className="landing-pill landing-final__cta">내 점수 확인하기</Link>
      </section>
    </div>
  )
}
