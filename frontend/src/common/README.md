# 공통 프론트 (feature-A/FP-79-publicFrontEnd)

A팀이 만든 공통 프론트입니다. 다른 팀은 이 틀과 부품 위에 화면을 만듭니다. 관련 N-ID는 N-01, N-08입니다.

## 이 브랜치에 포함된 기능

| 기능 | 내용 | 위치 |
|---|---|---|
| 앱 기본 틀 (헤더·탭·레이아웃) | 역할별 탭 메뉴, 사용자 이름·직군 배지, 로그아웃 버튼이 있는 공통 헤더. 다른 팀 화면은 빈 자리(placeholder)로 둠 | `layout/`, `pages/`, `routes/AppRoutes.jsx` |
| 로그인 상태·접근 제한 | 토큰 보관·삭제, 앱 전체에서 쓰는 로그인 상태(`useAuth`). 비로그인 → `/login`, 권한 없는 경로 → `/forbidden`, 직군 미선택 → `/select-job` | `auth/` |
| 역할·직군별 화면 분기 | 사용자·관리자 탭 구성, 직군별 재무 진단 서브탭 규칙(급여소득자: 현금흐름 숨김 / 프리랜서: 상권 지표 숨김 / 자영업자: 모두 표시) | `config/navigation.js`, `config/diagnosisTabs.js` |
| 공통 카드·입력 폼 | 카드, 금액 입력, 숫자 입력, 슬라이더, 선택 상자, 체크박스, 입력 오류 표시, 항목 추가·삭제 목록 | `components/` |
| API 공통 모듈 | 모든 요청에 토큰을 붙이고, 401이면 로그아웃. `VITE_USE_MOCK`으로 mock과 실제 API를 전환 | `api/`, `mocks/` |

스타일 코드(CSS·style·UI 라이브러리)는 포함하지 않았습니다. 디자인을 입힐 수 있도록 className만 붙였습니다.

## 다른 팀이 쓰는 방법

- **화면 붙이기:** `routes/AppRoutes.jsx`에서 자기 화면의 `PlaceholderPage` 한 줄만 바꿉니다.
- **서브탭 노출 판단:** `config/diagnosisTabs.js`의 `getVisibleDiagnosisTabs(jobType)`, `isDiagnosisTabVisible(jobType, key)`를 씁니다.
- **공통 컴포넌트:** `import { Card, MoneyInput } from '../../common/components/index.js'`. 사용법은 각 파일 맨 위 주석에 있습니다.
- **로그인 정보:** `const { user, logout } = useAuth()`
- **API 호출:** `apiGet`·`apiPost` 등(`api/client.js`)을 씁니다. mock 응답은 자기 폴더에서 `registerMockHandlers()`로 추가합니다.

## mock 계정 (개발용)

로그인 아이디는 `employee`, `self`, `freelancer`, `newbie`(직군 미선택), `admin`이고 비밀번호는 아무 값이나 됩니다.

## 팀 확인이 필요한 것

- API 응답 형식(D-20)과 화면 경로(D-14)는 임시안입니다. 코드에 `TODO(D-xx)`로 표시했습니다.
- 급여소득자에게도 소득 변동성(N-22) 탭이 보입니다. 명세의 N-22는 자영업자·프리랜서 대상입니다.
- 관리자가 사용자 화면에 들어가면 `/forbidden`으로 보냅니다.

자세한 작업 기록은 `docs/logs/features-A/FP-79-FrontEnd.md`에 있습니다.
