import { useState } from 'react'
import { Button, Chip, Notice } from '../../../common/components/index.js'
import { COMMENT_MAX, formatDateTime } from '../config/communityCodes.js'
import CommentItem from './CommentItem.jsx'

// N-06-1·3 글 상세 — 본문, 댓글 목록과 댓글 쓰기. 내 글이면 수정(N-06-5)·삭제(N-06-6, 한 번 더 확인)를,
// 남의 글·댓글이면 신고 버튼(N-33-1)을 보여 준다. 숨김 글은 안내 문구만 보여 주고 본인도 고치거나 지울 수 없다.
// onReport({ targetType, targetId }) · onAddComment(content) · onSaveComment(commentId, content) · onDeleteComment(commentId)는 Promise를 돌려준다.
export default function PostDetail({ post, reportedKeys, onBack, onEdit, onDelete, onReport, onAddComment, onSaveComment, onDeleteComment }) {
  const [askDelete, setAskDelete] = useState(false)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [sending, setSending] = useState(false)

  if (post.hidden) {
    return (
      <section className="card lounge-detail">
        <Notice type="warn">신고로 숨김 처리된 글입니다. 관리자가 확인한 뒤 다시 보이거나 삭제됩니다.</Notice>
        <div className="l-row">
          <Button size="sm" onClick={onBack}>
            목록으로
          </Button>
        </div>
      </section>
    )
  }

  // 신고 버튼 — 내 글·댓글이면 없고, 이번에 신고한 대상이면 '신고함' 칩
  const reportButton = (targetType, targetId, mine) => {
    if (mine) return null
    if (reportedKeys.includes(`${targetType}:${targetId}`)) return <Chip>신고함</Chip>
    return (
      <Button size="sm" onClick={() => onReport({ targetType, targetId })}>
        {targetType === 'POST' ? '이 글 신고' : '이 댓글 신고'}
      </Button>
    )
  }

  const visibleComments = post.comments.filter((item) => !item.hidden).length

  const handleComment = async (event) => {
    event.preventDefault()
    if (!comment.trim()) {
      setCommentError('댓글을 입력해 주세요.')
      return
    }
    setSending(true)
    setCommentError('')
    try {
      await onAddComment(comment.trim())
      setComment('')
    } catch (err) {
      setCommentError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <article className="card lounge-detail" aria-labelledby="lounge-post-title">
      <div className="l-row">
        <Button size="sm" onClick={onBack}>
          ← 목록으로
        </Button>
      </div>
      <div className="lounge-detail__head">
        <div className="lounge-detail__heading">
          <h2 id="lounge-post-title" className="card__title">
            {post.title}
          </h2>
          <p className="lounge-meta">
            <span>
              {post.nickname}
              {post.mine && ' · 내 글'}
            </span>
            <span>{formatDateTime(post.createdAt)}</span>
            {post.updatedAt && <span>수정 {formatDateTime(post.updatedAt)}</span>}
            <span>댓글 {visibleComments}</span>
          </p>
        </div>
        <div className="l-row">
          {reportButton('POST', post.postId, post.mine)}
          {post.mine && !askDelete && (
            <>
              <Button size="sm" onClick={onEdit}>
                수정
              </Button>
              <Button size="sm" variant="danger" onClick={() => setAskDelete(true)}>
                삭제
              </Button>
            </>
          )}
          {post.mine && askDelete && (
            <>
              <Button size="sm" variant="danger" onClick={onDelete}>
                정말 삭제
              </Button>
              <Button size="sm" onClick={() => setAskDelete(false)}>
                취소
              </Button>
            </>
          )}
        </div>
      </div>

      <p className="lounge-detail__body">{post.content}</p>

      <section className="lounge-comments" aria-label="댓글">
        <p className="form-field__label">댓글 {post.comments.length}</p>
        {post.comments.map((item) => (
          <CommentItem
            key={item.commentId}
            comment={item}
            reportAction={reportButton('COMMENT', item.commentId, item.mine)}
            onSave={(content) => onSaveComment(item.commentId, content)}
            onDelete={() => onDeleteComment(item.commentId)}
          />
        ))}
      </section>

      <form className="l-stack" onSubmit={handleComment}>
        <label htmlFor="lounge-comment-input" className="form-field__label">
          댓글 쓰기
        </label>
        <textarea
          id="lounge-comment-input"
          className="lounge-textarea lounge-textarea--short"
          value={comment}
          maxLength={COMMENT_MAX}
          placeholder="따뜻한 말로 남겨 주세요"
          onChange={(event) => setComment(event.target.value)}
        />
        {commentError && (
          <p className="field-error" role="alert">
            {commentError}
          </p>
        )}
        <div className="l-row">
          <Button type="submit" variant="primary" size="sm" disabled={sending}>
            댓글 등록
          </Button>
        </div>
      </form>
    </article>
  )
}
