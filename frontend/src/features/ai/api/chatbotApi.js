import { apiGet } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다 (VITE_USE_MOCK=false면 등록돼도 무시됨)
import '../mocks/chatbotMockHandlers.js'

// N-32 용어 도우미(챗봇) API 경로 정의. 자유 질문(HELP-03, N-32-2)은 FP-181 2부에서 추가한다.
export const CHATBOT_API = Object.freeze({
  PRESETS: '/api/chatbot/presets',
})

// N-32-1 HELP-02 질문 버튼 4개와 등록된 답을 표시 순서대로 가져온다. 버튼을 눌러도 질문 횟수는 줄지 않는다. 로그인해야 부를 수 있다.
// 응답: { presets: [{ presetId: 1, question: '…', answer: '…' }] } — 등록된 버튼이 없으면 presets가 []다.
// 한 번 받아 두고 버튼을 누를 때는 받아 둔 answer를 보여 주면 된다.
export function getChatbotPresets() {
  return apiGet(CHATBOT_API.PRESETS)
}
