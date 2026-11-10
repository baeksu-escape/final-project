# 공통 프론트 v3 정리 — 사용자·관리자 메뉴 분기와 공통 설정 (FP-79)

- **날짜:** 2026-11-10
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/A-GROUP-V3-front-UPDATE`
- **관련 N-ID:** N-08-1, N-01-2 (삭제: N-08-3)
- **관련 결정:** D-01(등급 경계 임시), D-14(경로 임시안), D-23(알림 범위), decisions.md 1-3 "화면 분기"·"사용자 주 메뉴"·"관리자 탭"

## 무엇을, 왜 바꿨나
- v1 기준으로 남아 있던 공통 프론트를 v3(11/09)에 맞췄다. 화면은 역할로만 나눈다.
  - 사용자 주 메뉴 9개는 직군과 상관없이 같다.
  - "직군별 재무 진단" 묶음과 서브탭을 없애고, 안의 기능을 주 메뉴로 올렸다.
  - 마이 페이지는 헤더 버튼으로 옮겼다.
  - 관리자 탭은 5개다.
- 공통 코드가 기능 폴더(`features/dataInput`)를 불러오지 않게 데이터 입력 경로를 공통 `PATHS`로 옮겼다.
- 등급 상수를 `common/config/grades.js` 한곳에 모았다. FP-92 진단 내역은 이 상수를 쓰고, 점수가 없는 계정은 진단 내역이 0건이다.
- 1차 개발 기준이라 시연용 편의 기능은 만들지 않았다. 각 메뉴 화면은 다른 팀 범위라 빈 화면(PlaceholderPage)만 연결했다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/src/common/config/navigation.js` | 새 경로 추가, `USER_TABS` 9개, `ADMIN_TABS` 5개, `DATA_INPUT` 추가, `DIAGNOSIS`에 삭제 주석 |
| `frontend/src/common/routes/AppRoutes.jsx` | 새 메뉴·탭 빈 화면 연결, `/diagnosis` 라우트와 `DIAGNOSIS_CONTENTS`·`DiagnosisPage` import 삭제 |
| `frontend/src/common/layout/AppHeader.jsx` | 사용자 헤더 [알림]·[마이 페이지]·[로그아웃], 관리자는 [로그아웃]만 |
| `frontend/src/common/config/diagnosisTabs.js` | 맨 위 "v3 삭제" 주석만 |
| `frontend/src/common/pages/DiagnosisPage.jsx` | 맨 위 "v3 삭제" 주석만 |
| `frontend/src/common/auth/accessRules.js` | `PATHS.DATA_INPUT` 사용(기능 폴더 import 제거) |
| `frontend/src/features/dataInput/dataInputPaths.js` | `DATA_INPUT_PATHS.DATA_INPUT`이 `PATHS.DATA_INPUT`을 가리킴(값 그대로) |
| `frontend/src/features/dataInput/pages/JobSelectPage.jsx` | 안내 문구 "직군에 따라 소득 입력 항목이 달라집니다" |
| `frontend/src/common/config/grades.js` | 새 파일. 등급 코드·이름, 점수 범위, 경계, `getGradeByScore` |
| `frontend/src/features/auth/diagnosisHistoryConfig.js` | `GRADE_LABELS`를 공통 상수에서 다시 내보냄(이름 그대로) |
| `frontend/src/features/auth/mocks/diagnosisHistoryMockHandlers.js` | 공통 등급 판정 사용, `hasScore`가 false면 0건 |
| `frontend/src/common/types/index.js` | `User.hasScore` 추가 |
| `frontend/src/common/README.md` | A팀 줄만: 브랜치 이름, 헤더 설명, 계정 분기·메뉴 설정 위치, 등급 상수, 서브탭 삭제 안내, N-22 서브탭 줄 삭제 |

## 새 경로 (TODO(D-14) 임시안)
| 메뉴 | 경로 | nId |
|------|------|-----|
| 신용 리포트 | `/report` (그대로) | N-12 |
| 자산·부채 건전성 | `/asset-debt` | N-16 |
| 시나리오 테스트 | `/scenario` | N-17 |
| 현금흐름·소득 변동성 | `/cash-flow` | N-21·N-22 |
| 상권 분석 | `/market` | N-24 |
| 신용케어 시뮬레이터 | `/simulator` (그대로, 이름만 바뀜) | N-18 |
| 대출 상품 | `/loans` | N-37 |
| 비교 분석 | `/comparison` | N-13·N-26 |
| 신용 라운지 | `/lounge` | N-06 |
| (관리자) 신고 접수 | `/admin/reports` | N-34 |
| (관리자) 접근·감사 로그 | `/admin/audit-logs` | N-28·N-35 |
- 그대로인 경로: `/admin/model`·`/admin/stats`·`/admin/accounts`, `/mypage`, `/data-input`, `/select-job`, 로그인 전 화면, 소셜 경로
- 연결을 끊은 경로: `/diagnosis`, `/diagnosis/:subTab`. 이제 없는 페이지 안내로 간다.

## DB·API 변경
- DB: 없음
- API: 경로·필드 변경 없음. mock 동작만 바뀌었다. `GET /api/members/me/diagnoses`는 로그인 사용자의 `hasScore`가 false면 `{ items: [] }`다.
- 영향을 받는 기능·팀원
  - 각 메뉴 화면 담당: 새 경로에 자기 화면을 연결한다. `AppRoutes.jsx`의 PlaceholderPage 한 줄을 바꾼다.
  - 재무 진단 4개 화면 담당: `/diagnosis` 서브탭 대신 각자의 주 메뉴 경로를 쓴다.
  - 등급을 보여 주는 화면(신용 리포트, 시뮬레이터, 관리자): `common/config/grades.js`를 쓴다.

## 확인
- 확인함
  - `npm run lint` 오류 0건, `npm run build` 성공
  - 로직 node 검사 10건 통과(저장소 밖 스크립트): 등급 경계(664·665·779·780), 메뉴 9개·탭 5개와 경로 중복 없음, `getHomePath` 그대로, 진단 내역(employee 5건, self·freelancer 0건, `hasScore` true로 바뀌면 5건)
  - 헤드리스 Chrome 점검 21건 통과(mock 모드)
    - employee: 메뉴 9개 순서, 헤더 버튼 순서, 이름·배지 그대로, [알림] 안내, 메뉴마다 빈 화면 연결, 헤더로 마이 페이지 진입, 진단 내역 5건
    - `/diagnosis`·`/diagnosis/asset-debt`: 없는 페이지 안내
    - 사용자가 관리자 탭에 들어가면 `/forbidden`
    - self: 데이터 입력 화면, 같은 메뉴, 진단 내역 0건 안내
    - newbie: 직군 선택 화면과 바뀐 문구
    - admin: 첫 화면 모형 성능 비교, 탭 5개 경로, 헤더 [로그아웃]만, 사용자 메뉴에 들어가면 `/forbidden`
  - 기존 점검 회귀 73건 통과: 마이페이지(FP-93), 진단 내역(FP-92), 첫 화면·데이터 입력(FP-151)
  - 콘솔: 브라우저가 자동으로 요청하는 `favicon.ico` 404만 있다.
- 확인 못 함: 실제 백엔드 연동(서버 없음)

## 다음 사람이 알아야 할 것
- 메뉴 이름·순서·경로는 `common/config/navigation.js` 한곳에서 바꾼다.
- `diagnosisTabs.js`·`DiagnosisPage.jsx`는 연결만 끊었다. 팀 확인 후 지운다. `PATHS.DIAGNOSIS`도 이 파일들 때문에 남겨 두었다.
- 점수가 없는 사용자가 주소로 다른 메뉴에 직접 들어가면 지금은 막지 않는다(명세에 없음).
- 관리자가 사용자 화면에 들어가면 지금처럼 `/forbidden`으로 간다.
- [알림]은 자리만 있다. 누르면 "알림 기능은 준비 중입니다." 토스트를 띄운다(TODO(D-23)).
- 2차로 미룬 것: 이번 번호에는 없다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
