import { ALT_DATA_SOURCES, ALT_DATA_TITLE } from './altDataSources.js'
import { getSectionsForJob } from './inputSections.js'

// 대안 데이터 항목의 key — 입력 섹션 5개만 끝났는지 볼 때 이 항목을 뺀다.
const ALT_DATA_ITEM_KEY = 'altData'

// 서버 status에서 불러온 대안 데이터 종류 수를 센다.
const countImported = (altData) => ALT_DATA_SOURCES.filter((source) => altData[source.key]).length

// N-05-8 입력 완료 현황 항목 6개(화면 단계 순서) — 서버가 준 status로 항목별 완료 여부를 정한다.
//   status 모양: { sections: { 섹션 key: boolean }, altData: { 대안 데이터 key: boolean } }
//   sectionKey: 이름을 가져올 섹션(inputSections.js의 title). 직군마다 이름이 다른 소득·기간도 여기서 맞춰진다.
//   대출 목록(N-05-3)은 대출이 없으면 "대출 없음" 체크로 완료한다.
//   월 고정 지출을 입력하면 지출이 완료다. 카드·신용 이용과 할부·정기결제는 없을 수 있어 항목에 넣지 않는다.
const COMPLETION_ITEMS = Object.freeze([
  { key: 'income', sectionKey: 'income', isDone: (sections) => sections.income },
  { key: 'period', sectionKey: 'workPeriod', isDone: (sections) => sections.workPeriod },
  { key: 'loans', sectionKey: 'loans', isDone: (sections) => sections.loans },
  { key: 'assets', sectionKey: 'assets', isDone: (sections) => sections.assets },
  { key: 'expenses', sectionKey: 'fixedExpense', isDone: (sections) => sections.fixedExpense },
  // 대안 데이터는 5종(altDataSources.js 목록)을 모두 불러와야 완료다. 나중에 바뀔 수 있는 팀 합의(11/12, N-05-9)라 조건은 이 줄만 고치면 된다.
  {
    key: ALT_DATA_ITEM_KEY,
    label: ALT_DATA_TITLE,
    isDone: (_, altData) => countImported(altData) === ALT_DATA_SOURCES.length,
    hint: (altData) => `${ALT_DATA_SOURCES.length}종 중 ${countImported(altData)}종 불러옴`,
  },
])

// N-05-8 항목별 완료 여부를 [{ key, label, done, hint }]로 돌려준다. label은 카드 제목과 같고, hint는 미완료일 때 옆에 보여 줄 안내(없으면 '')다.
// jobType: 소득·기간 이름을 직군에 맞추려고 받는다. 완료 여부(done)는 직군과 관계없이 status로만 정한다.
export function getCompletionItems(status, jobType) {
  const sections = getSectionsForJob(jobType)
  const savedSections = status?.sections ?? {}
  const savedAltData = status?.altData ?? {}
  return COMPLETION_ITEMS.map(({ key, sectionKey, label, isDone, hint }) => ({
    key,
    label: label ?? sections.find((section) => section.key === sectionKey)?.title ?? '',
    done: Boolean(isDone(savedSections, savedAltData)),
    hint: hint ? hint(savedAltData) : '',
  }))
}

// N-05-8 6개 항목이 모두 완료인지 본다 — 모두 차야 [점수 산출하기]를 연다.
export function isInputComplete(status, jobType) {
  return getCompletionItems(status, jobType).every((item) => item.done)
}

// FP-227 대안 데이터 항목({ done, hint })만 돌려준다 — 입력 완료 현황 6단계 줄의 완료 여부와 '5종 중 N종 불러옴' 안내에 쓴다.
export function getAltDataItem(status) {
  return getCompletionItems(status).find((item) => item.key === ALT_DATA_ITEM_KEY)
}

// FP-227 대안 데이터를 뺀 입력 섹션 5개(소득·기간·기존 부채·자산·월 고정 지출)가 모두 저장됐는지 본다 — 다시 들어올 때 시작 단계를 정한다.
export function areInputSectionsComplete(status) {
  return getCompletionItems(status)
    .filter((item) => item.key !== ALT_DATA_ITEM_KEY)
    .every((item) => item.done)
}
