import { useEffect, useLayoutEffect, useRef } from 'react'

// N-10 메인 스크롤 연출 공통 — 구간 진행률(0~1)을 매 프레임 보간해 넘긴다(requestAnimationFrame, 스크롤 중에만 돈다).

export const clamp = (v) => Math.min(1, Math.max(0, v))
export const ramp = (p, from, to) => clamp((p - from) / (to - from))
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
export const easeIn = (t) => t * t * t
export const reduceMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// 구간 위가 화면 위에 닿을 때 0, 구간 아래가 화면 아래에 닿을 때 1
export function sectionProgress(el) {
  const total = el.offsetHeight - window.innerHeight
  return total > 0 ? clamp(-el.getBoundingClientRect().top / total) : 0
}

// 구간 진행률을 보간해 onFrame(p)를 부른다 — 스크롤 위치를 바로 쓰지 않고 남은 거리의 18%씩 따라가 휠 스크롤도 끊기지 않는다.
// 움직임 줄이기 설정이면 보간 없이 바로 맞춘다. onFrame 안에서는 style·CSS 변수만 바꿔 리렌더를 만들지 않는다.
export function useSectionProgress(ref, onFrame) {
  const callback = useRef(onFrame)
  useLayoutEffect(() => {
    callback.current = onFrame
  })
  useEffect(() => {
    let frame = 0
    let shown = null
    const tick = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      const goal = sectionProgress(el)
      const next = shown == null || reduceMotion() ? goal : shown + (goal - shown) * 0.18
      shown = Math.abs(goal - next) < 0.0004 ? goal : next
      callback.current(shown)
      if (shown !== goal) frame = requestAnimationFrame(tick)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(tick) }
    tick()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref])
}
