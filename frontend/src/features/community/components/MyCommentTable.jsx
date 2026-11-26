import { POST_CATEGORIES, formatDate, labelOf } from '../config/communityCodes.js'
import LoungeAvatar from './LoungeAvatar.jsx'

// 댓글이 달린 글 제목 칸 — 길면 한 줄로 줄인다. 숨긴 글의 제목은 서버가 null로 보낸다.
function PostTitle({ title }) {
  return <span className="lounge-feed__text" title={title ?? undefined}>{title ?? '숨김 처리된 글'}</span>
}

// 글의 카테고리 칸 — 숨긴 글은 서버가 null로 보내 비워 둔다.
function PostCategory({ code }) {
  return <span className="lounge-feed__category">{code && labelOf(POST_CATEGORIES, code)}</span>
}

// 게시글 쓴 회원 칸 — 숨긴 글은 서버가 null로 보내 비워 둔다.
function PostAuthor({ name }) {
  return <span className="lounge-feed__author">{name && <><LoungeAvatar name={name} />{name}</>}</span>
}

// N-06 COMM-09 내가 쓴 댓글 목록 — 글 목록(PostTable)과 같은 줄 모양으로 카테고리 · 게시글 제목 · 댓글 · 게시글 쓴 회원 · 댓글 쓴 날짜를 보여 준다. 맨 위는 열 제목 줄이다.
// 제목이나 댓글을 누르면 그 댓글이 달린 글을 연다. 휴대폰에서는 카테고리·댓글·날짜만 보인다. 신고로 숨겨진 댓글은 안내 문구만 보여 주고 누를 수 없다.
// searched는 검색하거나 카테고리를 골랐는지(결과가 없을 때 문구가 다르다).
export default function MyCommentTable({ items, searched, onOpen }) {
  return (
    <div>
      <div className="lounge-feed__row lounge-feed__row--comment lounge-feed__head" aria-hidden="true">
        <span>카테고리</span>
        <span className="lounge-feed__post">제목</span>
        <span>댓글</span>
        <span className="lounge-feed__author">게시글 쓴 회원</span>
        <span className="lounge-feed__date">쓴 날짜</span>
      </div>
      {items.length === 0 && <p className="lounge-empty">{searched ? '찾는 댓글이 없습니다.' : '아직 쓴 댓글이 없습니다.'}</p>}
      <ul className="lounge-feed">
        {items.map((comment) =>
          comment.hidden ? (
            <li key={comment.commentId} className="lounge-feed__row lounge-feed__row--comment lounge-feed__row--hidden">
              <PostCategory code={comment.categoryCode} />
              <span className="lounge-feed__title lounge-feed__post"><PostTitle title={comment.postTitle} /></span>
              <span className="lounge-feed__title">신고로 숨김 처리된 댓글입니다.</span>
              <PostAuthor name={comment.postNickname} />
              <span className="lounge-feed__date num">{formatDate(comment.createdAt)}</span>
            </li>
          ) : (
            <li key={comment.commentId} className="lounge-feed__row lounge-feed__row--comment">
              <PostCategory code={comment.categoryCode} />
              <button type="button" className="lounge-feed__title lounge-feed__post" onClick={() => onOpen(comment.postId)}>
                <PostTitle title={comment.postTitle} />
              </button>
              <button
                type="button"
                className="lounge-feed__title"
                onClick={() => onOpen(comment.postId)}
                aria-label={`${comment.postTitle ? `'${comment.postTitle}' 글에 쓴 댓글` : '숨김 처리된 글에 쓴 댓글'} ${comment.content}`}
              >
                <span className="lounge-feed__text">{comment.content}</span>
              </button>
              <PostAuthor name={comment.postNickname} />
              <span className="lounge-feed__date num">{formatDate(comment.createdAt)}</span>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
