import { ApiError } from '../../../common/api/ApiError.js'
import { JOB_TYPES } from '../../../common/config/jobTypes.js'
import { ROLES } from '../../../common/config/roles.js'
import { registerMockHandlers } from '../../../common/mocks/mockHandlers.js'
import { patchMockAccountUser } from '../../auth/mocks/authMockHandlers.js'
import { ALT_DATA_SOURCES } from '../config/altDataSources.js'
import { getSectionsForJob } from '../config/inputSections.js'
import { getSectionStatus } from '../utils/inputValues.js'
import { createAltDataRows } from './altDataMock.js'

// 사용자별 저장값 — 메모리에만 있어 새로고침하면 사라진다.
const savedInputs = new Map() // userId → 요청 본문(+savedAt)
const importedAltData = new Map() // userId → { [대안 데이터 key]: { importedAt, rows } }

// 사용자의 입력 완료 현황 — { sections: { 섹션 key: 입력 여부 }, altData: { 대안 데이터 key: 불러옴 여부 } }
function statusOf(user) {
  const input = savedInputs.get(user.userId) ?? null
  const altData = importedAltData.get(user.userId) ?? {}
  return {
    sections: getSectionStatus(input, getSectionsForJob(user.jobType)),
    altData: Object.fromEntries(ALT_DATA_SOURCES.map((source) => [source.key, Boolean(altData[source.key])])),
  }
}

// 직군을 고른 일반 사용자인지 확인한다.
function requireUserWithJob(token) {
  const user = patchMockAccountUser(token)
  if (user.role !== ROLES.USER) throw new ApiError(403, '일반 사용자만 입력할 수 있습니다.')
  if (!user.jobType) throw new ApiError(409, '직군을 먼저 선택해 주세요.')
  return user
}

// 대안 데이터 불러오기 처리 함수를 종류별로 만든다.
const altDataHandlers = Object.fromEntries(
  ALT_DATA_SOURCES.map((source) => [
    `POST /api/members/me/alt-data/${source.apiSegment}/import`,
    ({ body, token }) => {
      const user = requireUserWithJob(token)
      if (!body?.baseMonth) throw new ApiError(400, '기준월을 먼저 입력해 주세요.')
      const result = { importedAt: new Date().toISOString(), rows: createAltDataRows(source.key, user.userId, body.baseMonth) }
      importedAltData.set(user.userId, { ...importedAltData.get(user.userId), [source.key]: result })
      return { source: source.key, ...structuredClone(result) }
    },
  ]),
)

registerMockHandlers({
  // N-08 직군 저장 — 직군이 없는 일반 사용자만 저장할 수 있다. 직군 변경은 팀 결정 전이라 막는다.
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
      altData: structuredClone(importedAltData.get(user.userId) ?? {}),
    }
  },

  // N-05 입력 저장 — 기준월과 직군을 확인하고 덮어쓴다.
  'PUT /api/members/me/financial-input': ({ body, token }) => {
    const user = requireUserWithJob(token)
    if (!body?.baseMonth) throw new ApiError(400, '기준월을 입력해 주세요.')
    if (body.jobType !== user.jobType) throw new ApiError(400, '직군 정보가 맞지 않습니다.')
    const savedAt = new Date().toISOString()
    savedInputs.set(user.userId, { ...structuredClone(body), savedAt })
    return { savedAt, status: statusOf(user) }
  },

  ...altDataHandlers,
})
