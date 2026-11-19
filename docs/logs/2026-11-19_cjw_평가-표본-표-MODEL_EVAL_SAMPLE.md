# 모형 성능 비교(N-25)용 평가 표본 표 MODEL_EVAL_SAMPLE 추가 (DDL C10)

- **날짜:** 2026-11-19
- **작성자:** 최재욱(B팀 모델·정의서 담당) / Claude Code
- **브랜치:** `feature-B/FP-235-eval-sample-table` (Jira FP-235, FP-235 브랜치 `feature-B/FP-235-same-label-eval` 위에 쌓음)
- **관련 N-ID:** N-25 모형 성능 비교
- **관련 결정:** 11/19 동주·재욱(컷오프별 지표·ROC를 FP-184 API가 행 데이터로 계산, 평가 표본 표를 따로 추가), 11/19 재욱 결정(표 추가 A안, 씬파일 노출 1인 TRAIN+VALID 평가), 11/19 DDL·공용 md는 재욱 작업과 연계되면 직접 수정 가능, 11/19 DB 변경은 `db변경사항` 채널에 공지

## 무엇을, 왜 바꿨나
- 동주 님 API(FP-184)가 컷오프 550~750점마다 지표 6개·직군별 오거절률·ROC를 계산하려면 고객별 기존·대안 점수와 정답 라벨이 필요한데, `ASSESSMENT`는 연령대·확률·등급·`REQUEST_ID`가 필수라 이 데이터를 그대로 담을 수 없다. 그래서 평가 표본 전용 표 `MODEL_EVAL_SAMPLE`을 추가했다(DDL C10, 표 47 → 48).
- 한 행이 평가 고객 1명이다. 열: 모델 버전(FK `MODEL_REGISTRY`), 분할(`TRAIN`·`VALID`·`TEST`), 집단(`LEGACY`·`THINFILE`), 고객 번호, 직군(FK `DIM_WORKER_TYPE`), 정답 라벨 2개, 점수 4개(0~1000). 유일 키는 모델 버전+분할+집단+고객 번호다.
- 데이터는 기본 시드에 넣지 않는다(`DATASET_VERSION`·`MODEL_ARTIFACT`와 같은 방식, 기본 기대 행 수 0). 적재 SQL은 `training/export_eval_scores.py --sql-out`이 평가 점수 CSV에서 만든다(3,085행: 기존 집단 VALID 1,800, 씬파일 노출 1인 TRAIN 1,057 + VALID 228, TEST 없음).
- 데이터 구성과 한계(씬파일은 기존 집단으로 학습한 모델 적용 결과, 연체 라벨에는 대안 효과를 넣지 않았고 비금융 효과 라벨은 설계된 효과라는 점 등)는 열 설명과 이전 로그(`2026-11-19_cjw_N-25-행-단위-평가-점수.md`)에 있다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `docs/spec/sql/avenue_ddl.sql` | 헤더 표 수 48, 변경 이력 C10, `MODEL_EVAL_SAMPLE` 표·제약·열 설명(`MODEL_ARTIFACT` 바로 뒤) |
| `docs/spec/sql/dummy_db/01_create_tables.sql` | 위 DDL의 바이트 동일 사본 |
| `docs/spec/sql/dummy_db/seed_report.json` | `ddl_sha256`(LF 정규화) 갱신, `table_count` 48, `rows`에 `MODEL_EVAL_SAMPLE` 0 |
| `docs/spec/sql/dummy_db/99_check.sql` | 표 수 48, 표 이름 목록 2곳, 기대 행 수 한 줄(0) |
| `docs/spec/sql/dummy_db/00_drop_all.sql` | `MODEL_EVAL_SAMPLE` 삭제 한 블록(자식 표라 `MODEL_ARTIFACT`보다 먼저) |
| `docs/spec/sql/dummy_db/tools/tests/test_build_db.py`, `test_market_schema.py` | 표 수 47 → 48 |
| `docs/spec/sql/create_model_eval_sample.sql` | 새 파일. 이미 만든 DB에 빈 표만 추가(DDL 블록과 같은 내용) |
| `docs/spec/sql/load_model_eval_sample_lgbm_base_0_1.sql` | 새 파일. 평가 표본 3,085행 적재(한 번만, 이미 있으면 멈춤, 500행마다 커밋) |
| `fastapi_server/training/export_eval_scores.py` | `--sql-out` 옵션과 적재 SQL 생성 함수 `render_load_sql` 추가 |
| `fastapi_server/tests/test_model_eval_sample.py` | 새 파일. DDL·생성 SQL·적재 SQL·스크립트·점검 SQL 일치 시험 13개 |
| `docs/spec/sql/README.md`, `dummy_db/README.md`, 루트 `README.md` | "47개 표"를 48개로, 상황별 실행 표에 생성·적재 SQL 2행 |

## DB·API 변경
- DB: **새 표 `MODEL_EVAL_SAMPLE`**(열 13개, PK·UK·FK 2·CHECK 4). 기존 표·열 변경 없음. 기본 시드와 `run_all.sql`·`run_seed_only.sql`은 그대로(표는 만들어지고 비어 있음).
- 기존 DB에 실행할 SQL, 순서대로: (1) `create_model_eval_sample.sql` → (2) `load_model_eval_sample_lgbm_base_0_1.sql`(`MODEL_REGISTRY`에 `LGBM-BASE-0.1`이 있어야 하며 없으면 멈춤)
- API: 없음(동주 님 FP-184가 이 표를 읽는다)
- 영향을 받는 기능·팀원: 동주(FP-184·185 읽기), 범영(공용 DB 적용), 경환(더미 DB 생성기·도구 테스트의 표 수), 이미 DB를 만든 팀원(생성 SQL 1회)

## 확인
- 확인함:
  - DDL 변경 체크리스트: 사본 `cmp` 일치, `seed_report.json`의 `ddl_sha256`이 LF 정규화 DDL 해시와 일치, `99_check.sql`·`00_drop_all.sql`·`seed_report.json`의 표 순서가 생성기(`parse_ddl`)가 읽은 DDL 순서와 같음.
  - DB 도구 테스트 52개 통과(건너뜀 3, 임시 가상환경에 `cryptography`·`pandas`·`bcrypt` 설치), FastAPI 테스트 143개 통과(새 13개 포함).
  - 적재 SQL 안의 행 수·집단/분할별 건수·코드·점수 범위·키 중복 없음을 코드로 확인. 가장 긴 줄이 SQL*Plus 한 줄 제한(2,499자) 안(INSERT 한 줄 약 330자). 파일 크기 약 1.0MB(기존 시드 1~3MB와 비슷).
- 확인 못 함: **Oracle에서 실행**(생성 SQL, 적재 SQL, 빈 스키마에서 `avenue_ddl.sql` 전체 실행과 `run_seed_only.sql`의 표 수 48 확인은 SQL Developer로 사용자가 해야 함), 공용 DB 적용(범영), 동주 님 API에서 이 표를 읽는 모습, 생성기를 팀 키로 다시 돌려 묶음을 만드는 것(경환).

## 다음 사람이 알아야 할 것
- 공용 DB 적용은 병합 후 DB 담당(범영)이 한다. 순서는 생성 SQL → 적재 SQL이고, 적용한 DB의 `99_check.sql`에서 `MODEL_EVAL_SAMPLE`은 기대값 0과 실제 3,085가 다르게 나오는 것이 정상이다.
- 새 모델 버전을 만들면 평가 점수도 다시 만들어(`python -m training.export_eval_scores --sql-out …`) 새 `MODEL_VERSION`으로 적재한다. 같은 버전으로 행을 덮어쓰지 않는다. TEST 표본은 최종 평가(FP-144) 때 `SPLIT_CODE = 'TEST'`로 같은 방식으로 넣는다.
- 씬파일을 학습에 쓰는 모델이 생기면 씬파일 TRAIN 행이 누수가 되므로 `--thinfile-valid-only`로 다시 만든다.
- **README 충돌 주의:** `docs/spec/sql/README.md`와 `dummy_db/README.md`는 FP-214(DB 안내 정리) PR도 고치는 파일이다. 먼저 병합되는 쪽 기준으로 나중 쪽이 "48개 표"와 새 2행을 다시 맞춰야 한다.
- 이 브랜치는 FP-235 브랜치 위에 쌓았다(평가 점수 스크립트가 필요). FP-235 PR이 먼저 병합돼야 이 PR의 변경만 보인다.
- 로그 파일명의 작성자 약어 `cjw`는 제안이다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
