import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../../common/api/client.js'
import { ALT_DATA_CONSENT_TYPE } from '../config/altDataSources.js'
// mock 모드에서 쓸 응답을 등록한다(VITE_USE_MOCK=false면 등록돼도 쓰이지 않는다).
import '../mocks/dataInputMockHandlers.js'

// N-05 API 경로. TODO(D-20) api_spec.md가 정해지면 경로와 요청·응답 필드를 맞춘다.
export const DATA_INPUT_API = Object.freeze({
  JOB_TYPE: '/api/members/me/job-type',
  FINANCIAL_INPUT: '/api/members/me/financial-input',
  SCORE_CALCULATION: '/api/members/me/score-calculation',
  altDataImport: (apiSegment) => `/api/members/me/alt-data/${apiSegment}/import`,
  // N-05-9 정보 제공 동의 — 목록 조회(GET)·동의(POST)·[연결 해제](DELETE /{consentId}).
  // 🟡 API 정의서 v0.1 제안 경로 — 확정되면 이 줄만 바꾼다.
  CONSENTS: '/api/members/me/consents',
  consent: (consentId) => `/api/members/me/consents/${consentId}`,
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

// N-05-6 대안 데이터 모의 연동 불러오기 — { baseMonth, consentId } → { source, importedAt, rows, consentId }
// 유효한 동의(consentId)가 없으면 서버가 409 { code: 'CONSENT_REQUIRED' }로 막는다(N-05-9, DDL v0.3.2 W3).
export function importAltData(source, baseMonth, consentId) {
  return apiPost(DATA_INPUT_API.altDataImport(source.apiSegment), { baseMonth, consentId })
}

// N-05-9 내 정보 제공 동의 목록 — → { items: [{ consentId, consentTypeCode, providerCode, itemCode, agreedAt, expiresAt, withdrawnAt }] }
// 🟡 응답 모양은 제안안이다. 철회한 동의도 이력으로 오므로 화면이 유효한 동의만 골라 쓴다.
export function fetchConsents() {
  return apiGet(DATA_INPUT_API.CONSENTS)
}

// N-05-9 항목 하나에 정보 제공 동의 — { consentTypeCode: 'ALT_DATA_PROVISION', providerCode, itemCode } → { consentId, agreedAt }
export function agreeConsent({ providerCode, itemCode }) {
  return apiPost(DATA_INPUT_API.CONSENTS, { consentTypeCode: ALT_DATA_CONSENT_TYPE, providerCode, itemCode })
}

// N-05-9 [연결 해제] — 동의를 거둔다. 서버는 동의 행에 철회 시각만 남기고 그 동의로 불러온 데이터를 지운다 → { consentId, withdrawnAt }
export function withdrawConsent(consentId) {
  return apiDelete(DATA_INPUT_API.consent(consentId))
}

// N-05-8 [점수 산출하기] — 저장된 입력으로 점수 산출을 요청한다 → { calculatedAt }
// TODO(D-20) B팀 점수 산출 API 명세가 나오면 이 함수의 경로와 응답을 맞춘다.
export function requestScoreCalculation() {
  return apiPost(DATA_INPUT_API.SCORE_CALCULATION)
}
