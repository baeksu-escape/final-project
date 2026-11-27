import Card from '../../../common/components/Card.jsx'
import { memberConversation } from '../api/chatApi.js'
import { SENDER } from '../chatConstants.js'
import Conversation from '../components/Conversation.jsx'
import { useChatSignal } from '../useChatSignal.js'
import '../chat.css'

// N-07-1·2 회원의 1:1 문의 화면 — 내 문의방 하나에서 관리자와 글을 주고받는다.
export default function InquiryPage() {
  const tick = useChatSignal()

  return (
    <div className="chat-page">
      <header className="page-head">
        <p className="page-head__tag">고객 지원</p>
        <h1 className="page-head__title">1:1 문의</h1>
        <p className="page-head__lead">궁금한 점을 남기면 관리자가 답변합니다.</p>
      </header>
      <Card>
        <Conversation api={memberConversation} tick={tick} mySide={SENDER.USER} otherName="관리자"
          inputLabel="문의 내용" emptyText="아직 문의한 내용이 없습니다. 첫 메시지를 보내 보세요." />
      </Card>
    </div>
  )
}
