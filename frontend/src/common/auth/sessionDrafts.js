// 화면 임시저장(sessionStorage) 공통 규칙 — 로그아웃 때 지워야 하는 화면 임시저장은 이 접두어로 키를 만든다.
// 예: 데이터 입력(features/dataInput/utils/inputDraft.js)은 'avenue:draft:dataInput:{userId}:{직군}'을 쓴다.
// 공통 코드는 기능 폴더를 몰라도 되고, AuthProvider는 직접 로그아웃·탈퇴 때 clearSessionDrafts()만 부른다.
export const SESSION_DRAFT_PREFIX = 'avenue:draft:'

// 이 접두어로 시작하는 sessionStorage 키를 모두 지운다. 저장소를 쓸 수 없으면(비공개 창 등) 조용히 넘어간다.
export function clearSessionDrafts() {
  try {
    const keys = []
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index)
      if (key?.startsWith(SESSION_DRAFT_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key))
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다.
  }
}
