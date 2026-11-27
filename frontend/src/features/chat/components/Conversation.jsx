import Notice from '../../../common/components/Notice.jsx'
import { useConversation } from '../useConversation.js'
import MessageForm from './MessageForm.jsx'
import MessageList from './MessageList.jsx'

// N-07 대화 창 — 메시지 목록과 입력 칸. 회원 화면과 관리자 화면이 함께 쓴다.
export default function Conversation({ api, tick, mySide, otherName, inputLabel, emptyText }) {
  const { messages, hasOlder, loading, error, loadOlder, send } = useConversation(api, tick)

  return (
    <div className="chat-conversation">
      {error && <Notice type="warn">{error}</Notice>}
      {loading
        ? <p className="hint">대화를 불러오는 중입니다.</p>
        : <MessageList messages={messages} mySide={mySide} otherName={otherName} hasOlder={hasOlder}
            onLoadOlder={loadOlder} emptyText={emptyText} />}
      <MessageForm label={inputLabel} onSend={send} />
    </div>
  )
}
