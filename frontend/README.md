# Avenue 프론트엔드 (React)

연령·직군별 대안 신용평가 서비스 Avenue의 화면이다. 사용자 화면(신용 리포트·재무 진단·시뮬레이터·대출 상품·신용 라운지 등)과 관리자 화면(모형 성능·통계·계정·신고·로그)을 만든다.

- 화면은 **Spring 백엔드(8080)만** 부른다. 점수 계산 서버(FastAPI, 8000)와 DB는 직접 부르지 않는다.
- 백엔드가 준비되기 전에는 **mock**(실제 응답과 같은 모양의 가짜 응답)으로 개발한다. `.env`의 `VITE_USE_MOCK` 하나로 mock과 실제 서버를 바꾼다.
- 화면 구성·문구의 기준은 11/06 확정 UI('Avenue 기능 데모 v2')이고, 기능 기준은 `docs/ai/features.md`다.

## 1. 기술 스택

| 항목 | 버전 |
|---|---|
| Node.js | 24 이상 권장 (팀 PC 확인 버전 v24.18.0, npm 11.16.0) |
| React | 19 |
| React Router | 7 |
| 빌드·개발 서버 | Vite 8 |
| 정적 검사 | ESLint 10 (`eslint.config.js`) |

차트·스타일용 외부 라이브러리는 쓰지 않는다. 차트는 SVG로 직접 그리고(`src/common/components`), 스타일은 일반 CSS 파일이다. 새 라이브러리는 추가하기 전에 팀에 확인한다(`AGENTS.md` 4장).

## 2. 폴더 구조

```
frontend/
├─ .env.example            환경 변수 견본 → .env로 복사해서 쓴다 (.env는 Git 제외)
├─ public/data/market/     상권 분석 정적 JSON (scripts/market으로 만든다)
├─ scripts/market/         상권 분석 JSON 생성 스크립트 (README 있음)
└─ src/
   ├─ main.jsx             시작점. 공통 CSS 3개를 불러온다
   ├─ App.jsx
   ├─ common/              모든 화면이 같이 쓰는 틀·부품 → 자세한 사용법은 src/common/README.md
   │  ├─ api/              API 호출(client.js: 토큰 붙이기·401 처리·mock 전환)
   │  ├─ auth/             로그인 상태(useAuth), 접근 제한(RouteGuard)
   │  ├─ components/       버튼·카드·입력·모달·토스트·차트 등 공통 부품
   │  ├─ config/           메뉴·경로(navigation.js), 역할, 등급, 직군
   │  ├─ layout/           헤더·탭 메뉴·화면 틀
   │  ├─ mocks/            mock 공통 처리기, 데모 계정
   │  ├─ routes/           AppRoutes.jsx (전체 라우트)
   │  └─ styles/           tokens.css(색·글꼴 변수, 화이트·블랙), forms.css, components.css
   └─ features/<기능>/     기능별 폴더. 안은 아래 구조를 따른다
      ├─ api/              그 기능의 API 함수 (common/api/client.js 사용)
      ├─ mocks/            그 기능의 mock 응답 (registerMockHandlers로 등록)
      ├─ components/       그 기능에서만 쓰는 부품
      ├─ pages/            라우트에 연결하는 화면
      └─ <기능>.css        그 화면 전용 스타일 (tokens.css 변수만 사용)
```

| 폴더 | 화면 (N-ID) |
|---|---|
| `features/auth` | 로그인·회원가입·아이디/비밀번호 찾기·소셜 로그인·마이페이지 (N-01~N-04) |
| `features/dataInput` | 직군 선택·데이터 입력·대안 데이터 불러오기 (N-05) |
| `features/market` | 상권 분석 (N-24) |
| `features/admin` | 관리자 계정·권한 관리, 접근·감사 로그, 관리자 비밀번호 (N-27·N-28·N-35) |
| `features/credit`, `diagnosis`, `simulation`, `community`, `ai` | 신용 리포트, 재무 진단, 시뮬레이터, 신용 라운지, AI 요약·챗봇 — 작업 중이거나 다른 브랜치에 있음 |

아직 만들지 않은 화면은 `common/routes/AppRoutes.jsx`에서 빈 자리(`PlaceholderPage`)로 연결돼 있다. 자기 화면을 붙일 때는 그 한 줄만 바꾼다.

## 3. 실행 방법

### 3-1. 처음 한 번
```
cd frontend
npm install
copy .env.example .env      # Git Bash·Mac은 cp .env.example .env
```

### 3-2. mock으로 실행 (백엔드 없이 화면만)
`.env`를 아래처럼 두고 실행한다.
```
VITE_USE_MOCK=true
VITE_API_BASE_URL=
```
```
npm run dev
```
브라우저에서 http://localhost:5173 을 연다.

**mock 데모 계정** (비밀번호는 아무 값이나 된다)

| 아이디 | 상태 |
|---|---|
| `employee` | 급여소득자, 점수 있음 → 모든 메뉴를 바로 볼 수 있다 |
| `self` | 자영업자, 점수 없음 → 데이터 입력부터 |
| `freelancer` | 프리랜서, 점수 없음 |
| `newbie` | 직군 미선택 → 직군 선택부터 |
| `admin` | 관리자. 비밀번호 다음 2단계 인증번호는 `123456` |
| `locked` | 잠긴 계정 안내 확인용 |
| `admin_park` | 초대만 된 관리자 → 첫 로그인 때 새 비밀번호 설정 화면 확인용 |

- 회원가입·이메일 변경의 이메일 인증번호도 mock에서는 `123456`이다.
- mock 데이터는 브라우저를 새로고침하면 처음 상태로 돌아간다.

### 3-3. 실제 서버와 연결해 실행 (전체 흐름)
화면 → Spring → FastAPI·Oracle 전체를 확인할 때는 아래 순서로 켠다. 앞 단계가 켜져 있어야 뒤 단계가 동작한다.

1. **Oracle**: DB 계정·DDL·시드 적재 → [docs/spec/sql/README.md](../docs/spec/sql/README.md)
2. **FastAPI (8000)**: 가상환경으로 실행 → [fastapi_server/README.md](../fastapi_server/README.md) 「실행」
3. **Spring (8080)**: `application.properties` 준비, 환경변수(키 3개) 설정 → [backend/README.md](../backend/README.md). 대안 데이터 [불러오기]를 쓰려면 `avenue.altdata.source-dir`도 설정 → [루트 README](../README.md) 「대안 데이터 원천 폴더」
4. **React (5173)**: `.env`를 아래처럼 바꾸고 `npm run dev`
   ```
   VITE_USE_MOCK=false
   VITE_API_BASE_URL=http://localhost:8080
   ```
   - Vite 프록시는 없다. 주소를 바꾸면 Spring의 `avenue.cors.allowed-origins`에도 같은 화면 주소가 있어야 한다.
   - `.env`를 바꾸면 `npm run dev`를 껐다 다시 켠다(실행 중에는 다시 읽지 않는다).
   - 다른 PC에서 시연 PC 화면을 열 때는 `npm run dev -- --host`로 켜고, `VITE_API_BASE_URL`과 CORS에 시연 PC IP를 쓴다.

### 3-4. 환경 변수

| 이름 | 값 | 설명 |
|---|---|---|
| `VITE_USE_MOCK` | `true`(기본) / `false` | `false`일 때만 실제 서버를 부른다. 값이 없거나 `true`면 mock |
| `VITE_API_BASE_URL` | 예: `http://localhost:8080` | 실제 서버 주소. 비우면 화면과 같은 주소로 요청한다 |

`.env`에는 비밀값을 넣지 않는다(빌드하면 화면 코드에 그대로 들어간다). 키·비밀번호는 백엔드 환경변수로만 다룬다.

## 4. 테스트 방법

프론트에는 자동 테스트 코드가 없다(팀 규칙: 요청 없이 만들지 않는다). 아래 두 가지로 확인한다.

**① 정적 검사 — 기능을 만들거나 고친 뒤 반드시**
```
npm run lint
```
마지막에 오류(error)가 0개여야 한다. `react-hooks`·`react-refresh` 규칙 위반도 오류로 나온다.

**② 빌드 확인 — PR 전에**
```
npm run build
```
`✓ built in …`이 나오면 정상이다. 결과물 `dist/`는 Git에 올리지 않는다.

**③ 화면 직접 확인** — lint는 문법만 보므로 화면 동작은 `npm run dev`로 직접 본다.
- mock 데모 계정으로 내 화면의 정상 흐름과 오류 흐름(빈 값, 권한 없음 등)을 모두 눌러 본다.
- **블랙 테마**: 지금은 전환 버튼이 없다. 브라우저 개발자 도구(F12) → Console에 아래를 입력해 확인한다. 크롬이 붙여 넣기를 막으면 `allow pasting`을 직접 입력한 뒤 다시 붙여 넣는다.
  ```js
  document.documentElement.dataset.theme = 'dark'     // 블랙
  delete document.documentElement.dataset.theme       // 화이트로 되돌리기
  ```
- 실제 서버가 준비된 기능은 3-3대로 `VITE_USE_MOCK=false`에서도 한 번 확인한다.

## 5. 작업할 때 지킬 것

- **공통 파일**(`common/routes/AppRoutes.jsx`, `common/api/client.js`, `common/mocks/mockHandlers.js`, `common/styles/*`, `common/config/navigation.js`)은 고치기 전에 팀에 알리고 확인받는다. 화면 연결은 `AppRoutes.jsx`의 자기 줄만 바꾼다.
- **스타일**: 색·글꼴·간격은 `common/styles/tokens.css` 변수를 쓴다(화이트·블랙 테마가 같이 바뀐다). 화면 전용 스타일은 `features/<기능>/<기능>.css`에 두고, 클래스 이름은 `block__elem--mod` 모양으로 짓는다. 인라인 `style`은 막대 너비처럼 값이 바뀌는 곳에만 쓴다.
- **공통 부품 먼저**: 버튼·입력·모달·토스트·차트는 `common/components`에 있는지 먼저 본다(`src/common/README.md`).
- **mock 응답은 실제 API 응답과 같은 모양**으로 만든다. 처리 함수는 `({ body, token, headers, query })`를 받는다. 쿼리는 `query.get('page')`처럼 꺼낸다. 공통 처리기는 경로가 정확히 같아야 찾으므로, 경로에 번호가 들어가는 API(`/posts/12`)는 번호마다 `registerMockHandlers`로 등록한다.
- **완료 기준**: CSS까지 적용되고, lint 오류 0, 화면 확인이 끝난 상태를 완료로 본다(1차 피드백).
- 개인정보는 서버가 가린 값만 보여 준다. 대출 상품·금리·한도에는 더미 데이터라는 표시를 붙인다(`AGENTS.md` 5장).

## 6. 관련 문서

| 문서 | 내용 |
|---|---|
| [src/common/README.md](src/common/README.md) | 공통 틀·부품·차트 사용법, mock 계정 |
| [scripts/market/README.md](scripts/market/README.md) | 상권 분석 정적 데이터 만들기 |
| [../backend/README.md](../backend/README.md) | Spring 실행·인증 사용법 |
| [../fastapi_server/README.md](../fastapi_server/README.md) | 점수 계산 서버 실행·테스트 |
| [../docs/spec/sql/README.md](../docs/spec/sql/README.md) | DB 초기 구성 |
| [../docs/ai/features.md](../docs/ai/features.md) | 기능 명세 (N-ID) |
| [../AGENTS.md](../AGENTS.md) | 팀 공통 규칙 |
