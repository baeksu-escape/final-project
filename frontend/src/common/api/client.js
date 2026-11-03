import { API_BASE_URL, USE_MOCK } from '../config/env.js'
import { tokenStorage } from '../auth/tokenStorage.js'
import { handleMockRequest } from '../mocks/mockHandlers.js'
import { ApiError } from './ApiError.js'

// 401을 받으면 이 이름의 이벤트를 보낸다. AuthProvider가 받아서 로그아웃 상태로 바꾼다.
export const UNAUTHORIZED_EVENT = 'auth:unauthorized'

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// 실제 서버로 요청을 보낸다. TODO(D-20) 공통 응답 형식이 정해지면 본문 꺼내는 방식을 여기서 맞춘다.
async function sendToServer(method, path, body, token) {
  const headers = { Accept: 'application/json' }
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
export async function apiRequest(method, path, body) {
  const token = tokenStorage.get()
  try {
    if (USE_MOCK) return await handleMockRequest(method, path, body, token)
    return await sendToServer(method, path, body, token)
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      tokenStorage.clear()
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw error
  }
}

export const apiGet = (path) => apiRequest('GET', path)
export const apiPost = (path, body) => apiRequest('POST', path, body)
export const apiPatch = (path, body) => apiRequest('PATCH', path, body)
export const apiPut = (path, body) => apiRequest('PUT', path, body)
export const apiDelete = (path) => apiRequest('DELETE', path)
