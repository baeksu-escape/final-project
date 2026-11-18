import { Chip } from '../../../common/components/index.js'
import { formatDate } from '../config/communityCodes.js'

// N-06-1 글 목록 표 — No·제목·작성자·댓글·등록일. 숨김 글은 제목 대신 안내 문구, 내 글에는 '내 글' 칩을 붙인다.
// No는 최신 글이 가장 큰 번호다(전체 글 수에서 거꾸로 센다).
export default function PostTable({ items, startNo, onOpen }) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="lounge-table__no">No</th>
            <th>제목</th>
            <th>작성자</th>
            <th className="lounge-table__num">댓글</th>
            <th className="lounge-table__num">등록일</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={5} className="lounge-table__empty">
                찾는 글이 없습니다.
              </td>
            </tr>
          )}
          {items.map((post, index) =>
            post.hidden ? (
              <tr key={post.postId} className="lounge-table__row--hidden">
                <td className="lounge-table__no">{startNo - index}</td>
                <td>신고로 숨김 처리된 글입니다.</td>
                <td>—</td>
                <td className="lounge-table__num">—</td>
                <td className="lounge-table__num">{formatDate(post.createdAt)}</td>
              </tr>
            ) : (
              <tr key={post.postId}>
                <td className="lounge-table__no">{startNo - index}</td>
                <td>
                  <button type="button" className="lounge-table__title" onClick={() => onOpen(post.postId)}>
                    {post.title}
                  </button>
                  {post.mine && <Chip accent>내 글</Chip>}
                </td>
                <td className="lounge-table__muted">{post.nickname}</td>
                <td className="lounge-table__num">{post.commentCount || ''}</td>
                <td className="lounge-table__num lounge-table__muted">{formatDate(post.createdAt)}</td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}
