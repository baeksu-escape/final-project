import { useRef } from 'react'
import { HAND_HERO_SCREEN, HERO_PHOTOS } from './landingMedia.js'
import { easeInOut, ramp, useSectionProgress } from './landingScroll.js'
import './landingCinema.css'

// 구간 진행률(0~1) → 장면 값
//   shrink 0~0.3: 꽉 찬 화면이 안쪽으로 줄며 바깥 여백·둥근 모서리 · title 0.02~0.12: 첫 문구 사라짐
//   swap 0.2~0.55: 뒷모습 사진 → 손에 든 폰 사진(opacity·scale로 겹쳐 넘어감, 억지 줌인 없음)
//   screen 0.55~0.72: 흰 액정 위 문구 등장
//   fade 0.84~1: 사진이 천천히 다가가며 사라짐 → 아래 LandingStory가 같은 자리에서 이어 나타난다
function sceneValues(p) {
  return {
    shrink: easeInOut(ramp(p, 0, 0.3)),
    title: ramp(p, 0.02, 0.12),
    swap: easeInOut(ramp(p, 0.2, 0.5)),
    // 문구는 사진보다 먼저(0.8~0.88) 위로 빠지며 사라진다 — 사진이 흐려질 때 회색으로 남아 겹쳐 보이지 않게
    screen: easeInOut(ramp(p, 0.55, 0.72)) * (1 - easeInOut(ramp(p, 0.8, 0.88))),
    screenOut: easeInOut(ramp(p, 0.8, 0.88)),
    fade: easeInOut(ramp(p, 0.84, 1)),
  }
}

const SCREEN_STYLE = {
  left: `${HAND_HERO_SCREEN.left}%`,
  top: `${HAND_HERO_SCREEN.top}%`,
  width: `${HAND_HERO_SCREEN.width}%`,
  height: `${HAND_HERO_SCREEN.height}%`,
}

// 사진 한 장(없으면 색 배경)
function Photo({ src }) {
  return src ? <img className="cinema__media" src={src} alt="" /> : <div className="cinema__media cinema__media--empty" />
}

// N-10 메인 ① 히어로 — 스크롤 축소 + 뒷모습 사진에서 손에 든 폰 사진으로 전환 + 흰 액정 위 문구.
// 진행률 값은 CSS 변수로만 넘겨(리렌더 없음) clip-path·transform·opacity로 그린다.
export default function LandingCinema() {
  const sectionRef = useRef(null)

  useSectionProgress(sectionRef, (p) => {
    const section = sectionRef.current
    if (!section) return
    const v = sceneValues(p)
    section.style.setProperty('--shrink', v.shrink.toFixed(4))
    section.style.setProperty('--title', v.title.toFixed(4))
    section.style.setProperty('--swap', v.swap.toFixed(4))
    section.style.setProperty('--screen', v.screen.toFixed(4))
    section.style.setProperty('--screen-out', v.screenOut.toFixed(4))
    section.style.setProperty('--fade', v.fade.toFixed(4))
  })

  return (
    <section className="cinema" ref={sectionRef} aria-labelledby="cinema-title">
      <div className="cinema__sticky">
        <div className="cinema__frame">
          <div className="cinema__plane cinema__plane--back">
            <Photo src={HERO_PHOTOS.back} />
          </div>
          <div className="cinema__plane cinema__plane--hand">
            <Photo src={HERO_PHOTOS.hand} />
            {/* 흰 액정 칸 — 사진 속 액정 위치에 맞춰 문구를 올린다 */}
            <div className="cinema__screen" style={SCREEN_STYLE}>
              <p className="cinema__screen-tag">신용 네비게이션</p>
              <p className="cinema__screen-title">당신의 좋은 길을<br />안내해 드릴까요?</p>
            </div>
          </div>
          <span className="cinema__shade" aria-hidden="true" />
          <div className="cinema__intro">
            <p className="cinema__eyebrow">연령·직군별 대안 신용평가</p>
            <h1 id="cinema-title" className="cinema__title">성실한 기록이<br />신용이 되는 곳</h1>
            <p className="cinema__brand">Avenue</p>
          </div>
          {(HERO_PHOTOS.back || HERO_PHOTOS.hand) && <p className="cinema__credit">이 화면의 사진은 AI로 생성한 이미지입니다</p>}
        </div>
      </div>
    </section>
  )
}
