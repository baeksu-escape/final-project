import { useEffect, useRef } from 'react'

// 토스트 — message가 있으면 화면 아래에 잠깐 알림을 띄우고, duration(ms) 뒤에 onClose를 부른다. 보여 줄 문구 상태는 쓰는 쪽이 들고 있는다.
// 사용 예: <Toast message={toastMessage} onClose={() => setToastMessage('')} />
export default function Toast({ message, onClose, duration = 3000 }) {
  const onCloseRef = useRef(onClose)

  // onClose를 인라인 함수로 넘겨도 타이머가 다시 시작되지 않도록 최신 함수만 따로 보관한다
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // message가 바뀔 때마다 타이머를 새로 건다
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => onCloseRef.current(), duration)
    return () => clearTimeout(timer)
  }, [message, duration])

  if (!message) return null
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  )
}
