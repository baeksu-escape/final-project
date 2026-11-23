# 마이 페이지 개선 — 같은 비밀번호 변경 막기·진단 내역 등급 태그·탈퇴 확인 상자 폭·개인정보 표시/숨기기

- **날짜:** 2026-11-23
- **작성자:** JWC1226 / Claude Code
- **브랜치:** `feature-A/FP-222-mypage-ui` (develop `f028850`에서 시작)
- **관련 N-ID:** N-04-2, N-04-3, N-04-6, N-04-7
- **관련 결정:** 11/18 시연 메모·중간 시연 피드백(Jira FP-222, 상위 FP-218)

## 무엇을, 왜 바꿨나
- **같은 비밀번호로 변경 막기(N-04-3):** 새 비밀번호가 지금 비밀번호와 같으면 화면에서 막고, 서버(MEM-04)도 400 `SAME_PASSWORD`로 거절한다. 화면을 거치지 않은 요청도 막기 위해서다.
- **진단 내역 등급 태그(N-04-6):** 등급 칸을 신용 리포트 [점수 비교]와 같은 등급 태그(`credit-grade`)로 보여 준다. 등급이 없으면 예전처럼 비운다.
- **탈퇴 확인 상자 폭(N-04-7):** [회원 탈퇴]를 누르면 열리는 확인 상자가 화면 전체 폭으로 늘어났다. 가입·찾기 화면과 같은 600px까지만 넓어지게 했다.
- **개인정보 표시/숨기기(N-04-2):** 비밀번호 확인은 그대로 두고, 확인한 뒤에는 같은 카드에서 [숨기기]·[표시]로 오간다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../user/service/MyPageService.java` | `changePassword`에서 새 비밀번호가 지금 비밀번호와 같으면(BCrypt `matches`) 400 `SAME_PASSWORD`(fieldErrors `newPassword`) |
| `backend/src/test/.../user/service/SocialAndMyPageServiceTest.java` | 같은 값 거절·다른 값 저장 시험 1개 추가 |
| `frontend/src/features/auth/authConstants.js` | 오류 코드 `SAME_PASSWORD`, 문구 `SAME_PASSWORD_MESSAGE`(서버와 같은 문구) |
| `frontend/src/features/auth/components/PasswordChangeForm.jsx` | 보내기 전 같은 값 검사, 서버 `SAME_PASSWORD`도 새 비밀번호 칸 아래에 같은 문구 |
| `frontend/src/features/auth/mocks/myPageMockHandlers.js` | mock 비밀번호 변경도 같은 순서로 `SAME_PASSWORD` |
| `frontend/src/features/auth/components/DiagnosisHistoryTable.jsx` | 등급 칸을 `credit-grade credit-grade--{코드}` 태그로, `features/credit/credit.css`를 가져와 씀(파일은 고치지 않음) |
| `frontend/src/features/auth/auth.css` | `.withdrawal-form`에 `max-width: 600px` |
| `frontend/src/features/auth/components/MyProfileCard.jsx` | 확인 뒤 [숨기기]·[표시] 버튼과 표시 상태 |

## DB·API 변경
- DB: 없음
- API: 경로·요청·응답 모양은 그대로다. MEM-04에 400 `SAME_PASSWORD`가 실제로 나오게 됐다.
  - `SAME_PASSWORD`는 `api_spec_a.md` 오류 표(153행)와 API 정의서 1장 오류 표(79행)에 이미 "같은 값으로 변경"으로 적혀 있어서 문서는 고치지 않았다. 정의서 2장 MEM-04 줄도 그대로다.
- 영향을 받는 기능·팀원: 없음. 신용 리포트 `credit.css`는 가져다 쓰기만 했다(규칙은 모두 `credit-`·`shap-` 접두어라 마이 페이지 다른 요소에 영향이 없다. 메인 화면 `LandingPage`와 같은 방식이다).

## 확인
- 확인함
  - `mvnw test`(`-DargLine=-Dfile.encoding=UTF-8 -Xmx512m`) 467건 통과, 실패·오류 0. 새 시험 `비밀번호_변경은_지금_비밀번호와_같은_새_비밀번호를_막는다` 포함.
  - `npm run lint` 오류 0, `npm run build` 성공.
- 확인 못 함
  - 화면은 직접 열어 보지 않았다(브라우저를 조작하지 않음). 사람이 로컬에서 로그인 → 마이 페이지 → 아래 4가지를 확인한다.
    1. 비밀번호 바꾸기에서 현재·새 비밀번호를 같게 넣으면 새 비밀번호 칸 아래에 「지금 쓰는 비밀번호와 같습니다. 다른 비밀번호를 입력해 주세요.」가 보이고 저장되지 않는다.
    2. 진단 내역 등급 칸이 리포트와 같은 둥근 태그(Good 초록·Standard 안내색·Caution 주의색)로 보이고, 산출 불가 줄은 예전 문구 그대로다.
    3. [회원 탈퇴]를 눌러 열린 상자가 600px 안쪽이고, 좁은 화면에서는 화면 폭에 맞춰 줄어든다.
    4. [가림 해제] → 비밀번호 확인 → 원래 값과 [숨기기]가 보이고, [숨기기] → 가린 값과 [표시], [표시] → 비밀번호 없이 원래 값. 다른 화면에 갔다 오면 가린 값부터 보인다.

## 디자인 확인 필요 (동주 님)
- 새 클래스는 없다.
- 바뀐 규칙: `auth.css`의 `.withdrawal-form`에 `max-width: 600px`(가입·찾기 화면 폭과 같은 값). 색은 그대로다.
- 가져다 쓴 클래스: `credit-grade`, `credit-grade--good`·`--standard`·`--caution`(`features/credit/credit.css`, 진단 내역 표 안에서 처음 씀).
- 다시 쓴 클래스: [표시]·[숨기기] 버튼은 기존 [가림 해제] 버튼 클래스 `my-profile-card__unmask`.

## 다음 사람이 알아야 할 것
- 가림 해제(MEM-02)는 서버에 유효시간·토큰이 없고 요청마다 비밀번호를 확인한다. 그래서 화면은 한 번 확인한 원래 값을 `MyPage` 상태에만 두고 [표시]·[숨기기]로 오간다. 저장소(sessionStorage 등)에는 남기지 않는다.
- 회원 탈퇴는 공통 Modal이 아니라 카드 안에서 열리는 상자라 Modal은 건드리지 않았다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
