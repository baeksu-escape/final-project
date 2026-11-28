import { useEffect, useId, useRef, useState } from 'react'
import Button from '../../../common/components/Button.jsx'
import Notice from '../../../common/components/Notice.jsx'
import TextInput from '../../../common/components/TextInput.jsx'
import { useAuth } from '../../../common/auth/useAuth.js'
import { askChatbotQuestion, getChatbotPresets } from '../api/chatbotApi.js'
import '../styles/glossaryHelper.css'

const EMPTY_QUESTION_MESSAGE = '질문을 입력해 주세요.'
// 안내를 숨긴 것을 기억하는 sessionStorage 키 앞부분. 뒤에 회원 번호를 붙인다.
const TEASER_HIDDEN_KEY = 'avenue.glossaryTeaserHidden'
// 닫힌 상태에서 말풍선으로 보여 줄 질문 수
const TEASER_CHIP_COUNT = 2

// 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 숨기지 않은 것으로 본다.
function readTeaserHidden(key) {
  try {
    return window.sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function saveTeaserHidden(key) {
  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // 저장하지 못해도 지금 화면에서는 숨긴다.
  }
}

// N-32 용어 도우미(FP-207) — 화면 오른쪽 아래 구석에 떠 있는 아이콘 버튼(스크롤해도 따라옴)을 누르면 버튼 위에 패널이 열린다(11/06 UI).
// N-32-1 질문 버튼을 누르면 등록된 답을 보여 주고(횟수 안 줄어듦), N-32-2 직접 쓴 질문은 AI(HELP-03)가 답한다(하루 횟수에서 차감).
// 닫혀 있을 때는 버튼 위에 안내 카드와 짧은 질문 말풍선 2개를 띄운다. ×로 숨기거나 패널을 한 번 열면 그 로그인(탭) 동안 다시 띄우지 않는다.
// 질문 목록·남은 횟수는 한 번만 불러와 기억한다. 닫아도 패널을 숨기기만 해서 고른 답·쓰던 글이 남는다.
// 스타일은 features/ai/styles/glossaryHelper.css(11/27 프론트 담당 허락). 위쪽 바(AppHeader)의 사용자 화면에 한 번 넣는다.
// 사용 예: <GlossaryHelperDialog />
export default function GlossaryHelperDialog() {
  const { user } = useAuth()
  const teaserKey = `${TEASER_HIDDEN_KEY}.${user?.userId ?? 'guest'}`
  const [open, setOpen] = useState(false)
  // 안내(카드·말풍선)를 숨겼는지 — 같은 탭에서는 회원별로 sessionStorage에 기억한다(다시 로그인하면 다시 보임).
  const [teaserHidden, setTeaserHidden] = useState(() => readTeaserHidden(teaserKey))
  const panelId = useId()
  const titleId = useId()
  const fabRef = useRef(null)
  const titleRef = useRef(null)
  const panelRef = useRef(null)
  // status: loading(아직 안 부름·부르는 중) · error · ready
  const [presets, setPresets] = useState({ status: 'loading', items: [], error: '' })
  const [selectedId, setSelectedId] = useState(null)
  const [attempt, setAttempt] = useState(0)
  // N-32-2 오늘 남은 자유 질문 횟수. 질문 목록을 못 불러오면 null(모름)로 두고 서버가 429로 막는다.
  const [quota, setQuota] = useState({ remaining: null, limit: null })
  const [question, setQuestion] = useState('')
  // ask.status: idle · sending. fieldError는 입력 칸 아래, error는 경고 상자에 보인다.
  const [ask, setAsk] = useState({ status: 'idle', fieldError: '', error: '' })
  // 직접 질문으로 받은 AI 답. 질문 버튼을 누르면 지운다(답 상자에는 마지막으로 고른 답 하나만 보인다).
  const [aiAnswer, setAiAnswer] = useState(null)
  // 몇 번째 시도까지 불렀는지 기억해 같은 시도를 두 번 부르지 않는다(창을 닫았다 열어도 다시 부르지 않음).
  const requestedAttempt = useRef(-1)

  const showTeaser = !open && !teaserHidden

  // 안내가 보이거나 창을 처음 열 때(또는 [다시 시도]) 질문 버튼 목록을 불러온다 — 말풍선에 질문이 필요해서다.
  useEffect(() => {
    if ((!open && !showTeaser) || requestedAttempt.current === attempt) return
    requestedAttempt.current = attempt
    getChatbotPresets()
      .then((data) => {
        setPresets({ status: 'ready', items: data?.presets ?? [], error: '' })
        if (Number.isInteger(data?.remainingCount)) setQuota({ remaining: data.remainingCount, limit: data.dailyLimit ?? null })
      })
      .catch((err) => setPresets({ status: 'error', items: [], error: err.message }))
  }, [open, showTeaser, attempt])

  // 안내를 숨긴다(×를 누르거나 패널을 한 번 열었을 때). 같은 탭·같은 회원이면 화면을 옮겨도 다시 안 뜬다.
  const hideTeaser = () => {
    setTeaserHidden(true)
    saveTeaserHidden(teaserKey)
  }

  // 패널 열기 — 안내 카드·말풍선·아이콘 어디서 열어도 안내는 그만 띄운다.
  const openPanel = () => {
    setOpen(true)
    hideTeaser()
  }

  // 열면 패널 제목으로 포커스를 옮겨 화면 낭독기가 패널을 읽게 한다.
  useEffect(() => {
    if (open) titleRef.current?.focus()
  }, [open])

  // 닫으면 포커스를 아이콘 버튼으로 돌려준다(키보드 사용자가 자리를 잃지 않게).
  const close = () => {
    setOpen(false)
    fabRef.current?.focus()
  }

  // 열려 있는 동안 Esc는 포커스가 어디 있든 패널을 닫는다(질문을 보내는 동안 입력 칸이 잠겨 포커스가 패널 밖으로 나가도).
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      // 공통 Modal(aria-modal)이 떠 있으면 Esc는 그 Modal만 닫게 두고 패널은 그대로 둔다(PR 리뷰 11/27).
      if (event.key === 'Escape' && !document.querySelector('[aria-modal="true"]')) {
        setOpen(false)
        fabRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const retry = () => {
    setPresets({ status: 'loading', items: [], error: '' })
    setAttempt((count) => count + 1)
  }
  const selected = presets.items.find((item) => item.presetId === selectedId) ?? null
  const sending = ask.status === 'sending'
  const usedUp = quota.remaining === 0

  // 답을 받고 입력 칸 잠금이 풀리면 포커스를 입력 칸으로 돌려 바로 다음 질문을 쓸 수 있게 한다.
  const wasSending = useRef(false)
  useEffect(() => {
    if (wasSending.current && !sending && open && !usedUp) panelRef.current?.querySelector('input')?.focus()
    wasSending.current = sending
  }, [sending, open, usedUp])

  // N-32-1 질문 버튼 — 등록된 답으로 바꾸고 AI 답은 지운다.
  const choosePreset = (presetId) => {
    setSelectedId(presetId)
    setAiAnswer(null)
  }

  // 닫힌 상태 말풍선 — 질문 버튼 중 글자가 짧은 2개(표시 순서는 그대로). 누르면 패널을 열고 그 답을 바로 보여 준다.
  const teaserChips = [...presets.items]
    .sort((a, b) => a.question.length - b.question.length)
    .slice(0, TEASER_CHIP_COUNT)
    .sort((a, b) => presets.items.indexOf(a) - presets.items.indexOf(b))
  const openWithPreset = (presetId) => {
    choosePreset(presetId)
    openPanel()
  }

  // N-32-2 직접 질문 보내기 — 빈 글은 화면에서 막고, 성공하면 AI 답과 남은 횟수를 바꾼다. 실패해도 쓴 글은 그대로 둔다.
  const submitQuestion = async (event) => {
    event.preventDefault()
    if (sending || usedUp) return
    const text = question.trim()
    if (!text) {
      setAsk({ status: 'idle', fieldError: EMPTY_QUESTION_MESSAGE, error: '' })
      return
    }
    setAsk({ status: 'sending', fieldError: '', error: '' })
    try {
      const data = await askChatbotQuestion(text)
      setAiAnswer({ question: text, answer: data.answer })
      setSelectedId(null)
      setQuestion('')
      setQuota({ remaining: data.remainingCount, limit: data.dailyLimit })
      setAsk({ status: 'idle', fieldError: '', error: '' })
    } catch (err) {
      if (err.status === 400) {
        setAsk({ status: 'idle', fieldError: err.data?.fieldErrors?.[0]?.message || err.message, error: '' })
        return
      }
      // 429: 오늘 횟수를 다 씀 — 남은 횟수를 0으로 맞춰 입력을 막는다. 502·503 등은 서버 문구를 그대로 보여 준다.
      if (err.status === 429) setQuota((prev) => ({ ...prev, remaining: 0 }))
      setAsk({ status: 'idle', fieldError: '', error: err.message || 'AI 답변을 받지 못했어요. 잠시 후 다시 시도해 주세요.' })
    }
  }

  const quotaHint = quota.remaining === null
    ? '질문 버튼은 횟수가 줄지 않아요.'
    : `오늘 남은 질문 ${quota.remaining}/${quota.limit ?? quota.remaining}회 · 질문 버튼은 횟수가 줄지 않아요.`

  return (
    <>
      {/* 버튼 위 패널 — 닫혀도 hidden으로 숨기기만 한다. Esc로 닫는다. */}
      <section
        id={panelId}
        className="gh-panel"
        role="dialog"
        aria-labelledby={titleId}
        hidden={!open}
        ref={panelRef}
      >
        <div className="gh-panel__head">
          <div>
            <p className="gh-panel__tag">도움말</p>
            <h2 id={titleId} ref={titleRef} tabIndex={-1} className="gh-panel__title">금융 용어 도우미</h2>
          </div>
          <Button size="sm" onClick={close}>닫기 ×</Button>
        </div>
        <div className="gh-panel__body l-stack">
        <p className="hint">궁금한 질문을 누르거나, 아래에 금융 용어를 직접 물어보세요.</p>
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
                  onClick={() => choosePreset(item.presetId)}
                >
                  {item.question}
                </button>
              ))}
            </div>
          </>
        )}
        {/* 답 상자 — 질문 버튼의 등록된 답이나 직접 질문의 AI 답 중 마지막 것 하나를 보여 준다. */}
        <div className="panel-sunk" aria-live="polite">
          {aiAnswer ? (
            <div className="l-stack">
              <strong>{aiAnswer.question}</strong>
              <p>{aiAnswer.answer}</p>
              <p className="hint">AI가 만든 설명이라 틀릴 수 있어요. 개인 재무 상담이 아니에요.</p>
            </div>
          ) : selected ? (
            <div className="l-stack">
              <strong>{selected.question}</strong>
              <p>{selected.answer}</p>
            </div>
          ) : (
            <p className="hint">위 질문을 누르거나 아래에 직접 물어보세요.</p>
          )}
        </div>
        {/* N-32-2 직접 질문 — Enter로도 보낸다. 질문 글은 AI에만 가고 저장되지 않는다. */}
        <form className="l-stack" onSubmit={submitQuestion} noValidate>
          <TextInput
            label="직접 질문하기"
            value={question}
            onChange={(value) => {
              setQuestion(value)
              if (ask.fieldError) setAsk((prev) => ({ ...prev, fieldError: '' }))
            }}
            placeholder="예: DSR이 뭐예요?"
            maxLength={200}
            hint={quotaHint}
            error={ask.fieldError}
            disabled={sending || usedUp}
          />
          {usedUp && <p className="hint">오늘 질문을 모두 썼어요. 내일 다시 이용해 주세요.</p>}
          {ask.error && !usedUp && <Notice type="warn">{ask.error}</Notice>}
          <Button variant="primary" type="submit" disabled={sending || usedUp}>
            {sending ? '답을 만드는 중…' : '질문하기'}
          </Button>
        </form>
        </div>
      </section>
      {/* 닫혀 있을 때 버튼 위 안내 — 위에 짧은 질문 말풍선, 아래에 안내 카드(×로 숨김) */}
      {showTeaser && (
        <aside className="gh-teaser" aria-label="용어 도우미 안내">
          {teaserChips.map((item) => (
            <button key={item.presetId} type="button" className="gh-chip" onClick={() => openWithPreset(item.presetId)}>
              {item.question}
            </button>
          ))}
          <div className="gh-teaser__card">
            <button type="button" className="gh-teaser__open" onClick={openPanel}>
              <span className="gh-teaser__title">궁금한 금융 용어를 물어보세요</span>
              <span className="gh-teaser__sub">대화 시작하기</span>
            </button>
            <button type="button" className="gh-teaser__close" aria-label="안내 닫기" onClick={hideTeaser}>×</button>
          </div>
        </aside>
      )}
      {/* 오른쪽 아래 구석에 떠 있는 아이콘 버튼 — 글자 대신 말풍선 안 물음표 선 아이콘, 이름은 aria-label로 알린다. */}
      <button
        ref={fabRef}
        type="button"
        className="gh-fab"
        aria-label={open ? '용어 도우미 닫기' : '용어 도우미 열기'}
        title="용어 도우미"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : openPanel())}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 5h16v11H9l-5 4z" />
          <path d="M10 8.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5M12 13.8h0" />
        </svg>
      </button>
    </>
  )
}
