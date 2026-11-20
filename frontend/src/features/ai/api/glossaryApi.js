import { apiGet } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 자동 등록한다 (VITE_USE_MOCK=false면 등록돼도 무시됨)
import '../mocks/glossaryMockHandlers.js'

// N-30 쉬운 금융사전 API 경로 정의
export const GLOSSARY_API = Object.freeze({
  LIST: '/api/glossary',
})

// N-30-1 HELP-01 용어 사전 전체를 용어 이름 순서로 가져온다. 툴팁(N-30-2)·챗봇(N-32)이 쓴다. 로그인해야 부를 수 있다.
// 응답: { terms: [{ term: 'DSR', easyText: '1년 소득 중 빚 갚는 데 쓰는 돈의 비율', explanation: '…' | null }] }
// 사전이 비어 있으면 terms가 []다. 사전에 없는 말은 원래 말 그대로 보여 주면 된다.
export function getGlossary() {
  return apiGet(GLOSSARY_API.LIST)
}
