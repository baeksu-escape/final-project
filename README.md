# 3조 백수 탈출기 — Avenue (대안 신용평가 서비스)

## 문서 위치
| 위치 | 누가 읽나 | 내용 |
|------|-----------|------|
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` | AI (자동) | AI 공통 규칙 |
| `docs/ai/` | AI (작업 전) | 기능 명세, 확정·미정 사항, 웹 채팅용 붙여넣기 |
| `docs/spec/` | 사람·AI | 팀이 합의한 API 명세, 피처 정의서, DB 스크립트 |
| `docs/logs/` | 사람·AI | 작업 로그와 검수 |
| `docs/guide/` | 사람 | 바이브 코딩 팀 가이드 (PDF) |

## 데이터 위치
| 위치 | 누가 읽나 | 내용 |
|------|-----------|------|
| [docs/spec/sql/](docs/spec/sql/README.md) | 사람·AI | 서비스 DB 구성·합성 데이터 사용 안내. 기준 DDL은 Oracle 21c·47개 테이블이며, 최초 적재·기존 DB 변경·실험용 초기화의 실행 순서를 구분 |
| [docs/spec/sql/dummy_db/](docs/spec/sql/dummy_db/README.md) | 사람·AI | 서비스 시연용 더미 회원 시드·기관 응답·생성 도구. DDL 적용 후 빈 시드 대상에는 `run_seed_only.sql`, 실험용 전체 초기화에만 `run_all.sql` 사용 |
| `fastapi_server/data_generation/` | B조·AI | 합성 데이터 생성 코드(현재 버전은 `fastapi_server/data/README.md`). 필드 정의 기준은 `data_generation/docs/DATA_DICTIONARY.csv` |
| `fastapi_server/data/` | B조 | 학습용 데이터. **Git 제외**, 공유 드라이브에서 받아 `fastapi_server/data/training/` 안에 압축 해제. 버전·폴더 구조는 `fastapi_server/data/README.md` |
| [docs/spec/sql/dummy_db/external_api/](docs/spec/sql/dummy_db/external_api/README.md) | backend | 대안 데이터(통신·공과금·간편결제·사회보험·신용) 모의 기관 응답 원천. **Git에 포함**(약 7MB)이라 따로 받지 않는다. 사용 설정은 아래 「실행 환경 공통 설정」 |

- `column_dictionary_207.csv`가 두 곳에 있다. `data_generation/reference/`는 기존 집단(12,000명) 원본 사전, `data/training/3_reference/thinfile/`은 씬파일 집단(2,400명) 사전이다. 이름은 생성 도구가 정한 것이라 바꾸지 않는다.
- `.csv`·`.xlsx`·`.pkl`·`.joblib`는 Git에 올리지 않고 드라이브로 공유한다. 예외는 `data_generation/`의 정의서·통계 원자료 7개(약 480KB)뿐이다(`.gitignore` 참고).

## 실행 환경 공통 설정
서버별 실행·테스트 방법은 각 README([backend](backend/README.md) · [fastapi_server](fastapi_server/README.md) · [frontend](frontend/README.md))를 본다. 여기에는 여러 서버나 팀 전체가 같이 알아야 하는 것만 적는다.

**실행 순서:** DB 준비([docs/spec/sql/README.md](docs/spec/sql/README.md), 개인 개발은 로컬 DB·통합 테스트 때만 공용 DB) → backend(8080) → fastapi_server(8000, 가상환경) → frontend(5173)

| 설정 | 쓰는 곳 | 값 | 공유 |
|---|---|---|---|
| `avenue.altdata.source-dir` | backend | `<본인 저장소 경로>/docs/spec/sql/dummy_db/external_api` (예: `C:/workspace/final-project/docs/spec/sql/dummy_db/external_api`) | 각자 저장소 위치에 맞춤 |
| `avenue.altdata.missing-member-mode` | backend | `EMPTY`(기본) / `BORROW` — 직접 가입한 계정처럼 더미 응답에 자료가 없는 회원도 시연하려면 `BORROW` | 각자 |
| `AVENUE_DEV_AES_KEY`, `AVENUE_DEV_HMAC_KEY` | backend, 시드 생성기 | 개인정보 암호화 키. 설명은 [backend/README.md](backend/README.md), [dummy_db/README.md](docs/spec/sql/dummy_db/README.md) | **팀 공통** (env 파일로 별도 전달, 새로 만들지 않는다) |
| `AVENUE_JWT_SECRET` | backend | Base64, 32바이트 이상 — 아래 명령으로 만든다 | 각자 생성 |
| FastAPI 주소 `avenue.prediction.base-url` | backend → fastapi_server | 비우면 `http://localhost:8000`. 실행은 [fastapi_server/README.md](fastapi_server/README.md) | — |
| `VITE_USE_MOCK`, `VITE_API_BASE_URL` | frontend | [frontend/README.md](frontend/README.md) | 각자 |

**JWT 키 만들기** (PowerShell, 폴더 상관없음) — 나온 문자열을 STS 실행 설정 Environment 탭에 `AVENUE_JWT_SECRET`으로 넣는다(Common 탭은 Local file 유지). 한 번 만든 값을 계속 쓴다.
```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
```

- 키·비밀번호 값은 저장소·PR·채팅·스크린샷에 올리지 않는다. 견본은 `*.example` 파일에 값 없이 둔다.
- `avenue.altdata.source-dir`가 비었거나 경로가 틀리면 서버는 켜지지만 로그에 "대안 데이터 원천 폴더가 없어 불러오기를 쓸 수 없습니다" 경고가 뜨고, 데이터 입력의 [불러오기]가 503으로 실패한다. 경로의 폴더 이름 철자부터 확인한다.

처음이라면 `docs/guide/`의 가이드 PDF 앞쪽 **한 장 요약**부터 읽어 주세요.

---

# Git 협업 규칙

## 🌿 브랜치 전략
**각자 기능 브랜치 (`feature-조/기능`) → `develop` 브랜치 → `main` 브랜치**

- 각자 자기 조의 기능 브랜치에서 작업한다.
  - 브랜치 이름 형식: `feature-A/기능명`, `feature-B/기능명`, `feature-C/기능명` (예: `feature-A/auth`)
- **연관된 기능 단위가 완성되면 `develop`에 머지한다.**
  - 예) 회원 인증(`feature-A/auth`): 로그인 및 회원가입 페이지 작업 (commit/push) → 백엔드 API 작업 (commit/push) → 프론트·백엔드 연동 및 테스트 완료 → **PR 생성 후 `develop` 브랜치로 머지**
- `develop`이 안정화되면 `main`에 최종 머지한다.
- `.gitignore`를 통해 보안 파일(`application.properties`, `.env`) 및 불필요한 파일 커밋을 방지한다.

## 📌 커밋 및 일일 규칙
- **Commit 메시지 형식:** `행위 - 내용` (예: `feat - 로그인 및 회원가입 JWT 연동 구현`)
- **일일 백업 Push:** 매일 **17시 30분 ~ 17시 50분** 사이에 작업 중인 개인 브랜치에 Push한다.
- **정기 코드 리뷰:** 매주 월요일 프로젝트 두 번째 시간에 코드 리뷰를 진행한다.
- **주석 작성:** 다른 팀원이 이해하기 쉽도록 코드 작성 시 핵심 로직 옆에 주석을 작성한다.

## 🔀 PR(Pull Request) 규칙
1. **연관 기능 묶음 완성 및 테스트 후 PR (기본 원칙)**
   - 단일 기능이 너무 잘게 쪼개지지 않도록 연관된 기능까지 묶어서 완성한 뒤 PR을 올린다. (예: 로그인 단독 PR 지양 → 로그인 + 회원가입 묶어서 PR)
   - 반드시 프론트·백엔드 연동 및 개별 동작 테스트까지 성공한 상태에서 PR을 요청한다.
2. **공통 작업(`common`, `util` 등)을 위해 선반영이 필요한 경우 (예외 허용)**
   - 다른 팀원의 작업을 위해 미완성 상태에서 먼저 머지가 필요한 경우, PR 메시지에 **"왜 선반영이 필요한지 사유"**를 반드시 기록하고 PR을 올린다.

---

### 💡 협업 프로세스 요약
1. 팀원은 각자 `feature-조/기능` 브랜치에서 개발한다.
2. 연관 기능 구현 및 개별 테스트가 끝나면 `develop`으로 PR을 요청한다.
3. **다른 조 팀원 1명 이상이 코드를 검토·승인하고, 형상 관리자가 확인한 뒤 병합한다.**
4. `develop`에서 충돌을 해결하고 통합 테스트를 진행한다.
5. 최종 발표 및 시연이 가능한 상태인지 검증한 후 `main`으로 PR을 요청한다.
6. 최종 승인 후 `main`에 병합한다.
