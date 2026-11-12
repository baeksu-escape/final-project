# 마이페이지 회원 탈퇴 추가 — 상태 변경 방식, 간편 로그인 연결 삭제 (FP-93)

- **날짜:** 2026-11-12
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-93-withdrawal` (`feature-A/FP-85-utility-consent`에서 분기)
- **관련 N-ID:** N-04-7 (함께 고친 곳: N-01-1 로그인, N-01-6 소셜 로그인 mock)
- **관련 결정:** DDL v0.3.2 W1(탈퇴 = 상태 변경), `CK_APU_PII_BY_STATUS`, API 정의서 1장 "탈퇴 회원" 규칙
  - 팀 결정: 재가입 제한 없음, 탈퇴하면 `USER_SOCIAL_ACCOUNT` 삭제

## 무엇을, 왜 바꿨나
- 마이페이지 맨 아래에 '회원 탈퇴' 카드를 추가했다(`WithdrawalCard.jsx`).
  - [회원 탈퇴]를 누르면 안내문과 비밀번호 확인 폼이 열린다. 버튼은 [탈퇴하기]·[취소]다.
  - 비밀번호가 틀리면 칸 옆에 오류를 보여 준다.
  - 성공하면 로그아웃하고 로그인 화면으로 보낸다. 로그인 화면은 "탈퇴를 마쳤습니다." 알림을 공통 `Toast`로 띄운다.
- 탈퇴 mock은 계정 행을 지우지 않고 값만 바꾼다.

  | 항목 | 탈퇴 후 값 |
  |---|---|
  | 상태 | `accountStatus = 'WITHDRAWN'`, `withdrawnAt = 현재 시각` |
  | 아이디 | `'wd_' + userId` |
  | 닉네임 | `'탈퇴' + userId` |
  | 이름·이메일 | `'WITHDRAWN'` |
  | 휴대폰·비밀번호 | null |

  - 그 이메일로 보낸 인증코드·인증 토큰도 지운다(N-04-7 "인증 기록 삭제").
- 동의로 불러온 대안 데이터를 지우고, 동의 이력에는 철회 시각을 채운다. FP-85 저장소의 `withdrawAllAltDataOfUser`를 쓴다.
- 진단 내역은 보관한다. 탈퇴한 토큰은 401이라 조회만 막힌다.
- 탈퇴한 토큰으로 `/api/members/me/**`(그리고 `/api/auth/me`)를 부르면 401 `{ code: 'UNAUTHORIZED' }`를 돌려준다. `common/api/client.js`의 기존 401 → 로그아웃 처리가 그대로 동작한다.
- 옛 아이디로 로그인하면 일반 실패 문구가 나온다. 같은 아이디·이메일로 바로 다시 가입할 수 있다.
  - 다시 가입한 계정은 새 userId(`u-아이디-2` 등)를 받는다. 탈퇴 계정의 옛 토큰·mock 데이터와 섞이지 않는다.
- 소셜 로그인 mock에 간편 로그인 연결 기록(`mockSocialLinks`, 제공자 → userId)을 추가했다.
  - 탈퇴하면 그 회원의 연결 기록을 지운다.
  - 같은 제공자로 다시 로그인하면 '처음 연결' 흐름으로 간다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/components/WithdrawalCard.jsx` | 새 파일. 회원 탈퇴 카드(안내문·비밀번호 확인·[탈퇴하기]·[취소]) |
| `frontend/src/features/auth/pages/MyPage.jsx` | 맨 아래에 회원 탈퇴 카드 |
| `frontend/src/features/auth/pages/LoginPage.jsx` | 다른 화면이 넘긴 알림(state.notice)을 토스트로 표시 |
| `frontend/src/features/auth/api/myPageApi.js` | `DELETE /api/members/me`(🟡 제안 경로), `requestWithdrawal` |
| `frontend/src/features/auth/mocks/myPageMockHandlers.js` | 탈퇴 mock: 비밀번호 확인, 대안 데이터·간편 로그인 연결 삭제, 상태 변경 |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | 탈퇴 계정 거르기(토큰 401 UNAUTHORIZED·로그인·소셜 연결), `withdrawMockAccount`, `findMockAccountByUserId`, 겹치지 않는 userId |
| `frontend/src/features/auth/mocks/socialLoginMockData.js` | 간편 로그인 연결 기록과 회원별 삭제 함수 |
| `frontend/src/features/auth/mocks/socialLoginMockHandlers.js` | LINKED 시나리오는 연결 기록으로 계정을 찾고, 없으면 '처음 연결' |

## DB·API 변경
- DB: 없음. DDL v0.3.2 `APP_USER`(ACCOUNT_STATUS_CODE·WITHDRAWN_AT·CK_APU_PII_BY_STATUS)와 `USER_SOCIAL_ACCOUNT`를 따른다.
- API(mock, 🟡 제안 경로)

| 요청 | 본문 | 응답 | 오류 |
|------|------|------|------|
| `DELETE /api/members/me` | `{ password }` | `{}` | 400 `fieldErrors [{ field: 'password', message }]` |

- 탈퇴한 토큰으로 부르는 모든 회원 API: 401 `{ code: 'UNAUTHORIZED' }`
- 영향을 받는 기능·팀원
  - Spring 회원 담당: 탈퇴 처리, 인증 기록 삭제, 소셜 연결 삭제
  - 커뮤니티 담당: 탈퇴 회원 글·댓글 표시. 이번에는 건드리지 않았다.

## 확인
- 확인함: `npm run lint` 통과, `npm run build` 통과
- 확인함: Node 스크립트로 mock 처리 함수를 직접 불러 30개 항목 통과
  1. 빈 비밀번호·틀린 비밀번호면 400 fieldErrors이고 계정이 유지된다.
  2. 탈퇴 → 같은 토큰으로 회원 API 6개 모두 401 UNAUTHORIZED
  3. 대안 데이터 삭제, 동의 이력 유지(철회 시각 채움)
  4. 옛 아이디·`wd_` 아이디로 로그인 실패(일반 문구)
  5. 세 제공자 모두 간편 로그인이 '처음 연결'로 가고, 탈퇴 계정에는 소셜 연결 불가
  6. 같은 아이디·이메일로 다시 가입하면 새 userId·새 토큰, 옛 데이터와 섞이지 않음, 옛 토큰은 계속 401
  7. 다른 계정은 영향 없음
- 확인함: FP-85 점검 72개를 다시 돌려 모두 통과
- 확인 못 함
  - 브라우저에서 탈퇴 → 로그인 화면 토스트 → 옛 아이디 로그인 → 다시 가입 → 간편 로그인을 직접 눌러 보는 확인. `npm run dev`(VITE_USE_MOCK=true)로 확인해야 한다.
  - `client.js`의 401 → 로그아웃 처리는 Node에서 불러오지 못해(`import.meta.env`) 코드로만 확인했다.

## 다음 사람이 알아야 할 것
- 옛 아이디 로그인 실패 문구는 기존 `LOGIN_FAILED_MESSAGE`("아이디 또는 비밀번호가 올바르지 않습니다.")를 그대로 썼다. 작업 지시서의 "맞지 않습니다"와 다르다. 문구는 바꾸지 않았다.
- 데모 계정은 비밀번호가 없어(null) 비어 있지 않은 값이면 통과한다. 틀린 비밀번호 확인은 새로 가입한 계정이나 비밀번호를 바꾼 계정으로 해야 한다.
- 공개 메인 화면(N-10)이 없고 로그아웃 상태의 `/`는 로그인 화면으로 가므로, "메인으로 보낸다"를 로그인 화면으로 보내는 것으로 처리했다.
- 탈퇴는 되돌릴 수 없다. mock은 메모리에만 있어 새로고침하면 데모 계정이 되살아난다.
- 탈퇴 회원의 평가를 통계(N-13·N-25·N-26)에 넣을지는 팀 결정이 남아 있다(D-28).
- 새로 붙인 클래스: `withdrawal-card`, `withdrawal-card__open`, `withdrawal-form`, `withdrawal-form__notice`. 폼 버튼은 기존 `account-form__*`를 다시 썼다. 스타일은 넣지 않았다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
