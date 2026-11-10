# 공통 프론트 (feature-A/A-GROUP-V3-front-UPDATE)

A팀이 만든 공통 프론트입니다. 다른 팀은 이 틀과 부품 위에 화면을 만듭니다. 관련 N-ID는 N-01, N-08입니다.

## 이 브랜치에 포함된 기능

| 기능 | 내용 | 위치 |
|---|---|---|
| 앱 기본 틀 (헤더·메뉴·레이아웃) | 계정 유형별 메뉴, 사용자 이름·직군 배지, 헤더 버튼(사용자: 알림·마이 페이지·로그아웃 / 관리자: 로그아웃)이 있는 공통 헤더. 다른 팀 화면은 빈 자리(placeholder)로 둠 | `layout/`, `pages/`, `routes/AppRoutes.jsx` |
| 로그인 상태·접근 제한 | 토큰 보관·삭제, 앱 전체에서 쓰는 로그인 상태(`useAuth`). 비로그인 → `/login`, 권한 없는 경로 → `/forbidden`, 직군 미선택 → `/select-job` | `auth/` |
| 사용자·관리자 계정 분기 (N-08-1) | 역할로만 화면을 나눈다. 사용자 주 메뉴 9개는 직군과 상관없이 같고, 관리자 탭은 5개다. 메뉴 이름·순서·경로는 설정 파일 하나에 있다 | `config/navigation.js` |
| 등급 공통 상수 | 등급 코드·이름(Good·Standard·Caution), 점수 범위 300~900, 경계 780·665(임시, D-01). 실제 등급은 서버가 정해 보낸다 | `config/grades.js` |
| 공통 카드·입력 폼 | 카드, 텍스트 입력, 금액 입력, 숫자 입력, 슬라이더, 선택 상자, 체크박스, 입력 오류 표시, 항목 추가·삭제 목록 | `components/` |
| 공통 UI 부품 | 버튼(`Button`), 칩(`Chip`), 안내 박스(`Notice`), 진행률 막대(`ProgressBar`), 스위치(`Switch`), 구간 선택(`SegmentedControl`), 모달(`Modal`), 토스트(`Toast`) | `components/` |
| 공통 스타일 | 색·글꼴 변수(화이트·블랙 테마), 위 컴포넌트의 스타일 | `styles/` |
| 공통 차트 컴포넌트 (FP-156) | 수평 비교 막대, 시계열 추이선, 지표·증감 막대, 직군×연령 격자 히트맵 (경량 SVG 기반) | `components/` |
| API 공통 모듈 | 모든 요청에 토큰을 붙이고, 401이면 로그아웃. `VITE_USE_MOCK`으로 mock과 실제 API를 전환 | `api/`, `mocks/` |

공통 컴포넌트의 스타일은 `styles/`(`tokens.css`·`forms.css`·`components.css`)에 있고 `main.jsx`에서 불러옵니다. 기본은 화이트 테마이며 `html`에 `data-theme="dark"`를 달면 블랙 테마가 됩니다(전환 코드는 아직 없습니다). 화면별 스타일은 각 담당자가 따로 추가합니다.

## 다른 팀이 쓰는 방법

- **화면 붙이기:** `routes/AppRoutes.jsx`에서 자기 화면의 `PlaceholderPage` 한 줄만 바꿉니다.
- **서브탭 노출 판단:** 삭제됐습니다(v3, N-08-3). 직군별 서브탭은 없고 `/diagnosis` 경로도 연결하지 않습니다. `config/diagnosisTabs.js`·`pages/DiagnosisPage.jsx`는 팀 확인 전까지 파일만 남겨 둡니다.
- **등급 표시:** `import { GRADE_LABELS, SCORE_RANGE } from '../../common/config/grades.js'`. 서버가 보낸 등급 코드를 이름으로 바꿀 때 씁니다.
- **공통 컴포넌트:** `import { Card, MoneyInput, Button } from '../../common/components/index.js'`. 사용법은 각 파일 맨 위 주석에 있습니다. 버튼·입력·모달·알림 같은 UI는 새로 만들기 전에 여기에 이미 있는지 먼저 확인합니다.
- **차트 컴포넌트 (FP-156):** 외부 라이브러리 없이 가벼운 SVG로 렌더링되며, 테마 변수(`var(--mint)` 등)를 자동 지원합니다.
  - `CompareBar`: 나와 동년배/직군 평균 수평 비교 (`myValue`, `avgValue`, `unit`, `label`) — N-15-3
  - `TrendLineChart`: 4분기/12개월 추이선 및 기준선 (`data: [{ label, value }]`, `baseline`, `unit`) — N-24-3, N-10-2
  - `BarChart`: 항목별 수치 비교 및 0 기준 상하 증감(±) 막대 (`data: [{ label, value, color, tag }]`, `unit`) — N-24-3, N-12-8
  - `HeatmapGrid`: 직군 × 연령 매트릭스 히트맵 (`rows`, `columns`, `data`, `myCell`, `onSelectCell`, `unit`) — N-26-3, N-26-6
  - 사용 예시: `import { CompareBar, TrendLineChart, BarChart, HeatmapGrid } from '../../common/components/index.js'`
- **로그인 정보:** `const { user, logout } = useAuth()`
- **API 호출:** `apiGet`·`apiPost` 등(`api/client.js`)을 씁니다. mock 응답은 자기 폴더에서 `registerMockHandlers()`로 추가합니다.

## mock 계정 (개발용)

로그인 아이디는 `employee`, `self`, `freelancer`, `newbie`(직군 미선택), `admin`이고 비밀번호는 아무 값이나 됩니다.

## 팀 확인이 필요한 것

- API 응답 형식(D-20)과 화면 경로(D-14)는 임시안입니다. 코드에 `TODO(D-xx)`로 표시했습니다.
- 관리자가 사용자 화면에 들어가면 `/forbidden`으로 보냅니다.

자세한 작업 기록은 `docs/logs/features-A/FP-79-FrontEnd.md`와 `docs/logs/2026-11-09_dongju_FP-156-commonChart.md`에 있습니다.
