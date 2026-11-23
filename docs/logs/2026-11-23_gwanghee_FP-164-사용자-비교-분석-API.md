# N-26-5~7 사용자 비교 분석 API (ADM-04)

- **날짜:** 2026-11-23
- **작성자:** 임광희(C팀) / Claude Code
- **브랜치:** `feature-C/FP-164-group-compare-api` (Jira FP-164)
- **관련 N-ID:** N-26-5 비교 분석 화면(사용자), N-26-6 직군 × 연령 격자·선택한 집단, N-26-7 직군별·연령별 비교
- **관련 결정:**
  - 11/23 동주·광희 합의: 동주는 N-13 내 위치 API·`/comparison` 화면 틀·카드 3개, 광희는 이 API와 그 아래 격자·비교 화면(동주 PR 병합 뒤)
  - 집계 기준은 FP-162(ADM-03)와 같다: ACTIVE 모델의 최근 평가, 탈퇴 제외(D-28), 5명 미만 숨김
  - D-27(우선순위 미정)에 N-26-5~7이 아직 남아 있다. 상태 변경은 사람이 decisions.md에서 한다

## 무엇을, 왜 바꿨나
- 주 메뉴 '비교 분석'의 격자·비교 화면이 쓸 API가 없었다. 화면은 동주 PR을 기다리므로 API를 먼저 만들었다.
- `GET /api/members/me/group-comparison` (일반 회원만)
  - 경로: 내 평가(`me`)가 들어 있어 Q-8 규칙대로 `/api/members/me/` 아래에 두었다(DIAG-01 `peer-benchmark`와 같음). 정의서의 옛 경로 `/api/stats/compare`를 바꿨다. ID는 ADM-04 그대로다.
  - 한 번 호출로 전체(`overall`), 직군 3개(`byWorkerType`), 연령대 4개(`byAgeBand`), 격자 12칸(`grid`), 내 평가(`me`)를 준다. 화면의 보기 전환(직군 × 연령, 직군별, 연령별)마다 다시 부르지 않아도 된다.
  - 집단 한 개의 모양은 ADM-03 `groups[]`와 같다. 관리자 전용 수치(가입 회원 수·오늘 산출)는 없다.
- 계산은 새로 만들지 않고 FP-161 코드를 재사용했다.
  - `AdminStatsService`의 그룹 한 줄 계산을 `groupStats(code, members)`로 꺼내 공개했다(ADM-03 동작은 그대로).
  - 매퍼도 ADM-03의 `selectActiveModelVersion`·`selectLatestScoredMembers`를 그대로 쓴다. 새 SQL은 없다.
  - `me`는 같은 목록에서 토큰의 회원을 찾는다. 그래서 통계에 들어간 평가와 내 평가가 늘 같다.
- 프론트는 화면 없이 API 함수와 mock만 만들었다(화면은 동주 PR 병합 뒤). mock은 관리자 통계 mock의 예시 회원 14명과 계산 함수를 export해서 그대로 쓴다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../assessment/controller/GroupComparisonController.java` | 새 파일. ADM-04 |
| `backend/.../assessment/service/GroupComparisonService.java` | 새 파일. 집단 나누기와 내 평가 찾기 |
| `backend/.../assessment/dto/GroupComparisonDtos.java` | 새 파일. 응답(`GroupStats`는 ADM-03 것을 씀) |
| `backend/.../admin/service/AdminStatsService.java` | 그룹 계산을 `groupStats`로 꺼냄, 직군·연령대 코드 목록과 5명 기준 공개 |
| `backend/src/test/.../GroupComparisonServiceTest.java`, `GroupComparisonApiTest.java` | 새 시험 7개 |
| `frontend/src/features/comparison/api/groupComparisonApi.js` | 새 파일. `getGroupComparison()` |
| `frontend/src/features/comparison/mocks/groupComparisonMockHandlers.js` | 새 파일. mock |
| `frontend/src/features/admin/mocks/adminStatsMockHandlers.js` | 예시 회원·계산 함수 export(내용은 그대로) |
| `docs/spec/api/api_spec_c.md` | N-26-5~7 절 추가 |
| `docs/spec/api/api_definition.md` | ADM-04 행(경로·설명·담당 FP-164·✅) |

## DB·API 변경
- DB: 없음.
- API: ADM-04 새로 구현. 경로를 `/api/stats/compare`에서 `/api/members/me/group-comparison`으로 바꿨다(아직 쓰는 곳이 없었다).

## 확인
- 백엔드 새 시험 7개(서비스 4, API 3), 기존 관리자 통계 시험 10개 통과. 전체 `./mvnw clean test` 통과
- 프론트 `npm run lint`·`npm run build` 통과
- mock을 node로 직접 불러 확인: `employee` 계정은 `me`가 급여소득자·30대 640 → 700, `self` 계정은 `me` null, 관리자 403
- 확인 못 함: 실제 DB(로컬 Oracle)에서 호출. 매퍼는 ADM-03과 같아 `AdminStatsMapperIT`가 이미 확인한다

## 다음 사람이 알아야 할 것
- **빼기로 숨긴 값을 알아낼 수 있다.** 5명 기준을 값마다 따로 걸어서, 행 평균이 보이고 그 행의 칸 하나만 숨겨졌으면 빼기로 그 칸의 점수가 나온다. 사용자가 보는 화면이라 관리자 통계보다 영향이 크다. 2차 숨김을 넣을지 팀 결정이 필요하다(명세 알려진 한계에 적음).
- mock 예시 회원 14명은 격자 칸마다 5명이 안 돼서, mock 화면에서는 격자 값이 모두 '—'다. 화면을 만들 때 예시 회원을 늘릴지 정한다.
- D-27에서 N-26-5~7을 미정에서 빼는 것은 decisions.md 규칙대로 사람이 한다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
