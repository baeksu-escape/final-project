import { ApiError } from '../../../common/api/ApiError.js'

// FP-258 13차 N-01-3·N-02-1·N-02-3 서버의 반복 시도 제한(ClientRateLimiter)과 하루 인증코드 발송 상한(AuthErrors.DAILY_CODE_SEND_LIMIT)을 mock에서 흉내 낸다.
// mock에는 접속 IP가 없어 브라우저 탭 하나를 한 접속지로 보고, 새로고침하면 초기화된다. 숫자·문구는 서버와 같다.
export const MOCK_RATE_RULES = Object.freeze({
  LOGIN_FAILURE: { limit: 20, windowMs: 10 * 60 * 1000, message: '로그인 시도가 너무 많습니다.' },
  AVAILABILITY_CHECK: { limit: 30, windowMs: 60 * 1000, message: '확인 요청이 너무 많습니다.' },
  CODE_SEND: { limit: 20, windowMs: 60 * 60 * 1000, message: '인증코드 요청이 너무 많습니다.' },
})
export const MOCK_DAILY_CODE_SEND_LIMIT = 10

// 규칙 이름 → { start, count }. 확인용으로 내보낸다(헤드리스 확인에서 횟수를 채울 때 쓴다).
export const mockRateWindows = new Map()
// '채널:대상' → { day: 'YYYY-MM-DD', count }
export const mockDailySends = new Map()

function tooMany(rule, window) {
  const minutes = Math.max(1, Math.ceil((window.start + rule.windowMs - Date.now()) / 60000))
  return new ApiError(429, `${rule.message} ${minutes}분 뒤에 다시 시도해 주세요.`, { code: 'TOO_MANY_REQUESTS' })
}

function currentWindow(ruleName) {
  const rule = MOCK_RATE_RULES[ruleName]
  const window = mockRateWindows.get(ruleName)
  return window && Date.now() < window.start + rule.windowMs ? window : null
}

function addRate(ruleName) {
  const window = currentWindow(ruleName) ?? { start: Date.now(), count: 0 }
  window.count += 1
  mockRateWindows.set(ruleName, window)
  return window
}

// 한 번 세고 limit을 넘으면 429(닉네임·아이디 확인, 인증코드 발송).
export function hitMockRate(ruleName) {
  const window = addRate(ruleName)
  if (window.count > MOCK_RATE_RULES[ruleName].limit) throw tooMany(MOCK_RATE_RULES[ruleName], window)
}

// 로그인·간편 로그인 연결 — 이미 limit에 닿았으면 요청 전에 429, 401로 끝나면 한 번 센다.
export function countMockFailures(action) {
  const window = currentWindow('LOGIN_FAILURE')
  if (window && window.count >= MOCK_RATE_RULES.LOGIN_FAILURE.limit) throw tooMany(MOCK_RATE_RULES.LOGIN_FAILURE, window)
  try {
    return action()
  } catch (error) {
    if (error?.status === 401) addRate('LOGIN_FAILURE')
    throw error
  }
}

// 같은 이메일·휴대폰으로 오늘 보낸 횟수가 상한이면 429, 아니면 한 번 센다. label은 "이메일" 또는 "번호".
export function countMockDailySend(channel, target, label) {
  const day = new Date().toLocaleDateString('sv-SE')
  const key = `${channel}:${target}`
  const saved = mockDailySends.get(key)
  const count = saved?.day === day ? saved.count : 0
  if (count >= MOCK_DAILY_CODE_SEND_LIMIT) {
    throw new ApiError(429, `오늘 이 ${label}로 받을 수 있는 인증코드 ${MOCK_DAILY_CODE_SEND_LIMIT}회를 모두 받았습니다. 내일 다시 시도해 주세요.`, {
      code: 'CODE_SEND_DAILY_LIMIT',
    })
  }
  mockDailySends.set(key, { day, count: count + 1 })
}
