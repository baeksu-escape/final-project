import { ApiError } from '../../../common/api/ApiError.js'
import { getGradeByScore } from '../../../common/config/grades.js'
import { JOB_TYPES } from '../../../common/config/jobTypes.js'
import { GRADE_STATUS } from '../../../common/config/scoreStatus.js'
import { ROLES } from '../../../common/config/roles.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { patchMockAccountUser } from '../../auth/mocks/authMockHandlers.js'
import { ALT_DATA_CONSENT_TYPE, ALT_DATA_SOURCES } from '../config/altDataSources.js'
import { isInputComplete } from '../config/completionItems.js'
import { BASE_MONTH_FIELD, getSectionsForJob } from '../config/inputSections.js'
import { getSectionStatus, toValues } from '../utils/inputValues.js'
import { validateFinancialInput } from '../validation/inputValidation.js'
import { INPUT_ERROR_CODE, SCORE_ERROR_CODES, toServerFieldErrors } from '../validation/serverErrors.js'
import { createAltDataRows } from './altDataMock.js'
import { mockScoreSettings } from './scoreMockData.js'
import {
  createConsent,
  findActiveConsent,
  findConsentById,
  getImportedAltData,
  isActiveConsent,
  listConsents,
  saveImportedAltData,
  withdrawConsentOf,
} from './altDataMockStore.js'

// 사용자별 저장값 — 메모리에만 있어 새로고침하면 사라진다. 동의·불러온 대안 데이터는 altDataMockStore.js에 있다.
const savedInputs = new Map() // userId → 가장 최근에 저장한 요청 본문(+savedAt)
const savedByMonth = new Map() // userId → { 기준월: 요청 본문(+savedAt) } (D-16 기준월별 저장)

// N-05-9 유효한 동의 없이 불러오려 할 때 쓰는 오류 코드(DDL v0.3.2 W3: 불러온 행은 동의 ID가 꼭 있어야 한다).
const CONSENT_REQUIRED_CODE = 'CONSENT_REQUIRED'

// N-05-8 점수 산출 결과 — requestId → { userId, response }. 같은 회원이 같은 requestId를 다시 보내면 처음 결과를 그대로 돌려준다.
const scoreResults = new Map()
// requestId는 소문자 UUID다(B팀 명세서 v0.2 3-1).
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
// 'NETWORK_ERROR_ONCE' 시나리오에서 연결 실패를 이미 한 번 냈는지.
let networkErrorShown = false

// 문자열로 정해지는 min~max 정수 — 같은 요청이면 같은 mock 점수가 나온다. 실제 점수 계산이 아니다.
function mockScore(seedText, min, max) {
  let hash = 0
  for (const char of seedText) hash = (hash * 31 + char.charCodeAt(0)) % 100003
  return min + (hash % (max - min + 1))
}

// N-05-8 점수 산출 mock 응답을 만든다. 점수는 0~1000 정수, 등급은 공통 경계(getGradeByScore)로 정한다. 실제로는 점수 서버가 정해 보낸다.
// 산출 불가 시나리오면 NOT_SCORABLE과 사유 코드를 보내고 점수·등급은 비운다.
function buildScoreResponse(user, requestId) {
  const base = { calculatedAt: new Date().toISOString(), requestId }
  if (mockScoreSettings.scenario !== 'SCORED' && mockScoreSettings.scenario !== 'NETWORK_ERROR_ONCE') {
    return {
      ...base,
      gradeStatusCode: GRADE_STATUS.NOT_SCORABLE,
      notScorableReasonCode: mockScoreSettings.scenario,
      alternative: { score: null, gradeBandCode: null },
      traditional: { scorableYn: 'N', score: null, gradeBandCode: null },
    }
  }
  const alternativeScore = mockScore(`alt:${user.userId}:${requestId}`, 600, 880)
  const traditionalScore = mockScore(`trad:${user.userId}:${requestId}`, 560, 820)
  return {
    ...base,
    gradeStatusCode: GRADE_STATUS.SCORED,
    notScorableReasonCode: null,
    alternative: { score: alternativeScore, gradeBandCode: getGradeByScore(alternativeScore) },
    traditional: { scorableYn: 'Y', score: traditionalScore, gradeBandCode: getGradeByScore(traditionalScore) },
  }
}

// 대안 데이터 5종 모두 유효한 동의가 있는지 본다(11/12 팀 합의 — 하나라도 없으면 점수를 산출하지 않는다).
function hasAllAltDataConsents(user) {
  return ALT_DATA_SOURCES.every((source) => findActiveConsent(user.userId, source.consent))
}

// 사용자의 입력 완료 현황 — { sections: { 섹션 key: 입력 여부 }, altData: { 대안 데이터 key: 불러옴 여부 } }
function statusOf(user) {
  const input = savedInputs.get(user.userId) ?? null
  const altData = getImportedAltData(user.userId)
  return {
    sections: getSectionStatus(input, getSectionsForJob(user.jobType)),
    altData: Object.fromEntries(ALT_DATA_SOURCES.map((source) => [source.key, Boolean(altData[source.key])])),
  }
}

// D-16 이 사용자가 저장한 적 있는 기준월 목록(오래된 달부터).
function savedBaseMonthsOf(user) {
  return Object.keys(savedByMonth.get(user.userId) ?? {}).sort()
}

// FP-86 입력값 오류 응답(400)을 만든다. 칸별 오류는 data.fieldErrors에 담는다(형식은 validation/serverErrors.js 참고).
function invalidInputError(fieldErrors) {
  const message = '입력값을 확인해 주세요.'
  return new ApiError(400, message, { code: INPUT_ERROR_CODE, message, fieldErrors })
}

// 직군을 고른 일반 사용자인지 확인한다.
function requireUserWithJob(token) {
  const user = patchMockAccountUser(token)
  if (user.role !== ROLES.USER) throw new ApiError(403, '일반 사용자만 입력할 수 있습니다.')
  if (!user.jobType) throw new ApiError(409, '직군을 먼저 선택해 주세요.', { code: SCORE_ERROR_CODES.JOB_TYPE_REQUIRED })
  return user
}

// 대안 데이터 불러오기 처리 함수를 종류별로 만든다.
// N-05-9: 요청의 consentId가 그 회원의, 같은 제공 기관·항목의 유효한 동의여야 불러온다. 아니면 409 CONSENT_REQUIRED로 막는다.
const altDataHandlers = Object.fromEntries(
  ALT_DATA_SOURCES.map((source) => [
    `POST /api/members/me/alt-data/${source.apiSegment}/import`,
    ({ body, token }) => {
      const user = requireUserWithJob(token)
      if (!body?.baseMonth) throw new ApiError(400, '기준월을 먼저 입력해 주세요.')
      const consent = findConsentById(user.userId, body.consentId)
      const consentMatches =
        consent &&
        isActiveConsent(consent) &&
        consent.providerCode === source.consent.providerCode &&
        consent.itemCode === source.consent.itemCode
      if (!consentMatches) {
        throw new ApiError(409, '정보 제공 동의를 먼저 해 주세요.', { code: CONSENT_REQUIRED_CODE })
      }
      const result = {
        importedAt: new Date().toISOString(),
        rows: createAltDataRows(source.key, user.userId, body.baseMonth, user.jobType),
        consentId: consent.consentId,
      }
      saveImportedAltData(user.userId, source.key, result)
      return { source: source.key, ...structuredClone(result) }
    },
  ]),
)

// N-05-9 [연결 해제] 처리 함수를 동의 번호마다 등록한다.
// mock 라우터(common/mocks/mockHandlers.js)는 'METHOD 경로'가 정확히 같을 때만 찾고 경로 변수({consentId})를 지원하지 않는다.
// 공통 파일을 고치지 않으려고, 동의를 만들 때 그 번호의 DELETE 경로를 하나씩 등록한다.
function registerConsentDeleteHandler(consentId) {
  registerMockHandlers({
    [`DELETE /api/members/me/consents/${consentId}`]: ({ token }) => {
      const user = requireUserWithJob(token)
      const consent = findConsentById(user.userId, consentId)
      if (!consent) throw new ApiError(404, '동의 내역을 찾을 수 없습니다.')
      if (consent.withdrawnAt === null) withdrawConsentOf(user.userId, consent)
      return { consentId, withdrawnAt: consent.withdrawnAt }
    },
  })
}

registerMockHandlers({
  // N-05-1 직군 저장 — 직군이 없는 일반 사용자만 저장할 수 있다. 직군 변경은 팀 결정 전이라 막는다.
  'PATCH /api/members/me/job-type': ({ body, token }) => {
    const user = patchMockAccountUser(token)
    if (user.role !== ROLES.USER) throw new ApiError(403, '일반 사용자만 직군을 선택할 수 있습니다.')
    if (!Object.values(JOB_TYPES).includes(body?.jobType)) throw new ApiError(400, '직군을 선택해 주세요.')
    if (user.jobType) throw new ApiError(409, '이미 직군이 선택되어 있습니다.')
    return { user: patchMockAccountUser(token, { jobType: body.jobType }) }
  },

  // N-05 저장된 입력·완료 현황·불러온 대안 데이터 조회.
  'GET /api/members/me/financial-input': ({ token }) => {
    const user = requireUserWithJob(token)
    return {
      input: structuredClone(savedInputs.get(user.userId) ?? null),
      status: statusOf(user),
      altData: structuredClone(getImportedAltData(user.userId)),
      savedBaseMonths: savedBaseMonthsOf(user),
    }
  },

  // N-05-9 내 정보 제공 동의 목록 — 철회한 동의도 이력으로 함께 보낸다(화면이 유효한 동의만 골라 쓴다).
  'GET /api/members/me/consents': ({ token }) => {
    const user = requireUserWithJob(token)
    return { items: structuredClone(listConsents(user.userId)) }
  },

  // N-05-9 항목 하나에 동의 — 대안 데이터 5종의 제공 기관·항목만 받는다. 같은 항목에 이미 유효한 동의가 있으면 그 동의를 돌려준다.
  'POST /api/members/me/consents': ({ body, token }) => {
    const user = requireUserWithJob(token)
    if (body?.consentTypeCode !== ALT_DATA_CONSENT_TYPE) throw new ApiError(400, '동의 종류를 확인해 주세요.')
    const source = ALT_DATA_SOURCES.find(
      (item) => item.consent.providerCode === body.providerCode && item.consent.itemCode === body.itemCode,
    )
    if (!source) throw new ApiError(400, '제공 기관과 항목을 확인해 주세요.')
    const consent = findActiveConsent(user.userId, source.consent) ?? createConsent(user.userId, source.consent)
    registerConsentDeleteHandler(consent.consentId)
    return { consentId: consent.consentId, agreedAt: consent.agreedAt }
  },

  // N-05 입력 저장 — 기준월과 직군을 확인하고 기준월별로 저장한다. 같은 기준월이면 덮어쓴다(D-16).
  // FP-86: 서버처럼 화면과 같은 규칙으로 다시 검사하고, 오류가 있으면 400과 칸별 오류(fieldErrors)를 돌려준다.
  'PUT /api/members/me/financial-input': ({ body, token }) => {
    const user = requireUserWithJob(token)
    if (!body?.baseMonth) {
      throw invalidInputError([{ field: BASE_MONTH_FIELD.key, message: '기준월을 입력해 주세요.' }])
    }
    if (body.jobType !== user.jobType) throw new ApiError(400, '직군 정보가 맞지 않습니다.')
    const sections = getSectionsForJob(user.jobType)
    const values = toValues(body, sections)
    const errors = validateFinancialInput(values, sections)
    if (Object.keys(errors).length > 0) throw invalidInputError(toServerFieldErrors(errors, values))
    const savedAt = new Date().toISOString()
    const saved = { ...structuredClone(body), savedAt }
    savedInputs.set(user.userId, saved)
    savedByMonth.set(user.userId, { ...savedByMonth.get(user.userId), [body.baseMonth]: saved })
    return { savedAt, status: statusOf(user), savedBaseMonths: savedBaseMonthsOf(user) }
  },

  // N-05-8 점수 산출(B팀 명세서 v0.2 3-1 RPT-01) — 실제 계산 없이 mock 점수를 돌려준다. SCORED면 '점수 있음'으로 바꾼다(N-01-2).
  // - requestId가 없거나 소문자 UUID가 아니면 400
  // - 같은 회원의 같은 requestId면 처음 결과를 그대로, 다른 회원이 쓴 requestId면 409 REQUEST_ID_CONFLICT
  // - 완료 현황 6개가 덜 찼거나 대안 데이터 5종 중 유효한 동의가 빠졌으면 409 INPUT_INCOMPLETE(팀 결정: 입력이 덜 차면 서버가 409로 막는다)
  'POST /api/members/me/score-calculation': ({ body, token }) => {
    const user = requireUserWithJob(token)
    const requestId = body?.requestId
    if (!REQUEST_ID_PATTERN.test(requestId ?? '')) throw new ApiError(400, '요청 번호(requestId)가 올바르지 않습니다.')
    const previous = scoreResults.get(requestId)
    if (previous) {
      if (previous.userId !== user.userId) {
        throw new ApiError(409, '이미 쓰인 요청 번호입니다.', { code: SCORE_ERROR_CODES.REQUEST_ID_CONFLICT })
      }
      return structuredClone(previous.response)
    }
    if (mockScoreSettings.scenario === 'NETWORK_ERROR_ONCE' && !networkErrorShown) {
      networkErrorShown = true
      throw new ApiError(0, '서버에 연결할 수 없습니다.')
    }
    if (!isInputComplete(statusOf(user)) || !hasAllAltDataConsents(user)) {
      throw new ApiError(409, '입력 완료 현황 6개 항목을 모두 채워 주세요.', { code: SCORE_ERROR_CODES.INPUT_INCOMPLETE })
    }
    const response = buildScoreResponse(user, requestId)
    scoreResults.set(requestId, { userId: user.userId, response })
    if (response.gradeStatusCode === GRADE_STATUS.SCORED) patchMockAccountUser(token, { hasScore: true })
    return structuredClone(response)
  },

  ...altDataHandlers,
})
