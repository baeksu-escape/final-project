import { POST_CATEGORIES, formatDate, labelOf } from '../config/communityCodes.js'
import LoungeAvatar from './LoungeAvatar.jsx'

// N-06-1 글 목록 — 커뮤니티형 줄 목록: 카테고리 · 제목(+댓글 수) · 회원(얼굴·닉네임) · 쓴 날짜. 맨 위는 열 제목 줄이다. 숨김 글은 안내 문구, 내 글에는 '내 글' 표시.
// startNo는 예전 표의 번호(최신 글이 가장 큰 번호)로, 화면 낭독기용 이름에만 쓴다.
export default function PostTable({ items, startNo, onOpen }) {
  return (
    <div>
      {/* 열 제목은 눈으로 보는 안내라 낭독기에서는 뺀다(줄마다 제목·회원·날짜를 읽는다) */}
      <div className="lounge-feed__row lounge-feed__row--post lounge-feed__head" aria-hidden="true">
        <span>카테고리</span>
        <span>제목</span>
        <span className="lounge-feed__author">회원</span>
        <span className="lounge-feed__date">쓴 날짜</span>
      </div>
      {items.length === 0 && <p className="lounge-empty">찾는 글이 없습니다.</p>}
      <ul className="lounge-feed">
        {items.map((post, index) =>
          post.hidden ? (
            <li key={post.postId} className="lounge-feed__row lounge-feed__row--post lounge-feed__row--hidden">
              <span className="lounge-feed__category" />
              <span className="lounge-feed__title">신고로 숨김 처리된 글입니다.</span>
              <span className="lounge-feed__author" />
              <span className="lounge-feed__date num">{formatDate(post.createdAt)}</span>
            </li>
          ) : (
            <li key={post.postId} className="lounge-feed__row lounge-feed__row--post">
              <span className="lounge-feed__category">{labelOf(POST_CATEGORIES, post.categoryCode)}</span>
              <button type="button" className="lounge-feed__title" onClick={() => onOpen(post.postId)} aria-label={`${startNo - index}번 글 ${post.title}${post.commentCount ? `, 댓글 ${post.commentCount}개` : ''}`}>
                <span className="lounge-feed__text">{post.title}</span>
                {post.commentCount > 0 && <span className="lounge-feed__comments num">{post.commentCount}</span>}
                {post.mine && <span className="lounge-feed__mine">내 글</span>}
              </button>
              <span className="lounge-feed__author"><LoungeAvatar name={post.nickname} />{post.nickname}</span>
              <span className="lounge-feed__date num">{formatDate(post.createdAt)}</span>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
