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

- `column_dictionary_207.csv`가 두 곳에 있다. `data_generation/reference/`는 기존 집단(12,000명) 원본 사전, `data/training/3_reference/thinfile/`은 씬파일 집단(2,400명) 사전이다. 이름은 생성 도구가 정한 것이라 바꾸지 않는다.
- `.csv`·`.xlsx`·`.pkl`·`.joblib`는 Git에 올리지 않고 드라이브로 공유한다. 예외는 `data_generation/`의 정의서·통계 원자료 7개(약 480KB)뿐이다(`.gitignore` 참고).

### 대안 데이터 원천 폴더 (backend·fastapi_server 공통)
대안 데이터(통신비·공과금·간편결제·국민연금·건강보험·금융) 원천은 아래 세 곳에 나뉘어 있다. **시연·개발에 꼭 필요한 것은 1번뿐이고, 1번은 저장소에 들어 있어 따로 받을 것이 없다.**

| # | 위치 | Git | 쓰는 곳 | 내용 |
|---|------|-----|---------|------|
| 1 | [docs/spec/sql/dummy_db/external_api/](docs/spec/sql/dummy_db/external_api/README.md) | **포함** | backend (데이터 입력의 [불러오기], N-05-6) | 가상 기관 응답 `*_responses.jsonl` 6개, 더미 회원 400명분(데이터 v3.6.1) |
| 2 | `fastapi_server/data_generation/service_dummy/` | 없음 (생성하면 생김) | fastapi_server의 생성 도구만 | 1번과 DB 시드를 만드는 원본. `data_generation/README.md`의 생성 명령으로 만든다. **시드를 다시 만들 때만 필요**하며, 결과는 1번 폴더와 시드 SQL로 옮겨 커밋한다 |
| 3 | `fastapi_server/data/training/` | 제외 (공유 드라이브) | fastapi_server 모델 학습 | 학습용 CSV. 받는 법은 위 「데이터 위치」 표와 `fastapi_server/data/README.md` |

**backend 설정:** 1번 폴더를 Spring이 자동으로 찾지 않는다. `backend/src/main/resources/application.properties`의 `avenue.altdata.source-dir`에 **내 PC의 절대 경로**를 적는다. 실행 위치에 따라 상대 경로가 달라지므로 절대 경로를 쓴다.

```properties
# 예: 저장소를 C:\workspace\final-project에 받은 경우 (역슬래시 대신 / 를 쓴다)
avenue.altdata.source-dir=C:/workspace/final-project/docs/spec/sql/dummy_db/external_api
```

- 비워 두거나 경로가 틀려도 서버는 켜진다. 대신 시작할 때 콘솔에 `대안 데이터 원천 폴더가 없어 불러오기를 쓸 수 없습니다(avenue.altdata.source-dir)`가 찍히고, 데이터 입력의 [불러오기]가 503 오류로 실패한다. 이 문구가 보이면 이 줄부터 확인한다.
- 시연 중 새로 가입한 계정은 1번 파일에 자료가 없다. 이때의 동작은 `avenue.altdata.missing-member-mode`로 정한다(`EMPTY` 빈 결과 / `BORROW` 다른 더미 회원 자료를 빌려 씀).
- fastapi_server의 점수 계산 서버(`uvicorn main:app`)는 이 폴더를 읽지 않는다. 점수에 필요한 값은 Spring이 DB에서 꺼내 보낸다.

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
