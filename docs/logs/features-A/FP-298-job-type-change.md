# 마이페이지 직군 변경 — 저장한 회원도 직군만 바꾸고 기존 입력 유지 (FP-298)

- **날짜:** 2026-11-28
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-259-260-mypage-data-input`
- **관련 N-ID:** N-04-8 (함께 본 곳: N-05-1 직군 선택, N-05-8 입력 완료 현황)
- **관련 결정:** 11/28 조장 확인 — 직군 변경은 기존 입력을 유지하고 소득·기간 재입력을 안내한다(decisions.md 1-2). 예전 FP-227 규칙(저장 뒤 409 `JOB_TYPE_LOCKED`)을 대신한다.

## FP-298

### 무엇을, 왜 바꿨나
- 원래 서버(MEM-05 `PATCH /api/members/me/job-type`, `MyPageService.selectJobType`)는 저장한 회원의 직군 변경을 막았다.
  - 직군이 이미 있는 회원이 다른 직군을 보내면, 저장 기록(`USER_ASSET_SNAPSHOT` 기준월)이나 평가(`ASSESSMENT`)가 하나라도 있는지 봤다.
  - 있으면 409 `JOB_TYPE_LOCKED`를 줬다. 같은 직군을 보내면 바꾸지 않고 200을 줬다.
- 바꾼 규칙
  - 다른 직군이면 저장 여부와 상관없이 바꾼다(조건부 UPDATE는 그대로라 동시 변경은 409 `JOB_TYPE_ALREADY_SELECTED`).
  - 같은 직군이면 400 `SAME_JOB_TYPE`, 틀린 값이면 400 `INVALID_INPUT`이다. 둘 다 `fieldErrors[0].field = jobType`이다.
  - 탈퇴·잠긴 계정은 지금처럼 JWT 필터가 401로 막는다(잠김은 `ACCOUNT_LOCKED`).
  - 바꾸면 시스템 로그 INFO에 `직군 변경 EMPLOYEE → FREELANCER (me***)`처럼 가린 아이디와 직군 코드만 남긴다.
  - 저장된 입력·평가 행은 읽지도, 지우지도, 바꾸지도 않는다. DB 구조 변경은 없다.
- 화면: 마이페이지 계정 관리 카드 맨 아래 줄을 위 2×2와 같은 격자로 바꿨다.
  - 왼쪽 [직군 변경하기], 오른쪽 [회원 탈퇴]다.
  - [직군 변경하기]를 누르면 같은 카드 안에 지금 직군·새 직군·안내문·[변경하기][취소]가 펼쳐진다. 탈퇴 폼과 한 번에 하나만 열린다.
- 데이터 입력 첫 화면의 직군 선택(가입 직후, `JobSelectPage`)은 화면을 그대로 뒀다. 같은 직군이면 요청을 보내지 않으므로 400 규칙의 영향이 없다.

### 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../user/service/MyPageService.java` | `selectJobType` — 저장 여부 잠금 제거, 같은 직군 400 `SAME_JOB_TYPE`, 변경 시 시스템 로그. 생성자 인자 `FinancialInputMapper` → `SystemLogService` |
| `backend/.../user/controller/MyPageController.java` | MEM-05 주석만 새 규칙으로 |
| `backend/src/test/.../user/service/SocialAndMyPageServiceTest.java` | 저장한 회원 변경·로그, 같은 직군 400, 틀린 값 400, 동시 변경 409 시험으로 바꿈 |
| `backend/src/test/.../user/controller/JobTypeChangeApiTest.java` (새 파일) | 실제 서비스·JWT 필터로 200·400·400·잠김/탈퇴 401 |
| `frontend/src/features/auth/components/JobTypeChangeForm.jsx` (새 파일) | 직군 변경 폼 |
| `frontend/src/features/auth/components/AccountManageCard.jsx` | 맨 아래 줄 [직군 변경하기]·[회원 탈퇴] 격자, 폼 하나만 열기 |
| `frontend/src/features/auth/auth.css` | 맨 아래 줄 격자·직군 변경 폼 모양 |
| `frontend/src/features/dataInput/mocks/dataInputMockHandlers.js` | mock MEM-05를 서버와 같은 규칙으로 |
| `frontend/src/features/dataInput/pages/JobSelectPage.jsx` | 409 `JOB_TYPE_LOCKED` 설명 주석만 고침(화면 변경 없음) |
| `docs/ai/features.md`·`docs/ai/decisions.md`·`docs/spec/api/api_definition.md` | N-04-8, 1-2 표 한 줄, MEM-05 줄 |

### DB·API 변경
- DB: 없음. 쓰는 곳은 `APP_USER.WORKER_TYPE_CODE`·`UPDATED_AT`, `SYSTEM_LOG` 1행이다.
- API: MEM-05 응답 규칙이 바뀌었다.
  - 같은 직군: 200 → 400 `SAME_JOB_TYPE`
  - 저장한 회원: 409 `JOB_TYPE_LOCKED` → 200 (`JOB_TYPE_LOCKED`는 더 쓰지 않음)
  - 요청·응답 필드는 그대로다.
- 영향을 받는 기능·팀원
  - 직군별 비교 분석(N-13·N-25·N-26)·리포트·진단 내역은 응답의 평가 당시 직군(`ASSESSMENT.WORKER_TYPE_CODE`)을 본다. 다시 산출한 뒤부터 새 직군이 되고, 평가 행의 직군 칸은 바꾸지 않았다(13차 확인).
  - `docs/spec/api/api_spec_a.md` MEM-05 줄·오류 표도 11차에 지금 동작으로 맞췄다.

### 확인
- 확인함
  - `./mvnw test -DargLine=-Dfile.encoding=UTF-8` — 602개 통과(실패 0)
  - 실제 서버(로컬 Oracle, 8080·8000, Vite 5173)에서 mem000004로 확인했다.
    - 마이페이지에서 급여소득자 → 프리랜서로 바꿨다(PATCH 200).
    - 내 정보의 직군이 바뀌었고, 데이터 입력에 월별 소득 12칸이 보였다.
    - 1단계가 노랗게 표시되고, 7단계 남은 항목에 "월별 소득 — 최근 12개월 소득을 모두 입력하고 저장해 주세요."가 나왔다.
    - 같은 직군은 400 `SAME_JOB_TYPE`, 틀린 값은 400 `INVALID_INPUT`이었다.
    - `SYSTEM_LOG`에 INFO 2행(변경·되돌림)이 남았고, 가린 아이디 `me***`만 들어 있었다.
  - 1280·390 폭: 맨 아래 줄 두 버튼은 위 2×2와 같은 너비(157·139px), 가로·세로 간격 8px이다. 폼은 한 번에 하나만 열린다.
- 확인 못 함: mock 모드의 직군 변경 화면(lint만 통과).

### 다음 사람이 알아야 할 것
- decisions.md 1-2의 「직군 선택·변경」 행은 11차에 새 결정으로 고쳐 쓰고 10차에 더한 「직군 변경」 행과 합쳤다(옛 결정은 같은 행에 "이전:"으로 남김).
- decisions.md D-27에서는 N-04-8을 우선순위 미정 목록에서 뺐다. features.md N-04-8 제목의 "미정"은 우선순위 값이라 그대로 두고 구현 현황 줄을 더했다(13차).
- `UserAccountMapper.countAssessments`는 더 부르는 곳이 없지만 지우지 않았다.

### 검수 반영(11/28)
- `fastapi_server/artifacts/README.txt`(B팀 모형 설명서)를 저장소에서만 뺐다. 로컬 파일은 남기고 `.git/info/exclude`로 무시한다.
- decisions.md D-27·features.md N-04-8을 위와 같이 정리했다.
- 진단 내역 mock(`diagnosisHistoryMockHandlers.js`)이 서버처럼 진단 당시 직군을 보내게 고쳤다. 직군을 바꿔도 지난 진단의 직군은 그대로다.
- `JobTypeChangeApiTest`에서 쓰이지 않는 `countAssessments` 스텁을 지웠다.
- 14차(11/28): 직군 변경 안내를 실제 동작(기간 유지, 급여소득자 → 다른 직군일 때만 12개월 소득)에 맞췄고, 직군 선택 화면 옛 문구·닉네임 칸 오류 테두리·390 폭 내 정보 카드 높이·mock 소득 모양(서버 `toInput`과 같게)을 고쳤다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
