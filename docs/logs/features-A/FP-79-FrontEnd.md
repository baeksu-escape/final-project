# 공통 프론트 기본 틀 (React 프로젝트 초기 설정 + 인증·라우팅·공통 부품)

- **날짜:** 2026-11-03
- **작성자:** JWC / Claude Code
- **브랜치:** `JWC_Work` (팀 규칙의 `feature-A/…` 이름과 다름. 형상 관리자 확인 필요)
- **관련 N-ID:** N-01(토큰·로그인 상태 구조), N-08(역할·직군별 화면 분기)
- **관련 결정:** D-14(폴더 구조·경로 임시안), D-20(응답 형식 임시안), D-06(데모 계정 미정)

## 무엇을, 왜 바꿨나
- `frontend/`의 package.json·vite.config.js·App.jsx·main.jsx가 비어 있어서 React(Vite) 프로젝트를 처음 설정했다.
- 다른 팀이 화면을 올릴 공통 틀을 `frontend/src/common/`에 만들었다. 헤더·탭, 토큰 인증 상태, 접근 제한, 직군별 서브탭 규칙, 공통 입력 컴포넌트, API 모듈(mock 전환)이 들어 있다.
- 스타일 코드(CSS·style·UI 라이브러리)는 넣지 않았다. className만 붙였다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `frontend/package.json` | 빈 파일 → scripts와 의존성(react, react-dom, react-router-dom / vite, @vitejs/plugin-react, eslint 등) |
| `frontend/package-lock.json` | 새 파일(npm 자동 생성) |
| `frontend/vite.config.js` | 빈 파일 → react 플러그인만 |
| `frontend/eslint.config.js` | 새 파일. Vite 템플릿 기본 ESLint 설정 |
| `frontend/index.html` | 새 파일. Vite 진입 HTML |
| `frontend/.env.example` | 빈 파일 → `VITE_USE_MOCK`, `VITE_API_BASE_URL` |
| `frontend/src/main.jsx` | 빈 파일 → App 렌더 |
| `frontend/src/App.jsx` | 빈 파일 → BrowserRouter + AuthProvider + AppRoutes |
| `frontend/src/common/**` | 새 파일 37개 (config, auth, api, mocks, layout, pages, routes, components, utils, types) |

## DB·API 변경
- DB: 없음
- API: 프론트에서 쓸 경로를 임시로 정함(백엔드 미구현, mock만 있음). TODO(D-20)
  - `POST /api/auth/login` → `{ accessToken, user }`
  - `GET /api/auth/me` → `{ user }`
  - `POST /api/auth/logout` → `{}`
  - `user = { userId, name, role: 'ROLE_USER'|'ROLE_ADMIN', jobType: 'EMPLOYEE'|'SELF_EMPLOYED'|'FREELANCER'|null }`
- 영향을 받는 기능·팀원: 모든 프론트 화면 담당(라우트·공통 컴포넌트 사용), 인증 백엔드 담당(응답 모양 맞추기)

## 확인
- 확인함
  - `npm run lint` 오류 0건
  - `npm run build` 성공
  - 규칙 함수 node 검사 29건 통과(직군별 서브탭, 접근 규칙, 숫자 형식, mock API)
  - 헤드리스 Chrome으로 개발 서버 점검 32건 통과(비로그인·급여·자영업·프리랜서·직군 미선택·관리자 라우팅, 401 로그아웃, 로그아웃 버튼, 404). 콘솔 경고·오류 없음
  - 공통 컴포넌트 10건 정적 렌더링 확인
- 확인 못 함
  - 공통 컴포넌트의 실제 입력 동작(타이핑·추가·삭제 클릭)은 아직 쓰는 화면이 없어 브라우저에서 확인하지 못함
  - 실제 백엔드 연동(VITE_USE_MOCK=false)은 서버가 없어 확인하지 못함
  - `npm audit`: 개발용 ESLint 의존성(minimatch)에 moderate 6건, 아직 수정판 없음

## 다음 사람이 알아야 할 것
- 화면을 붙일 때는 `src/common/routes/AppRoutes.jsx`의 해당 `PlaceholderPage` 한 줄만 자기 화면으로 바꾼다.
- 직군별 서브탭 노출은 `src/common/config/diagnosisTabs.js`의 `getVisibleDiagnosisTabs` / `isDiagnosisTabVisible`로만 판단한다.
- 서브탭 4개(자산·부채 / 소득 변동성 / 현금흐름 / 상권 지표)는 작업자가 정했다. 급여소득자에게도 소득 변동성(N-22) 탭이 보이는데, 명세의 N-22는 자영업자·프리랜서 대상이라 팀 확인이 필요하다.
- 관리자가 사용자 경로에 들어가도 `/forbidden`으로 보낸다(역할별 화면 분리).
- mock 계정: 로그인 아이디 `employee`·`self`·`freelancer`·`newbie`(직군 미선택)·`admin`, 비밀번호는 아무 값. 토큰 형식 `mock-token-u-<id>`.
- 다른 팀의 mock 응답은 자기 폴더에서 `registerMockHandlers()`로 추가할 수 있다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
