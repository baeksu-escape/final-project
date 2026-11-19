# DB 처음 설정하기

이 안내는 **비어 있는 새 개발용 Oracle 스키마**에 합성 시연 데이터를 처음 준비할 때 사용한다. 기존 데이터가 있는 DB에는 초기 설정을 실행하지 않는다.

## 1. Oracle 계정 준비

DB 담당자에게 개발 스키마 계정과 접속 정보, 테이블 생성 권한을 요청한다. SQL Developer에서 새 연결을 만들고 `Test`가 성공하면 `Connect`한다. 연결 후 아래 쿼리로 발급받은 스키마 계정인지 확인한다. 접속 정보는 팀에서 안내한 안전한 경로로 받고 문서나 저장소에 적지 않는다.

```sql
SELECT USER FROM DUAL;
```

## 2. 파일을 차례로 실행

각 파일을 SQL Developer에서 직접 열고 같은 스키마 연결을 선택해 **F5 (스크립트 실행)** 한다.

1. `avenue_ddl.sql` — 테이블과 기본 코드를 만든다.
2. `dummy_db/run_seed_only.sql` — 비어 있는 시드 대상 테이블에 회원·상품·FS-DRAFT·FS-V1 피처 데이터를 넣고 검사를 실행한다.

`run_seed_only.sql`은 같은 폴더의 다른 SQL 파일을 상대 경로로 읽는다. 파일을 옮기지 말고 저장소 안의 폴더 구조를 유지한다. SQL*Plus를 쓰면 1번은 SQL 파일 경로에서 `@avenue_ddl.sql`, 2번은 `dummy_db` 폴더에서 `@run_seed_only.sql`로 실행한다.

## 3. 완료 확인

- FS-DRAFT 피처 시드: `TOTAL_CNT=39`, `ALT_CNT=20`, `SIM_CNT=9`; FS-V1 38개를 합친 `DIM_FEATURE`는 77행
- 테이블 수: 47개, `99_check.sql`의 기대 행 수와 실제 행 수 일치

피처 시드 SQL은 2번 파일이 자동 실행하므로 따로 실행하지 않는다. 오류나 불일치가 있으면 재실행·초기화하지 말고 결과를 DB 담당자에게 전달한다.

## 다른 상황

- 최신 테이블이 있고 시드 대상이 비어 있으면 DDL을 다시 실행하지 말고 `dummy_db/run_seed_only.sql`만 사용한다.
- 기존 DB의 구조 변경은 해당 변경 SQL만 검토한다. `ALT_DATA_EMPTY` 추가는 [add_not_scorable_reason_alt_data_empty.sql](add_not_scorable_reason_alt_data_empty.sql)을 사용하고, 그 밖의 변경은 [더미 시드 안내](dummy_db/README.md)를 참고한다.
- 기존 DB에 FS-V1을 추가할 때는 [피처 세트 추가 SQL](add_fs_v1_feature_set.sql) 실행 후 [FS-V1 피처 시드](seed/avenue_seed_dim_feature_fs_v1.sql) 38행을 한 번만 넣는다. ACTIVE 모델은 바뀌지 않는다.
- `dummy_db/run_all.sql`은 테이블을 삭제한 뒤 다시 만든다. **기존 데이터가 삭제되므로 버려도 되는 별도 스키마에서만 실행한다.**
- 모델 학습 CSV는 Oracle에 넣지 않는다. 위치와 사용법은 [학습 데이터 안내](../../../fastapi_server/data/README.md)를 참고한다.
- 실제 모델 전환·복구는 [전환 SQL](activate_model_lgbm_base_0_1.sql)과 [되돌리기 SQL](rollback_model_to_dev_dummy.sql)을 사용하며, [FastAPI 안내](../../../fastapi_server/README.md)의 공용 DB 전환 절차를 따른다. 전환 전 `/v1/health`에서 `modelLoaded: true`를 확인하고 DB 담당자와 순서를 맞춘다.
- 기존 DB의 게시글 본문 열 변경(`BOARD_POST.CONTENT` CLOB → `VARCHAR2(1300 CHAR)`, DDL C9)은 [게시글 본문 변경 SQL](alter_board_post_content_varchar2.sql)을 사용한다. 글 데이터는 유지하고, 1300자를 넘는 글이 있으면 자르지 않고 멈춘다. 다시 실행해도 된다.
- 실제 모델 LGBM-BASE-0.1의 학습 데이터·모델 파일 기록(N-25 근거)은 [모델 기록 SQL](register_model_lgbm_base_0_1.sql)을 사용한다. `DATASET_VERSION` 1행과 `MODEL_ARTIFACT` 2행만 넣고 ACTIVE는 바꾸지 않는다. 다시 실행해도 되며, 적용 후 `99_check.sql`의 두 표 기대값 0과 다르게 나오는 것은 정상이다.
- 위 모델 기록의 `METRICS_JSON`에 두 모델 AUC를 같은 라벨로 맞춘 값(`same_label_comparison`, N-25·정의서 C20)을 더할 때는 [같은 라벨 AUC SQL](update_model_metrics_same_label_lgbm_base_0_1.sql)을 사용한다. 모델 기록 SQL을 먼저 실행해야 하며(없으면 멈춤), `AUC_VALID`·해시는 바꾸지 않는다. 다시 실행해도 된다.

## 참고

DDL을 변경할 때는 확인 명령을 포함한 [DDL 변경 체크리스트](REFERENCE.md#ddl-변경-체크리스트-pr-64)를 따른다. 상권·알림 테이블 결정과 생성 코드 보존 이유는 [DB 참고](REFERENCE.md)에 정리되어 있다.
