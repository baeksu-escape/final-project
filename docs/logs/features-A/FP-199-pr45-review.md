# PR #45 검토 반영 — 마이페이지 접근 가드, 마이페이지 mock의 닉네임·가입일·휴대폰 null 처리 (FP-199)

- **날짜:** 2026-11-13
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-199-V3-UPDATE` (PR #45)
- **관련 N-ID:** N-08-1, N-04-1, N-04-2, N-04-6
- **관련 결정:** PR #45 검토 의견, 11/06 확정 UI(N-08-1 직군 선택·데이터 입력 중에도 헤더에 [마이 페이지]), DDL v0.3.2 `APP_USER.PHONE_ENC` nullable

## 무엇을, 왜 바꿨나
- **마이페이지 접근**
  - 문제: 마이페이지 경로가 `requireJobType` 가드 안에 있었다. 그래서 직군을 고르지 않은 회원이 헤더에서 [마이 페이지]를 누르면 `/select-job`으로 돌아갔다.
  - 확정 UI는 직군 선택·데이터 입력 중에도 헤더에 [마이 페이지]를 보여 준다(`accessRules.js` `canSeeMainMenu` 주석). 그래서 링크는 숨기지 않고, 마이페이지 라우트를 `requireJobType` 가드 밖으로 뺐다.
  - 마이페이지는 `<RouteGuard requiredRole={ROLES.USER} />`만 거친다. 다른 라우트의 가드 구조는 그대로다.
- **직군이 없는 계정의 마이페이지**
  - 내 정보의 직군 칸은 '직군 미선택'으로 보인다. 예전에는 '-'였다.
  - 진단 내역은 0건 안내가 나온다. 지금 mock 규칙은 hasScore가 false면 0건이다.
  - [직군 바꾸기] 버튼은 없다. N-04-8은 D-27 미정이라 처음부터 만들지 않았다(`AccountManageCard.jsx` 주석).
    - 대신 [데이터 다시 입력]을 누르면 데이터 입력 경로의 기존 `requireJobType` 가드가 직군 선택 화면으로 보낸다.
- **휴대폰 null**
  - DDL에서 휴대폰은 null일 수 있다(`PHONE_ENC` nullable).
  - mock의 `formatPhone`·`maskPhone`은 null이나 빈 값을 받으면 오류 없이 null을 돌려준다. `maskName`·`maskEmail`도 같은 방식으로 지켰다.
  - GET profile과 POST profile/unmask 모두 `phone: null`로 응답한다. 화면은 '등록 안 함'으로 보여 준다.
- **닉네임·가입일**
  - 계정에 저장된 값을 먼저 쓰고, 없을 때만 데모 값(`MY_PAGE_DEMO_PROFILES`)을 쓴다.
    - `nickname`: `account.nickname ?? 데모 값 ?? null`
    - `joinedAt`: `account.createdAt`(YYYY-MM-DD로 자름) `?? 데모 값 ?? null`
  - 가입 mock은 계정을 만들 때 `createdAt`(현재 시각 ISO 문자열)만 저장한다. 닉네임 입력·저장은 FP-87 브랜치에서 가입 화면과 함께 한다.
- **진단 내역(FP-92)**: PR #45 검토에 따라 FP-92 브랜치를 이 브랜치에 직접 병합했다.
  - 변경 내용은 `FP-92-diagnosis-request-id.md`에 있다: diagnosisId=REQUEST_ID, 산출 불가 행, 기존 점수가 없는 산출 행 '—'.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/routes/AppRoutes.jsx` | 마이페이지 라우트를 `requireJobType` 묶음에서 빼서 `requiredRole={ROLES.USER}` 묶음으로 옮김 |
| `frontend/src/features/auth/mocks/myPageMockHandlers.js` | 가림·형식 함수 4개의 null 처리, 닉네임·가입일은 계정 값을 먼저 쓰고 데모 값은 대체값 |
| `frontend/src/features/auth/mocks/myPageMockData.js` | 주석만(데모 값은 대체값) |
| `frontend/src/features/auth/mocks/authMockHandlers.js` | 가입 시 계정에 `createdAt` 저장 |
| `frontend/src/features/auth/components/MyProfileCard.jsx` | 휴대폰 null → '등록 안 함', 직군 null → '직군 미선택'(글자만, 마크업·className 그대로) |

## DB·API 변경
- DB: 없음
- API: 경로·필드 이름은 그대로다.
  - `GET /api/members/me/profile`과 `POST /api/members/me/profile/unmask`의 `phone`은 null일 수 있다.
  - `joinedAt`은 계정 가입 시각에서 날짜(YYYY-MM-DD)를 잘라 쓴다.
- 영향을 받는 기능·팀원
  - 공통 라우터(`AppRoutes.jsx`)는 공유 파일이다. 작업 지시서로 확인을 받았다.
  - 마이페이지 서버 담당: phone null, joinedAt은 가입일

## 확인
- 확인함: `npm run lint` 통과, `npm run build` 통과
- 확인함: Node 스크립트로 mock 처리 함수와 접근 규칙 함수를 직접 불러 25개 항목 통과
  - 직군 없는 계정(newbie)
    - 마이페이지 가드(`requiredRole: USER`)를 통과한다. 예전 가드였다면 `/select-job`으로 갔다.
    - 주 메뉴는 그대로 숨겨진다.
    - profile.jobType은 null이고, 진단 내역은 0건이다.
    - [데이터 다시 입력] 경로는 직군 선택 화면으로 보내진다.
  - 휴대폰 null·빈 값 계정: 내 정보 조회와 가림 해제가 오류 없이 `phone: null`을 준다. 이름·이메일이 null이어도 오류가 없다.
  - 휴대폰이 있는 기존 계정: 가림 값과 해제 값이 그대로다.
  - 새로 가입한 계정
    - `createdAt`이 ISO 문자열로 저장되고, 가입일은 오늘 날짜로 보인다.
    - 닉네임은 null이다(FP-87에서 추가).
  - 계정에 저장된 닉네임·가입일이 데모 값보다 먼저 쓰인다.
  - FP-92 진단 내역 점검 22개도 다시 돌려 통과했다.
- 확인 못 함: 브라우저 화면 확인. `npm run dev`(VITE_USE_MOCK=true)로 다음을 직접 확인해야 한다.
  - newbie로 로그인 → 헤더 [마이 페이지] → 마이페이지가 열리고 직군 칸이 '직군 미선택'으로 보이는지
  - 새로 가입한 계정의 가입일이 보이는지
  - 휴대폰 null 계정은 지금 데모 데이터에 없다. 화면에서는 mock 계정 값을 바꿔야 볼 수 있다.

## 다음 사람이 알아야 할 것
- 직군 없는 계정의 [직군 바꾸기]는 D-27이 정해지면 다시 본다. 지금은 [데이터 다시 입력] → 직군 선택 화면 흐름뿐이다.
- 닉네임 입력(FP-87)이 병합되면 새 가입자의 닉네임도 계정 값으로 보인다.
- `/diagnosis` 관련 파일(DiagnosisPage.jsx, diagnosisTabs.js, PATHS.DIAGNOSIS)은 팀 확인 전이라 건드리지 않았다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
