// N-30-1 용어 사전 mock 핸들러 — 응답 모양은 실제 HELP-01(GET /api/glossary)과 같고, 용어는 시드 SQL(seed_glossary_term.sql)에서 몇 개만 옮겼다.
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'

// 시드와 같은 문구 일부 (용어 이름 순서)
const SAMPLE_GLOSSARY_TERMS = Object.freeze([
  {
    term: 'DSR',
    easyText: '1년 소득 중 빚 갚는 데 쓰는 돈의 비율',
    explanation:
      '총부채원리금상환비율의 줄임말입니다. 1년 동안 갚는 모든 대출의 원금과 이자를 1년 소득으로 나눈 값으로, 높을수록 소득에 비해 빚 갚는 부담이 큽니다.',
  },
  {
    term: 'SHAP 영향도',
    easyText: '각 항목이 점수를 얼마나 올리거나 내렸는지 나눠 본 값',
    explanation:
      '모델이 점수를 계산할 때 항목마다 점수가 기준점보다 얼마나 올라가거나 내려갔는지를 나눠 보여 줍니다. 모든 항목의 값을 기준점에 더하면 내 점수가 됩니다. 점수에 어떻게 반영됐는지를 보여 줄 뿐, 그 항목이 원인이라는 뜻은 아닙니다.',
  },
  {
    term: '대안 신용 점수',
    easyText: '통신비·공과금 납부처럼 금융 거래 밖의 기록까지 함께 본 점수',
    explanation:
      '대출·카드 이력만으로는 판단하기 어려운 사람을 위해, 통신비·공과금 제때 납부, 간편결제 이용 같은 생활 기록을 더해 계산한 0~1000점 점수입니다. 이 서비스의 점수는 합성 데이터로 만든 교육용 예시이며 실제 신용평가 결과가 아닙니다.',
  },
  {
    term: '변동계수',
    easyText: '달마다 소득이 얼마나 들쭉날쭉한지 나타낸 값',
    explanation: '월 소득의 표준편차를 평균 소득으로 나눈 값입니다. 클수록 달마다 버는 돈의 차이가 크다는 뜻입니다.',
  },
  {
    term: '원리금',
    easyText: '갚아야 하는 원금과 이자를 합친 돈',
    explanation: '빌린 돈(원금)과 그 돈을 빌린 대가(이자)를 합친 금액입니다. 보통 매달 정해진 원리금을 갚습니다.',
  },
])

// N-30-1 HELP-01 mock — 실제 API처럼 로그인하지 않았으면 401이다.
function handleGlossary({ token }) {
  requireMockUser(token)
  return { terms: SAMPLE_GLOSSARY_TERMS.map((item) => ({ ...item })) }
}

registerMockHandlers({
  'GET /api/glossary': handleGlossary,
})
