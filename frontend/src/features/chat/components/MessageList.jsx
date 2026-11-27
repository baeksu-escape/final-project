import { useEffect, useRef } from 'react'
import Button from '../../../common/components/Button.jsx'
import { SENDER, formatChatTime } from '../chatConstants.js'

// N-07-2 메시지 목록 — 내 쪽(mySide) 글은 오른쪽, 상대 글은 왼쪽에 보여 준다. 새 메시지가 오면 맨 아래로 내린다.
export default function MessageList({ messages, mySide, otherName, hasOlder, onLoadOlder, emptyText }) {
  const boxRef = useRef(null)
  const lastId = messages.at(-1)?.messageId

  // 마지막 메시지가 바뀔 때만 내린다. 이전 메시지를 더 불러올 때는 보던 자리에 둔다.
  useEffect(() => {
    const box = boxRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [lastId])

  return (
    <div ref={boxRef} className="chat-messages" role="log" aria-label="대화 내용">
      {hasOlder && (
        <div className="chat-messages__older">
          <Button size="sm" onClick={onLoadOlder}>이전 대화 더 보기</Button>
        </div>
      )}
      {messages.length === 0 && <p className="hint">{emptyText}</p>}
      <ul className="chat-messages__list">
        {messages.map((message) => {
          const mine = message.senderType === mySide
          const name = mine ? '나' : message.senderType === SENDER.ADMIN ? '관리자' : otherName
          return (
            <li key={message.messageId} className={mine ? 'chat-message chat-message--mine' : 'chat-message'}>
              <span className="chat-message__name">{name}</span>
              <p className="chat-message__bubble">{message.content}</p>
              <time className="chat-message__time num" dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
