import { useEffect, useId, useRef } from 'react'

// 모달 창 — open이 true일 때만 화면 가운데에 띄운다. Esc 키나 배경 클릭, 닫기 버튼으로 onClose를 부른다.
// 열리면 창으로 포커스를 옮기고, 닫히면 원래 있던 곳으로 돌려준다.
// 사용 예: <Modal open={open} title="삭제 확인" onClose={() => setOpen(false)}>정말 삭제할까요?</Modal>
export default function Modal({ open, title, onClose, children }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)

  // onClose를 인라인 함수로 넘겨도 포커스가 매번 초기화되지 않도록 최신 함수만 따로 보관한다
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // 열려 있는 동안 Esc로 닫기, 포커스 이동·복원
  useEffect(() => {
    if (!open) return undefined
    const previous = document.activeElement
    dialogRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}
