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
| 데이터가 있는 기존 DB에 자산 4종 열(`USER_ASSET_SNAPSHOT` 예금·적금·투자·부동산·보증금·기타 자산, DDL C13)만 추가 | [alter_user_asset_snapshot_breakdown.sql](alter_user_asset_snapshot_breakdown.sql) | 스키마 소유자로 한 번 실행한다(공용 DB는 DB 담당). 기존 행의 새 4개 열은 NULL로 남고 총자산은 그대로다. 이미 열이 있으면 오류로 멈춘다. 새로 DDL을 실행하는 DB에는 필요 없다 |
| 데이터가 있는 기존 DB에 대출 상품 문구 보강만 적용 | [update_loan_product_copy.sql](update_loan_product_copy.sql) | LP001~LP017의 ID·코드 대응을 확인한 뒤 지정 문구와 상품 특징만 갱신한다. 자동 실행 묶음에는 연결하지 않는다 |
| 데이터가 있는 기존 DB에 시드 회원 근무기간만 채우기 🆕 11/24 | [update_seed_user_work_period.sql](update_seed_user_work_period.sql) | 시드 회원 400명(`DUMMY_YN='Y'`)의 `WORK_PERIOD_MONTHS`를 나이·직군에 맞는 회원별 합성 값(자영업자·프리랜서 최소 12개월)으로 채운다(NULL·직군 고정값 모두 덮어씀). 같은 계산식이라 다시 실행해도 결과가 같다. 직접 가입한 회원은 건드리지 않는다. |
| 비교 분석용 시드 회원 점수 넣기(일괄 산출 없이) 🆕 11/24 | [load_seed_assessment_lgbm_base_0_2.sql](load_seed_assessment_lgbm_base_0_2.sql) | 근무기간 SQL 다음에 실행한다. 범영 로컬에서 모델 LGBM-BASE-0.2로 일괄 산출한 시드 회원 318명(대안 데이터 동의 회원)의 평가와 항목 12,084행을 넣는다. 이미 그 회원의 같은 모델 점수가 있으면 건너뛰므로 다시 실행해도 중복이 없다. 모델이 바뀌면 [export_seed_assessment.sql](export_seed_assessment.sql)로 다시 뽑는다(로컬 일괄 산출 결과 필요). |
| (위 파일을 다시 뽑을 때만) 🆕 11/24 | [export_seed_assessment.sql](export_seed_assessment.sql) | 읽기만 한다. 일괄 산출을 마친 로컬 DB에서 F5로 실행하면 `C:	emp\load_seed_assessment.sql`이 만들어진다. |
| 데이터가 있는 기존 DB에 산출 불가 사유 `ALT_DATA_EMPTY` 1행만 추가 | [add_not_scorable_reason_alt_data_empty.sql](add_not_scorable_reason_alt_data_empty.sql) | 이미 있으면 넣지 않으므로 다시 실행해도 된다. 새로 DDL을 실행하는 DB에는 필요 없다 |
| 금융 용어 사전(쉬운 금융사전 N-30, FP-180) 넣기 | [add_glossary_term.sql](add_glossary_term.sql) | 새 DB·기존 DB 모두 이 파일로 넣는다(DDL·시드에는 용어가 없다). DDL → `run_seed_only.sql` 다음에 실행한다. `GLOSSARY_TERM` 20행(합성 교육용 문구)이며 같은 용어는 문구를 덮어써 다시 실행해도 같은 결과다. 적용 후 `99_check.sql`의 `GLOSSARY_TERM` 기대값 0과 다르게 나오는 것은 정상 |
| 데이터가 있는 기존 DB에 피처 세트 `FS-V1`(DRAFT)과 모델 버전 `LGBM-BASE-0.1`(CANDIDATE) 추가 | 1단계 [add_fs_v1_feature_set.sql](add_fs_v1_feature_set.sql), 2단계 [seed/avenue_seed_dim_feature_fs_v1.sql](seed/avenue_seed_dim_feature_fs_v1.sql) | 1단계는 이미 있으면 넣지 않아 다시 실행해도 된다. **2단계 `DIM_FEATURE` 38행은 한 번만** 실행한다(다시 실행하면 PK 중복). 서비스는 바뀌지 않는다(ACTIVE 모델은 그대로, 전환은 activate SQL이 따로). 새로 DDL을 실행하는 DB는 `run_seed_only.sql`이 포함한다 |
| 데이터가 있는 기존 DB에 게시글 본문 열 변경(`BOARD_POST.CONTENT` CLOB → `VARCHAR2(1300 CHAR)`, DDL C9)만 적용 | [alter_board_post_content_varchar2.sql](alter_board_post_content_varchar2.sql) | 글 데이터는 유지한다. 1300자를 넘는 글이 있으면 자르지 않고 멈춘다. 이미 바뀐 DB에서 다시 실행해도 된다. `CONTENT`는 표의 맨 뒤 열이 된다 |
| 서비스 모델을 Mock(`DEV-DUMMY`)에서 실제 모델(`LGBM-BASE-0.1`)로 전환 | [activate_model_lgbm_base_0_1.sql](activate_model_lgbm_base_0_1.sql) | **실행 전 FastAPI `/v1/health`가 `"modelLoaded": true`인지 확인**(모델 파일 없이 바꾸면 모든 점수가 503). FS-V1 기준 데이터(위 행)가 없으면 멈추고 아무것도 바꾸지 않는다. 다시 실행해도 된다. 공용 DB는 전환 PR 작성자가 실행하고 채널에 남김. 절차: `fastapi_server/README.md` 「공용 DB를 실제 모델로 전환하는 절차」 |
| 실제 모델 LGBM-BASE-0.1의 학습 데이터·모델 파일 기록(N-25 모형 성능 비교 근거) | [register_model_lgbm_base_0_1.sql](register_model_lgbm_base_0_1.sql) | `DATASET_VERSION` 1행(학습 표 해시·12,000행·252열) + `MODEL_ARTIFACT` 2행(모델 파일 해시·검증 AUC). 기록만 하고 ACTIVE는 바꾸지 않는다. 다시 실행해도 된다. 적용 후 `99_check.sql`의 두 표 기대값 0과 다르게 나오는 것은 정상 |
| 위 모델 파일 두 행의 `METRICS_JSON`에 두 모델 AUC를 같은 라벨로 맞춘 값(`same_label_comparison`) 추가(N-25, 정의서 C20) | [update_model_metrics_same_label_lgbm_base_0_1.sql](update_model_metrics_same_label_lgbm_base_0_1.sql) | 위 기록 SQL을 먼저 실행해야 한다(없으면 멈춤). `AUC_VALID`·해시는 바꾸지 않고 `METRICS_JSON`만 바꾼다. 다시 실행해도 된다. 같은 라벨 값은 라벨마다 두 모델을 새로 학습한 실험값이다 |
| 기존 DB에 모형 성능 비교용 평가 표본 표 `MODEL_EVAL_SAMPLE`(DDL C10, N-25) 추가 | [create_model_eval_sample.sql](create_model_eval_sample.sql) | 고객별 기존·대안 모델 점수와 정답 라벨을 담는 빈 표만 만든다. `MODEL_REGISTRY`·`DIM_WORKER_TYPE`이 있는 스키마에서 한 번 실행하고, 같은 표가 있으면 오류로 멈춘다. 새로 DDL을 실행하는 DB에는 필요 없다 |
| 모형 성능 비교용 평가 표본 적재(`MODEL_EVAL_SAMPLE` 3,085행) | [load_model_eval_sample_lgbm_base_0_1.sql](load_model_eval_sample_lgbm_base_0_1.sql) | 위 표를 만든 뒤 한 번만 실행한다(이 모델 버전의 행이 있으면 오류로 멈춤). 기본 시드(`run_seed_only.sql`)에는 넣지 않는다. 적용한 DB에서는 `99_check.sql`의 `MODEL_EVAL_SAMPLE` 기대값 0과 실제 3,085가 다르게 나오는 것이 정상. 원본 CSV는 `#파일공유` |
| 기존 DB에 등급 구간 버전 `CUT-0.2`(DRAFT, 25/50/25 임시 결정 D-01: 0~659 / 660~730 / 731~1000) 추가 | [add_cutoff_cut_0_2.sql](add_cutoff_cut_0_2.sql) | 버전 1행과 구간 3행을 없을 때만 넣어 다시 실행해도 된다. **서비스는 바뀌지 않는다**: ACTIVE는 계속 `CUT-0.1`이고 `CUT-0.2`를 ACTIVE로 옮기는 일(FastAPI 상수 변경 포함)은 팀이 시점을 정한 뒤 따로 한다. 새로 DDL을 실행하는 DB는 기준 데이터에 이미 들어 있다 |
| 모델 `LGBM-BASE-0.2`(단조 제약 후보 B)의 평가 표본 적재(`MODEL_EVAL_SAMPLE` 3,085행, 0.1 행은 그대로 두고 같은 표에 모델 버전으로 구분해 쌓임) | [load_model_eval_sample_lgbm_base_0_2.sql](load_model_eval_sample_lgbm_base_0_2.sql) | **0.2를 `MODEL_REGISTRY`에 등록한 뒤**(`register_model_lgbm_base_0_2.sql`)(모델 버전 FK) 한 번만 실행한다(0.2 행이 있으면 오류로 멈춤). 읽는 쪽(FP-184)은 쿼리에서 `MODEL_VERSION`으로 거른다 |
| 위 0.2 모델 파일 두 행의 `METRICS_JSON`에 같은 라벨 AUC(`same_label_comparison`) 추가 | [update_model_metrics_same_label_lgbm_base_0_2.sql](update_model_metrics_same_label_lgbm_base_0_2.sql) | 0.2 등록 SQL을 먼저 실행한다(행이 없으면 멈춤). `JSON_MERGEPATCH`로 이 키만 더해서 등록 SQL이 넣은 기존 항목은 그대로이고, 오류가 나면 두 행이 함께 취소된다. `AUC_VALID`·`AUC_TEST`는 바꾸지 않는다 |
| 기존 DB에 등급 구간 버전 `CUT-0.3`(DRAFT, 모델 0.2 분포로 다시 계산한 25/50/25 경계: 0부터 653 / 654부터 726 / 727부터 1000) 추가 | [add_cutoff_cut_0_3.sql](add_cutoff_cut_0_3.sql) | 버전 1행과 구간 3행을 없을 때만 넣어 다시 실행해도 되고, 오류가 나면 두 단계가 함께 취소된다. `CUT-0.1`·`CUT-0.2`는 건드리지 않는다. **서비스는 바뀌지 않는다**: ACTIVE는 계속 `CUT-0.1`이다. 새로 DDL을 실행하는 DB는 기준 데이터에 이미 들어 있다 |
| 서비스 등급 구간을 `CUT-0.3`(0~653 / 654~726 / 727~1000)으로 전환(FP-248, 11/23): `CUT-0.1` RETIRED, `CUT-0.3` ACTIVE, 점수대별 금리·한도 구간과 대출 상품 최소 점수(780→727, 665→654)도 같이 옮김 | [activate_cutoff_cut_0_3.sql](activate_cutoff_cut_0_3.sql) | `add_cutoff_cut_0_3.sql`로 `CUT-0.3`이 먼저 있어야 한다. **이 SQL을 먼저 실행하고 바로 FastAPI(`CUT-0.3` 상수 버전)를 배포한다**(순서가 바뀌면 FK 오류나 화면 불일치). 다시 실행해도 같은 결과이고 값이 다르면 오류로 멈춘다. 되돌리기는 [rollback_cutoff_cut_0_3_to_0_1.sql](rollback_cutoff_cut_0_3_to_0_1.sql) + FastAPI 상수. 새로 DDL을 실행하는 DB는 기준 데이터와 더미 시드에 이미 반영되어 있다 |
| 실제 모델을 `LGBM-BASE-0.1`에서 `0.2`로 전환 | [activate_model_lgbm_base_0_2.sql](activate_model_lgbm_base_0_2.sql) | **먼저 서버 PC `artifacts/`를 0.2 묶음으로 바꾸고 `/v1/health` `modelVersion`이 0.2인지 확인**(파일을 안 바꾸면 모든 점수가 409). **파일을 바꾼 뒤엔 바로 실행**한다(그 사이 점수 요청도 409라 공용 DB는 사용자가 없는 시간에). 0.2 모델 행·파일 기록이 없으면 멈추고 아무것도 바꾸지 않는다. 다시 실행해도 된다. 공용 DB는 전환 PR 작성자가 실행하고 DB 변경 채널에 남긴다(11/20 공용 DB 전환 완료) 🆕 11/20 |
| 0.2 전환 뒤 0.1로 되돌리기 | [rollback_model_lgbm_base_0_2_to_0_1.sql](rollback_model_lgbm_base_0_2_to_0_1.sql) | 파일도 0.1 묶음으로 되돌린다. 저장된 0.2 평가는 지우지 않는다. 다시 실행해도 된다 |
| 실제 모델 전환 뒤 문제가 생겨 Mock으로 되돌리기 | [rollback_model_to_dev_dummy.sql](rollback_model_to_dev_dummy.sql) | 저장된 평가는 지우지 않는다(평가마다 자기 모델 버전이 남음). 다시 실행해도 된다 |
| 정책금리(한국은행 기준금리, 2024.01~2026.10 월별) 넣기(N-17, FP-153) | [add_policy_rate_bok_base_rate.sql](add_policy_rate_bok_base_rate.sql) | 새 DB·기존 DB 모두 이 파일로 넣는다(DDL에는 데이터가 없다). DDL → `run_seed_only.sql` 다음에 실행한다. `FACT_POLICY_RATE` 34행(월 값을 그 달 마지막 날로)이며 다시 실행해도 같은 결과다. 새 달 값은 같은 형식으로 행을 더해 다시 실행한다. `99_check.sql`의 `FACT_POLICY_RATE` 기대값 0은 기본 시드만 적용한 상태 기준이라, 이 파일을 실행한 뒤에는 EXPECTED=0, ACTUAL=34로 보이는 것이 정상이다. 적재된 행 수와 최신 기준금리는 이 파일 마지막의 확인 쿼리로 본다 |
| 옛 DDL로 만든 DB에서 미사용 상권 테이블 5개 제거 | [drop_unused_market_tables.sql](drop_unused_market_tables.sql) | N-24의 JSON 전환에 따라 상권 전용 표·데이터만 제거한다. 공공통계 표는 유지한다 |
| 버려도 되는 별도 실험용 스키마를 완전히 초기화 | `dummy_db/run_all.sql` | **대상 테이블을 삭제하고 재생성한 뒤 시드를 적재한다. 기존 데이터가 삭제된다** |
| 기존 회원 데이터나 시드를 일부 수정·보정 | 담당자와 별도 변경 SQL 검토 | `run_seed_only.sql`은 병합·갱신·재적재 도구가 아니다. `run_all.sql`로 해결하지 않는다 |
| 모델 학습용 데이터만 받거나 다시 생성 | 학습 데이터·생성 패키지 README | 위 DB 초기화·적재 SQL을 실행할 필요가 없다 |

`00_drop_all.sql`, `01_create_tables.sql`, 개별 `10_seed_*.sql`~`25_seed_*.sql`은 묶음의 구성 파일이다. 일반적인 최초 적재는 `run_seed_only.sql`, 전체 초기화는 `run_all.sql`을 사용한다. `init_schema.sql`은 현재 비어 있어 실행 입구로 사용하지 않는다.

## 일반적인 최초 준비 순서

1. 대상 Oracle 개발 스키마와 DDL 버전을 확인한다. 기준은 현재 `avenue_ddl.sql`의 Oracle 21c·48개 테이블이다(상권 5개 표 제거·빈 알림 표·평가 표본 표 추가 후). 이미 사용 중인 DB라면 위 표의 ALTER·보정 경로를 먼저 검토한다.
2. 빈 스키마에서 원본 `avenue_ddl.sql`을 실행한다. 테이블과 DDL에 내장된 기준 데이터가 생성된다. 최신 구조가 이미 있다면 생략한다.
3. 같은 스키마에서 `dummy_db/run_seed_only.sql`을 실행한다. SQL Developer의 스크립트 실행(F5) 또는 SQL*Plus에서 해당 파일을 실행하며, 함께 제공된 시드 파일의 상대 위치를 유지한다.
4. 마지막에 실행되는 `99_check.sql`의 기대·실제 테이블 수와 행 수를 직접 확인한다. 이는 결과 출력이며 모든 불일치를 자동 오류로 바꾸는 검사는 아니다. 생성 당시 기준은 `seed_report.json`에서 확인한다.
5. 피처 사전 FS-DRAFT 39개와 FS-V1 38개는 `run_seed_only.sql`에서 회원·상품 시드 뒤, `99_check.sql` 전에 자동 적재된다. 전체 초기화 `run_all.sql`에도 같은 순서로 포함된다.

생성기는 [seed/avenue_seed_dim_feature_fs_draft.sql](seed/avenue_seed_dim_feature_fs_draft.sql)을 변경 없이 `25_seed_dim_feature_fs_draft.sql`로, [seed/avenue_seed_dim_feature_fs_v1.sql](seed/avenue_seed_dim_feature_fs_v1.sql)을 `26_seed_dim_feature_fs_v1.sql`로 실행 묶음에 포함한다. 사전 검사는 `DIM_FEATURE`도 비어 있는지 확인하므로 기존 피처 행이나 이를 참조하는 평가 요인이 있으면 `run_seed_only.sql`은 중단된다. 평가 요인이 생긴 뒤에는 피처 시드의 DELETE가 FK 오류를 낼 수 있어 시드를 재실행하지 않는다. `99_check.sql`과 `seed_report.json`은 DIM_FEATURE 기대 행 수 77(FS-DRAFT 39 + FS-V1 38)을 표시한다.

Oracle DDL과 시드의 중간 COMMIT·IDENTITY 변경은 전체 롤백할 수 없다. `run_seed_only.sql`의 사전 검사도 동시 쓰기를 잠그지 않으므로 적재 중 같은 대상 테이블에 다른 작업이 쓰지 않게 한다. 실패한 경우 무작정 재실행하거나 초기화하지 말고, 어디까지 적용됐는지 먼저 확인한다.

## 상권 분석은 DB에 적재하지 않는다 (N-24)

C조 담당자의 결정과 사용자 승인에 따라 상권 분석은 DB·API 없이 `frontend/public/data/market/`의 정적 JSON을 읽는다. 매출·점포·생활인구와 지도용 동 좌표·보로노이 다각형도 파일로 제공하며 신용모델에는 넣지 않는다. 이 경로의 파일은 C조 작업 브랜치에서 제공되고, 현재 작업 브랜치에 병합됐는지는 별도로 확인한다.

기준 DDL에서 `DIM_ADM_DONG`, `DIM_SERVICE_CATEGORY`, `FACT_DONG_SALES`, `FACT_DONG_STORE`, `FACT_DONG_LIVING_POP`과 전용 FK·인덱스를 제거했다. C8 지도 코드 열은 추가하지 않는다. `FACT_HFS_STAT`, `FACT_HFS_WORKER_STAT`, `FACT_INDUSTRY_AGE_INCOME`, `FACT_POLICY_RATE`는 다른 기능용이므로 유지한다.

기존 DB의 상권 표는 DDL 파일을 수정해도 자동으로 사라지지 않는다. 전용 삭제 SQL은 수동 적용용이며 `run_all.sql`·`run_seed_only.sql`에 자동 연결하지 않는다. 최신 초기화 묶음은 48개 표를 대상으로 하므로, 옛 상권 표를 제거하려면 전용 SQL을 별도로 실행해야 한다. 실제 Oracle 삭제 확인은 별도다.

## 생성 코드와 설계 근거를 남기는 이유

교육용 프로젝트의 결과물은 데이터 파일뿐 아니라 **어떤 규칙·가정으로 만들었고 어떻게 검증했는지**도 포함한다. 따라서 모델 학습용 생성 코드·설계 문서·데이터 사전·검증기·실험 코드는 저장소에 보존한다. 시연할 때 생성 코드를 지우지 않는다.

사용 준비와 재생성은 다른 작업이다. 일반적인 시연 준비는 전달된 학습 CSV와 준비된 서비스 시드를 사용하고, 전체 데이터 생성·실험을 매번 실행하지 않는다. 재현이나 규칙 변경이 필요한 경우에만 [생성 패키지 README](../../../fastapi_server/data_generation/README.md)의 순서와 검증 절차를 따른다. 이 안내가 자동 실행 기능을 추가하는 것은 아니다.

학습용 생성 결과의 공유·버전은 [데이터 README](../../../fastapi_server/data/README.md)를 따르고, 서비스 시드 재생성과 개발 키 취급은 [더미 시드 README](dummy_db/README.md)를 따른다. 키·비밀번호·개인 설정 파일은 문서나 저장소에 남기지 않는다. 합성 데이터의 성능은 실제 예측력의 근거로 제시하지 않는다.

## 알림 테이블은 빈 구조만 준비한다

회의 결정에 따라 `USER_NOTIFICATION`은 빈 테이블로만 만든다. 알림 시드·API·생성·발송 로직은 추가하지 않는다. 기존 DB에는 [create_user_notification.sql](create_user_notification.sql)을 한 번 실행한다. `APP_USER`가 먼저 있어야 하며, 테이블이 이미 있으면 재실행하지 않는다. 새 스키마에는 기준 DDL에 포함되어 있으므로 별도 실행하지 않는다. 실제 Oracle 적용은 아직 확인하지 않았다.

## 공용 DB 적용 규칙 🆕 11/20

팀원은 각자 **로컬 DB**로 개발·테스트한다. 공용 DB(SQL Developer 접속 이름 BACKSU)는 최신 상태를 모아 두고 최종 발표 때 쓰는 DB다. 그래서 공용 DB에서는 테스트하지 않는다.

1. 기존 DB용 변경 SQL(`add_*`·`alter_*`·`update_*`·`load_*`·`register_*` 등)이 들어간 PR이 **병합되면, 작성자가** 공용 DB에 직접 실행한다. 순서는 위 「먼저 내 상황에 맞는 경로를 고른다」 표와 파일 머리말을 따른다. 실행 결과 맨 아래 확인 조회가 기대값과 같은지 본다.
2. 실행한 뒤 **팀 디스코드 DB 변경 채널**에 아래 형식으로 한 줄 남기고, 그 글에 답글로 `공용 DB 적용 완료`를 단다.
   ```
   [MM/DD] / 무엇이 바뀜(표·열 이름) / 기존 DB에 실행할 SQL(여러 개면 → 로 순서) / PR #번호
     └ 왜 바꿨는지, 무엇이 달라지는지 한두 문장
   ```
   예: `[11/14] / 대출 "해당 없음" 칸(NO_LOAN_YN) 추가 / alter_user_asset_snapshot_no_loan.sql / PR #49`
   `  └ 대출이 없는 회원이 "해당 없음"을 고르면 Y로 저장. "아직 안 적음"과 "대출 없음"을 구분해서, 대출 없는 회원도 점수 산출 가능`
   다른 팀원은 이 글을 보고 자기 로컬 DB에도 같은 SQL을 실행한다.
3. **모델 전환·되돌리기(`activate_model_*`·`rollback_model_*`)와 등급 구간 ACTIVE 전환도 그 PR 작성자가 한다.** 공용 DB로 점수를 내는 PC의 모델 파일(`fastapi_server/artifacts/`)이나 FastAPI 코드와 같은 시점에 바꿔야 하므로, 실행 전에 채널에 미리 알린다. 등급 구간 ACTIVE 전환은 팀이 시점을 정한 뒤 한다.
4. 실행하다 오류가 나면 그 메시지를 채널에 남기고 멈춘다. 직접 지우거나 고치지 않는다(일부만 들어간 상태를 DB 담당과 함께 확인해 정리한다).
5. **DB 담당(범영)은 공용 DB에 SQL을 대신 실행하지 않고 검수만 한다.** PR 리뷰에서 변경 SQL·실행 순서를 보고, 적용 뒤 공용 DB가 DDL·변경 SQL과 맞는지 점검 조회로 확인해 다르면 채널에 알린다.
6. 공용 DB에는 서비스 DDL 밖의 감사 표 `ACCESS_LOG`·`DDL_CHANGE_LOG`(로그인·DDL 기록 트리거)가 있다. 지우거나 고치지 않는다.

SQL 파일 머리말의 공용 DB 실행 문구도 11/20에 이 규칙으로 맞췄다("PR 작성자가 병합 후 실행").

## DDL을 고칠 때 같이 고칠 것 (체크리스트)

`avenue_ddl.sql`을 한 글자라도 고치면 아래 짝꿍 파일도 **같은 PR에서** 함께 맞춘다. DB 생성 도구 테스트가 DDL의 지문(해시)·행 수를 고정해 두고 비교하기 때문이다. 저장소에 자동 검사(CI)가 없어서, 이 테스트는 누가 직접 돌려야만 실패가 보인다(11/16 DDL 한 줄 변경 두 건이 이 파일들을 놓쳐 테스트가 깨진 뒤 추가).

1. **사본:** `dummy_db/01_create_tables.sql`을 원본과 바이트까지 같게 맞춘다. 확인: `cmp docs/spec/sql/avenue_ddl.sql docs/spec/sql/dummy_db/01_create_tables.sql` (출력이 없으면 같다)
2. **DDL 지문:** `dummy_db/seed_report.json`의 `ddl_sha256`을 새 값으로 바꾼다. DDL을 고칠 때마다 해당한다. 줄바꿈을 LF로 바꾼 뒤 계산하므로(생성기·테스트 기준, PR #61) PC의 줄바꿈 설정과 관계없이 같은 값이 나온다. 저장소 맨 위에서 아래 명령으로 구한다.
   ```
   python -c "import hashlib,pathlib;print(hashlib.sha256(pathlib.Path('docs/spec/sql/avenue_ddl.sql').read_bytes().replace(b'\r\n',b'\n')).hexdigest())"
   ```
3. **기준 데이터 INSERT를 더하거나 뺐을 때:** 아래 두 곳을 같은 숫자로 맞춘다. 도구 테스트의 기본 INSERT 총수는 DDL에서 직접 세므로 고칠 필요가 없다.
   - `dummy_db/99_check.sql`의 그 표 `EXPECTED` 값
   - `dummy_db/seed_report.json` `rows`의 그 표 값
4. **피처 사전 시드(`seed/avenue_seed_dim_feature_fs_draft.sql`)를 고칠 때:** 생성기가 이 파일을 그대로 `dummy_db/25_seed_dim_feature_fs_draft.sql`로 복사해 쓰므로 둘을 바이트까지 같게 맞추고, `99_check.sql`·`seed_report.json`의 `DIM_FEATURE` 값도 맞춘다. 생성기는 이 파일이 39행이 아니면 오류를 낸다. 확정 피처 세트(FS-V1 등)는 이 파일을 고치지 말고 **새 파일로 추가**한다. FS-V1은 `seed/avenue_seed_dim_feature_fs_v1.sql`(38행, 사본 `26_seed_dim_feature_fs_v1.sql`)로 추가했고, 생성기(`build_db.py`의 `feature_seeds` 목록)가 두 파일을 읽는다. FS-V2 같은 새 세트도 같은 방식으로 파일과 목록 한 줄을 더하고 `99_check.sql`·`seed_report.json` 값을 맞춘다.
5. **시드(회원 데이터) 구조가 바뀔 때:** 손으로 고치지 않고 [dummy_db/README.md](dummy_db/README.md)의 `build_db.py`로 다시 만든다. 팀 키 파일이 필요하고 시드 암호문이 전부 바뀌므로 생성기 담당과 먼저 상의한다. DDL 문구나 기준 데이터만 바뀐 경우에는 위 2·3번 값만 고쳐도 생성기 결과와 같다.
6. **이미 만든 DB용 변경 SQL:** 데이터가 있는 DB에 적용할 `add_*`·`alter_*`·`update_*` SQL을 만들고, 위 「먼저 내 상황에 맞는 경로를 고른다」 표에 한 행을 추가한다.
7. **확인:** 저장소 맨 위에서 아래를 실행하고 결과를 PR 「테스트 방법」에 적는다.
   ```
   python -B -m unittest discover -s docs/spec/sql/dummy_db/tools/tests
   ```
   `No module named 'bcrypt'` 오류 1건은 PC 환경 문제다(`fastapi_server/data_generation/requirements.txt` 설치 시 사라짐). 그 밖의 실패가 없어야 한다.
8. **작업 로그:** DB 변경이므로 `docs/logs/`에 남긴다(AGENTS.md 3-4).
9. **공용 DB 적용 🆕 11/20:** PR이 병합되면 **작성자가** 아래 「공용 DB 적용 규칙」대로 공용 DB에 실행하고 DB 변경 채널에 남긴다.
