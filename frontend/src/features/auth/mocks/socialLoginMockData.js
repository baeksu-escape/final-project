// N-01-6 mock 설정 — scenario 값 하나를 바꾸면 소셜 로그인 결과가 달라진다.
//   'LINKED'(a 연결된 계정) | 'NEW_ACCOUNT'(b 처음 연결) | 'ADMIN'(c 관리자) | 'LOCKED'(d 잠긴 계정) | 'FAILED'(e 취소·오류)
export const mockSocialSettings = {
  scenario: 'LINKED',
}

// a 시나리오에서 로그인되는 데모 계정의 아이디.
export const MOCK_LINKED_LOGIN_ID = 'employee'

// b 시나리오에서 제공자가 준 것처럼 쓰는 가짜 값. 실제 정보가 아니다.
export const MOCK_SOCIAL_PROFILE = Object.freeze({
  name: '소셜테스트',
  email: 'social-test@example.com',
})

// 교환 결과로 내준 임시 연결 키. 연결이나 가입에 쓰이면 지운다(메모리에만 있다).
export const mockLinkKeys = new Set()
