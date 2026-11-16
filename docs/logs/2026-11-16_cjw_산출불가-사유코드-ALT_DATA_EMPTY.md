# 산출 불가 사유 코드 ALT_DATA_EMPTY 추가 (통신비·공과금 기관 기록 없음)

- **날짜:** 2026-11-16
- **작성자:** 최재욱(B팀 정의서 담당) / Claude Code
- **브랜치:** `feature-B/FP-132-feature-definition-fix3` (같은 작업의 문서 변경 C17~C19와 한 PR)
- **관련 N-ID:** N-12 (점수 산출 불가 처리)
- **관련 결정:** `feature_definition.md` 8-5 (다) 1차 확정, 10장 C14·C16, `decisions.md` D-30

## 무엇을, 왜 바꿨나
- 대안 데이터 중 통신비 또는 공과금이 빈 목록(기관 기록 없음)이면 점수를 내지 않기로 했다((다), 1차 확정). 이때 저장할 산출 불가 사유 코드가 없어 `DIM_NOT_SCORABLE_REASON`에 1행을 추가했다.
- 코드 `ALT_DATA_EMPTY`, 표시 이름 "통신비·공과금 기관 기록 없음", 표시 순서 5. 이름은 B팀 정의서 담당이 정했고 FP-142 작성자(범영)에게 알린다.
- 새로 DDL을 실행하는 DB는 `avenue_ddl.sql`에 들어 있다. 이미 만들어진 DB는 INSERT 1행을 따로 실행해야 해서 변경 SQL을 하나 만들었다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `docs/spec/sql/avenue_ddl.sql` | `DIM_NOT_SCORABLE_REASON` INSERT 1행, 테이블 COMMENT에 코드 설명 추가 |
| `docs/spec/sql/dummy_db/01_create_tables.sql` | 위 DDL의 바이트 동일 사본에 같은 수정 |
| `docs/spec/sql/dummy_db/99_check.sql` | 사유 코드 행 수 기대값 4 → 5 |
| `docs/spec/sql/dummy_db/seed_report.json` | `ddl_sha256`을 새 DDL 해시로, `DIM_NOT_SCORABLE_REASON` 행 수를 4 → 5로 (두 값만, DB 담당 검토 반영) |
| `docs/spec/sql/dummy_db/tools/tests/test_build_db.py`, `test_market_schema.py` | 기본 INSERT 행 수 기대값 25 → 26 |
| `docs/spec/sql/add_not_scorable_reason_alt_data_empty.sql` | 기존 DB용 변경 SQL 신규(없을 때만 넣는 MERGE, 재실행 가능) |
| `docs/spec/sql/README.md` | 경로 표에 변경 SQL 한 줄 추가 |
| `docs/spec/feature_definition.md` | 8-5 필요한 일 1번에 확정한 코드 이름 기록 |

## DB·API 변경
- DB: `DIM_NOT_SCORABLE_REASON`에 행 1개 추가(`ALT_DATA_EMPTY`). 테이블·컬럼·제약 변경 없음. `ASSESSMENT.NOT_SCORABLE_REASON_CODE`는 FK로만 막으므로 다른 변경이 없다.
- API: 없음. 다만 Spring 선검사와 FastAPI 422가 구현되면 이 코드가 응답에 나올 수 있다(구현 전).
- 영향을 받는 기능·팀원: 범영(FP-142 Spring 선검사가 이 코드를 쓴다), UI 담당(산출 불가 안내 문구), FastAPI 담당(422 추가 여부), DB를 이미 만든 팀원(변경 SQL 1회 실행).

## 확인
- 확인함: `cmp`로 `avenue_ddl.sql`과 `dummy_db/01_create_tables.sql`이 수정 후에도 바이트까지 같음을 확인. `git diff --stat`으로 의도한 줄만 바뀐 것을 확인. 다른 파일에서 `DIM_NOT_SCORABLE_REASON` 행 수를 세는 곳은 `99_check.sql`뿐임을 `grep`으로 확인.
- 확인함(DB 담당 검토 반영 후): `dummy_db/tools/tests` 51개 실행, 통과(`OK`). 3개는 환경 변수 `AVENUE_TEST_SERVICE_DUMMY`(별도 재생성한 서비스 더미 경로)가 없어 건너뜀. 이 3개는 시드 재생성(팀 키 파일 필요)이 필요해 이번에는 돌리지 않았고, 사유 코드 추가와 맞는지는 DB 담당의 재생성 환경에서 확인이 필요하다. 임시 가상환경에 `cryptography`, `pandas`, `bcrypt`만 설치해 실행했다(저장소·`requirements.txt` 변경 없음). DDL 해시는 `a835211b…1026`로 `seed_report.json`과 일치.
- 확인 못 함: Oracle에서 DDL과 변경 SQL을 실행하지 못했다(DB 접속 환경 없음). 변경 SQL의 `MERGE`와 `COMMENT` 문은 실행 전이다. Spring 코드(`ScoreCalculationService`)가 새 코드를 쓰는 부분과 테스트는 아직 없다.

## 다음 사람이 알아야 할 것
- 이 PR은 사유 코드만 만든다. Spring 선검사, FastAPI 422, 화면 안내 문구는 각 담당 확인 후 진행한다(`feature_definition.md` 8-5).
- 이미 DB가 있으면 `add_not_scorable_reason_alt_data_empty.sql`을 한 번 실행한다. 새 DB는 필요 없다.
- 로그 파일명의 작성자 약어 `cjw`는 제안이다(다르면 바꿔 주세요).

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
