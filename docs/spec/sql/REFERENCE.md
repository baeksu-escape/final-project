# DB 참고

## DDL 변경 체크리스트 (PR #64)

`avenue_ddl.sql`을 변경하면 아래 항목을 같은 PR에서 확인한다.

1. 사본 일치: `cmp docs/spec/sql/avenue_ddl.sql docs/spec/sql/dummy_db/01_create_tables.sql` (출력이 없으면 동일).
2. DDL 해시: `dummy_db/seed_report.json`의 `ddl_sha256`을 LF 정규화 기준으로 갱신한다. 저장소 루트에서 실행: `python -c "import hashlib,pathlib;print(hashlib.sha256(pathlib.Path('docs/spec/sql/avenue_ddl.sql').read_bytes().replace(b'\r\n',b'\n')).hexdigest())"`.
3. DDL 기준 INSERT가 바뀌면 `dummy_db/99_check.sql`의 `EXPECTED`와 `seed_report.json`의 `rows`를 같은 값으로 맞춘다.
4. FS-DRAFT 시드는 원본과 실행용 사본을 맞추고 기대 행 수도 갱신한다. FS-V1 등 확정 피처 세트는 별도 파일과 생성기 목록에 추가한다.
5. 회원 시드 구조가 바뀌면 담당자와 상의해 `dummy_db/tools/build_db.py`로 재생성한다.
6. 기존 DB용 변경 SQL을 만들고 [초기 설정 안내](README.md)에 링크한다.
7. 저장소 루트에서 `python -B -m unittest discover -s docs/spec/sql/dummy_db/tools/tests`를 실행하고 결과를 PR에 기록한다.
8. DB 변경 작업 로그를 `docs/logs/`에 추가한다.
9. 공용 DB 적용은 DB 담당자와 실행 순서를 맞춘다.

## 실제 모델 전환·복구 (PR #77)

- 전환: [activate_model_lgbm_base_0_1.sql](activate_model_lgbm_base_0_1.sql)
- 복구: [rollback_model_to_dev_dummy.sql](rollback_model_to_dev_dummy.sql)
- 전환 전 FastAPI `/v1/health`에서 `modelLoaded: true`를 확인하고 DB 담당자와 적용 순서를 맞춘다. 상세 절차는 [FastAPI 안내](../../../fastapi_server/README.md)를 따른다.

## 테이블 결정 및 생성 코드

- **상권(N-24):** 화면이 정적 JSON을 사용하기로 결정해 상권 전용 5개 테이블과 관련 FK·인덱스를 DDL에서 제거했다. 기존 DB에서는 [전용 삭제 SQL](drop_unused_market_tables.sql)을 별도로 실행한다. 다른 공공 통계 테이블은 유지한다.
- **알림:** 결정에 따라 `USER_NOTIFICATION`은 빈 테이블만 준비한다. 시드·API·발송 로직은 추가하지 않는다. 기존 DB에는 [생성 SQL](create_user_notification.sql)을 한 번 적용한다.
- **생성 코드 보존:** 교육용 데이터의 생성 규칙과 검증 과정을 재현할 수 있도록 생성 코드·설계 문서·검증기를 저장소에 보존한다. 일반적인 시연 준비에서는 제공된 데이터를 사용하며 재생성 절차는 [생성 패키지 안내](../../fastapi_server/data_generation/README.md)를 따른다.
