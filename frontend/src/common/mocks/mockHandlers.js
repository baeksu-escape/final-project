import { ApiError } from '../api/ApiError.js'
import { MOCK_USERS, toMockToken } from './mockUsers.js'

const MOCK_DELAY_MS = 200

// mock 토큰으로 사용자를 찾는다. 없거나 잘못된 토큰이면 401을 던진다.
export function requireMockUser(token) {
  const found = MOCK_USERS.find(({ user }) => toMockToken(user.userId) === token)
  if (!found) throw new ApiError(401, '로그인이 필요합니다.')
  return structuredClone(found.user)
}

// 'METHOD 경로' → 처리 함수. 처리 함수는 { body, token }을 받아 응답 본문을 돌려준다.
// TODO(D-20) 응답은 감싸지 않은 본문 그대로다.
const handlers = {
  'POST /api/auth/login': ({ body }) => {
    if (!body?.loginId || !body?.password) {
      throw new ApiError(400, '아이디와 비밀번호를 입력해 주세요.')
    }
    const found = MOCK_USERS.find((item) => item.loginId === body.loginId)
    if (!found) throw new ApiError(401, '아이디 또는 비밀번호가 올바르지 않습니다.')
    return { accessToken: toMockToken(found.user.userId), user: structuredClone(found.user) }
  },
  'GET /api/auth/me': ({ token }) => ({ user: requireMockUser(token) }),
  'POST /api/auth/logout': () => ({}),
}

// 다른 팀이 자기 폴더에서 mock 응답을 추가할 때 쓴다. 같은 키가 있으면 덮어쓴다.
// 사용 예: registerMockHandlers({ 'GET /api/report/me': ({ token }) => ({ ... }) })
export function registerMockHandlers(newHandlers) {
  Object.assign(handlers, newHandlers)
}

// client.js가 VITE_USE_MOCK일 때 fetch 대신 호출한다. 실제 서버처럼 약간 늦게 응답한다.
export async function handleMockRequest(method, path, body, token) {
  await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS))
  const pathname = path.split('?')[0]
  const handler = handlers[`${method} ${pathname}`]
  if (!handler) throw new ApiError(404, `mock 응답이 없는 요청입니다: ${method} ${pathname}`)
  return handler({ body, token })
}
