// v3 삭제(N-08-3, 11/06) — 연결하지 않음. 팀 확인 후 지운다. 사용자 메뉴는 직군과 상관없이 같다(N-08-1, config/navigation.js).
import { JOB_TYPES } from './jobTypes.js'

// N-08 직군별 재무 진단 서브탭 — 다른 팀도 서브탭 노출 여부는 이 파일의 함수로만 판단한다.
export const DIAGNOSIS_SUB_TABS = Object.freeze([
  { key: 'asset-debt', label: '자산·부채 건전성', nId: 'N-16' },
  { key: 'income-volatility', label: '소득 변동성', nId: 'N-22' },
  { key: 'cash-flow', label: '현금흐름', nId: 'N-21' },
  { key: 'market', label: '상권 지표', nId: 'N-24' },
])

// 직군별로 숨길 서브탭 key 목록. 급여소득자는 현금흐름, 프리랜서는 상권 지표를 숨기고 자영업자는 모두 보인다.
export const HIDDEN_SUB_TABS_BY_JOB = Object.freeze({
  [JOB_TYPES.EMPLOYEE]: ['cash-flow'],
  [JOB_TYPES.FREELANCER]: ['market'],
  [JOB_TYPES.SELF_EMPLOYED]: [],
})

// 해당 직군에서 서브탭이 보이는지 돌려준다. 알 수 없는 직군이면 아무 탭도 보이지 않는다.
export function isDiagnosisTabVisible(jobType, tabKey) {
  const hidden = HIDDEN_SUB_TABS_BY_JOB[jobType]
  if (!hidden) return false
  return DIAGNOSIS_SUB_TABS.some((tab) => tab.key === tabKey) && !hidden.includes(tabKey)
}

// 해당 직군에서 보이는 서브탭 목록을 순서대로 돌려준다.
export function getVisibleDiagnosisTabs(jobType) {
  return DIAGNOSIS_SUB_TABS.filter((tab) => isDiagnosisTabVisible(jobType, tab.key))
}
