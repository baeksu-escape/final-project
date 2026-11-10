import { apiGet, apiPatch, apiPost, apiPut } from '../../../common/api/client.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/dataInputMockHandlers.js'

// N-05 API 경로. TODO(D-20) api_spec.md가 정해지면 경로와 요청·응답 필드를 맞춘다.
export const DATA_INPUT_API = Object.freeze({
  JOB_TYPE: '/api/members/me/job-type',
  FINANCIAL_INPUT: '/api/members/me/financial-input',
  SCORE_CALCULATION: '/api/members/me/score-calculation',
  altDataImport: (apiSegment) => `/api/members/me/alt-data/${apiSegment}/import`,
})

// N-05-1 직군 저장 — { jobType } → { user }
export function saveJobType(jobType) {
  return apiPatch(DATA_INPUT_API.JOB_TYPE, { jobType })
}

// N-05 저장된 입력 조회 — → { input | null, status, altData }
export function fetchFinancialInput() {
  return apiGet(DATA_INPUT_API.FINANCIAL_INPUT)
}

// N-05 입력 저장 — 요청 본문 모양은 utils/inputValues.js의 buildPayload 참고 → { savedAt, status }
export function saveFinancialInput(payload) {
  return apiPut(DATA_INPUT_API.FINANCIAL_INPUT, payload)
}

// N-05-6 대안 데이터 모의 연동 불러오기 — { baseMonth } → { source, importedAt, rows }
export function importAltData(source, baseMonth) {
  return apiPost(DATA_INPUT_API.altDataImport(source.apiSegment), { baseMonth })
}

// N-05-8 [점수 산출하기] — 저장된 입력으로 점수 산출을 요청한다 → { calculatedAt }
// TODO(D-20) B팀 점수 산출 API 명세가 나오면 이 함수의 경로와 응답을 맞춘다.
export function requestScoreCalculation() {
  return apiPost(DATA_INPUT_API.SCORE_CALCULATION)
}
