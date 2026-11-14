# 서비스 DB 구성과 합성 데이터 사용 안내

이 문서는 DB 구조, 모델 학습용 합성 데이터, 서비스 시연용 더미 데이터를 구분하고 상황에 맞는 실행 순서를 안내한다. 모든 고객·회원 데이터는 합성 데이터이며 실제 신용평가·대출 심사에 사용하지 않는다.

## 왜 이렇게 나눴나

전체 서비스 DDL이 나오기 전에는 실험과 화면 개발에 필요한 데이터를 먼저 사용하려고 더미 DB에 테이블 생성과 시드 적재를 함께 묶었다. 현재는 전체 서비스 DDL이 있으므로 **테이블 구조의 기준과 데이터를 채우는 절차를 분리**한다.

- **DDL:** 테이블·열·제약을 정의한다. 기준 파일은 [avenue_ddl.sql](avenue_ddl.sql)이다.
- **시드:** 이미 정의된 테이블에 개발·시연용 데이터를 넣는다. 회원 시드는 [dummy_db/](dummy_db/README.md)에 둔다.
- **ALTER:** 이미 데이터를 사용 중인 DB의 구조를 필요한 부분만 바꾼다. 해당 변경용 SQL을 별도로 적용한다.

`dummy_db/01_create_tables.sql`은 별도로 설계한 DB가 아니라 원본 DDL의 바이트 동일 사본이다. 생성기가 원본 DDL을 복사해 묶음을 만들며, 사본만 독립적으로 수정하지 않는다. `run_all.sql`은 실험용 DB를 한 번에 초기화하기 위한 편의 경로로 남긴다.

## 데이터는 두 용도로 구분한다

| 구분 | 모델 학습용 합성 데이터 | 서비스용 더미 회원 데이터 |
|---|---|---|
| 목적 | 모델 학습·평가, 합성 규칙과 가정 검증 | 가입·입력·조회·기관 불러오기·점수 산출 흐름 시연 |
| 사용하는 형태 | CSV 모델 표·상세 원천·열 역할표 | DB 적재용 SQL 시드·기관 응답 JSONL |
| 위치·사용법 | [fastapi_server/data/README.md](../../../fastapi_server/data/README.md)의 전달 묶음을 받아 `fastapi_server/data/training/`에 둔다 | [dummy_db/README.md](dummy_db/README.md)의 적재 절차를 따른다 |
| 생성 과정 | [data_generation/README.md](../../../fastapi_server/data_generation/README.md)의 생성·검증·전달 묶음 절차 | 같은 생성 패키지의 `service_dummy/` 원천을 `dummy_db/tools/build_db.py`로 DB 시드에 매핑 |

학습용 CSV를 회원 테이블에 적재하는 것이 아니며, 서비스 더미 회원(`MEM…`)은 모델 학습에 쓰지 않는다. 서비스용 더미도 원천에는 CSV 등이 있지만 DB에서 사용할 때 SQL 시드로 바꾼다. [기관 응답 더미](dummy_db/external_api/README.md)는 회원이 동의하고 불러오는 과정을 시연하기 위한 자료다.

## 먼저 내 상황에 맞는 경로를 고른다

| 상황 | 사용할 경로 | 주의할 점 |
|---|---|---|
| 새 개발 스키마에 서비스 테이블과 더미 회원 데이터를 처음 준비 | `avenue_ddl.sql` → `dummy_db/run_seed_only.sql` | 같은 스키마에서 실행한다. DDL 내장 기준 데이터는 유지하고 시드 대상 테이블은 비어 있어야 한다 |
| 테이블은 이미 최신 DDL로 만들어졌고 시드 대상 테이블이 비어 있음 | `dummy_db/run_seed_only.sql` | 원본 DDL을 다시 실행하지 않는다. 대상 테이블이 없거나 한 곳이라도 데이터가 있으면 시드 실행 전에 중단한다 |
| 데이터가 있는 기존 DB에 이번 자산·대출 상태 변경만 적용 | [alter_user_asset_snapshot_no_loan.sql](alter_user_asset_snapshot_no_loan.sql) | 테이블·데이터를 유지한다. 기존 행의 새 `NO_LOAN_YN`은 NULL이며 Y/N 보정은 하지 않는다 |
| 옛 DDL로 만든 DB에서 미사용 상권 테이블 5개 제거 | [drop_unused_market_tables.sql](drop_unused_market_tables.sql) | N-24의 JSON 전환에 따라 상권 전용 표·데이터만 제거한다. 공공통계 표는 유지한다 |
| 버려도 되는 별도 실험용 스키마를 완전히 초기화 | `dummy_db/run_all.sql` | **대상 테이블을 삭제하고 재생성한 뒤 시드를 적재한다. 기존 데이터가 삭제된다** |
| 기존 회원 데이터나 시드를 일부 수정·보정 | 담당자와 별도 변경 SQL 검토 | `run_seed_only.sql`은 병합·갱신·재적재 도구가 아니다. `run_all.sql`로 해결하지 않는다 |
| 모델 학습용 데이터만 받거나 다시 생성 | 학습 데이터·생성 패키지 README | 위 DB 초기화·적재 SQL을 실행할 필요가 없다 |

`00_drop_all.sql`, `01_create_tables.sql`, 개별 `10_seed_*.sql`~`24_seed_*.sql`은 묶음의 구성 파일이다. 일반적인 최초 적재는 `run_seed_only.sql`, 전체 초기화는 `run_all.sql`을 사용한다. `init_schema.sql`은 현재 비어 있어 실행 입구로 사용하지 않는다.

## 일반적인 최초 준비 순서

1. 대상 Oracle 개발 스키마와 DDL 버전을 확인한다. 기준은 현재 `avenue_ddl.sql`의 Oracle 21c·47개 테이블이다(상권 5개 표 제거·빈 알림 표 추가 후). 이미 사용 중인 DB라면 위 표의 ALTER·보정 경로를 먼저 검토한다.
2. 빈 스키마에서 원본 `avenue_ddl.sql`을 실행한다. 테이블과 DDL에 내장된 기준 데이터가 생성된다. 최신 구조가 이미 있다면 생략한다.
3. 같은 스키마에서 `dummy_db/run_seed_only.sql`을 실행한다. SQL Developer의 스크립트 실행(F5) 또는 SQL*Plus에서 해당 파일을 실행하며, 함께 제공된 시드 파일의 상대 위치를 유지한다.
4. 마지막에 실행되는 `99_check.sql`의 기대·실제 테이블 수와 행 수를 직접 확인한다. 이는 결과 출력이며 모든 불일치를 자동 오류로 바꾸는 검사는 아니다. 생성 당시 기준은 `seed_report.json`에서 확인한다.
5. 점수·SHAP 저장에 필요한 피처 사전은 아래 별도 절차를 확인하고, 서비스 연동을 진행한다.

**현재 피처 사전 시드는 별도 적용한다.** [seed/avenue_seed_dim_feature_fs_draft.sql](seed/avenue_seed_dim_feature_fs_draft.sql)은 `DIM_FEATURE`에 FS-DRAFT 39개를 넣지만 현재 `run_all.sql`·`run_seed_only.sql`에는 연결되지 않았다. 최초 시드 검사 후, 첫 점수·SHAP 저장 전에 같은 스키마에서 이 파일을 별도로 실행하고 파일 끝의 확인 조회를 본다. 현재 `99_check.sql`의 `DIM_FEATURE` 기대값은 0이므로, 이 피처 시드 적용 뒤에는 실제 39행과 차이가 난다. 자동 연결 예정 기록은 [FP-123 작업 로그](../../logs/2026-11-13_obm_DIM_FEATURE-FS-DRAFT-시드.md)에 있으나 생성기 반영은 별도 작업이다. 해당 피처를 참조하는 평가 요인 데이터가 이미 있으면 앞의 DELETE가 FK 오류를 낼 수 있으므로 재실행하지 않는다.

Oracle DDL과 시드의 중간 COMMIT·IDENTITY 변경은 전체 롤백할 수 없다. `run_seed_only.sql`의 사전 검사도 동시 쓰기를 잠그지 않으므로 적재 중 같은 대상 테이블에 다른 작업이 쓰지 않게 한다. 실패한 경우 무작정 재실행하거나 초기화하지 말고, 어디까지 적용됐는지 먼저 확인한다.

## 상권 분석은 DB에 적재하지 않는다 (N-24)

C조 담당자의 결정과 사용자 승인에 따라 상권 분석은 DB·API 없이 `frontend/public/data/market/`의 정적 JSON을 읽는다. 매출·점포·생활인구와 지도용 동 좌표·보로노이 다각형도 파일로 제공하며 신용모델에는 넣지 않는다. 이 경로의 파일은 C조 작업 브랜치에서 제공되고, 현재 작업 브랜치에 병합됐는지는 별도로 확인한다.

기준 DDL에서 `DIM_ADM_DONG`, `DIM_SERVICE_CATEGORY`, `FACT_DONG_SALES`, `FACT_DONG_STORE`, `FACT_DONG_LIVING_POP`과 전용 FK·인덱스를 제거했다. C8 지도 코드 열은 추가하지 않는다. `FACT_HFS_STAT`, `FACT_HFS_WORKER_STAT`, `FACT_INDUSTRY_AGE_INCOME`, `FACT_POLICY_RATE`는 다른 기능용이므로 유지한다.

기존 DB의 상권 표는 DDL 파일을 수정해도 자동으로 사라지지 않는다. 전용 삭제 SQL은 수동 적용용이며 `run_all.sql`·`run_seed_only.sql`에 자동 연결하지 않는다. 최신 초기화 묶음은 47개 표를 대상으로 하므로, 옛 상권 표를 제거하려면 전용 SQL을 별도로 실행해야 한다. 실제 Oracle 삭제 확인은 별도다.

## 생성 코드와 설계 근거를 남기는 이유

교육용 프로젝트의 결과물은 데이터 파일뿐 아니라 **어떤 규칙·가정으로 만들었고 어떻게 검증했는지**도 포함한다. 따라서 모델 학습용 생성 코드·설계 문서·데이터 사전·검증기·실험 코드는 저장소에 보존한다. 시연할 때 생성 코드를 지우지 않는다.

사용 준비와 재생성은 다른 작업이다. 일반적인 시연 준비는 전달된 학습 CSV와 준비된 서비스 시드를 사용하고, 전체 데이터 생성·실험을 매번 실행하지 않는다. 재현이나 규칙 변경이 필요한 경우에만 [생성 패키지 README](../../../fastapi_server/data_generation/README.md)의 순서와 검증 절차를 따른다. 이 안내가 자동 실행 기능을 추가하는 것은 아니다.

학습용 생성 결과의 공유·버전은 [데이터 README](../../../fastapi_server/data/README.md)를 따르고, 서비스 시드 재생성과 개발 키 취급은 [더미 시드 README](dummy_db/README.md)를 따른다. 키·비밀번호·개인 설정 파일은 문서나 저장소에 남기지 않는다. 합성 데이터의 성능은 실제 예측력의 근거로 제시하지 않는다.

## 알림 테이블은 빈 구조만 준비한다

회의 결정에 따라 `USER_NOTIFICATION`은 빈 테이블로만 만든다. 알림 시드·API·생성·발송 로직은 추가하지 않는다. 기존 DB에는 [create_user_notification.sql](create_user_notification.sql)을 한 번 실행한다. `APP_USER`가 먼저 있어야 하며, 테이블이 이미 있으면 재실행하지 않는다. 새 스키마에는 기준 DDL에 포함되어 있으므로 별도 실행하지 않는다. 실제 Oracle 적용은 아직 확인하지 않았다.
