// N-05-8 입력 완료 현황 항목 6개 — 서버가 준 status로 항목별 완료 여부를 정한다.
//   status 모양: { sections: { 섹션 key: boolean }, altData: { 대안 데이터 key: boolean } }
//   '카드/부채'는 화면 표기이고 대출 목록(N-05-3)을 뜻한다. 대출이 없으면 "대출 없음" 체크로 완료한다.
//   '지출'은 월 고정 지출을 입력하면 완료다. 할부·정기결제는 없을 수 있어 조건에 넣지 않는다.
const COMPLETION_ITEMS = Object.freeze([
  { key: 'income', label: '소득(12개월)', isDone: (sections) => sections.income },
  { key: 'period', label: '기간', isDone: (sections) => sections.workPeriod },
  { key: 'assets', label: '자산', isDone: (sections) => sections.assets },
  { key: 'loans', label: '카드/부채', isDone: (sections) => sections.loans },
  { key: 'expenses', label: '지출', isDone: (sections) => sections.fixedExpense },
  { key: 'altData', label: '대안 데이터(4종 중 1개 이상)', isDone: (_, altData) => Object.values(altData).some(Boolean) },
])

// N-05-8 항목별 완료 여부를 [{ key, label, done }]로 돌려준다.
export function getCompletionItems(status) {
  return COMPLETION_ITEMS.map(({ key, label, isDone }) => ({
    key,
    label,
    done: Boolean(isDone(status?.sections ?? {}, status?.altData ?? {})),
  }))
}

// N-05-8 6개 항목이 모두 완료인지 본다 — 모두 차야 [점수 산출하기]를 연다.
export function isInputComplete(status) {
  return getCompletionItems(status).every((item) => item.done)
}
