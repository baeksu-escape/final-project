import { formatDate } from '../config/communityCodes.js'

// 닉네임 첫 글자로 만든 동그란 얼굴 — 닉네임마다 색이 고정된다(실제 사진·개인정보 아님)
const AVATAR_TONES = ['var(--c-blue)', 'var(--c-green)', 'var(--c-violet)', 'var(--c-orange)', 'var(--c-sky)', 'var(--c-pink)']
function Avatar({ name = '?' }) {
  const code = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  return <span className="lounge-avatar" style={{ '--tone': AVATAR_TONES[code % AVATAR_TONES.length] }} aria-hidden="true">{name.slice(0, 1)}</span>
}

// N-06-1 글 목록 — 커뮤니티형 줄 목록: 제목(+댓글 수) · 작성자(얼굴·닉네임) · 등록일. 숨김 글은 안내 문구, 내 글에는 '내 글' 표시.
// startNo는 예전 표의 번호(최신 글이 가장 큰 번호)로, 화면 낭독기용 이름에만 쓴다.
export default function PostTable({ items, startNo, onOpen }) {
  if (items.length === 0) return <p className="lounge-empty">찾는 글이 없습니다.</p>
  return (
    <ul className="lounge-feed">
      {items.map((post, index) =>
        post.hidden ? (
          <li key={post.postId} className="lounge-feed__row lounge-feed__row--hidden">
            <span className="lounge-feed__title">신고로 숨김 처리된 글입니다.</span>
            <span className="lounge-feed__author" />
            <span className="lounge-feed__date num">{formatDate(post.createdAt)}</span>
          </li>
        ) : (
          <li key={post.postId} className="lounge-feed__row">
            <button type="button" className="lounge-feed__title" onClick={() => onOpen(post.postId)} aria-label={`${startNo - index}번 글 ${post.title}${post.commentCount ? `, 댓글 ${post.commentCount}개` : ''}`}>
              <span className="lounge-feed__text">{post.title}</span>
              {post.commentCount > 0 && <span className="lounge-feed__comments num">{post.commentCount}</span>}
              {post.mine && <span className="lounge-feed__mine">내 글</span>}
            </button>
            <span className="lounge-feed__author"><Avatar name={post.nickname} />{post.nickname}</span>
            <span className="lounge-feed__date num">{formatDate(post.createdAt)}</span>
          </li>
        ),
      )}
    </ul>
  )
}
