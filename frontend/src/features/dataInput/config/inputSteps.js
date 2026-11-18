// N-05 데이터 입력 화면의 단계 설정 — 관련 있는 카드(섹션)를 2~3개씩 묶어 한 화면에 보여 준다.
// sectionKeys는 config/inputSections.js의 섹션 key다. 마지막 단계(sectionKeys가 빈 배열)는 입력 카드 없이
// 대안 데이터 불러오기·입력 완료 현황·점수 산출을 보여 준다. 묶음을 바꿀 때는 이 목록만 고친다.
export const INPUT_STEPS = Object.freeze([
  { key: 'income', title: '소득·기간', sectionKeys: ['income', 'workPeriod'] },
  { key: 'debt', title: '부채·신용', sectionKeys: ['loans', 'creditProfile'] },
  { key: 'asset', title: '자산·지출', sectionKeys: ['assets', 'fixedExpense', 'otherExpenses'] },
  { key: 'review', title: '대안 데이터·점수 산출', sectionKeys: [] },
])

// 입력 카드가 있는 마지막 단계 — 여기서 [저장하고 다음]으로 서버에 저장한다.
export const LAST_INPUT_STEP = INPUT_STEPS.length - 2
// 입력 카드가 없는 확인 단계(대안 데이터·완료 현황·점수 산출).
export const REVIEW_STEP = INPUT_STEPS.length - 1

// 오류 key('baseMonth' | '섹션' | '섹션.칸' | '섹션.줄id.칸')가 속한 단계 번호를 돌려준다. 기준월은 소득 카드 안에 있으므로 0단계다.
export function getStepIndexOfErrorKey(errorKey) {
  const sectionKey = errorKey.split('.')[0]
  const index = INPUT_STEPS.findIndex((step) => step.sectionKeys.includes(sectionKey))
  return index === -1 ? 0 : index
}
