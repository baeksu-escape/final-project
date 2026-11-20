# Avenue 화면 (React)

사용자·관리자가 보는 웹 화면이다. 로그인·데이터 입력·신용 리포트·재무 진단·상권 분석·신용 라운지·관리자 화면을 보여 준다.
화면은 Spring(`backend`)만 부르고, 점수 계산 서버(FastAPI)는 직접 부르지 않는다.

```
브라우저(React, 5173) → Spring Boot(8080) → FastAPI(8000)
                          └→ Oracle DB
```

- 기능 기준: `docs/ai/features.md` (N-ID), 확정 UI는 11/06 기준
- 이 화면의 점수·금리·한도는 합성 데이터로 만든 교육용 값이며 실제 신용평가 결과가 아니다.

## 1. 준비

| 항목 | 버전 |
|---|---|
| Node.js | **20.19 이상 또는 22.12 이상** (Vite 8 요구 사항) |
| npm | Node에 포함된 버전 |

주요 라이브러리: React 19, React Router 7, Vite 8, ESLint. 차트는 라이브러리 없이 SVG로 직접 그린다(`common/components`).

## 2. 실행

```
cd frontend
npm install                 # 처음 한 번, package.json이 바뀌면 다시
copy .env.example .env      # 처음 한 번 (Mac·Linux는 cp)
npm run dev                 # → http://localhost:5173
```

### 환경 변수 (`.env`)

`.env`는 Git에 올리지 않는다. 견본은 `.env.example`이다.

| 이름 | 값 | 뜻 |
|---|---|---|
| `VITE_USE_MOCK` | `true`(기본) / `false` | `true`면 서버 없이 화면 안의 mock 응답을 쓴다. `false`면 실제 Spring API를 부른다 |
| `VITE_API_BASE_URL` | 예: `http://localhost:8080` | 실제 API 주소. `VITE_USE_MOCK=false`일 때 쓴다 |

`.env`를 바꾸면 `npm run dev`를 다시 켜야 반영된다.

### 실행 방식 두 가지

**① mock (서버 없이 화면만)** — `VITE_USE_MOCK=true`

로그인 아이디로 계정이 정해지고, 비밀번호는 아무 값이나 넣으면 된다(`src/common/mocks/mockUsers.js`).

| 아이디 | 상태 | 로그인 후 첫 화면 |
|---|---|---|
| `employee` | 급여소득자, 점수 있음 | 신용 리포트 (주 메뉴 전체) |
| `self` | 자영업자, 점수 없음 | 데이터 입력 |
| `freelancer` | 프리랜서, 점수 없음 | 데이터 입력 |
| `newbie` | 직군 미선택 | 직군 선택 |
| `admin` | 관리자 (2단계 인증 번호 `123456`) | 모형 성능 비교 |
| `locked` | 잠긴 계정 | 로그인 실패(423) 확인용 |

이메일 인증번호(회원가입·아이디/비밀번호 찾기)와 관리자 2단계 인증 번호는 mock에서 늘 `123456`이다(`features/auth/mocks/authMockData.js`의 `MOCK_EMAIL_CODE`). mock 데이터는 메모리에만 있어 새로고침하면 새로 가입한 계정이 사라진다.

**② 실서버** — `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=http://localhost:8080`

1. DB 준비: `docs/spec/sql/README.md` — **개인 개발은 로컬 DB**(새 스키마에 `avenue_ddl.sql` → `dummy_db/run_seed_only.sql`)에 연결하고, 공용 DB는 통합 테스트 기간에만 연결한다. 접속 정보는 Spring `application.properties`에 넣는다
2. Spring 실행: `backend/README.md` (대안 데이터 원천 폴더 설정 포함)
3. FastAPI 실행: `fastapi_server/README.md` (점수 산출에 필요)
4. `npm run dev`

같은 네트워크의 다른 PC에서 보려면 `npm run dev -- --host`로 켜고, `VITE_API_BASE_URL`을 `http://<내 IPv4>:8080`으로, Spring CORS(`avenue.cors.allowed-origins`)에 `http://<내 IPv4>:5173`을 추가한다. 방화벽에서 5173·8080 허용이 필요할 수 있다.

## 3. 확인·테스트

```
npm run lint      # 코드 검사 — 오류 0이어야 한다
npm run build     # 배포용 빌드가 되는지 확인 (결과는 dist/, Git 제외)
```

- 프론트 자동 테스트 코드는 두지 않는다(팀 규칙). 화면 동작은 `npm run dev`로 직접 확인한다.
- 화면 확인은 mock 계정별 첫 화면 이동과 좁은 화면 폭을 함께 본다.

## 4. 폴더 구조

```
frontend/
├─ public/data/market/     상권 분석(N-24) 정적 JSON — DB 없이 화면이 직접 읽는다
├─ scripts/market/         위 JSON을 만드는 Python 스크립트 (원본 CSV는 Git 제외, scripts/market/README.md)
└─ src/
   ├─ main.jsx, App.jsx    시작점, 공통 CSS 불러오기
   ├─ common/              여러 기능이 함께 쓰는 것
   │  ├─ api/              API 호출(client.js: 토큰·mock 전환·401 처리), 오류 형식
   │  ├─ auth/             로그인 상태, 라우트 가드(역할·직군·점수 여부)
   │  ├─ components/       공통 컴포넌트(버튼·입력·카드·모달) + 차트 4종(CompareBar·TrendLineChart·BarChart·HeatmapGrid)
   │  ├─ config/           환경 변수, 메뉴 경로, 역할·직군·등급 코드
   │  ├─ layout/           화면 틀 — AppLayout(로그인 후)·PublicLayout(로그인 전)·AppHeader·TabMenu·AppFooter
   │  ├─ mocks/            mock 응답 등록·처리, mock 계정
   │  ├─ pages/            메인(홍보) 페이지·403·404·준비 중 화면
   │  ├─ routes/           AppRoutes.jsx — 전체 라우트
   │  ├─ styles/           tokens.css(색·간격) / forms.css / components.css / layout.css(화면 틀·배치 클래스)
   │  └─ utils/            theme.js(화이트·블랙 테마 저장·적용) 등
   └─ features/<기능>/     기능별 폴더: api · components · pages · mocks · config
      admin · auth · community · dataInput · market (만들어진 기능)
```

### 새 기능을 붙일 때
- 화면은 `features/<기능>/pages/`에 만들고, `AppRoutes.jsx`에서 해당 경로의 `element` 한 줄만 바꾼다(가드·경로 구조는 그대로). `AppRoutes.jsx`·`client.js`는 공유 파일이라 고치기 전에 팀에 알린다.
- API는 `features/<기능>/api/`에서 `common/api/client.js`를 통해 부른다. mock은 같은 기능의 `mocks/`에 실제 응답과 같은 모양으로 만들어 `registerMockHandlers`로 등록한다.
- 화면 모양은 공통 재료로 맞춘다(기준 UI: 데모 v2). 컴포넌트는 `common/components`(Card·Button·Chip·Notice·Modal·Toast·입력류·차트), 배치는 `layout.css` 클래스를 쓴다.
  - 제목 줄 `page-head`(`__tag`·`__title`·`__lead`), 2:1 `l-cols`(+`l-cols__main`), 3열 `l-grid3`, 숫자 타일 `l-kpis`, 자동 칸 `l-g2`, 표 `data-table`(+`data-table-wrap`), 안쪽 상자 `panel-sunk`, 글자 `hint`·`num`
  - 색·간격은 `tokens.css` 변수만 쓴다. 이 재료로 안 되는 모양이 필요하면 기능 폴더에 `<기능>.css`를 만들기 전에 프론트 담당에게 알린다. 공통 CSS 4개(`tokens`·`forms`·`components`·`layout.css`)는 프론트 담당만 고친다(AGENTS.md 3-2).
  - 공통으로 올릴 후보: 여러 줄 입력칸(`lounge-textarea`), 쪽 번호(`lounge-pager`), 설명이 붙은 라디오 카드(`report-option`). 지금은 `community.css`에 있으니 필요하면 프론트 담당에게 알린다.

## 5. 현재 상태 (2026-11-17)

| 메뉴 | 상태 |
|---|---|
| 로그인·회원가입·아이디/비밀번호 찾기·소셜 로그인, 직군 선택, 데이터 입력, 마이 페이지 | 실서버 연결 |
| 상권 분석 | 정적 JSON |
| 신용 라운지(게시판·신고), 관리자 신고함 | 화면 완료, 실서버 확인 중 |
| 관리자 계정·권한, 접근·감사 로그, 비밀번호 변경 | 실서버 연결 |
| 관리자 모형 성능 비교 | 화면 완료(FP-185), API는 FP-184(ADM-01·02). mock은 실제 응답과 같은 모양의 예시값 |
| 신용 리포트, 자산·부채 건전성, 시나리오, 현금흐름, 시뮬레이터, 대출 상품, 비교 분석, 직군·연령별 통계 | 준비 중 화면(PlaceholderPage) |

- `/`는 메인(홍보) 페이지(N-10)다. 로그인한 사람은 자기 첫 화면(관리자는 모형 성능 비교, 직군 없으면 직군 선택, 점수 없으면 데이터 입력, 그 외 신용 리포트)으로 바로 간다. 로그아웃하면 메인으로 돌아온다.
- 모든 화면 아래에 교육용 고지 푸터가, 오른쪽 아래에 화이트·블랙 테마 버튼이 있다(선택은 이 브라우저에만 저장).
