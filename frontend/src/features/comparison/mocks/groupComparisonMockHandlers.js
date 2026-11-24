// FP-164 N-26-5~7 사용자 비교 분석(ADM-04) mock — 실제 API와 같은 모양·규칙(관리자 통계 mock의 계산 함수 aggregate를 그대로 쓴다).
// 11/23 광희 결정: 격자 칸 색 진하기를 볼 수 있게 이 mock만 예시 회원을 칸마다 3~9명(약 80명)으로 따로 만든다.
// 관리자 통계 mock(14명)과 동주 님 내 위치 mock(그 14명으로 계산한 고정값)은 그대로라, mock 화면에서는 내 위치 카드 숫자와 격자 숫자가 다르다.
// 예시 점수는 화면 확인용이며 실제 저장 데이터가 아니다.
import { ApiError } from '../../../common/api/ApiError.js'
import { ROLES } from '../../../common/config/roles.js'
import { registerMockHandlers, requireMockUser } from '../../../common/mocks/mockHandlers.js'
import { GROUP_CODES, MIN_GROUP_SIZE, SAMPLE_MODEL_VERSION, aggregate } from '../../admin/mocks/adminStatsMockHandlers.js'

// 등급은 점수로 정한다(CUT-0.3 경계 654·727, 관리자 통계 mock과 같음). 기존 점수가 없으면 null
const gradeOfScore = (score) => (score === null ? null : score >= 727 ? 'GOOD' : score >= 654 ? 'STANDARD' : 'CAUTION')
// 칸 평균을 정하는 직군·연령대 가감(점)과 칸 안에서 회원마다 더할 차이 — 칸마다 진하기가 달라 보이게 한 예시값
const WORKER_TYPE_BASE = Object.freeze({ EMPLOYEE: 705, SELF_EMPLOYED: 685, FREELANCER: 675 })
const AGE_BAND_SHIFT = Object.freeze({ '20S': -15, '30S': 5, '40S': 12, '50_PLUS': -2 })
const SPREAD = Object.freeze([-45, -20, -5, 10, 30, -30, 15, 40, 5])
// 칸 인원 — 프리랜서·50대 이상은 3명으로 둬서 숨김('—')도 보이게 한다
const cellSize = (row, col) => (row === 2 && col === 3 ? 3 : 5 + ((row * 4 + col) * 3) % 5)

const member = (workerTypeCode, ageBandCode, tradScore, altScore) =>
  Object.freeze({ workerTypeCode, ageBandCode, tradScore, altScore, altGradeBandCode: gradeOfScore(altScore), tradGradeBandCode: gradeOfScore(tradScore) })

// 첫 회원이 데모 employee 계정의 내 평가다(급여소득자·30대, 기존 640 → 대안 700 — 동주 님 내 위치 mock의 700점과 같음).
const MY_MEMBER = member('EMPLOYEE', '30S', 640, 700)
const COMPARISON_MEMBERS = Object.freeze([
  MY_MEMBER,
  ...GROUP_CODES.WORKER_TYPE.flatMap((workerTypeCode, row) =>
    GROUP_CODES.AGE_BAND.flatMap((ageBandCode, col) =>
      Array.from({ length: cellSize(row, col) - (workerTypeCode === 'EMPLOYEE' && ageBandCode === '30S' ? 1 : 0) }, (_, k) => {
        const altScore = WORKER_TYPE_BASE[workerTypeCode] + AGE_BAND_SHIFT[ageBandCode] + SPREAD[(k + row + col) % SPREAD.length]
        // 10명 중 1명꼴로 기존 모델로 산출하지 못한 회원(기존 점수 null)
        const tradScore = (k + row * 4 + col) % 10 === 9 ? null : altScore - (40 + ((k * 7 + row * 5 + col * 3) % 35))
        return member(workerTypeCode, ageBandCode, tradScore, altScore)
      }),
    ),
  ),
])

// 데모 계정 중 점수가 있는 employee만 내 평가가 있다.
const MY_SAMPLE = Object.freeze({ 'u-employee': MY_MEMBER })

const group = (groupCode, members) => ({ groupCode, memberCount: members.length, ...aggregate(members) })

function handleGroupComparison({ token }) {
  const user = requireMockUser(token) // 실제 API처럼 비로그인 401
  if (user.role === ROLES.ADMIN) throw new ApiError(403, '일반 회원만 볼 수 있습니다.') // 실제 API: /api/members/me/** = ROLE_USER
  const members = COMPARISON_MEMBERS
  const mine = MY_SAMPLE[user.userId]
  return {
    modelVersion: SAMPLE_MODEL_VERSION,
    minGroupSize: MIN_GROUP_SIZE,
    me: mine
      ? {
          workerTypeCode: mine.workerTypeCode,
          ageBandCode: mine.ageBandCode,
          tradScore: mine.tradScore,
          altScore: mine.altScore,
          tradGradeBandCode: mine.tradGradeBandCode,
          altGradeBandCode: mine.altGradeBandCode,
        }
      : null,
    overall: group('ALL', members),
    byWorkerType: GROUP_CODES.WORKER_TYPE.map((code) => group(code, members.filter((m) => m.workerTypeCode === code))),
    byAgeBand: GROUP_CODES.AGE_BAND.map((code) => group(code, members.filter((m) => m.ageBandCode === code))),
    grid: GROUP_CODES.WORKER_TYPE.flatMap((workerTypeCode) =>
      GROUP_CODES.AGE_BAND.map((ageBandCode) => ({
        workerTypeCode,
        ageBandCode,
        stats: group(
          `${workerTypeCode}:${ageBandCode}`,
          members.filter((m) => m.workerTypeCode === workerTypeCode && m.ageBandCode === ageBandCode),
        ),
      })),
    ),
  }
}

registerMockHandlers({
  'GET /api/members/me/group-comparison': handleGroupComparison,
})
