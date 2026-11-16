# 서비스 시연용 DB 시드

이 폴더에는 Oracle 개발 DB에 넣을 합성 회원·상품 시드와 기관 응답 더미가 있다. 모델 학습용 CSV는 포함하지 않는다.

처음 DB를 준비한다면 먼저 [상위 DB 설정 안내](../README.md)를 따른다. 계정 준비, DDL 실행, 최초 시드 적재 순서는 그 문서에 있다.

## 실행 파일

| 파일 | 용도 |
|---|---|
| `run_seed_only.sql` | DDL 실행 후 비어 있는 시드 대상 테이블에 데이터를 넣는다. 대상 테이블이 없거나 이미 데이터가 있으면 중단된다. |
| `run_all.sql` | 대상 테이블을 삭제하고 DDL과 시드를 다시 실행한다. 기존 데이터가 삭제되므로 폐기 가능한 개발 스키마에서만 사용한다. |
| `99_check.sql` | 테이블 수와 테이블별 기대 행 수를 출력한다. 출력된 기대값과 실제값을 직접 확인한다. |

`00_drop_all.sql`, `01_create_tables.sql`, `10_seed_*.sql`~`25_seed_*.sql`은 실행 묶음 내부 파일이다. 일반적인 준비에서는 개별 실행하지 않는다. 피처 시드 원본(`../seed/avenue_seed_dim_feature_fs_draft.sql`)도 따로 실행하지 않는다. `run_seed_only.sql`과 `run_all.sql`이 필요한 순서에 맞춰 실행한다.

## 완료 확인

- 피처 시드 출력: `TOTAL_CNT=39`, `ALT_CNT=20`, `SIM_CNT=9`
- `99_check.sql`: 테이블 47개, `DIM_FEATURE` 39행
- 각 테이블의 기대 행 수와 실제 행 수가 일치

오류나 불일치가 있으면 재실행하거나 `run_all.sql`로 초기화하지 말고, 실행 결과를 DB 담당자에게 전달한다.

## 시연 계정

| 아이디 | 용도 |
|---|---|
| `demo_employee` | 급여소득자 시연 |
| `demo_self` | 자영업자 시연 |
| `demo_free` | 프리랜서 시연 |
| `demo_admin` | 관리자 시연 |

비밀번호는 팀에서 별도로 안내받는다. 이 문서나 저장소에는 비밀번호를 적지 않는다.

## 기관 응답 더미

대안 데이터 불러오기 시연 파일은 [external_api](external_api/README.md)에 있다. 새 계정 또는 기관 응답 형식 확인이 필요하면 해당 안내를 본다.

## DB 변경 파일

기존 DB에 적용할 변경은 전체 초기화나 시드 재실행 대신 해당 파일만 검토한다.

- 자산·대출 상태 컬럼 변경: [alter_user_asset_snapshot_no_loan.sql](../alter_user_asset_snapshot_no_loan.sql)
- 대출 상품 설명 갱신: [update_loan_product_copy.sql](../update_loan_product_copy.sql)
- 사용하지 않는 상권 테이블 제거: [drop_unused_market_tables.sql](../drop_unused_market_tables.sql)
- 알림 테이블만 추가: [create_user_notification.sql](../create_user_notification.sql)

실제 Oracle DB에 적용하기 전 대상 스키마와 변경 내용을 확인한다. DDL과 시드에는 중간 커밋이 있어 오류가 나도 전체 작업이 자동으로 되돌아오지 않는다.

## 시드 재생성

일반 사용자는 시드를 다시 만들 필요가 없다. 시드 원천이나 매핑을 바꾸는 담당자는 [데이터 생성 안내](../../../../fastapi_server/data_generation/README.md)와 `tools/build_db.py`를 확인한다. 개발 키와 시연 비밀번호는 저장소 밖의 팀 보안 경로로 관리하며, 실제 값을 문서·명령 기록·커밋에 남기지 않는다.
