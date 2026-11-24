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
- 백엔드 새 시험 7개(서비스 4, API 3), 기존 관리자 통계 시험 10개 통과. 전체 `./mvnw clean test` 통과(11/24 최신 develop #149 반영 후 491개)
- 프론트 `npm run lint`·`npm run build` 통과
- mock을 node로 직접 불러 확인: `employee` 계정은 `me`가 급여소득자·30대 640 → 700, `self` 계정은 `me` null, 관리자 403
- 확인 못 함: 실제 DB(로컬 Oracle)에서 호출. 매퍼는 ADM-03과 같아 `AdminStatsMapperIT`가 이미 확인한다

## 11/23 화면: 같은 집단과 나란히 보기 (N-26-5~7)
- **결정(광희, 11/23)**
  - 격자는 표(`data-table`)로 그린다. 공통 `HeatmapGrid`(동주 님)는 숨긴 값(null)을 0점으로 그리고 색 기준도 0부터 잡는데, 격자 칸은 대부분 5명 미만이라 그대로 쓰면 '0점' 칸이 잔뜩 보인다.
  - N-26-7 점 그래프는 공통 부품이 없어 `CompareBar` 막대로 대신한다. 내 점수 세로선 대신 "내 대안 점수 ○점"과 "(내 집단)" 표시로 보여 준다.
  - 화면도 FP-164 PR에 같이 올린다.
- **만든 것** (`frontend/src/features/comparison/`)
  - `components/GroupCompareSection.jsx`: 구역 진입점. ADM-04를 한 번 불러 보기 전환(직군 × 연령 / 직군별 / 연령대별)마다 다시 부르지 않는다. 동주 님 `MyPositionSection`처럼 자기 데이터를 스스로 불러온다.
  - `components/GroupGridTable.jsx`: 직군 3 × 연령대 4 표, 오른쪽 끝 직군 평균, 맨 아래 연령 평균, 오른쪽 아래 전체. 칸은 공통 `Button`으로 고르고 '나'·'선택'을 글자로 표시한다.
  - `components/SelectedGroupPanel.jsx`: 고른 칸의 기존 → 대안 평균, 전체·같은 직군·같은 연령대 평균 대비, 내 점수 대비, 보통 이상 비율, 등급 분포(관리자 `GradeDistributionBars` 재사용)
  - `components/GroupBarsCompare.jsx`: 직군별·연령대별 막대, 요약표(관리자 `AdminStatsTable` 재사용, 전체 행 포함), 전체 등급 분포
  - `groupComparisonCodes.js`: 보기 이름, 행·열 순서, 차이 표시
  - `features/admin/adminStatsCodes.js`의 `groupLabel`이 `ALL`을 "전체"로 보여 준다(관리자 통계 응답에는 ALL이 없어 영향 없음).
- CSS·className은 새로 만들지 않았다. 공통 컴포넌트(`Card`·`Button`·`Notice`·`SegmentedControl`·`CompareBar`)와 기존 클래스(`l-stack`·`l-cols`·`data-table`·`hint`·`num`)만 썼다.
- **연결:** 동주 님 FP-253(`ComparisonPage.jsx`, PR #147)이 develop에 병합된 뒤, 동주 님이 비워 둔 주석 자리에 `<GroupCompareSection />` 한 줄을 넣었다. `/comparison`에서 내 위치 카드 아래에 보인다. 페이지 전체를 서버 렌더링해 두 구역이 함께 조립되는 것을 확인했다.
- **확인**
  - `npm run lint` 오류 0, `npm run build` 성공
  - mock 응답으로 서버 렌더링해 글자를 확인했다.
    - 격자: 칸은 모두 5명 미만이라 '—'(예시 회원 14명), 직군 평균 720.0·701.0, 연령 평균 30대 703.0, 전체 705.4, 내 칸 "나"
    - 직군별·연령대별: 막대, 요약표 전체 행, 숨김 안내, `me` 없을 때
    - 값이 있는 칸(가정 712.4): 전체 대비 +7.0, 같은 직군 −7.6, 같은 연령대 +9.4, 내 점수 대비 −12.4
  - 확인 못 함: 브라우저 화면(FP-253 병합 뒤 `/comparison`에서)

## 11/23 시안 맞추기: 색 격자(HeatmapGrid)·칸 값 전환·선택 집단 패널
- **왜:** 광희가 11/06 UI 비교 분석 시안처럼 만들기로 했다. 시안의 요소는 색 진하기 격자와 '나' 표시, 점선 평균, "칸에 표시할 값", 오른쪽 선택한 집단 패널이다.
- **동주 님 동의(11/23):** 공통 `HeatmapGrid`(FP-156)를 광희가 고쳐도 된다. 고친 범위는 동의 문안의 4가지뿐이다(커밋 분리 `b9a37b4`).
  1. 칸 값이 null·숫자가 아니면 '—'로 보이고 색 범위(최솟값·최댓값)에서 뺀다. 색은 가장 옅은 단계 그대로다.
  2. 직군·연령·전체 평균이 null이면 '—'. 연령 평균 행이 있으면 전체 칸도 늘 그린다.
  3. 선택 속성 `formatValue`(상승폭 "+n점", 비율 "n%"). 없으면 예전처럼 숫자 + unit이다.
  4. 숨긴 칸의 화면 낭독기 문구는 "인원 부족으로 숨김"이다.
  - 스타일 값(색·크기·테두리)은 바꾸지 않았다. 숫자만 넘기는 예전 사용법은 글자·색이 그대로다(서버 렌더링으로 확인). 이 부품을 쓰는 다른 화면은 없었다.
- **화면 변경**
  - 격자를 표(`GroupGridTable`, 삭제)에서 `HeatmapGrid`로 바꿨다.
  - "칸에 표시할 값" 전환(대안 점수 / 상승폭 / 보통 이상)을 넣었다. 등급 이름은 리뉴얼 규칙대로 한글로 쓴다.
  - 선택한 집단 패널을 시안처럼 바꿨다.
    - 집단 이름과 "n명 · 전체의 x%"
    - `panel-sunk` 상자에 평균 점수 기존 → 대안, "대안 모형으로 +n점"
    - 전체·직군·연령대 평균 대비, 내 점수와 비교, 보통 이상, 등급 분포
  - 등급 분포는 시안의 누적 막대 대신 지금 `CompareBar` 막대를 유지한다(광희 결정, 누적 막대는 새 스타일이 필요해서).
  - 시안의 색(베이지·초록)과 "합성 데이터 12,000명" 문구는 따르지 않는다(UI 리뉴얼 기준, D-26 서비스 회원).
- **확인:** `npm run lint` 오류 0, `npm run build` 성공. 화면 없는 Edge로 mock `/comparison`(employee)을 캡처해 격자·지표 전환 3가지·선택 패널을 확인했다.
- **mock 예시 회원(11/23 광희 결정):** 비교 분석 mock만 예시 회원을 칸마다 3~9명(78명)으로 따로 만들었다. 칸 색 진하기와 선택 패널 값을 mock에서 볼 수 있다.
  - 프리랜서·50대 이상은 3명으로 두어 숨김('—')도 보인다. 내 평가는 그대로 급여소득자·30대 700점이다.
  - 관리자 통계 mock(14명)과 동주 님 내 위치 mock(14명 기준 고정값)은 건드리지 않았다. 그래서 mock 화면에서는 내 위치 카드 숫자(예: 30대 급여소득자 3명)와 격자 숫자(8명)가 다르다. 실제 서버는 같은 쿼리라 같다.
- **11/06 UI 맞춤 2차:** 격자 안내를 제목 아래로 옮기고, 격자 아래에 글자 범례를 넣었다. 선택 패널의 비교 줄은 기존 `data-table`로 왼쪽 이름·오른쪽 값(▲·▼)으로 바꿨다.

## 11/23 직군별·연령대별도 색 칸으로, 문구 다듬기
- **왜:** 광희가 직군별·연령대별 보기도 "직군 × 연령 한눈에 보기"처럼 만들고, 'AI 느낌 지우기' 가이드의 문구·위계 부분을 반영하기로 했다.
- **화면**
  - 직군별·연령대별: 왼쪽은 공통 `HeatmapGrid`다(새 `GroupStripHeatmap`). 행은 집단이고, 열은 고른 지표의 기존 → 대안이다(대안 점수·보통 이상은 2칸, 상승폭은 1칸). 오른쪽은 선택한 집단 패널, 아래는 요약표(전체 행 포함)다.
  - 행을 누르면 그 집단을 고른다. '나'와 선택 테두리는 대안 칸에 붙는다.
  - `HeatmapGrid`의 평균 줄 제목이 '직군 평균'·'연령 평균'으로 고정돼 있어, 직군별·연령대별에서는 평균 줄을 쓰지 않는다. 전체 평균은 안내 줄과 패널의 "전체 평균 대비"로 보여 준다.
  - `SelectedGroupPanel`을 세 보기 공용으로 바꿨다(비교 대상을 넘겨받음). `GroupBarsCompare`(막대)와 전체 등급 분포 카드는 뺐다.
  - "칸에 표시할 값"은 세 보기가 함께 쓰고, 보기마다 고른 집단을 따로 기억한다.
- **문구(가이드 1번):** 개발자 말투를 사람 말투로 바꿨다.
  - "…값마다 계산에 들어간 인원이 5명보다 적으면 숨깁니다" → "5명보다 적은 집단은 개인 점수가 드러나지 않게 숨겨요(—)"
  - "대안 모형으로 +n점" → "대안 점수로 보면 +n점"
  - 오류·빈 데이터 문구도 같은 말투로 바꿨다.
  - '대안 점수'라는 용어는 화면 전체에서 쓰는 말이라 그대로 두었다(바꾸려면 팀 결정).
- **반영하지 않은 가이드:** 색 코드, 테두리·그림자, 비활성 버튼 색은 CSS 영역이라 프론트 담당 몫이다(AGENTS 3-2). 감점 요인·입력 폼 내용은 시뮬레이터 화면이다.
- **확인:** `npm run lint` 오류 0, `npm run build` 성공. 화면 없는 Edge로 mock `/comparison`을 캡처했다.
  - 격자, 직군별, 직군별에서 자영업자 행 클릭(패널이 자영업자 26명 · 630.2 → 688.2로 바뀜), 보통 이상 지표, 연령대별을 확인했다.

## 다음 사람이 알아야 할 것
- **빼기로 숨긴 값을 알아낼 수 있다.** 5명 기준을 값마다 따로 걸어서, 행 평균이 보이고 그 행의 칸 하나만 숨겨졌으면 빼기로 그 칸의 점수가 나온다. 사용자가 보는 화면이라 관리자 통계보다 영향이 크다. 2차 숨김을 넣을지 팀 결정이 필요하다(명세 알려진 한계에 적음).
- mock 예시 회원 14명은 격자 칸마다 5명이 안 돼서, mock 화면에서는 격자 값이 모두 '—'다. 화면을 만들 때 예시 회원을 늘릴지 정한다.
- D-27에서 N-26-5~7을 미정에서 빼는 것은 decisions.md 규칙대로 사람이 한다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
