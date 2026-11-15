# 관리자 화면 — 로그인 2단계 인증, 관리자 비밀번호 설정·변경, 계정·권한 관리, 접근·감사 로그 (FP-80 PR C)

- **날짜:** 2026-11-15
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-80-admin-ui` (`feature-A/FP-85-86-93-bundle` 6ee8bf2에서 분기, worktree에서 화면만 작업)
- **관련 N-ID:** N-01-1(관리자 2단계 인증), N-27-1·N-27-3·N-27-4, N-28-2, N-35-1·N-35-2
- **관련 결정:** API 정의서 v0.2 2-10(ADM-05~10) + 작업 7(관리자 백엔드)과 맞춘 계약(AUTH-11, 첫 비밀번호 설정, 재확인 step-up, 관리자 비밀번호 변경)

## 무엇을, 왜 바꿨나
- 관리자 백엔드(작업 7)와 동시에 진행해서, 화면은 계약 모양의 mock(`VITE_USE_MOCK=true`)으로 만들고 확인했다.
- **로그인 2단계 인증:** 관리자는 비밀번호가 맞으면 같은 로그인 화면에서 6자리 입력 단계로 바뀐다([확인]·[다시 보내기]·[처음으로]).
  - [다시 보내기]는 같은 아이디·비밀번호로 AUTH-01을 다시 부른다. 1분 동안은 버튼을 막는다(서버는 429).
  - 첫 로그인(임시 비밀번호)이면 이어서 같은 화면에서 새 비밀번호를 정한다.
  - 1회용 토큰(`challengeToken`·`passwordSetupToken`)은 화면 상태에만 둔다. 저장하지 않는다.
  - 일반 사용자 흐름은 그대로다.
- **재확인(step-up) 모달:** [번호 보내기] → 6자리 → `stepUpToken`을 부른 쪽에 바로 넘긴다. 그 요청 한 번에만 쓴다(관리자 추가·비밀번호 변경).
- **관리자 비밀번호 변경:** `/admin/password`. 헤더에 [비밀번호 변경] 링크를 하나 두었다.
- **계정·권한 관리:** `/admin/accounts`
  - 검색, 권한·상태 필터, 표, 쪽 넘기기.
  - 열람 사유(확정 UI 5개 + 직접 입력)를 남기고 회원 상세를 연다.
  - 잠금(사유 모달)·잠금 해제. 본인 행은 "본인"으로 표시한다.
  - 관리자 추가: 재확인 → 임시 비밀번호를 모달로 한 번만 보여 준다.
- **접근·감사 로그:** `/admin/audit-logs`. 탭 2개(열람 감사 로그, 시스템 로그). 시스템 로그는 AUTH·INFO·WARN으로 거른다.
- **403 `PASSWORD_CHANGE_REQUIRED`:** 관리자 화면이 이 응답을 받으면 로그아웃하고 로그인 화면에 안내를 띄운다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/api/client.js` | ⚠️ 공통. 요청별 헤더 `options.headers` 추가(기존 호출은 그대로). 401이어도 `STEP_UP_REQUIRED`면 로그아웃하지 않음 |
| `frontend/src/common/mocks/mockHandlers.js` | ⚠️ 공통. mock 처리 함수에 `headers`·`query`(URLSearchParams)를 함께 넘김 |
| `frontend/src/common/routes/AppRoutes.jsx` | ⚠️ 공통. 계정·권한 관리, 접근·감사 로그 PlaceholderPage를 실제 화면으로, `/admin/password` 라우트 추가(관리자 가드 안) |
| `frontend/src/common/layout/AppHeader.jsx` | ⚠️ 공통. 관리자 헤더에 [비밀번호 변경] 링크(기존 `app-header__mypage` 클래스 재사용) |
| `frontend/src/features/auth/pages/LoginPage.jsx` | 관리자 2단계 인증·첫 비밀번호 설정 단계, 429 문구. `login()` 대신 `requestLogin` + `loginWithToken` |
| `frontend/src/features/auth/components/AdminTwoFactorStep.jsx` | 새 파일. 6자리 입력 단계 |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | 로그인 mock: 관리자면 2단계 인증 시작 응답. `listMockAccounts`·`addMockAccount` 내보내기 |
| `frontend/src/features/admin/adminConstants.js` | 새 파일. 경로·오류 코드·열람 사유·필터·쪽 크기 등 상수 |
| `frontend/src/features/admin/adminFormat.js` | 새 파일. 날짜·금액·개수 표시 |
| `frontend/src/features/admin/useAdminErrorHandler.js` | 새 파일. 403 `PASSWORD_CHANGE_REQUIRED` → 로그아웃 |
| `frontend/src/features/admin/api/adminAuthApi.js` | 새 파일. AUTH-11, 비밀번호 설정, step-up, 비밀번호 변경 |
| `frontend/src/features/admin/api/adminApi.js` | 새 파일. ADM-05~10 |
| `frontend/src/features/admin/components/*.jsx` | 새 파일 8개. 재확인 모달, 임시 비밀번호 모달, 잠금 사유 모달, 열람 사유 폼, 회원 상세, 관리자 추가 폼, 쪽 넘기기, 첫 비밀번호 설정 폼 |
| `frontend/src/features/admin/pages/*.jsx` | 새 파일 3개. 계정·권한 관리, 접근·감사 로그, 비밀번호 변경 |
| `frontend/src/features/admin/mocks/*.js` | 새 파일 6개. 위 API 전부의 mock(합성 계정 9개 추가, 로그 몇 건, 가린 값만) |

## DB·API 변경
- DB: 없음
- API: 서버 변경 없음. 화면이 부르는 경로·필드는 작업 7 계약 그대로다.
  - 공통 `client.js`에 요청 헤더 옵션을 더했다. 기존 `apiPost(path, body)` 호출은 영향이 없다.
- 영향을 받는 기능·팀원: 공통 `client.js`·`mockHandlers.js`를 쓰는 모든 기능(동작 변화 없음, 인자만 추가). 관리자 탭의 다른 화면(모형 성능·통계·신고)은 건드리지 않았다.

## 확인
- 확인함:
  - `npm run lint` 통과, `npm run build` 통과.
  - `VITE_USE_MOCK=true` 개발 서버(5174)에서 Playwright로 실제 화면을 눌러 보는 흐름 22개 통과. 스크립트는 저장소 밖 임시 폴더에 있다.
    - 일반 사용자 로그인 유지, 잠긴 계정 문구 유지.
    - 관리자 2단계: 틀린 번호, 429, 통과, [다시 보내기](1분 뒤).
    - 목록 쪽 넘기기·검색·필터, 사유 열람·상세, 잠금·해제.
    - 관리자 추가·임시 비밀번호 1회 표시·중복 409.
    - 감사 로그·시스템 로그 필터.
    - 비밀번호 변경(불일치·현재 비밀번호 틀림).
    - 새 관리자 첫 로그인 → 비밀번호 설정 → 관리자 첫 화면.
    - 403 `PASSWORD_CHANGE_REQUIRED` → 로그아웃·안내.
    - localStorage에는 액세스 토큰만 있고 sessionStorage는 비어 있음. console에 임시 비밀번호·번호·1회용 토큰 없음.
- 확인 못 함:
  - 실제 서버 연동(작업 7 진행 중). 작업 3에서 확인한다.
  - 비밀번호 설정 토큰 만료 화면. mock에서 10분을 기다리지 않았다. 코드상 400·401이면 "처음부터 다시 로그인" 안내로 바뀐다.

## 다음 사람이 알아야 할 것
- 작업 7과 맞출 것:
  - AUTH-11·비밀번호 설정 응답의 토큰 이름. 화면은 `accessToken`과 `token`을 둘 다 받는다(`pickAccessToken`, `TODO(D-20)`).
  - 쪽 번호 시작값. 화면은 0부터 센다(`ADMIN_FIRST_PAGE`).
  - 관리자 아이디 규칙. 화면은 확정 UI 안내대로 소문자 시작 4~16자, 소문자·숫자·_를 쓴다.
  - 열람 화면 코드 `resource`. 화면은 `CREDIT_DATA`만 이름으로 바꾸고, 나머지 코드는 그대로 보여 준다.
- 임시 비밀번호 재발급(`POST /api/admin/admins/{userId}/temporary-password`) 버튼은 두지 않았다. 작업 시점에 작업 7에 아직 그 API가 없었다. 만들어지면 `AddAdminForm`과 같은 방식(재확인 → `TemporaryPasswordModal`)으로 관리자 행에 붙이면 된다.
- 새 화면은 공통 컴포넌트와 기본 마크업만 쓰고 새 className을 달지 않았다. 표·필터 줄·상세 목록 스타일은 프론트 담당 요청 목록에 있다(PR 본문).
- mock 시연 계정:
  - `admin`: 아무 비밀번호. 2단계 번호는 `123456`.
  - `admin_park`: 첫 로그인 비밀번호 설정 흐름 확인용.
  - 관리자 화면에서 새로 만든 관리자도 임시 비밀번호로 로그인된다(새로고침하면 사라짐).

## [2026-11-15 · JWC / Claude Code] 작업 9 — 작업 7 백엔드와 계약 맞추기 (브랜치 `feature-A/FP-80-admin`, merge dce775d 뒤)
- **화면을 백엔드 응답에 맞춘 곳**
  - `MemberDetailPanel`: creditProfile 키를 `cardLimitAmount`·`cardMonthlySpendAmount`·`delinquencyCount12m`·`privateLenderLoanBalanceAmount`로 바꿨다. `baseDate`(기준일) 줄을 더하고, 가입일은 `profile.joinedAt`으로 읽는다.
  - `AdminAuditLogsPage`: 열람 화면 코드 `MEMBER_DETAIL` 이름을 추가했다.
- **오류 문구**
  - `adminConstants.js`에 `ADMIN_ERROR_MESSAGES`(백엔드 code → 화면 문구)와 `adminErrorMessage(error)`를 두었다. 모르는 code는 서버 message를 그대로 쓴다.
  - 관리자 화면 7곳(2단계 인증·재확인·비밀번호 설정·비밀번호 변경·관리자 추가·계정 목록·감사 로그)이 이 함수로 문구를 보여 준다.
  - `SAME_PASSWORD`는 새 비밀번호 칸 오류로 보여 준다.
- **mock을 실제 응답 모양으로 맞춘 곳**
  - AUTH-11·비밀번호 설정 응답은 `token`이다.
  - step-up/send 응답은 `{ expiresInSeconds, maskedEmail }`이다.
  - 오류 code: `ADMIN_CHALLENGE_INVALID`·`VERIFICATION_CODE_EXPIRED`·`PASSWORD_SETUP_INVALID`·`SAME_PASSWORD`·`CODE_RESEND_TOO_SOON`·`CANNOT_CHANGE_SELF`·`ACCOUNT_WITHDRAWN`·`ACCESS_REASON_REQUIRED`
  - 문구는 백엔드와 같게 했다.
  - 가린 이메일 규칙, 임시 비밀번호 12자, 시스템 로그 문구(아이디 앞 2자 + ***), 열람 기록 `MEMBER_DETAIL`, 관리자 대상 ADM-08은 404
- 마크업·className·CSS는 바꾸지 않았다. 상세 목록에 '기준일' 줄 하나(데이터)를 더했다.
- **확인:** `npm run lint`·`npm run build` 통과. 실제 가동 결과는 `FP-80-admin-api.md` 작업 9 절에 있다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
