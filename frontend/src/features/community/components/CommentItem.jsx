import { useState } from 'react'
import { Button } from '../../../common/components/index.js'
import { COMMENT_MAX, formatDateTime } from '../config/communityCodes.js'

// N-06 댓글 한 개 — 내 댓글이면 [수정](그 자리에서 고치기)·[삭제](한 번 더 확인), 남의 댓글이면 신고 버튼(reportAction)을 보여 준다.
// 신고로 숨겨진 댓글은 안내 문구만 보여 주고 본인도 고치거나 지울 수 없다. onSave(content)·onDelete()는 Promise를 돌려준다.
export default function CommentItem({ comment, reportAction, onSave, onDelete }) {
  // view: 보기, edit: 고치는 중, askDelete: 삭제 확인
  const [mode, setMode] = useState('view')
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  if (comment.hidden) return <div className="lounge-comment lounge-comment--hidden">신고로 숨김 처리된 댓글입니다.</div>

  const changeMode = (next) => {
    setMode(next)
    setText(comment.content)
    setError('')
  }

  // 저장·삭제를 보내고, 실패하면 그 자리에 이유를 보여 준다.
  const send = async (request) => {
    setSending(true)
    setError('')
    try {
      await request()
      setMode('view')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleSave = (event) => {
    event.preventDefault()
    if (!text.trim()) {
      setError('댓글을 입력해 주세요.')
      return
    }
    send(() => onSave(text.trim()))
  }

  const inputId = `lounge-comment-edit-${comment.commentId}`
  return (
    <div className="lounge-comment">
      <div className="lounge-comment__head">
        <p className="lounge-meta">
          <b>{comment.nickname}</b>
          <span>{formatDateTime(comment.createdAt)}</span>
        </p>
        {!comment.mine && reportAction}
        {comment.mine && mode === 'view' && (
          <div className="l-row">
            <Button size="sm" onClick={() => changeMode('edit')}>
              수정
            </Button>
            <Button size="sm" variant="danger" onClick={() => changeMode('askDelete')}>
              삭제
            </Button>
          </div>
        )}
        {comment.mine && mode === 'askDelete' && (
          <div className="l-row">
            <Button size="sm" variant="danger" disabled={sending} onClick={() => send(onDelete)}>
              정말 삭제
            </Button>
            <Button size="sm" disabled={sending} onClick={() => changeMode('view')}>
              취소
            </Button>
          </div>
        )}
      </div>
      {mode === 'edit' ? (
        <form className="l-stack" onSubmit={handleSave}>
          <label htmlFor={inputId} className="sr-only">
            댓글 고치기
          </label>
          <textarea
            id={inputId}
            className="lounge-textarea lounge-textarea--short"
            value={text}
            maxLength={COMMENT_MAX}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="l-row">
            <Button type="submit" variant="primary" size="sm" disabled={sending}>
              저장
            </Button>
            <Button size="sm" disabled={sending} onClick={() => changeMode('view')}>
              취소
            </Button>
          </div>
        </form>
      ) : (
        <p className="lounge-comment__body">{comment.content}</p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
