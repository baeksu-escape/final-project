import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SERVICES } from './landingServices.js'
import { AppHome, Phone3D, ServiceScreen } from './LandingPhone.jsx'
import { ramp, reduceMotion, useSectionProgress } from './landingScroll.js'
import './landingStory.css'

// 진행률 구간 — 0~0.07 목록·폰이 0.9배에서 커지며 나타남 → 0.07~0.18 폰이 정면에서 기욺(앱 첫 화면) → 서비스 4개가 차례로 펼쳐진다
const APPEAR_END = 0.07
const TILT_END = 0.18
const stopOf = (index) => TILT_END + ((index + 0.5) / SERVICES.length) * (1 - TILT_END)

// N-10 메인 ② 밝은 바탕 스티키 — 왼쪽 서비스 목록(아코디언), 오른쪽 기울어진 입체 폰(펼친 서비스의 미리보기).
// 좁은 화면(767px 이하)은 위(폰)·아래(목록)로 쌓는다.
export default function LandingStory() {
  const sectionRef = useRef(null)
  const [active, setActive] = useState(-1)

  useSectionProgress(sectionRef, (p) => {
    const section = sectionRef.current
    if (!section) return
    const appear = ramp(p, 0, APPEAR_END)
    section.style.setProperty('--c', appear.toFixed(4))
    section.style.setProperty('--t', ramp(p, APPEAR_END, TILT_END).toFixed(4))
    // 위 히어로와 겹쳐 있는 동안(아직 안 보일 때)은 클릭되지 않게
    section.dataset.shown = appear > 0.5 ? 'true' : 'false'
    const next = p < TILT_END ? -1 : Math.min(SERVICES.length - 1, Math.floor(ramp(p, TILT_END, 1) * SERVICES.length))
    setActive((old) => (old === next ? old : next))
  })

  // 서비스 이름을 누르면 그 서비스가 펼쳐지는 위치로 부드럽게 스크롤한다
  const goTo = (index) => {
    const el = sectionRef.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * stopOf(index), behavior: reduceMotion() ? 'auto' : 'smooth' })
  }

  return (
    <section className="story" ref={sectionRef} aria-labelledby="story-title">
      <div className="story__sticky">
        <div className="story__list">
          <h2 id="story-title" className="story__title">내 신용을 관리하는 일은<br />한눈에, 단순하게</h2>
          <ul className="svc-acc">
            {SERVICES.map((service, index) => (
              <li key={service.key} className={index === active ? 'is-on' : ''}>
                <button type="button" className="svc-acc__head" aria-expanded={index === active} onClick={() => goTo(index)}>
                  {service.label}
                </button>
                <div className="svc-acc__body">
                  <div>
                    <p>{service.summary}</p>
                    <Link to={service.path} className="svc-acc__cta" tabIndex={index === active ? 0 : -1}>{service.cta} <span aria-hidden="true">→</span></Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="story__visual" aria-hidden="true">
          <div className="story__phone">
            <Phone3D tilt>
              {/* 폰 화면 — 처음엔 앱 첫 화면, 서비스가 펼쳐지면 그 미리보기로 부드럽게 바뀐다 */}
              <div className="story__screens">
                <div className={`story__screen${active < 0 ? ' is-on' : ''}`}><AppHome /></div>
                {SERVICES.map((service, index) => (
                  <div key={service.key} className={`story__screen${index === active ? ' is-on' : ''}`}>
                    {index === active && <ServiceScreen serviceKey={service.key} label={service.label} />}
                  </div>
                ))}
              </div>
            </Phone3D>
          </div>
        </div>
      </div>
    </section>
  )
}
