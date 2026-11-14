# 마이페이지 내 정보·계정 관리 추가 (FP-93)

- **날짜:** 2026-11-10
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-93-myPage`
- **관련 N-ID:** N-04-1, N-04-2, N-04-3 (N-04-6 자리만, N-04-8 만들지 않음)
- **관련 결정:** D-20(응답 형식 임시안), D-27(N-04-8 우선순위 미정), decisions.md 1-2 "개인정보 저장"·"비밀번호 규칙"

## 무엇을, 왜 바꿨나
- 빈 안내 화면이던 `/mypage`를 기능 명세서 v3 기준 마이페이지로 바꿨다. CSS는 넣지 않았다.
  - 내 정보 7개 항목을 보여 준다. 이름·휴대폰·이메일은 서버(mock)가 가린 값을 그대로 보여 준다.
  - [가림 해제]: 비밀번호를 다시 확인한 뒤 원래 값을 화면 상태에만 둔다. 화면을 벗어나면 사라지고 브라우저 저장소에는 남기지 않는다.
  - 계정 관리 카드: [이메일 바꾸기]는 FP-87 이메일 인증(`CHANGE_EMAIL`)을 통과해야 저장된다. [비밀번호 바꾸기]는 FP-87 비밀번호 검사를 그대로 쓴다. [데이터 다시 입력]은 `/data-input`으로 이동한다.
  - 저장이 끝나면 결과를 안내하고 내 정보를 다시 불러온다.
  - 진단 내역 자리: `MyPage.jsx` 맨 아래의 빈 카드 `my-page-history-card`. FP-92에서 채운다.
- 비밀번호 규칙을 decisions.md 1-2대로 "영문과 숫자를 섞어 8자 이상"으로 맞췄다. FP-87 `PASSWORD_RULES`에서 기호 규칙을 뺐으므로 가입·비밀번호 찾기·마이페이지가 모두 같은 규칙을 쓴다. 비밀번호 칸은 모두 가린 입력(`type="password"`)이다.
- 직군 바꾸기(N-04-8)는 우선순위 미정(D-27)이라 만들지 않았다. `AccountManageCard.jsx`에 주석만 남겼다.
- 새 폴더를 만들지 않으려고(decisions.md 저장소 구조) N-04와 같은 회원·인증 묶음인 `features/auth/`에 두었다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/auth/pages/MyPage.jsx` | 새 파일. 마이페이지 진입점, 내 정보 불러오기·가림 해제 상태 |
| `frontend/src/features/auth/components/MyProfileCard.jsx` | 새 파일. 내 정보 7개 항목, 가림 해제 비밀번호 칸 |
| `frontend/src/features/auth/components/AccountManageCard.jsx` | 새 파일. 계정 관리 버튼 3개와 폼 전환 |
| `frontend/src/features/auth/components/EmailChangeForm.jsx` | 새 파일. 새 이메일 인증 후 저장 |
| `frontend/src/features/auth/components/PasswordChangeForm.jsx` | 새 파일. 현재·새·확인 비밀번호 |
| `frontend/src/features/auth/api/myPageApi.js` | 새 파일. 마이페이지 API 경로와 호출 함수 |
| `frontend/src/features/auth/mocks/myPageMockHandlers.js` | 새 파일. mock 4개, 마스킹 |
| `frontend/src/features/auth/mocks/myPageMockData.js` | 새 파일. 데모 계정의 합성 닉네임·가입일 |
| `frontend/src/features/auth/validation.js` | `PASSWORD_RULES`에서 기호 규칙 삭제, 주석 |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | `requireAccountByToken`·`consumeVerification` export, `isMockEmailInUse` 추가, 인증코드 발송 중복 차단에 `CHANGE_EMAIL` 추가 |
| `frontend/src/common/routes/AppRoutes.jsx` | `MyPage` import, `/mypage` element 교체 |

## DB·API 변경
- DB: 없음.
- API(mock 임시안, TODO(D-20)). 비밀번호가 틀려도 401을 쓰지 않는다. 401이면 `client.js`가 로그아웃시킨다.

| 요청 | 본문 | 응답 | 오류 |
|------|------|------|------|
| `GET /api/members/me/profile` | 없음 | `{ profile: { loginId, nickname, name, phone, email, joinedAt, jobType } }`. 이름·휴대폰·이메일은 가린 값, `joinedAt`은 `YYYY-MM-DD`, 없는 값은 `null` | 401 |
| `POST /api/members/me/profile/unmask` | `{ password }` | `{ profile: { name, phone, email } }` (원래 값, 휴대폰은 하이픈 포함) | 400 비밀번호 틀림 |
| `PUT /api/members/me/email` | `{ email, emailVerificationToken }` | `{}` | 400 형식·같은 이메일·인증 토큰 불일치, 409 `DUPLICATE_EMAIL` |
| `PUT /api/members/me/password` | `{ currentPassword, newPassword }` | `{}` | 400 현재 비밀번호 틀림·규칙 위반 |

- 기존 `POST /api/auth/email/send`: `purpose: CHANGE_EMAIL`이면 이미 가입된 이메일을 409로 막는다(SIGNUP과 같다).
- 마스킹은 아래 mock 예시를 기준으로 한다: 이름 `홍*동`, 휴대폰 `010-****-5678`, 이메일 `em******@example.com`(아이디 앞 두 글자만 남김). 화면은 서버가 보낸 값을 그대로 보여 주므로, 백엔드가 이 모양으로 보내면 된다.
- 데모 계정은 비밀번호가 없어 아무 값이나 통과한다. 마이페이지에서 비밀번호를 바꾸면 그 뒤로는 새 비밀번호만 통과한다(새로고침하면 처음 상태로 돌아간다).
- 영향을 받는 기능·팀원: 백엔드 회원 API 담당(위 경로 구현), FP-92(진단 내역 카드)

## 확인
- 확인함
  - `npm run lint` 오류 0건, `npm run build` 성공
  - mock 로직 node 검사 18건 통과(저장소 밖 스크립트): 마스킹, 가림 해제, 인증 토큰 목적·1회 사용, 중복 이메일, 비밀번호 규칙(영문만·숫자만·7자 차단, 기호 없이 통과)·현재 비밀번호, 바꾼 이메일로 비밀번호 찾기
  - 헤드리스 Chrome 점검 36건 통과(mock 모드)
    - 탭에서 진입하면 7개 항목이 가린 값으로 보인다.
    - 가림 해제 후 다른 탭에 갔다 오면 다시 가려지고, 브라우저 저장소에 원래 값이 없다.
    - 이메일 인증 전·인증 뒤 이메일을 고친 경우 저장이 막힌다.
    - 비밀번호 규칙 위반·불일치를 막고, 기호 없는 `abcd1234`는 통과한다. 변경 뒤에는 틀린 비밀번호로 가림 해제하면 안내가 나온다.
    - 가입 화면의 비밀번호 규칙 표시도 3개(8자 이상·영문·숫자)로 바뀌었다.
    - [데이터 다시 입력]은 `/data-input`으로 이동한다.
    - 직군 미선택 계정은 `/select-job`으로 간다.
  - 콘솔: 브라우저가 자동으로 요청하는 `favicon.ico` 404만 있다.
- 확인 못 함: 실제 백엔드 연동(서버·API 명세 없음)

## 다음 사람이 알아야 할 것
- 가입(FP-87)이 닉네임을 받지 않는다. 그래서 새로 가입한 계정은 닉네임·가입일이 "-"로 보인다(decisions.md 1-2 "가입 입력"과 다르다). 데모 계정의 닉네임·가입일은 `myPageMockData.js`의 합성 값이다.
- 헤더에 별도 [마이 페이지] 버튼은 없다. 진입은 사용자 탭 메뉴의 "마이 페이지"다. 공통 컴포넌트는 다른 팀원이 작업 중이라 손대지 않았다. 마이페이지는 경로 `PATHS.MY_PAGE`만 쓰므로 헤더가 바뀌어도 이 경로로 연결하면 된다.
- `/mypage`는 기존 가드(일반 사용자 + 직군 선택 완료) 안에 있다. 직군을 고르지 않은 사용자는 직군 선택 화면으로 간다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
