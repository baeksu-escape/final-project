import { useState } from 'react'
import Button from '../../../common/components/Button.jsx'
import TextInput from '../../../common/components/TextInput.jsx'
import { CONTENT_MAX } from '../chatConstants.js'

// N-07-1·4 메시지 입력 — Enter나 [보내기]로 보낸다. 실패하면 쓴 글을 남기고 이유를 보여 준다.
export default function MessageForm({ label, onSend }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError('')
    try {
      await onSend(content)
      setText('')
    } catch (err) {
      setError(err.data?.fieldErrors?.[0]?.message ?? err.message)
    } finally {
      setSending(false)
    }
  }

  // 보내는 동안에도 입력 칸을 잠그지 않아 커서가 그대로 남는다. 겹쳐 보내기는 위의 sending 확인이 막는다.
  return (
    <form className="chat-form" onSubmit={handleSubmit}>
      <TextInput label={label} value={text} onChange={setText} maxLength={CONTENT_MAX} error={error}
        hint={`${text.length} / ${CONTENT_MAX}자`} autoComplete="off" />
      <Button type="submit" variant="primary" disabled={sending || !text.trim()}>보내기</Button>
    </form>
  )
}
