import { useEffect, useRef, useState } from 'react'
import Button from '../../../common/components/Button.jsx'
import Modal from '../../../common/components/Modal.jsx'
import Notice from '../../../common/components/Notice.jsx'
import { getChatbotPresets } from '../api/chatbotApi.js'

// N-32-1 용어 도우미 창(FP-207) — 위쪽 바 [용어 도우미]로 연다. 미리 정한 질문 버튼을 누르면 등록된 답을 보여 주고, 질문 횟수는 줄지 않는다.
// 질문 목록은 처음 열 때 한 번만 불러와 기억한다(위쪽 바는 화면을 옮겨도 그대로라 다시 부르지 않는다).
// 자유 질문(N-32-2, HELP-03)은 AI 제공사가 정해진 뒤 추가한다. 새 CSS 없이 공통 컴포넌트와 기존 클래스만 쓴다.
// 사용 예: <GlossaryHelperDialog open={open} onClose={() => setOpen(false)} />
export default function GlossaryHelperDialog({ open, onClose }) {
  // status: loading(아직 안 부름·부르는 중) · error · ready
  const [presets, setPresets] = useState({ status: 'loading', items: [], error: '' })
  const [selectedId, setSelectedId] = useState(null)
  const [attempt, setAttempt] = useState(0)
  // 몇 번째 시도까지 불렀는지 기억해 같은 시도를 두 번 부르지 않는다(창을 닫았다 열어도 다시 부르지 않음).
  const requestedAttempt = useRef(-1)

  // 창을 처음 열 때(또는 [다시 시도]) 질문 버튼 목록을 불러온다.
  useEffect(() => {
    if (!open || requestedAttempt.current === attempt) return
    requestedAttempt.current = attempt
    getChatbotPresets()
      .then((data) => setPresets({ status: 'ready', items: data?.presets ?? [], error: '' }))
      .catch((err) => setPresets({ status: 'error', items: [], error: err.message }))
  }, [open, attempt])

  const retry = () => {
    setPresets({ status: 'loading', items: [], error: '' })
    setAttempt((count) => count + 1)
  }
  const selected = presets.items.find((item) => item.presetId === selectedId) ?? null

  return (
    <Modal open={open} title="용어 도우미" onClose={onClose}>
      <div className="l-stack">
        <p className="hint">궁금한 질문을 누르면 설명을 보여 드려요. 질문 버튼은 횟수가 줄지 않아요.</p>
        {presets.status === 'loading' && <p className="hint">불러오는 중…</p>}
        {presets.status === 'error' && (
          <Notice type="warn">
            {presets.error || '질문 목록을 불러오지 못했어요.'} <Button size="sm" onClick={retry}>다시 시도</Button>
          </Notice>
        )}
        {presets.status === 'ready' && presets.items.length === 0 && <p className="hint">등록된 질문이 아직 없어요.</p>}
        {presets.status === 'ready' && presets.items.length > 0 && (
          <>
            <div className="l-stack" role="group" aria-label="질문 버튼">
              {presets.items.map((item) => (
                // 고른 질문은 옅은 파랑(작은 primary)으로 표시하고 aria-pressed로 알린다. 기존 버튼 클래스만 쓴다.
                <button
                  key={item.presetId}
                  type="button"
                  className={item.presetId === selectedId ? 'button button--primary button--sm' : 'button button--sm'}
                  aria-pressed={item.presetId === selectedId}
                  onClick={() => setSelectedId(item.presetId)}
                >
                  {item.question}
                </button>
              ))}
            </div>
            <div className="panel-sunk" aria-live="polite">
              {selected ? (
                <div className="l-stack">
                  <strong>{selected.question}</strong>
                  <p>{selected.answer}</p>
                </div>
              ) : (
                <p className="hint">위 질문을 눌러 보세요.</p>
              )}
            </div>
          </>
        )}
        <p className="hint">직접 질문하기는 준비 중이에요.</p>
      </div>
    </Modal>
  )
}
