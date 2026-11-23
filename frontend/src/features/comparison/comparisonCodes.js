import { JOB_TYPE_LABELS } from '../../common/config/jobTypes.js'
import { AGE_BAND_LABELS } from '../admin/adminStatsCodes.js'

// FP-253 N-13-4 비교 분석 '내 위치' 화면 코드값과 표시 함수. groupType 문자열은 서버(RPT-05)와 같다.

// 위치 막대 양 끝이 나타내는 평균과의 점수 차이. 이보다 크게 벗어나면 막대 끝에 찍고 글자로 실제 차이를 보여 준다.
export const POSITION_RANGE = 150

const GROUP_TAGS = Object.freeze({
  WORKER_TYPE: '직군 안에서',
  AGE_BAND: '연령대 안에서',
  WORKER_TYPE_AGE: '직군 + 연령대 안에서',
})

export const groupTag = (groupType) => GROUP_TAGS[groupType] ?? groupType

// 집단 이름 — 예) 자영업자, 30대, 30대 자영업자. 모르는 코드는 그대로 보여 준다.
export function groupName(groupType, workerTypeCode, ageBandCode) {
  const job = JOB_TYPE_LABELS[workerTypeCode] ?? workerTypeCode
  const age = AGE_BAND_LABELS[ageBandCode] ?? ageBandCode
  if (groupType === 'WORKER_TYPE') return job
  if (groupType === 'AGE_BAND') return age
  return `${age} ${job}`
}

// 소수 첫째 자리까지 보여 주되 .0은 뗀다. 예) 37.5 → 37.5, 690.0 → 690
export const formatNumber = (value) => String(Math.round(value * 10) / 10)

// 평균과의 차이를 글로 — 평균보다 낮아도 그대로 알린다.
export function diffText(diff) {
  if (diff === 0) return '평균과 같음'
  return `평균보다 ${formatNumber(Math.abs(diff))}점 ${diff > 0 ? '높음' : '낮음'}`
}

// 막대 위 내 위치(0~100%) — 평균이 늘 가운데(50%)이고 점수 차이만큼 옮긴다.
// 상위 %로 찍으면 점수가 몰린 집단에서 평균보다 높은데 평균 왼쪽에 찍힐 수 있어 점수 차이를 쓴다(11/23 동주).
export function positionPct(diff) {
  return Math.min(100, Math.max(0, 50 + (diff / POSITION_RANGE) * 50))
}
