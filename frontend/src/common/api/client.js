import { API_BASE_URL, USE_MOCK } from '../config/env.js'
import { tokenStorage } from '../auth/tokenStorage.js'
import { handleMockRequest } from '../mocks/mockHandlers.js'
import { ApiError } from './ApiError.js'

// 401을 받으면 이 이름의 이벤트를 보낸다. AuthProvider가 받아서 로그아웃 상태로 바꾼다.
export const UNAUTHORIZED_EVENT = 'auth:unauthorized'

// FP-80 관리자 재확인(step-up)이 필요하다는 401 오류 코드. 로그인이 풀린 것이 아니므로 로그아웃시키지 않는다.
const STEP_UP_REQUIRED_CODE = 'STEP_UP_REQUIRED'

// 응답 본문을 JSON으로 읽는다. JSON이 아니면(빈 본문, HTML 오류 페이지 등) null을 돌려준다.
function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// 실제 서버로 요청을 보낸다. TODO(D-20) 공통 응답 형식이 정해지면 본문 꺼내는 방식을 여기서 맞춘다.
async function sendToServer(method, path, body, token, extraHeaders = {}) {
  const headers = { ...extraHeaders, Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없습니다.')
  }

  const text = await response.text()
  const data = text ? parseJson(text) : null
  if (!response.ok) {
    throw new ApiError(response.status, data?.message ?? `요청에 실패했습니다. (${response.status})`, data)
  }
  return data
}

// 공통 API 호출 — 토큰을 붙이고, VITE_USE_MOCK에 따라 mock 또는 실제 서버로 보낸다. 401이면 토큰을 지우고 로그아웃시킨다.
// 사용 예: const data = await apiGet('/api/report/me')
//   options.headers: 이 요청에만 붙일 헤더(예: FP-80 관리자 재확인 { 'X-Step-Up-Token': stepUpToken }).
//   401이라도 code가 STEP_UP_REQUIRED(재확인 필요)면 로그인은 그대로 두고 오류만 던진다.
export async function apiRequest(method, path, body, options = {}) {
  const token = tokenStorage.get()
  const headers = options.headers ?? {}
  try {
    if (USE_MOCK) return await handleMockRequest(method, path, body, token, headers)
    return await sendToServer(method, path, body, token, headers)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && error.data?.code !== STEP_UP_REQUIRED_CODE) {
      tokenStorage.clear()
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw error
  }
}

// HTTP 메서드별 줄임 함수 — apiRequest와 같고 메서드만 정해져 있다. body는 객체로 넘기면 JSON으로 보낸다.
// 사용 예: await apiPost('/api/income', { month: '2026-11', amount: 3000000 })
//   세 번째 값 options는 apiRequest와 같다(예: apiPost(경로, 본문, { headers: { 'X-Step-Up-Token': t } })).
export const apiGet = (path) => apiRequest('GET', path)
export const apiPost = (path, body, options) => apiRequest('POST', path, body, options)
export const apiPatch = (path, body, options) => apiRequest('PATCH', path, body, options)
export const apiPut = (path, body, options) => apiRequest('PUT', path, body, options)
export const apiDelete = (path) => apiRequest('DELETE', path)
