import { apiGet, apiPost } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다 (VITE_USE_MOCK=false면 등록돼도 무시됨)
import '../mocks/chatbotMockHandlers.js'

// N-32 용어 도우미(챗봇) API 경로 정의 (FP-181)
export const CHATBOT_API = Object.freeze({
  PRESETS: '/api/chatbot/presets',
  QUESTIONS: '/api/chatbot/questions',
})

// N-32-1 HELP-02 질문 버튼 4개와 등록된 답을 표시 순서대로 가져온다. 버튼을 눌러도 질문 횟수는 줄지 않는다. 로그인해야 부를 수 있다.
// 응답: { presets: [{ presetId: 1, question: '…', answer: '…' }], remainingCount: 10, dailyLimit: 10 }
// — 등록된 버튼이 없으면 presets가 []다. remainingCount는 오늘 남은 자유 질문 횟수(N-32-2)다.
// 한 번 받아 두고 버튼을 누를 때는 받아 둔 answer를 보여 주면 된다.
export function getChatbotPresets() {
  return apiGet(CHATBOT_API.PRESETS)
}

// N-32-2 HELP-03 직접 쓴 질문(1~200자)에 AI가 답한다. 질문 글만 AI로 가고 저장하지 않는다. 성공했을 때만 하루 횟수(10회)에서 뺀다.
// 응답: { answer: '…', remainingCount: 9, dailyLimit: 10 }
// 오류: 400 INVALID_INPUT(빈 글·200자 초과), 429 DAILY_LIMIT_EXCEEDED(오늘 횟수 다 씀), 502 AI_FAILED(잠시 후 다시), 503 AI_UNAVAILABLE(서버에 AI 키 없음)
export function askChatbotQuestion(question) {
  return apiPost(CHATBOT_API.QUESTIONS, { question })
}
