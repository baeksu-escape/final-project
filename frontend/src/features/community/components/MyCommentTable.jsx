import { formatDate } from '../config/communityCodes.js'
import LoungeAvatar from './LoungeAvatar.jsx'

// 댓글이 달린 글 제목 칸 — 길면 한 줄로 줄인다. 숨긴 글의 제목은 서버가 null로 보낸다.
function PostTitle({ title }) {
  return (
    <span className="lounge-feed__author">
      <span className="lounge-feed__text" title={title ?? undefined}>{title ?? '숨김 처리된 글'}</span>
    </span>
  )
}

// N-06 COMM-09 내가 쓴 댓글 목록 — 글 목록(PostTable)과 같은 줄 모양으로 댓글 · 게시글 제목 · 닉네임 · 등록일을 보여 준다.
// 줄의 댓글을 누르면 그 댓글이 달린 글을 연다. 신고로 숨겨진 댓글은 안내 문구만 보여 주고 누를 수 없다.
export default function MyCommentTable({ items, onOpen }) {
  if (items.length === 0) return <p className="lounge-empty">아직 쓴 댓글이 없습니다.</p>
  return (
    <ul className="lounge-feed">
      {items.map((comment) =>
        comment.hidden ? (
          <li key={comment.commentId} className="lounge-feed__row lounge-feed__row--comment lounge-feed__row--hidden">
            <span className="lounge-feed__title">신고로 숨김 처리된 댓글입니다.</span>
            <PostTitle title={comment.postTitle} />
            <span className="lounge-feed__author"><LoungeAvatar name={comment.nickname} />{comment.nickname}</span>
            <span className="lounge-feed__date num">{formatDate(comment.createdAt)}</span>
          </li>
        ) : (
          <li key={comment.commentId} className="lounge-feed__row lounge-feed__row--comment">
            <button
              type="button"
              className="lounge-feed__title"
              onClick={() => onOpen(comment.postId)}
              aria-label={`${comment.postTitle ? `'${comment.postTitle}' 글에 쓴 댓글` : '숨김 처리된 글에 쓴 댓글'} ${comment.content}`}
            >
              <span className="lounge-feed__text">{comment.content}</span>
            </button>
            <PostTitle title={comment.postTitle} />
            <span className="lounge-feed__author"><LoungeAvatar name={comment.nickname} />{comment.nickname}</span>
            <span className="lounge-feed__date num">{formatDate(comment.createdAt)}</span>
          </li>
        ),
      )}
    </ul>
  )
}
