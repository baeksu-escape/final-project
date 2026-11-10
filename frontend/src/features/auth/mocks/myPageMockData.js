// N-04-1 데모 계정의 합성 닉네임·가입일. 가입 화면(FP-87)이 아직 닉네임을 받지 않아 마이페이지 확인용으로만 둔다. 실제 정보가 아니다.
// 여기에 없는 계정(새로 가입한 계정)은 닉네임·가입일이 null로 간다.
export const MY_PAGE_DEMO_PROFILES = Object.freeze({
  employee: { nickname: '데모직장인', joinedAt: '2026-10-01' },
  self: { nickname: '데모사장님', joinedAt: '2026-10-02' },
  freelancer: { nickname: '데모프리랜서', joinedAt: '2026-10-03' },
  newbie: { nickname: '데모새내기', joinedAt: '2026-11-01' },
})
