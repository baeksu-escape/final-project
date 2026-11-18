import { apiDelete, apiGet, apiPost, apiPut } from '../../../common/api/client.js'
import { PAGE_SIZE } from '../config/communityCodes.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/communityMockHandlers.js'

// N-06 신용 라운지 API 경로 — 범영님 API 정의서 v0.2 COMM-01~06과 같다.
export const BOARD_API = Object.freeze({
  POSTS: '/api/board/posts',
  post: (postId) => `/api/board/posts/${postId}`,
  comments: (postId) => `/api/board/posts/${postId}/comments`,
})

// N-06-1 글 목록·검색 — → { items: [{ postId, title, nickname, commentCount, createdAt, hidden, mine }], page, size, totalCount }
export function fetchPosts({ page = 1, keyword = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
  if (keyword.trim()) params.set('keyword', keyword.trim())
  return apiGet(`${BOARD_API.POSTS}?${params}`)
}

// N-06-1 글 상세 + 댓글 — → { postId, title, content, nickname, createdAt, updatedAt, hidden, mine, comments: [...] }
export function fetchPost(postId) {
  return apiGet(BOARD_API.post(postId))
}

// N-06-2 글쓰기 — { title, content } → { postId }
export function createPost(payload) {
  return apiPost(BOARD_API.POSTS, payload)
}

// N-06-5 내 글 수정 — { title, content } → {}
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
