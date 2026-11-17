// N-04-1 데모 계정의 합성 닉네임·가입일. 실제 정보가 아니다.
// 계정에 저장된 값(nickname, createdAt)이 없을 때만 쓰는 대체값이다. 둘 다 없으면 null로 간다.
export const MY_PAGE_DEMO_PROFILES = Object.freeze({
  employee: { nickname: '데모직장인', joinedAt: '2026-10-01' },
  self: { nickname: '데모사장님', joinedAt: '2026-10-02' },
  freelancer: { nickname: '데모프리랜서', joinedAt: '2026-10-03' },
  newbie: { nickname: '데모새내기', joinedAt: '2026-11-01' },
})
