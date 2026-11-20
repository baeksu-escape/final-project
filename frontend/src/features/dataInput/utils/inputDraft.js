import { SESSION_DRAFT_PREFIX } from '../../../common/auth/sessionDrafts.js'
import { LAST_INPUT_STEP } from '../config/inputSteps.js'

// N-05 입력 임시저장 — 단계를 넘기거나 값을 고칠 때 입력값과 단계를 브라우저(sessionStorage)에 보관한다.
// 같은 탭에서만 이어지고 탭을 닫으면 사라진다. 서버에는 마지막 입력 단계(5단계)에서 [저장하기]를 눌러야 저장된다.
// 저장소를 쓸 수 없는 환경(비공개 창 등)이면 조용히 건너뛰고 화면은 그대로 동작한다.
// FP-227: 같은 PC·같은 탭을 여러 사람이 쓰는 경우(시연 PC)를 위해 키를 회원별로 나눈다.
// 키는 공통 접두어(common/auth/sessionDrafts.js)를 써서, 직접 로그아웃·탈퇴 때 AuthProvider가 지운다. 세션 만료(401) 때는 남긴다.
const draftKey = (userId, jobType) => `${SESSION_DRAFT_PREFIX}dataInput:${userId}:${jobType}`

// 임시저장본을 { values, step, savedAt, passedSteps }로 돌려준다. 없거나 지금 섹션 구성과 맞지 않으면 null.
// passedSteps(FP-227): [다음] 검사를 통과한 단계 번호들 — 입력 완료 현황의 초록 동그라미를 새로고침 뒤에도 남긴다. 없으면 빈 배열.
// serverSavedAt: 지금 서버 저장본의 저장 시각(없으면 null). 임시저장할 때의 서버 저장 시각과 다르면
// 그사이 다른 곳(다른 탭 등)에서 저장한 것이므로 오래된 임시저장본으로 보고 지운 뒤 null을 돌려준다.
export function loadDraft(userId, jobType, sections, serverSavedAt = null) {
  try {
    const draft = JSON.parse(window.sessionStorage.getItem(draftKey(userId, jobType)))
    if (!draft) return null
    if ((draft.savedAt ?? null) !== (serverSavedAt ?? null)) {
      clearDraft(userId, jobType)
      return null
    }
    const hasAllSections = sections.every((section) => draft.values?.[section.key] !== undefined)
    // 임시저장은 입력 단계(1~5단계)에서만 하므로 그 밖의 단계 번호는 맞지 않는 저장본으로 본다.
    const isStepValid = Number.isInteger(draft.step) && draft.step >= 0 && draft.step <= LAST_INPUT_STEP
    if (!hasAllSections || !isStepValid) return null
    const passedSteps = Array.isArray(draft.passedSteps)
      ? draft.passedSteps.filter((index) => Number.isInteger(index) && index >= 0 && index < LAST_INPUT_STEP)
      : []
    return { ...draft, passedSteps }
  } catch {
    return null
  }
}

// 입력값·단계·통과한 단계들(passedSteps)을, 그 시점의 서버 저장 시각(savedAt, 없으면 null)과 함께 임시저장한다.
export function saveDraft(userId, jobType, values, step, savedAt = null, passedSteps = []) {
  try {
    window.sessionStorage.setItem(
      draftKey(userId, jobType),
      JSON.stringify({ values, step, savedAt: savedAt ?? null, passedSteps }),
    )
  } catch {
    // 저장소를 쓸 수 없으면 임시저장 없이 진행한다.
  }
}

// 임시저장본을 지운다(서버에 저장한 뒤, [처음 값으로]를 누를 때 호출).
export function clearDraft(userId, jobType) {
  try {
    window.sessionStorage.removeItem(draftKey(userId, jobType))
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다.
  }
}
