// N-32 용어 도우미 mock 핸들러 — 응답 모양은 실제 HELP-02(GET /api/chatbot/presets)·HELP-03(POST /api/chatbot/questions)과 같고,
// 질문 버튼 문구는 시드 SQL(add_chatbot_preset_question.sql)과 같다.
import { ApiError } from '../../../common/api/ApiError.js'
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'

// 시드와 같은 질문 버튼 4개 (표시 순서대로)
const SAMPLE_CHATBOT_PRESETS = Object.freeze([
  {
    presetId: 1,
    question: '대안 신용 점수는 기존 신용 점수와 무엇이 다른가요?',
    answer:
      '기존 신용 점수는 소득·지출·상환 금액, 직군·나이, 대출·카드 이력처럼 기존 신용평가에서 주로 쓰는 항목으로 계산합니다. 대안 신용 점수는 여기에 통신비·공과금 납부, 간편결제 이용, 국민연금·건강보험 납부 기록을 더해 계산합니다. 그래서 금융 거래 기록이 적은 사회초년생이나 프리랜서도 성실한 생활 기록이 점수에 반영될 수 있습니다. 두 점수는 신용 리포트에서 나란히 비교할 수 있고, 대안 점수가 더 낮게 나오는 경우도 그대로 보여 줍니다. 이 서비스의 점수는 합성 데이터로 만든 교육용 예시이며 실제 신용평가 결과가 아닙니다.',
  },
  {
    presetId: 2,
    question: '점수 영향도(SHAP)는 어떻게 읽나요?',
    answer:
      '점수 영향도는 모델이 내 점수를 계산할 때 항목마다 점수가 기준점보다 얼마나 올라가거나 내려갔는지를 나눠 보여 주는 값입니다. 플러스(+)는 점수를 올린 쪽, 마이너스(-)는 내린 쪽으로 반영됐다는 뜻이고, 모든 항목의 값을 기준점에 더하면 내 점수가 됩니다. 다만 이 값은 점수에 어떻게 반영됐는지를 보여 줄 뿐, 그 항목 때문에 점수가 정해졌다는 원인·결과를 뜻하지는 않습니다. 값을 바꿨을 때 점수가 어떻게 달라지는지는 신용케어 시뮬레이터에서 따로 확인해 보세요.',
  },
  {
    presetId: 3,
    question: 'DSR(상환 부담률)이 높으면 어떤 뜻인가요?',
    answer:
      'DSR은 1년 동안 갚는 모든 대출의 원금과 이자를 1년 소득으로 나눈 비율입니다. 예를 들어 1년 소득이 4,000만 원이고 1년에 갚는 원리금이 1,200만 원이면 DSR은 30%입니다. 이 비율이 높을수록 버는 돈에 비해 빚 갚는 데 쓰는 돈이 많아, 갑자기 소득이 줄거나 지출이 늘었을 때 버티기 어려워집니다. 자산·부채 건전성 화면에서 내 비율과 위험 단계(서비스가 정한 예시 기준)를 볼 수 있습니다.',
  },
  {
    presetId: 4,
    question: '시뮬레이터 결과와 참고 금리·한도는 실제 대출 심사 결과인가요?',
    answer:
      '아니요. 신용케어 시뮬레이터는 입력값을 바꿨을 때 모델이 계산한 예상 점수를 보여 줄 뿐 저장되지 않고, 실제 점수가 바뀌지도 않습니다. 함께 보이는 금리·한도도 실제 금융회사의 심사 결과가 아니라, 서비스 시연용으로 만든 예시 데이터에서 같은 점수대에 해당하는 값을 보여 주는 참고 정보입니다. 실제 대출 가능 여부와 조건은 금융회사의 심사를 따릅니다.',
  },
])

// N-32-2 하루 자유 질문 횟수(APP_SETTING CHATBOT_DAILY_LIMIT 기본값). mock은 새로고침하면 다시 10회가 된다.
const MOCK_DAILY_LIMIT = 10
// 회원 번호 → 오늘 쓴 질문 수. 실제 서버처럼 회원마다 따로 센다(다른 회원으로 로그인하면 10회부터 다시).
const mockUsedCounts = new Map()
const usedCountOf = (userId) => mockUsedCounts.get(userId) ?? 0

// N-32-1 HELP-02 mock — 실제 API처럼 로그인하지 않았으면 401이다. 버튼을 눌러도 횟수는 줄지 않고, 그 회원의 남은 자유 질문 횟수를 함께 준다.
function handleChatbotPresets({ token }) {
  const { userId } = requireMockUser(token)
  return {
    presets: SAMPLE_CHATBOT_PRESETS.map((item) => ({ ...item })),
    remainingCount: Math.max(0, MOCK_DAILY_LIMIT - usedCountOf(userId)),
    dailyLimit: MOCK_DAILY_LIMIT,
  }
}

// N-32-2 HELP-03 mock — 실제 API와 같은 입력 검사·하루 횟수(429)를 흉내 낸다. 답은 AI가 아니라 고정 예시 문장이다.
function handleChatbotQuestion({ body, token }) {
  const { userId } = requireMockUser(token)
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  if (!question || question.length > 200) {
    const message = question ? '질문은 200자까지 쓸 수 있습니다.' : '질문을 입력해 주세요.'
    throw new ApiError(400, message, { code: 'INVALID_INPUT', message, fieldErrors: [{ field: 'question', message }] })
  }
  const used = usedCountOf(userId)
  if (used >= MOCK_DAILY_LIMIT) {
    const message = `자유 질문은 하루 ${MOCK_DAILY_LIMIT}번까지 할 수 있습니다. 내일 다시 이용해 주세요.`
    throw new ApiError(429, message, { code: 'DAILY_LIMIT_EXCEEDED', message, fieldErrors: [] })
  }
  mockUsedCounts.set(userId, used + 1)
  return {
    answer: `(예시 답) "${question}"에 대한 설명입니다. 실제 서버에서는 AI가 쉬운 말로 3~5문장 안에서 답합니다. 이 답은 교육용 예시이며 개인 재무 상담이 아닙니다.`,
    remainingCount: MOCK_DAILY_LIMIT - (used + 1),
    dailyLimit: MOCK_DAILY_LIMIT,
  }
}

registerMockHandlers({
  'GET /api/chatbot/presets': handleChatbotPresets,
  'POST /api/chatbot/questions': handleChatbotQuestion,
})
