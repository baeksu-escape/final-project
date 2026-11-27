import { ALT_DATA_TITLE } from './altDataSources.js'

// 점수 산출 단계 이름이자 [점수 산출하기] 버튼 글자.
export const SCORE_STEP_TITLE = '점수 산출하기'

// N-05 데이터 입력 화면의 단계 설정(7단계) — 카드(섹션)를 1~2개씩 한 화면에 보여 준다. 묶음을 바꿀 때는 이 목록만 고친다.
// question: 화면 맨 위 질문형 한 줄 제목.
// sectionKeys는 config/inputSections.js의 섹션 key다. 입력 카드가 있는 단계의 이름은 그 카드 제목을 이어 붙여 만든다(getStepTitle).
// 입력 카드가 없는 단계(sectionKeys가 빈 배열)는 title을 직접 갖는다 — 대안 데이터 불러오기, 점수 산출.
export const INPUT_STEPS = Object.freeze([
  { key: 'income', question: '최근 소득과 일해 온 기간을 알려 주세요', sectionKeys: ['income', 'workPeriod'] },
  { key: 'loans', question: '지금 갚고 있는 대출이 있나요?', sectionKeys: ['loans'] },
  { key: 'creditProfile', question: '카드와 신용 이용 기록을 알려 주세요', sectionKeys: ['creditProfile'] },
  { key: 'assets', question: '가지고 있는 자산을 알려 주세요', sectionKeys: ['assets'] },
  { key: 'expenses', question: '매달 나가는 지출을 알려 주세요', sectionKeys: ['fixedExpense', 'otherExpenses'] },
  { key: 'altData', title: ALT_DATA_TITLE, question: '납부 기록을 불러올 기관에 동의해 주세요', sectionKeys: [] },
  { key: 'score', title: SCORE_STEP_TITLE, question: '입력이 끝났어요, 점수를 확인해 볼까요?', sectionKeys: [] },
])

// 단계 key로 단계 번호(0부터)를 찾는다.
const stepIndexOf = (key) => INPUT_STEPS.findIndex((step) => step.key === key)

// 입력 카드가 있는 마지막 단계 — 여기서 [저장하기]로 서버에 저장한다. 임시저장도 이 단계까지만 한다.
export const LAST_INPUT_STEP = stepIndexOf('expenses')
// 대안 데이터 불러오기 단계 — 저장한 뒤에만 갈 수 있다.
export const ALT_DATA_STEP = stepIndexOf('altData')
// 점수 산출 단계([점수 산출하기]·[신용 리포트로 이동]) — 저장한 뒤에만 갈 수 있다.
export const SCORE_STEP = stepIndexOf('score')

// FP-227 입력 완료 현황(단계 리모컨)에서 누를 수 없는 줄에 보여 줄 이유.
export const LOCKED_STEP_MESSAGE = '앞 단계를 먼저 끝내 주세요.'

// FP-227 단계별 완료 여부를 [true | false × 단계 수]로 돌려준다(입력 완료 현황의 동그라미).
//   passedSteps: [다음] 검사를 통과한 단계 번호들   saved: 서버에 저장한 입력이 있는지(savedAt)
//   errorSteps: 지금 값에 오류가 있는 단계 번호들   altDataDone: 대안 데이터 5종을 모두 불러왔는지(서버 status)
//   1~4단계는 통과했거나 저장본이 있고 지금 오류가 없을 때, 5단계는 저장본이 있고 지금 오류가 없을 때,
//   6단계는 대안 데이터를 모두 불러왔을 때 완료다. 7단계는 점수를 내면 신용 리포트로 가므로 완료 표시를 하지 않는다.
export function getStepDoneList({ passedSteps, saved, errorSteps, altDataDone }) {
  return INPUT_STEPS.map((_, index) => {
    if (index < LAST_INPUT_STEP) return (saved || passedSteps.includes(index)) && !errorSteps.includes(index)
    if (index === LAST_INPUT_STEP) return saved && !errorSteps.includes(index)
    if (index === ALT_DATA_STEP) return altDataDone
    return false
  })
}

// FP-227 입력 완료 현황의 줄을 눌러 그 단계로 갈 수 있는지 — 앞 단계는 늘 가고, 뒤 단계는 그 앞 단계가 모두 완료일 때만 간다.
// 6·7단계는 서버에 저장하기 전에는 가지 못한다. 지금 단계는 누를 것이 없다.
export function canJumpToStep(index, currentStep, doneList, saved) {
  if (index === currentStep) return false
  if (index < currentStep) return true
  if (index >= ALT_DATA_STEP && !saved) return false
  return doneList.slice(0, index).every(Boolean)
}

// 단계 이름 — 입력 카드가 있으면 그 카드 제목(직군별 섹션 목록 sections에서)을 ' · '로 이어 붙인다. 예: '월급 · 재직 기간'
export function getStepTitle(step, sections) {
  if (step.title) return step.title
  return step.sectionKeys
    .map((sectionKey) => sections.find((section) => section.key === sectionKey)?.title)
    .filter(Boolean)
    .join(' · ')
}

// 오류 key('baseMonth' | '섹션' | '섹션.칸' | '섹션.줄id.칸')가 속한 단계 번호를 돌려준다. 기준월은 소득 카드 안에 있으므로 0단계다.
export function getStepIndexOfErrorKey(errorKey) {
  const sectionKey = errorKey.split('.')[0]
  const index = INPUT_STEPS.findIndex((step) => step.sectionKeys.includes(sectionKey))
  return index === -1 ? 0 : index
}
