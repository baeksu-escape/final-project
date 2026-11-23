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

## 11/23 v2 탭 개편 (기능·구조 우선, 디자인은 UI 패치팀)
- **탭 3개:** 마이 페이지를 [진단내역 | 내정보 | 게시판관리]로 나눴다. 첫 탭은 진단내역이고, 지금 탭은 주소 `?tab=profile|board`로 남는다(진단내역은 `?tab` 없음). 새로고침·뒤로 가기에서 같은 탭이 열린다.
  - 공통 `TabMenu`는 주소 경로(`NavLink`)로 현재 탭을 고르는 페이지 이동용이라 `?tab` 값에는 맞지 않아, 화면 안 보기 전환용 공통 `SegmentedControl`을 썼다(관리자 감사 로그 화면과 같은 방식).
- **진단내역:** 진단 내역(MEM-06)을 한 번 불러와 위에 대안 점수 변화 그래프(공통 `TrendLineChart`), 아래에 지금 표를 둔다. 산출 불가·대안 점수 없는 진단은 그래프에서 빼고, 그릴 점이 2개 미만이면 안내만 보인다. 서버 API는 그대로다.
  - `TrendLineChart`는 선이 하나라 기존 점수는 그래프에 넣지 않고 표에서 본다.
- **내정보:** 탭에 들어오면 비밀번호부터 받는다(기존 MEM-02 가림 해제로 확인, 새 확인 API 없음). 맞으면 원래 값을 바로 보여 주고 [숨기기]·[표시]는 v1 그대로다. 탭이나 화면을 떠나면 다시 잠긴다(상태로만 들고 저장소에 남기지 않음).
  - 계정 관리에 [닉네임 바꾸기]를 더했다. 규칙은 가입과 같고(`validateNickname`), [중복 확인](AUTH-13)을 통과한 닉네임만 저장한다.
  - 이메일·비밀번호 바꾸기, [데이터 다시 입력], 회원 탈퇴는 동작 그대로 내정보 탭으로 옮겼다. 회원 탈퇴는 탭 맨 아래다.
- **게시판관리:** 서버에 "내가 쓴 글·댓글" 목록 API가 없어(COMM-01은 페이지마다 `mine` 표시만 있음) 만들지 않고 "준비 중" 안내만 둔다.
- **서버 MEM-08 `PATCH /api/members/me/nickname`(새 API):** `{ nickname }` → `{}`. 형식 오류 400 `INVALID_INPUT`, 지금 닉네임과 같으면 400 `SAME_NICKNAME`(새 코드), 다른 회원이 쓰면 409 `DUPLICATE_NICKNAME`(저장 직전 겹침은 UNIQUE 제약 오류를 같은 409로). DDL 변경 없음.

바뀐 파일(v2)
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../user/controller/MyPageController.java` | MEM-08 `PATCH /nickname` |
| `backend/.../user/service/MyPageService.java` | `changeNickname`(규칙·같은 값·중복·동시 저장 겹침) |
| `backend/.../user/dto/MyPageDtos.java` | `NicknameChange` |
| `backend/.../user/mapper/UserAccountMapper.java`·`resources/mapper/user/UserAccountMapper.xml` | `updateNickname` |
| `backend/src/test/.../user/service/SocialAndMyPageServiceTest.java` | 닉네임 변경 시험 1개 |
| `docs/spec/api/api_spec_a.md` | MEM-08 줄, 오류 표에 `SAME_NICKNAME`, 머리말 최근 변경 |
| `docs/spec/api/api_definition.md` | 2-2에 MEM-08 줄(머리말 최근 변경 블록은 규칙상 고치지 않음) |
| `frontend/src/features/auth/pages/MyPage.jsx` | 탭 3개(`?tab`), 탭별 화면 |
| `frontend/src/features/auth/components/MyProfileTab.jsx` | (새 파일) 내정보 탭 — 잠금·내 정보·계정 관리·탈퇴 |
| `frontend/src/features/auth/components/ProfileUnlockCard.jsx` | (새 파일) 내정보 비밀번호 확인 |
| `frontend/src/features/auth/components/DiagnosisHistoryPanel.jsx` | (새 파일) 진단 내역 불러오기 + 그래프 + 표 |
| `frontend/src/features/auth/components/DiagnosisScoreChart.jsx` | (새 파일) 대안 점수 변화 그래프 |
| `frontend/src/features/auth/components/DiagnosisHistoryTable.jsx` | 불러오기를 패널로 옮기고 받은 `items`만 그림 |
| `frontend/src/features/auth/components/NicknameChangeForm.jsx` | (새 파일) 닉네임 바꾸기 폼 |
| `frontend/src/features/auth/components/AccountManageCard.jsx` | [닉네임 바꾸기] 버튼·폼 |
| `frontend/src/features/auth/components/MyProfileCard.jsx` | 잠금 해제로 열리면 원래 값부터 보임 |
| `frontend/src/features/auth/api/myPageApi.js`·`authConstants.js`·`mocks/myPageMockHandlers.js` | MEM-08 호출·`SAME_NICKNAME`·mock |
| `frontend/src/features/auth/auth.css` | `.account-manage-card__nickname`을 기존 보조 버튼 규칙 2곳에 추가 |

- **디자인 확인 필요(동주 님·UI 패치팀):** 새 CSS 규칙은 없다. 새 클래스 이름 `profile-unlock-card`, `my-board-card`, `nickname-change-form`(규칙 없음, 자리 표시용), 기존 규칙에 이름만 더한 `account-manage-card__nickname`. 탭은 공통 `segmented`, 그래프는 공통 `TrendLineChart`, 새 폼 버튼은 공통 `Button`, 안내 글자는 공통 `hint`, 잠금 폼은 기존 `my-profile-card__unmask-form`·`__unmask-submit`을 쓴다.
- **팀 결정 필요**
  - 간편 로그인 전용 계정의 내정보·탈퇴 확인: 지금은 해당 계정이 로그인할 수 없어 영향 없음. 간편 로그인만으로 가입 기능을 만들 때 MEM-01 hasPassword 추가와 함께 처리(2차 계획표 반영)
  - 직군 다시 선택: 아래 조사 결과에서 방법을 고른다. 이번에는 서버 규칙·DB를 바꾸지 않았다.
  - 게시판관리: C팀에 "내가 쓴 글·댓글" 목록 API를 요청한다.
- **직군 다시 선택 조사(바꾸지 않음):** 지금 MEM-05는 저장한 입력(`USER_ASSET_SNAPSHOT` 행) 또는 평가(`ASSESSMENT` 행)가 있으면 409 `JOB_TYPE_LOCKED`다. 평가는 `ASSESSMENT.WORKER_TYPE_CODE`에 평가 시점 직군을 따로 남겨 직군을 바꿔도 진단 내역은 깨지지 않는다. 소득은 `USER_INCOME_MONTH`에 직군 없이 저장되고, 급여소득자는 기준월 1달(월급), 자영업자·프리랜서는 12달을 쓰므로(`DIM_WORKER_TYPE.REQUIRED_INCOME_MONTHS`, `FinancialInputService.saveIncome`·`toInput`) 직군이 바뀌면 저장된 소득이 새 직군 규칙과 맞지 않는다. 임시저장 키는 직군별(`avenue:draft:dataInput:{회원}:{직군}`)이고, 대안 데이터·동의는 직군과 상관없다.
  - A안(직군 바꾸고 소득만 다시 입력): 평가가 있어도 바꿀 수 있게 MEM-05 잠금을 푼다. 소득 행은 그대로 두고, 새 직군 기준으로 소득이 모자라 입력 미완료가 되므로 [데이터 다시 입력]에서 소득을 새로 넣고 저장해야 점수를 낼 수 있다. 서버는 MEM-05 규칙만 바꾸면 되고 DB 변경은 없다. 옛 직군의 소득 행이 남아 화면에 섞여 보일 수 있어(급여 → 12달 직군이면 1달만 채워짐) 화면 안내가 필요하다.
  - B안(직군 바꿀 때 입력 저장본 지우기): 직군을 바꾸면 그 회원의 직접 입력(소득·대출·자산·지출·카드신용)을 지우고 처음부터 입력하게 한다. 평가 기록과 대안 데이터는 남긴다. 규칙이 단순하지만 대출·자산처럼 직군과 무관한 값도 다시 넣어야 하고, 지우는 범위를 정해야 한다(DB 변경 없음, 서버 삭제 쿼리 추가).
  - C안(지금처럼 막고 안내만): 저장 뒤에는 직군을 못 바꾸는 FP-227 결정을 유지하고, [데이터 다시 입력] 옆에 "직군은 바꿀 수 없습니다"만 알린다. 변경 없음. 직군을 잘못 고른 회원은 관리자 도움이 필요하다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
