import { useEffect, useState } from 'react'
import { CountUp } from './viz.jsx'
import Button from './Button.jsx'
import { useCountUp, useInView } from './vizHooks.js'
import { GRADE_BOUNDARIES } from '../config/grades.js'

const MAX = 1000
const ZONES = [
  { key: 'caution', label: '주의', from: 0, to: GRADE_BOUNDARIES.STANDARD },
  { key: 'standard', label: '보통', from: GRADE_BOUNDARIES.STANDARD, to: GRADE_BOUNDARIES.GOOD },
  { key: 'good', label: '좋음', from: GRADE_BOUNDARIES.GOOD, to: MAX },
]
// 캐릭터 "아비"의 단계 이름 — 점수 구간(ZONES)과 같은 순서
const STAGES = ['새싹', '무럭무럭', '활짝']

// ── 캐릭터 ──────────────────────────────────────────────────────────────────
// src/assets/mascot-{caution,standard,good}.{png,webp}(투명 배경 정사각형, 발이 아래쪽)가 있으면 그 그림을 점수 구간별 표정으로 쓴다.
// 그림 파일은 깃에 올리지 않는 로컬 전용이다. shortcut: 파일이 없으면 코드로 그린 둥근 캐릭터를 보여 준다. 정식 그림을 커밋하면 이 분기를 지운다.
const FACE_FILES = import.meta.glob('../../assets/mascot-{caution,standard,good}.{png,webp}', { eager: true, import: 'default' })
const FACES = ZONES.map((zone) => Object.entries(FACE_FILES).find(([path]) => path.includes(`mascot-${zone.key}.`))?.[1])

// 그림 파일이 없을 때 쓰는 둥근 캐릭터. 머리 위 새싹이 단계마다 자란다(0 새싹 → 1 잎 둘 → 2 잎 둘 + 꽃).
function DrawnMascot({ stage }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <ellipse className="road-mascot__foot" cx="14" cy="38" rx="5" ry="2.6" />
      <ellipse className="road-mascot__foot" cx="26" cy="38" rx="5" ry="2.6" />
      <ellipse className="road-mascot__body" cx="20" cy="26" rx="15" ry="13" />
      <circle className="road-mascot__eye" cx="15" cy="25" r="1.9" />
      <circle className="road-mascot__eye" cx="25" cy="25" r="1.9" />
      <ellipse className="road-mascot__cheek" cx="11" cy="29.5" rx="2.6" ry="1.7" />
      <ellipse className="road-mascot__cheek" cx="29" cy="29.5" rx="2.6" ry="1.7" />
      <path className="road-mascot__mouth" d={stage === 0 ? 'M17.5 31.5 Q20 29 22.5 31.5' : 'M17.5 29.5 Q20 32 22.5 29.5'} />
      <path className="road-mascot__stem" d="M20 13.5 V8" />
      <path className="road-mascot__leaf" d={stage === 0 ? 'M20 9 Q25 4 29 8 Q25 12 20 9Z' : 'M20 9 Q13 3 8 7 Q13 13 20 9Z M20 9 Q27 3 32 7 Q27 13 20 9Z'} />
      {stage === 2 && (
        <g className="road-mascot__flower">
          <circle cx="20" cy="4" r="3.2" />
          <circle className="road-mascot__core" cx="20" cy="4" r="1.3" />
        </g>
      )}
    </svg>
  )
}

// 축하 연출 조각 — 가운데에서 사방으로 퍼진다(좌표는 한 번만 계산)
const BITS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2
  const dist = 90 + (i % 3) * 34
  return { x: Math.round(Math.cos(angle) * dist), y: Math.round(Math.sin(angle) * dist * 0.7 - 16), color: ['--acc', '--mint', '--c-gold', '--c-sky', '--c-pink'][i % 5], delay: (i % 6) * 0.04 }
})

// 한 번 본 축하는 다시 띄우지 않는다(평가 시각별로 기억). 저장소를 못 쓰면 이번 화면에서만 기억한다.
const SEEN_KEY = 'avenue.roadSeen'
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) } catch { return null } }
const writeSeen = (value) => { try { localStorage.setItem(SEEN_KEY, value) } catch { /* 저장소를 못 써도 화면은 동작 */ } }

function LevelUp({ headline, sub, onClose }) {
  return (
    <div className="road-up" role="status">
      {BITS.map((bit, i) => <span key={i} className="road-up__bit" style={{ '--x': `${bit.x}px`, '--y': `${bit.y}px`, '--c': `var(${bit.color})`, animationDelay: `${bit.delay}s` }} />)}
      <div className="road-up__card">
        <b>{headline}</b>
        <p>{sub}</p>
        <Button size="sm" onClick={onClose}>확인</Button>
      </div>
    </div>
  )
}

// UI 시안(Avenue) — 내 점수를 캐릭터 아비로 보여 준다. 점수 구간(주의·보통·좋음)에 따라 표정이 바뀌고, 점수는 0에서 올라가며 세어진다.
// previous(지난 평가 점수)보다 오르면 한 번 축하 화면을 띄운다(seenKey = 이번 평가 시각, 이미 본 평가는 건너뜀).
// 남은 점수와 축하 문구는 안내일 뿐 점수가 오른다는 보장이나 좋은 신용이라는 판정이 아니다.
export default function ScoreRoad({ score, previous, seenKey }) {
  const [ref, seen] = useInView()
  const shown = useCountUp(seen ? score : 0, 1800)
  const found = ZONES.findIndex((zone) => score < zone.to)
  const stage = found === -1 ? ZONES.length - 1 : found
  const now = ZONES[stage]
  const next = ZONES[stage + 1]
  const left = next ? next.from - score : 0
  const face = FACES[stage]
  const label = `내 점수 ${score}점, 현재 ${now.label} 구간. ${next ? `${next.label} 구간까지 ${left}점 남음` : '가장 높은 구간'}`

  // 축하: 지난 평가보다 오른 경우만. 점수 올림 폭과 구간 상승 여부로 문구를 정한다.
  const gain = previous != null ? score - previous : 0
  const gradeUp = previous != null && ZONES.findIndex((zone) => previous < zone.to) < stage
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (!seen || gain <= 0 || !seenKey || readSeen() === String(seenKey)) return undefined
    const timer = setTimeout(() => setCelebrate(true), 1900)
    return () => clearTimeout(timer)
  }, [seen, gain, seenKey])
  const closeCelebrate = () => { writeSeen(String(seenKey)); setCelebrate(false) }

  return (
    <div ref={ref} className="road">
      <div className="road__head">
        <p className="road__title">
          <span className="road__score">내 신용점수 <b className="num">{shown}</b>점</span>
          <span>
            {next
              ? <>{next.label} 구간까지 <b className="num"><CountUp value={left} />점</b> 남았어요</>
              : <>가장 높은 구간까지 왔어요</>}
          </span>
        </p>
        <div className="road__side">
          <span className={`road__grade road__grade--${now.key}`}>{now.label}</span>
          {previous != null && (
            <span className={`road__delta ${gain > 0 ? 'is-up' : gain < 0 ? 'is-down' : ''}`}>지난 평가 대비 <b className="num">{gain > 0 ? '▲' : gain < 0 ? '▼' : ''}{Math.abs(gain)}점</b></span>
          )}
        </div>
      </div>
      <div className="road-art" role="img" aria-label={label}>
        <div className="road-mascot">
          {face ? <img src={face} alt="" /> : <DrawnMascot stage={stage} />}
        </div>
      </div>
      <p className="road__stage">아비는 지금 <b>{STAGES[stage]}</b> 단계예요{next ? ` · ${next.label} 구간에서 ${STAGES[stage + 1]} 단계로 자라요` : ''}</p>
      {celebrate && (
        <LevelUp
          headline={gradeUp ? `${now.label} 구간에 올라섰어요` : `지난 평가보다 ${gain}점 높아졌어요`}
          sub={gradeUp ? `지난 평가보다 ${gain}점 높아졌고, 아비도 ${STAGES[stage]} 단계로 자랐어요.` : '아비도 한 걸음 더 나아갔어요.'}
          onClose={closeCelebrate}
        />
      )}
    </div>
  )
}
