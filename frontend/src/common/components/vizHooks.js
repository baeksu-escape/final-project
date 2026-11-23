import { useEffect, useRef, useState } from 'react'

// UI 리뉴얼 — 시각화 부품(viz.jsx)과 게이지가 같이 쓰는 훅.

const reduceMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

// 0에서 target까지 숫자를 올린다(ease-out). 움직임 줄이기 설정이면 바로 target.
export function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  const instant = reduceMotion()
  useEffect(() => {
    if (instant || target == null || !Number.isFinite(Number(target))) return undefined
    let frame
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(Math.round(Number(target) * (1 - (1 - t) ** 3)))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration, instant])
  return instant ? Number(target ?? 0) : value
}

// 화면에 들어왔는지(한 번 들어오면 true 유지) — 들어올 때 애니메이션을 시작하려고 쓴다.
const IN_VIEW = { threshold: 0.25 }
export function useInView(options = IN_VIEW) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(() => typeof window !== 'undefined' && !('IntersectionObserver' in window))
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true)
        observer.disconnect()
      }
    }, options)
    observer.observe(el)
    return () => observer.disconnect()
  }, [seen, options])
  return [ref, seen]
}
