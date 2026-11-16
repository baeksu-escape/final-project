# DB 처음 설정하기

이 안내는 **비어 있는 새 개발용 Oracle 스키마**를 처음 준비할 때 사용한다. 합성 시연 데이터를 넣는다. 기존 데이터가 있는 DB에는 초기 설정을 실행하지 않는다.

## 1. Oracle 계정 준비

DB 담당자에게 개발 스키마 계정을 요청한다. 접속에 필요한 사용자 이름·비밀번호·주소·포트·서비스 이름과 테이블 생성 권한을 받는다. 계정 생성과 권한 부여는 Oracle 관리자 권한이 있는 담당자가 한다. SQL Developer의 연결 등록은 계정 생성과 별개다. 접속 정보는 팀에서 안내한 안전한 경로로 받고 문서나 저장소에 적지 않는다.

SQL Developer에서 **새 연결**을 만들고 전달받은 정보를 입력한다. `Test`가 성공하면 `Connect`한다. 연결 후 아래 쿼리로 발급받은 스키마 계정인지 확인한다.

```sql
SELECT USER FROM DUAL;
```

## 2. 파일을 차례로 실행

각 파일을 SQL Developer에서 직접 열고, 같은 스키마 연결을 선택해 **F5 (스크립트 실행)** 한다.

1. `avenue_ddl.sql` — 테이블과 기본 코드를 만든다.
2. `dummy_db/run_seed_only.sql` — 회원·상품·피처 시연 데이터를 넣고 검사를 실행한다.

`run_seed_only.sql`은 같은 폴더의 다른 SQL 파일을 상대 경로로 읽는다. 파일을 옮기지 말고 저장소 안의 폴더 구조를 유지한다. SQL*Plus를 쓰면 1번은 SQL 파일 경로에서 `@avenue_ddl.sql`, 2번은 `dummy_db` 폴더에서 `@run_seed_only.sql`로 실행한다.

## 3. 완료 확인

실행 결과에서 아래를 확인한다.

- 피처 시드: `TOTAL_CNT=39`, `ALT_CNT=20`, `SIM_CNT=9`
- 테이블 수: 47개
- `DIM_FEATURE`: 39행
- `99_check.sql`의 각 테이블 기대 행 수와 실제 행 수가 일치

피처 시드 SQL은 2번 파일이 자동 실행하므로 따로 실행하지 않는다. 오류가 나거나 행 수가 다르면 재실행·초기화하지 말고 결과를 DB 담당자에게 전달한다.

## 다른 상황

- 이미 테이블이 있고 시드 대상이 비어 있는 경우: DDL을 다시 실행하지 말고 `dummy_db/run_seed_only.sql`만 사용한다.
- 기존 DB의 구조 변경: 해당 변경 SQL만 검토한다. 산출 불가 사유 코드 `ALT_DATA_EMPTY` 추가는 [add_not_scorable_reason_alt_data_empty.sql](add_not_scorable_reason_alt_data_empty.sql)을 사용하고, 그 밖의 변경 파일은 [dummy_db README](dummy_db/README.md)를 참고한다.
- `dummy_db/run_all.sql`: 테이블을 삭제한 뒤 다시 만드는 실험용 파일이다. **기존 데이터가 삭제되므로 버려도 되는 별도 스키마에서만 실행한다.**
- 모델 학습 CSV: Oracle에 넣지 않는다. 위치와 사용법은 [학습 데이터 README](../../../fastapi_server/data/README.md)를 참고한다.
