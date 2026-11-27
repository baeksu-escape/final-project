import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PATHS } from '../config/navigation.js'
import { HERO_PHOTOS, photoOf } from './landingMedia.js'
import LandingCinema from './LandingCinema.jsx'
import LandingStory from './LandingStory.jsx'
import './landing.css'

// N-10 메인(홍보) 페이지 — 토스처럼 스크롤에 반응하는 두 구간 + 아래 소개 구간.
//   ① LandingCinema: 꽉 찬 사진이 스크롤할수록 둥근 카드로 줄고, 뒷모습 사진에서 손에 든 폰 사진으로 넘어간 뒤 흰 액정 위에 문구가 나온다.
//   ② LandingStory: 밝은 바탕 스티키 — 왼쪽 서비스 목록(아코디언), 오른쪽 기울어진 입체 폰.

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

const ARRIVE_PHOTO = photoOf('arrive')
const HAS_PHOTOS = Boolean(HERO_PHOTOS.back || HERO_PHOTOS.hand)

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

// 페이지 실제 폭(스크롤 막대 제외)을 --page-w로, 위 고정 메뉴 높이를 --bar-h로 넘긴다
// — 화면 끝까지 붙는 두 구간이 좌우로 어긋나지 않고, 메뉴 바로 아래에 고정되게(모바일은 메뉴가 두 줄이라 더 높다)
function usePageWidth(rootRef) {
  useEffect(() => {
    const update = () => {
      const root = rootRef.current
      if (!root) return
      root.style.setProperty('--page-w', `${document.body.clientWidth}px`)
      root.style.setProperty('--bar-h', `${document.querySelector('.public-bar')?.offsetHeight ?? 0}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    return () => observer.disconnect()
  }, [rootRef])
}

export default function LandingPage() {
  const rootRef = useRef(null)
  usePageWidth(rootRef)
  useReveal()

  return (
    <div className="landing" ref={rootRef}>
      <LandingCinema />
      <LandingStory />

      <section className="landing-mission" aria-labelledby="landing-mission-title">
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
        <p className="hint landing-collage__note">광고용 예시 값입니다. 실제 고객 결과가 아니며, 교육용 합성 데이터로 학습한 시연 화면입니다.{HAS_PHOTOS ? ' 메인 화면의 사진은 AI로 생성한 이미지입니다.' : ''}</p>
      </section>

      {/* 마무리 — 페이지 맨 아래(도착 사진이 있으면 배경으로) */}
      <section className={`landing-final${ARRIVE_PHOTO ? ' landing-final--photo' : ''}`} style={ARRIVE_PHOTO ? { '--final-photo': `url(${ARRIVE_PHOTO})` } : undefined} data-reveal>
        <p className="landing-final__eyebrow">Avenue</p>
        <h2>이제, 내 기록으로<br />다시 평가받아 보세요</h2>
        <Link to={PATHS.LOGIN} className="landing-pill landing-final__cta">내 점수 확인하기</Link>
      </section>
    </div>
  )
}
