import { apiDelete, apiGet, apiPost, apiPut } from '../../../common/api/client.js'
import { PAGE_SIZE } from '../config/communityCodes.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/communityMockHandlers.js'

// N-06 신용 라운지 API 경로 — 범영님 API 정의서 v0.2 COMM-01~06·09~11과 같다.
export const BOARD_API = Object.freeze({
  POSTS: '/api/board/posts',
  post: (postId) => `/api/board/posts/${postId}`,
  comments: (postId) => `/api/board/posts/${postId}/comments`,
  comment: (postId, commentId) => `/api/board/posts/${postId}/comments/${commentId}`,
  MY_COMMENTS: '/api/members/me/comments',
})

// N-06-1 글 목록·검색 — → { items: [{ postId, categoryCode, title, nickname, commentCount, createdAt, hidden, mine }], page, size, totalCount }
// filter 'mine'은 내 글만. 늘 최신순
// category는 글 카테고리 코드(그 카테고리의 보이는 글만)
export function fetchPosts({ page = 1, keyword = '', filter = '', category = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
  if (keyword.trim()) params.set('keyword', keyword.trim())
  if (filter) params.set('filter', filter)
  if (category) params.set('category', category)
  return apiGet(`${BOARD_API.POSTS}?${params}`)
}

// N-06-1 글 상세 + 댓글 — → { postId, categoryCode, title, content, nickname, createdAt, updatedAt, hidden, mine, comments: [...] }
export function fetchPost(postId) {
  return apiGet(BOARD_API.post(postId))
}

// N-06-2 글쓰기 — { title, content, categoryCode } → { postId }
export function createPost(payload) {
  return apiPost(BOARD_API.POSTS, payload)
}

// N-06-5 내 글 수정 — { title, content, categoryCode } → {}
export function updatePost(postId, payload) {
  return apiPut(BOARD_API.post(postId), payload)
}

// N-06-6 내 글 삭제 — → {}
export function deletePost(postId) {
  return apiDelete(BOARD_API.post(postId))
}

// N-06-3 댓글 쓰기 — { content } → { commentId }
export function createComment(postId, content) {
  return apiPost(BOARD_API.comments(postId), { content })
}

// N-06 COMM-10 내 댓글 수정 — { content } → {}
export function updateComment(postId, commentId, content) {
  return apiPut(BOARD_API.comment(postId, commentId), { content })
}

// N-06 COMM-11 내 댓글 삭제 — → {}
export function deleteComment(postId, commentId) {
  return apiDelete(BOARD_API.comment(postId, commentId))
}

// N-06 COMM-09 내가 쓴 댓글 — → { items: [{ commentId, postId, categoryCode, postTitle, postNickname, content, createdAt, hidden }], page, size, totalCount }
// 최신순. 숨김 댓글은 content가, 숨김 글의 댓글은 categoryCode·postTitle·postNickname이 null이다. keyword는 댓글 내용·게시글 제목에서 찾고, category는 글 카테고리다.
export function fetchMyComments({ page = 1, keyword = '', category = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
  if (keyword.trim()) params.set('keyword', keyword.trim())
  if (category) params.set('category', category)
  return apiGet(`${BOARD_API.MY_COMMENTS}?${params}`)
}
