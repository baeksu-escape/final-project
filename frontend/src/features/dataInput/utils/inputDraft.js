import { INPUT_STEPS } from '../config/inputSteps.js'

// N-05 입력 임시저장 — 단계를 넘기거나 값을 고칠 때 입력값과 단계를 브라우저(sessionStorage)에 보관한다.
// 같은 탭에서만 이어지고 탭을 닫으면 사라진다. 서버에는 마지막 단계에서 [저장하고 다음]을 눌러야 저장된다.
// 저장소를 쓸 수 없는 환경(비공개 창 등)이면 조용히 건너뛰고 화면은 그대로 동작한다.
const draftKey = (jobType) => `avenue:dataInput:draft:${jobType}`

// 임시저장본을 { values, step }으로 돌려준다. 없거나 지금 섹션 구성과 맞지 않으면 null.
export function loadDraft(jobType, sections) {
  try {
    const draft = JSON.parse(window.sessionStorage.getItem(draftKey(jobType)))
    const hasAllSections = sections.every((section) => draft?.values?.[section.key] !== undefined)
    const isStepValid = Number.isInteger(draft?.step) && draft.step >= 0 && draft.step < INPUT_STEPS.length
    return hasAllSections && isStepValid ? draft : null
  } catch {
    return null
  }
}

// 입력값과 단계를 임시저장한다.
export function saveDraft(jobType, values, step) {
  try {
    window.sessionStorage.setItem(draftKey(jobType), JSON.stringify({ values, step }))
  } catch {
    // 저장소를 쓸 수 없으면 임시저장 없이 진행한다.
  }
}

// 임시저장본을 지운다(서버에 저장한 뒤 호출).
export function clearDraft(jobType) {
  try {
    window.sessionStorage.removeItem(draftKey(jobType))
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다.
  }
}
