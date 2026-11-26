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

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
