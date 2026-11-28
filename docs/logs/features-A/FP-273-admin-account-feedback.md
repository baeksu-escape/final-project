# 관리자 계정·권한 관리 1차 테스트 반영 — 닉네임 열, 직군 필터, 관리자 추가 화면 감춤 (FP-273)

- **날짜:** 2026-11-26
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-273-admin-account-feedback` (develop 297179e에서 분기)
- **관련 N-ID:** N-27-1, N-27-4
- **관련 결정:** decisions.md 1장 "관리자 추가 화면" (통합 관리자 운영, 11/26)

## 무엇을, 왜 바꿨나
- **ACCT-03 닉네임 열:** 계정 목록에서 회원을 닉네임으로도 알아볼 수 있게 ADM-05 응답 한 줄에 `nickname`을 더했다.
  - 화면은 [이름] 옆에 [닉네임] 열을 둔다.
  - 탈퇴 회원은 DB 표시값('탈퇴'+회원 번호)을 그대로 보여 준다.
- **ACCT-03 직군 필터:** ADM-05에 `workerType`(선택) 조건을 더했다.
  - 값은 `EMPLOYEE`·`SELF_EMPLOYED`·`FREELANCER`이고, 그 밖의 값은 role·status와 같은 400 `INVALID_INPUT`(칸 `workerType`)이다.
  - 화면은 [권한]·[상태] 옆에 같은 `Select`로 [직군]을 둔다. 필터를 바꾸면 첫 쪽부터 다시 본다.
- **ACCT-04:** 통합 관리자로 운영하기로 해 계정·권한 관리 화면에서 [관리자 계정 추가] 카드를 감췄다.
  - ADM-07·임시 비밀번호 재발급 API, `AddAdminForm.jsx`, `createAdminAccount`는 지우지 않았다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/src/main/resources/mapper/admin/AdminAccountMapper.xml` | `userColumns`에 `u.NICKNAME AS nickname`, `userFilter`에 `WORKER_TYPE_CODE = #{workerType}` 조건 |
| `backend/src/main/java/com/baeksuescape/admin/mapper/AdminAccountMapper.java` | `selectUsers`·`countUsers`에 `@Param("workerType")` 추가(메서드 이름 그대로) |
| `backend/src/main/java/com/baeksuescape/admin/dto/AdminRows.java` | `UserData` 맨 끝에 `nickname` |
| `backend/src/main/java/com/baeksuescape/admin/dto/AdminDtos.java` | `UserRow` 맨 끝에 `nickname`(기존 필드 이름·순서 그대로) |
| `backend/src/main/java/com/baeksuescape/admin/service/AdminAccountService.java` | `list`에 `workerType` 인자·검사(`AdminStatsService.WORKER_TYPE_CODES` 재사용), `toRow`가 닉네임을 넘김 |
| `backend/src/main/java/com/baeksuescape/admin/controller/AdminAccountController.java` | `GET /api/admin/users`에 `workerType`(선택) 쿼리 |
| `backend/src/test/java/com/baeksuescape/admin/service/AdminAccountServiceTest.java` | 기존 시험을 새 인자에 맞춤, 닉네임·직군 전달·틀린 직군 400 시험 추가 |
| `backend/src/test/java/com/baeksuescape/admin/controller/AdminApiTest.java` | `nickname` 응답·`workerType=FREELANCER` 통과·`workerType=WRONG` 400 시험 |
| `frontend/src/features/admin/adminConstants.js` | `WORKER_TYPE_FILTER_OPTIONS`(전체 + 공통 `JOB_TYPE_OPTIONS`) |
| `frontend/src/features/admin/api/adminApi.js` | `fetchAdminUsers`가 `workerType`을 보냄, 응답 주석에 `nickname` |
| `frontend/src/features/admin/pages/AdminAccountsPage.jsx` | [직군] 필터, [닉네임] 열(10열), [관리자 계정 추가] 카드와 쓰지 않는 import 제거 |
| `frontend/src/features/admin/mocks/adminMockShared.js` | `toAdminRow`에 `nickname` |
| `frontend/src/features/admin/mocks/adminMockHandlers.js` | 목록 `workerType` 필터, 틀린 값 400 |
| `docs/ai/features.md` | N-27-1 목록 열·필터, N-27-4 화면 감춤 |
| `docs/ai/decisions.md` | 1장 "관리자 추가 화면" 줄 |
| `docs/spec/api/api_definition.md`, `docs/spec/api/api_spec_a.md` | ADM-05 `workerType` 조건, 응답 `nickname` |

## DB·API 변경
- DB: 없음(이미 있는 `APP_USER.NICKNAME`·`WORKER_TYPE_CODE`를 읽기만 한다).
- API: ADM-05 `GET /api/admin/users`
  - 요청에 `workerType`(선택)을 새로 받는다.
  - 응답 `items[]` 맨 끝에 `nickname`이 생긴다.
  - ADM-06 잠금·해제 응답도 같은 한 줄 모양이라 `nickname`이 함께 실린다.
- 영향을 받는 기능·팀원: 관리자 계정·권한 관리 화면(A팀)만 쓴다. 기존 필드는 그대로라 다른 호출부는 영향이 없다.

## 확인
- 확인함
  - `./mvnw test` 전체 522개 통과(실패 0). `AdminApiTest` 9개, `AdminAccountServiceTest` 10개 포함.
  - `npm run lint` 오류 0, `npm run build` 성공.
  - mock 개발 서버 + 헤드리스 Edge로 관리자 로그인 → `/admin/accounts`:
    - [닉네임] 열이 [이름] 옆에 있다(탈퇴 계정은 `탈퇴u-old01`).
    - 필터가 [권한]·[상태]·[직군] 3개다.
    - 직군 자영업자 3명, 프리랜서 2명으로 걸러진다.
    - [관리자 계정 추가] 카드가 없다.
- 확인 못 함
  - 실제 Oracle DB에서 `NICKNAME`·`WORKER_TYPE_CODE` 조건 SQL 실행(시험은 mapper를 mock으로 바꿔 돌렸다).
  - 화면에서 틀린 직군 값 400(화면은 고정 선택지만 보내므로 백엔드 시험으로만 확인했다).

## 다음 사람이 알아야 할 것
- 관리자 계정을 다시 화면에서 만들 일이 생기면 `AdminAccountsPage.jsx`에 `AddAdminForm` 카드를 되살리면 된다. API·컴포넌트는 그대로다.
- 직군 코드 목록은 백엔드 `AdminStatsService.WORKER_TYPE_CODES`, 프론트 `common/config/jobTypes.js`를 쓴다. 코드가 늘면 두 곳을 함께 본다.

## develop 병합(11/28)
- 병합 기준: origin/develop `928b126`(#182 FP-258 로그인·회원가입 1차 테스트·멘토링 반영)을 이 브랜치(`d89c4a6`)에 병합했다.
- 충돌은 `docs/ai/decisions.md` 1-2 표 한 곳이었다.
  - 이 브랜치의 「관리자 추가 화면」(11/26) 행은 그대로 살렸다.
  - 두 쪽이 함께 고친 「가입 입력」 행은 develop 쪽(11/27, 닉네임 2~7자·소문자 저장·한글 이름·새 비밀번호 칸만 거름)으로 하나만 남겼다. 이 브랜치 쪽 내용은 develop 행에 모두 들어 있다.
- `adminMockHandlers.js`는 자동 병합됐다. develop(PR1)의 "잠금 해제 때 실패 횟수 0"과 이 브랜치의 직군 필터·틀린 값 400·닉네임 검색이 모두 남았다.
- `features.md`·`api_definition.md`에 충돌 표시가 없다.
- 병합 뒤 #166 새 화면에서도 [닉네임] 열, [직군] 필터(바꾸면 1쪽으로), [관리자 계정 추가] 감춤이 그대로인지 mock으로 확인했다.

## FP-275

### 무엇을, 왜 바꿨나
- **N-28-2 접근·감사 로그(LOG-01):** 두 표(열람 감사·시스템)의 높이를 한 쪽(`ADMIN_PAGE_SIZE`, 10줄) 크기로 고정했다.
  - 열 너비는 `table-layout: fixed`로 고정하고, 긴 칸(사유·내용·대상 회원 등)은 한 줄 말줄임 + `title`이다.
  - 불러오는 중·오류·"기록이 없습니다"도 표 상자 안에 보여 줘서, 마지막 쪽이나 건수가 적은 구분에서도 [이전]/[다음] 위치가 같다.
  - 쪽을 넘기는 동안에는 지난 쪽을 흐리게 두고(`aria-busy`) 새 쪽이 오면 바꾼다. 빈 줄은 그리지 않는다.
- **N-35-1 회원 상세(AUDIT-01):** 네 묶음을 이름·값 2열 목록으로 바꿨다.
  - 넓은 화면은 2×2, 900px 미만은 한 줄에 하나로 놓는다.
  - 패널을 열면 패널로 스크롤한다(움직임 줄이기 설정이면 바로 이동).
- **관리자 비밀번호 길이 안내(PR2 12차 후속):** 관리자 첫 비밀번호 설정·비밀번호 변경 화면도 64자를 넘으면 칸 아래에 바로 길이 오류를 보이고 저장 버튼을 끈다.
  - 공통 `validation.js`·`PasswordRuleList.jsx`와 서버 `AccountRules` 문구, `AuthServiceTest` 한 줄은 PR2(`feature-A/FP-259-260-mypage-data-input`)와 글자까지 같은 줄로만 바꿨다(두 PR을 합칠 때 충돌하지 않게). 서버 길이 규칙(64자)은 그대로다.

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/features/admin/admin.css` (새 파일) | 관리자 전용 스타일(admin- 접두어, tokens.css 변수만): 로그 표 고정 높이·열 너비·말줄임, 회원 상세 2×2·2열 목록 |
| `frontend/src/features/admin/pages/AdminAuditLogsPage.jsx` | 공통 로그 표 `AdminLogTable`, 열 정의, 안내를 표 상자 안으로, 쪽 넘김 중 표시 |
| `frontend/src/features/admin/components/MemberDetailPanel.jsx` | 네 묶음 `DetailGroup`, 2열 목록, 열면 스크롤 |
| `frontend/src/features/admin/components/AdminPasswordSetupForm.jsx`, `frontend/src/features/admin/pages/AdminPasswordPage.jsx` | 64자 초과 즉시 오류·버튼 끔 |
| `frontend/src/features/auth/validation.js`, `frontend/src/features/auth/components/PasswordRuleList.jsx` | PR2와 같은 줄: 길이 문구, 64자 줄 목록에서 숨김 |
| `backend/.../user/service/AccountRules.java`, `backend/src/test/.../user/service/AuthServiceTest.java` | PR2와 같은 줄: 길이 문구 |
| `docs/ai/features.md` | N-28-2·N-35-1 구현 현황, N-27-4 관리자 비밀번호 줄, 새 비밀번호 줄(PR2와 같은 글) |

### DB·API 변경
- DB·API: 없음(오류 문구 하나만 바뀌었다. 400 code와 칸 이름은 그대로다).

### 확인
- 확인함
  - `./mvnw test -DargLine=-Dfile.encoding=UTF-8`: 599개 통과
  - `npm run lint`, `npm run build`: 통과
  - mock + 헤드리스로 1280·768·390 폭, 밝은·어두운 테마를 확인했다. 결과는 아래 줄에 적었다.
- 확인 못 함
  - 실제 서버 로그 화면(mock만 확인했다).
  - "기록이 없습니다" 상태: mock 시스템 로그는 구분마다 1건 이상이라 화면에 나오지 않았다.

### 다음 사람이 알아야 할 것
- mock 시스템 로그는 9건이라 한 쪽(10건)보다 적다. 열람 감사 로그는 2건이라, 확인할 때 회원 상세를 여러 번 열어 두 쪽을 만들었다(mock 데이터는 바꾸지 않았다).
- `validation.js`의 64자 규칙 바로 위에 「FP-258 길이 상한도 목록에 보여 준다」 옛 주석이 PR2와 같이 남아 있다. 두 PR이 develop에 들어간 뒤 지운다.

## 4차(11/28) — 관리자 화면 UI v2 틀

### 무엇을, 왜 바꿨나
- #166(UI v2) 때 다른 담당의 관리자 화면(모형 성능·통계·신고 접수)은 공통 틀로 바뀌었다. A팀 화면 셋(접근·감사 로그, 계정·권한 관리, 비밀번호 변경)은 `<section><h1><p>` 옛 머리라 관리자 탭을 오갈 때 모양이 달랐다. 원래 UI 담당 이슈였는데 이 브랜치에서 맞췄다.
- 세 화면의 머리를 통계 화면과 같은 `.page-head`(제목 `page-head__title` + 설명 `page-head__lead`)로 바꿨다. 설명 문장은 그대로다.
- 접근·감사 로그
  - [열람 감사 로그 | 시스템 로그] 탭을 통계 화면의 구분 줄처럼 `section.card.l-g2`에 넣고, 그 아래에 "최신 기록이 위에 옵니다." Notice를 둔다.
  - 두 로그 카드 안의 Chip과 구분 탭은 카드 폭으로 늘어나지 않게 왼쪽에 둔다.
  - 카드 끝 안내 문장에는 `.hint`를 붙였다.
- 계정·권한 관리
  - 검색 카드는 공통 규칙(`.card__body:has(> form[role='search'])`)으로 검색 칸·권한·상태·직군을 한 줄에 둔다.
  - 공통 form 격자(칸 최소 200px) 때문에 [검색]이 칸 아래로 내려가던 것을 `admin-search`로 붙였다. 인원 Chip은 입력 칸 높이 가운데에 둔다.
- 표·회원 상세 패널·잠금 창·비밀번호 폼·64자 오류·FP-275 로그 표 동작과 보여 주는 문구·API는 그대로다.

### 바뀐 파일
- `frontend/src/features/admin/pages/AdminAuditLogsPage.jsx`, `AdminAccountsPage.jsx`, `AdminPasswordPage.jsx`: 머리·탭 줄·검색 줄 마크업
- `frontend/src/features/admin/admin.css`: `admin-log-tabs`, `admin-log-card`, `admin-search`, `admin-search__count` 정렬 규칙(공통 CSS·공통 컴포넌트는 고치지 않음)
- `docs/ai/features.md` N-27-1 UI 줄 한 구절

### 확인
- `npm run lint`, `npm run build`: 통과
- mock 관리자 로그인 → 통계(비교용)·계정·권한 관리(회원 상세 열기 포함)·접근·감사 로그(두 탭)·비밀번호 변경을 1280·768·390 × 밝은·어두운 테마로 찍었다.
  - 머리 시작 위치·높이·아래 간격이 통계 화면과 같다: 1280 101/203/20px, 768 125/200/20px, 390 163/181/20px. 비밀번호 변경은 설명이 한 줄이라 1280에서 최소 높이 200px이다.
  - FP-275 표: 높이 493px, [이전]/[다음]은 표 위에서 505px로, 열람 감사 첫·마지막 쪽과 시스템 전체·AUTH·INFO·WARN에서 모두 같다(전·후 같음).
  - 가로 넘침·콘솔 오류 없음
- 확인 못 함: 실제 서버(mock만 확인했다).

## 5차(11/28) — 직접 시험 피드백

### 무엇을, 왜 바꿨나
- 실제 서버로 시험한 피드백이다. 원칙은 "쪽·탭·내용이 조금 달라도 화면이 출렁이지 않는다"이다.
- **계정 목록 쪽 넘기기**
  - 원인: 열 너비가 내용에 따라 바뀌고, 줄마다 높이가 달랐다("본인" 줄 55px, 버튼 줄 61px). 표 높이도 줄 수만큼 바뀌었다.
  - 고친 것: 접근·감사 로그 표(FP-275)처럼 열 너비 고정(table-layout fixed), 줄 높이 61px, 긴 칸 말줄임 + title을 적용했다. 표 상자는 한 쪽(10줄) 높이를 늘 차지하고, 안내 문구는 상자 안에 두며, 불러오는 동안 지난 쪽을 흐리게 둔다.
- **열람 사유 줄**
  - [열람 사유] → [사유 남기고 열기] → [취소]를 48px 높이·8px 간격으로 한 줄에 두고, 안내는 아래 한 줄(.hint)로 옮겼다.
  - 좁은 화면에서는 두 버튼이 함께 아래 줄로 내려가고, 폼은 표 상자의 보이는 폭에 맞춘다.
- **상세 패널**
  - 원인: 패널이 회원 목록 카드 아래(쪽 넘기기 뒤)에 붙어, 연 줄에서 멀리 떨어졌다. 닫아도 패널 자리에 남아 보던 줄을 다시 찾아야 했다.
  - 고친 것: 연 줄을 바탕색으로 표시하고, 닫으면 그 줄로 스크롤해 [상세 보기]에 포커스를 둔다. 패널 제목(대상 아이디 포함)은 메뉴 줄 아래에서 온전히 보인다.
- **잠금 창**
  - 원인(공통): 본문 `.page-enter`의 들어오는 애니메이션(transform·filter·opacity, fill both)이 fixed 창의 기준·층이 됐다. 그래서 공통 Modal을 그 안에 그리면 배경이 화면이 아니라 본문에 붙었다(맨 위 top 101px, 스크롤하면 −90px). 창이 스크롤과 함께 올라가 메뉴 줄(z-index 35)에 가렸다.
  - 고친 것: `LockReasonModal`만 portal로 body 아래에 그리고, 창을 열 때 잰 메뉴 줄 아래에 둔다. 창 안은 사유 칸 한 줄 + [잠그기]·[취소] 2칸이다.
- **접근·감사 로그 탭**
  - 고친 것: 시스템 로그 구분을 위 탭 줄 오른쪽 칸으로 옮겼다(열람 감사 탭에서는 같은 높이로 비움). 두 로그 카드는 같은 뼈대(Chip 줄·표·쪽 넘기기 자리·안내 줄)를 쓴다. 시스템 카드는 Chip·안내를 보이지 않게 두어 높이만 맞춘다.
  - 순서는 머리 → Notice → 탭 줄 → 로그 카드로 바꿨다.

### 바뀐 파일
- `frontend/src/features/admin/pages/AdminAccountsPage.jsx`, `AdminAuditLogsPage.jsx`
- `frontend/src/features/admin/components/AccessReasonForm.jsx`, `LockReasonModal.jsx`
- `frontend/src/features/admin/admin.css`(admin- 접두어 규칙만 추가)
- `docs/ai/features.md` N-27-1·N-28-2 한 구절
- 공통 Modal·공통 CSS·레이아웃은 고치지 않았다. `MemberDetailPanel.jsx`는 고칠 것이 없었다.

### 확인
- `npm run lint`, `npm run build`: 통과
- mock 1280·768·390 × 밝은·어두운 테마
  - 계정 목록: 1쪽(본인·관리자 줄 포함)·2쪽(마지막 쪽 5줄)·검색 1명에서 표 상자 654px, 줄 61px, 열 너비 같음, [이전]/[다음]은 카드 위에서 742px(어두운 테마 743px)이다.
  - 잠금 창: 세 가지 스크롤 위치에서 제목 y가 메뉴 줄 아래에 있다(1280 114px > 69px, 768 145px > 105px, 390 183px > 143px).
  - 로그 탭을 오가도 로그 카드 시작 y·높이·[이전]/[다음] y가 같다.
- 확인 못 함: 실제 서버(mock만 확인했다).

### 다음 사람이 알아야 할 것
- 공통 Modal을 쓰는 다른 화면도 스크롤한 뒤 열면 같은 문제가 생길 수 있다. 공통 담당이 Modal을 portal로 그리거나, `.page-enter` 애니메이션 끝 값을 남기지 않게(fill-mode) 고치는 것을 권한다. 고치면 `LockReasonModal`의 portal은 빼도 된다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
