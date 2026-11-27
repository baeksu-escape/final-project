import { useEffect, useMemo, useState } from 'react'
import Button from '../../../common/components/Button.jsx'
import Card from '../../../common/components/Card.jsx'
import Notice from '../../../common/components/Notice.jsx'
import { useAdminErrorHandler } from '../../admin/useAdminErrorHandler.js'
import { adminConversation, fetchRooms } from '../api/chatApi.js'
import { CHAT_READ_EVENT, SENDER, formatChatTime } from '../chatConstants.js'
import Conversation from '../components/Conversation.jsx'
import { useChatSignal } from '../useChatSignal.js'
import '../chat.css'

// N-07-3·4 관리자의 1:1 문의 화면 — 왼쪽 문의 목록(최근 메시지 순)에서 하나를 고르면 오른쪽에서 답장한다.
export default function AdminInquiryPage() {
  const tick = useChatSignal()
  const handleAdminError = useAdminErrorHandler()
  const [page, setPage] = useState(1)
  const [list, setList] = useState({ data: null, error: '' })
  const [selected, setSelected] = useState(null)
  // 읽음 처리 뒤에 목록의 안 읽은 개수를 다시 불러오려고 1씩 올린다
  const [readVersion, setReadVersion] = useState(0)

  useEffect(() => {
    const onRead = () => setReadVersion((value) => value + 1)
    window.addEventListener(CHAT_READ_EVENT, onRead)
    return () => window.removeEventListener(CHAT_READ_EVENT, onRead)
  }, [])

  useEffect(() => {
    let alive = true
    fetchRooms(page)
      .then((data) => alive && setList({ data, error: '' }))
      .catch(async (err) => {
        if (await handleAdminError(err)) return
        if (alive) setList((prev) => ({ ...prev, error: err.message }))
      })
    return () => {
      alive = false
    }
  }, [page, tick, readVersion, handleAdminError])

  const roomId = selected?.roomId
  const api = useMemo(() => (roomId == null ? null : adminConversation(roomId)), [roomId])
  const rooms = list.data?.items ?? []
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.totalCount / list.data.size)) : 1

  return (
    <div className="chat-page">
      <header className="page-head">
        <p className="page-head__tag">관리자</p>
        <h1 className="page-head__title">1:1 문의</h1>
        <p className="page-head__lead">회원의 문의를 확인하고 답장합니다.</p>
      </header>
      <div className="chat-admin">
        <Card title="문의 목록">
          {list.error && <Notice type="warn">{list.error}</Notice>}
          {!list.data && !list.error && <p className="hint">목록을 불러오는 중입니다.</p>}
          {list.data && rooms.length === 0 && <p className="hint">접수된 문의가 없습니다.</p>}
          <ul className="chat-rooms">
            {rooms.map((room) => (
              <li key={room.roomId}>
                <button type="button" className="chat-room" aria-current={room.roomId === roomId ? 'true' : undefined}
                  onClick={() => setSelected(room)}>
                  <span className="chat-room__name">{room.nickname}</span>
                  <time className="chat-room__time num" dateTime={room.lastMessageAt}>{formatChatTime(room.lastMessageAt)}</time>
                  <span className="chat-room__last">{room.lastMessage}</span>
                  {room.unreadCount > 0 && <span className="chat-badge num" aria-label={`안 읽은 메시지 ${room.unreadCount}개`}>{room.unreadCount}</span>}
                </button>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="chat-pager">
              <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>이전</Button>
              <span className="num">{page} / {totalPages}</span>
              <Button size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>다음</Button>
            </div>
          )}
        </Card>
        <Card title={selected ? `${selected.nickname} 님의 문의` : '대화'}>
          {api
            ? <Conversation key={roomId} api={api} tick={tick} mySide={SENDER.ADMIN} otherName={selected.nickname}
                inputLabel="답장" emptyText="대화 내용이 없습니다." />
            : <p className="hint">왼쪽 목록에서 문의를 고르세요.</p>}
        </Card>
      </div>
    </div>
  )
}
