# 서비스 DB DDL v0.3.1 확정본 더미 시드 — 별도 개발 스키마 권장

**폴더 이름은 `v0_2`지만 내용은 범영 DDL v0.3.1 "배포용 확정본"(2026-11-11, 표 47개)이다.** 폴더는 옮기지 않았다. v0.3.1은 서비스 DB 기준 DDL이며, 옛 `dummy_db/` 14개 표(`APP_MEMBER` 계열)를 대신한다고 범영 님(DB·데이터 관리자)이 정했다. 옛 `dummy_db/` 파일 삭제는 팀 공지 후 진행할 예정이며, 그때까지 옛 생성기·SQL·README는 보존한다. 두 묶음은 `DIM_WORKER_TYPE`, `LOAN_PRODUCT` 등 이름이 겹치므로 **별도 Oracle 개발 사용자(스키마)에 적재**하는 것을 권장한다.

`01_create_tables.sql`은 2026-11-11 받은 v0.3.1 파일(`Downloads/message (3).txt`)을 바이트 그대로 복사했다. 원본 머리말에 출처·날짜·결정(E2·U1~U3·S1 등)이 있어 추가하지 않았다. SHA256: `a733cba56d779733728a8b65fdbb91c292e5cc7ac182c188ad33f97fced47568`.

## 저장소 상태와 생성

**커밋용 시드는 팀 개발 키 한 쌍으로 만든다(회의 결정).** 키는 저장소 밖(디스코드 비공개 채널)으로만 공유하고, 그 키로 만든 시드 SQL을 이 폴더에 커밋한다. 절차는 아래 「팀 개발 키로 시드 만들기」에 있다.

**`run_all.sql` 규칙:** 시드 SQL이 이 폴더에 없을 때의 `run_all.sql`은 실행을 막는 안내 파일이다. 생성기로 이 폴더에 시드를 쓰면 `run_all.sql`도 시드까지 적재하는 생성기 출력으로 바뀐다. 테스트(`RunAllRuleTests`)가 "시드 파일이 있으면 run_all이 그 시드를 모두 부르고, 없으면 안내 파일"인지 검사한다. 생성기가 키·DDL·원천 검사 중 하나라도 실패하면 파일을 쓰지 않는다.

의존성은 `fastapi_server/data_generation/requirements.txt`의 `cryptography==50.0.2`, `bcrypt==5.0.0`을 포함한다. 상위 `fastapi_server/requirements.txt`는 수정하지 않았다. 데이터 생성은 기존 PyYAML 등도 필요하다.

1. 데이터 패키지 루트(`fastapi_server/data_generation/`)에서 기존 순서대로 `generate.build_members`, `generate.build_external_api`, `generate.build_loan_products`를 실행한다. 기존 출력에 새 `members/member_asset_snapshots_v02.csv`가 추가된다. 기존 원천 값과 난수 소비는 바꾸지 않는다.
2. 키와 시연 비밀번호는 `--env-file <저장소 밖 env 파일>`로 넘기거나(권장), 없으면 Python 프로세스의 `AVENUE_DEV_AES_KEY`, `AVENUE_DEV_HMAC_KEY`, `AVENUE_DEMO_PASSWORD` 환경변수에서 읽는다. 저장소 안 env 파일은 거부한다. 키 문자열을 명령 인자·저장소·로그에 넣지 않는다. AES 키는 Base64 디코딩 후 정확히 32바이트, HMAC 키는 별도 최소 32바이트 키다. 같은 키는 거부한다.
3. 저장소 루트에서 실행한다(원천과 출력은 별도 폴더).

```text
python -I -X utf8 docs/spec/sql/dummy_db/tools/build_db_v02.py <service_dummy 폴더> <출력 폴더> --env-file <env 파일>
```

기본 DDL은 이 폴더의 `01_create_tables.sql`이다. `--ddl <받은 개정 DDL>`로 별도 입력을 지정할 수 있지만, 현재 CLI는 검수한 47테이블(v0.3.1)을 전제하므로 테이블 추가 개정은 시드 매핑·테이블 수를 함께 검수해야 한다. 키 누락·잘못된 Base64·동일 키·DDL/원천 불일치는 파일 쓰기 전에 오류로 중단한다. 미지원 CHECK 구문은 무시하지 않는다.

## 백엔드 전달용 개인정보 규격 (N-02-4)

- AES-256-GCM, 값마다 독립적인 **12바이트 난수 IV**, UTF-8 원문, AAD 없음(`None`). 저장값은 키 버전 접두어 **`v1:`** 뒤에 표준 Base64로 인코딩한 **`IV(12바이트) + 암호문 + 인증 태그(16바이트)`**를 붙인 문자열이다(v0.3.1 E2). 복호화할 때는 첫 `:` 앞의 버전으로 키를 고르고, 모르는 버전이면 오류로 멈춘다(`decrypt_text()` 참고). Base64 해제 후 앞 12바이트를 IV로, 나머지를 암호문+태그로 분리한다. 같은 원문도 매번 암호문이 달라지는 것이 정상이다.
- 검색값은 **별도 키의 HMAC-SHA256**, UTF-8, **64자 소문자 16진수**다. 이메일은 `trim` 후 소문자, 휴대폰은 ASCII 숫자만 남긴 뒤 HMAC을 계산한다. HMAC 열에는 접두어를 붙이지 않는다. 이름·휴대폰·이메일 원문은 SQL·보고서·오류에 남기지 않는다.
- 환경변수는 **`AVENUE_DEV_AES_KEY`**, **`AVENUE_DEV_HMAC_KEY`**(각 Base64)와 `AVENUE_DEMO_PASSWORD`만, 환경변수 또는 `--env-file`로 직접 지정한 저장소 밖 파일에서 읽는다. 저장소의 `.env`·application 설정 파일은 읽지 않는다. 키나 키 지문을 산출물에 저장하지 않는다. 백엔드도 동일한 키·정규화·포맷을 써야 한다.
- 암호문 생성 후 접두어를 포함한 실제 문자 길이를 DDL의 `NAME_ENC`, `PHONE_ENC`, `EMAIL_ENC` 길이와 대조한다. 이메일·휴대폰 HMAC도 DDL 길이 검사를 통과해야 한다.
- 이름·휴대폰은 회원 ID로 만든 합성 값, 이메일은 기존 `example.com` 합성 원천이다. 원문을 새 CSV로 저장하지 않는다. 테스트의 고정 공개 키는 실제 키가 아니다.
- 구현 기준: [cryptography AESGCM 공식 문서](https://cryptography.io/en/stable/hazmat/primitives/aead/#cryptography.hazmat.primitives.ciphers.aead.AESGCM).

## 팀 개발 키로 시드 만들기 (PowerShell, 저장소 루트에서)

1. **키 만들기(한 번만).** 저장소 밖 경로에만 저장되고, 이미 파일이 있으면 덮어쓰지 않는다. 키 값은 화면에 나오지 않는다.

   ```powershell
   python docs/spec/sql/dummy_db/tools/gen_dev_keys.py "$env:USERPROFILE\avenue-secrets\avenue_dev.env"
   ```

2. **공유.** 만든 파일을 디스코드 비공개 채널에만 올린다. 저장소·이슈·PR·일반 채널에 올리지 않는다.
3. **env 파일 위치.** 각자 저장소 밖(예: `%USERPROFILE%\avenue-secrets\avenue_dev.env`)에 둔다. 파일의 `AVENUE_DEMO_PASSWORD=` 뒤에 시연 계정 비밀번호를 채운다(비밀번호도 디스코드에서 공유). 항목 이름은 `docs/spec/sql/dummy_db/.env.example`에 있다.
4. **시드 생성(커밋용).** 출력 폴더를 이 폴더로 준다.

   ```powershell
   python -I -X utf8 docs/spec/sql/dummy_db/tools/build_db_v02.py <service_dummy 폴더> docs/spec/sql/dummy_db/v0_2 --env-file "$env:USERPROFILE\avenue-secrets\avenue_dev.env"
   ```

5. **커밋할 파일:** 이 폴더의 `00_drop_all.sql`, `01_create_tables.sql`, `10_seed_*.sql`~`24_seed_*.sql`, `99_check.sql`, `run_all.sql`(시드 적재용으로 바뀜), `seed_report.json`, `README.md`. env 파일은 절대 커밋하지 않는다.
6. **키가 바뀌면** 4번을 다시 실행해 시드 전체를 새로 만들고 커밋한다. 이전 키로 만든 암호문·HMAC은 새 키로 복호화·검색되지 않는다. Spring도 같은 env 값을 써야 한다.

**시연 계정(N-01-5):** 사용자는 직군별로 회원 ID 정렬 후 첫 회원 1명씩 3명이고, 관리자 1명을 새 행으로 추가해 모두 4개다. 네 계정은 같은 비밀번호를 쓴다.

| 아이디 | 직군 |
|---|---|
| `demo_employee` | 급여소득자 |
| `demo_self` | 자영업자 |
| `demo_free` | 프리랜서 |
| `demo_admin` | 관리자(N-01-5). 더미 회원과 별도로 추가한 새 행(USER_ID = 회원 최대값 + 1, `ROLE_ADMIN`, 직군·출생연도·휴대폰 NULL, 회원 데이터 행 없음) |

비밀번호는 디스코드 비공개 채널에서 공유한다. `PASSWORD_HASH`는 Spring `BCryptPasswordEncoder`와 호환되는 BCrypt `$2a$`, cost 10이다. 나머지 회원의 `PASSWORD_HASH`는 NULL이라 비밀번호 로그인이 되지 않는다.

**주의:** 키·비밀번호를 명령 인자·로그·스크린샷에 남기지 않는다. `.env`는 루트 `.gitignore`로 무시되지만, env 파일은 처음부터 저장소 밖에 둔다. 시드를 다시 만들면 BCrypt 해시와 암호문이 매번 달라지는 것이 정상이다. 테스트의 고정 공개 키·비밀번호는 실제 값이 아니다.

## 원천 매핑과 시드 범위

| 테이블 | 원천·규칙 |
|---|---|
| `APP_USER` | 기존 400명 ID를 정수 USER_ID로 유지, 이메일·닉네임·출생연도·직군은 기존 원천. 이름·휴대폰은 ID 기반 합성값을 암호화 |
| `USER_CONSENT` | 필수 2·선택 마케팅 미동의 1·외부 7항목(공과금 `utility`/`UTILITY_BILL` 포함)으로 회원당 10행. 외부 항목은 members.csv의 external_data_consent(시연 시작 상태)를 항목마다 복사하며 응답 status로 판단하지 않음. 외부 동의 시각은 원천에 없어 시연 기준일로 가정, 만료는 365일 후 |
| `USER_INCOME_MONTH` | 급여는 `SALARY` 기준월 1행, 자영업·프리랜서는 `MONTHLY_INCOME` 12행. 원천 금액·입력일 유지 |
| `USER_EXPENSE_ITEM` | 회원마다 `FIXED` 1행 = 원천 12개월 월 지출 평균, 원 단위 `ROUND_HALF_UP`. 세부 종류는 NULL |
| `USER_LOAN` | 전 회원 대출 원장을 기준월 한 세트로 보존. 시작 동의 회원은 IMPORTED, 미동의 회원은 MANUAL. 잔액 원 단위 보존, 연 금리는 비율×100 후 DDL 소수 3자리 반올림 |
| `USER_ASSET_SNAPSHOT` | 새 자산 보조 CSV의 합성 원천 자산을 기준월 1행으로 그대로 옮김 |
| `USER_UTILITY_PAYMENT` | 공과금 응답 `utility_responses.jsonl`을 통신비와 같은 `map_bill_rows()`로 매핑. 시작 동의 회원만 IMPORTED, 회원·월 12행. 미납 개월(LATE+UNPAID)을 원장 `utility_late`와 달마다·합계로 대조 |
| 통신·간편결제·사회보험 | 시작 동의 회원만 IMPORTED로 매핑하고 해당 회원의 Y 동의 ID 연결. 응답 전원 OK여도 미동의 회원 제외. 회원/월별 키·관측 상태·금액·납부 상태 대조 |
| `USER_CREDIT_PROFILE` | 기존 신용평가사 값 유지. 신규 대출 건수·현금서비스 개월·대부업 잔액은 동의된 회원 원장에서 파생 |
| 상품·대상 직군·특징·점수대 안내 | 기존 상품 17개를 유지하며 설명·기간·특징은 교육용 더미 문구. 평균 금리는 더미 최소·최대의 중간값으로 실제 통계 평균이 아님 |
| 기준 코드·모델 등록 | 받은 DDL 안 기준 INSERT 25행을 그대로 사용, 중복 생성하지 않음 |
| 평가·게시판·신고·운영 로그·통계 | `ASSESSMENT`, `ASSESSMENT_FACTOR` 등은 빈 테이블 |

**기준월은 임시 `2026-08`이다(TODO(D-16)).** 급여소득자의 이번 달/지난달 기준은 A팀·DB팀 합의 후 변경한다. 지출·대출·자산은 이 기준월의 한 세트다.

기존 대출 `kind(0~8)`의 의미와 고정/변동 구분은 미확정이다. 사용자 승인으로 `OTHER`·`UNKNOWN`을 사용하며 임의의 매핑을 만들지 않았다(TODO(D-27)). 대출별 월 상환액은 원천 기준월의 회원 총 상환액을 원장 연 상환액 비중으로 정수 배분하며, 합계를 정확히 보존한다. 비중이 모두 0이면 잔액 비중, 그것도 0이면 같은 비중을 쓴다. 실제 상환 스케줄을 재현한 값은 아니다.

**대출·동의 보존:** 전 회원에 대해 `USER_LOAN.MONTHLY_PAYMENT_AMT` 합계 = 원천 기준월 `debt_service_krw`를 검사한다(대출이 없으면 0). 받은 DDL의 `USER_LOAN`에는 `CONSENT_ID` 열이 없어 이 열은 SQL에 넣지 않는다. DDL 개정으로 열이 추가되면 MANUAL은 NULL, IMPORTED는 해당 LOANS 동의 ID로 연결한다. 통신·간편결제·사회보험·신용 프로필의 IMPORTED 행과 USER_CONSENT는 응답 status와 무관하게 시작 동의 상태를 따른다. 동의 회원의 기관 응답이 OK가 아니면 정상 데이터로 간주하지 않고 중단한다.

**점수대별 참고 범위(시연 가정, N-12·N-37):** 새 DB 상품의 `MIN_ALT_SCORE`는 은행(업권 0) 780, 상호금융(5) 665, 카드·저축은행·캐피탈(1·2·3) 0으로 둔다. 이는 실제 상품 심사 기준이 아니며 기존 상품 CSV 값은 바꾸지 않는다. 각 등급의 최저점 `MIN_SCORE`가 이 조건을 만족하는 상품만 모아 `SCORE_BAND_OFFER`의 최저/최고 금리와 최대 한도를 계산한다. 따라서 등급 내 모든 점수에서 해당 조건을 만족하는 범위다. 평균 금리는 그 최저·최고의 중간값으로 실제 고객 통계 평균이 아니다. 직군·소득 등 개별 신청 자격이나 승인 결과를 뜻하지 않는다.

원천에 카드 한도·재직/활동 기간이 없어 `CARD_LIMIT_AMT`, `WORK_PERIOD_MONTHS`는 NULL이다. `PASSWORD_HASH`는 시연 계정 4개(사용자 3·관리자 1)만 BCrypt 해시가 있고 나머지는 NULL이다. 임의 값·가짜 해시를 만들지 않았다.

현재 받은 DDL에는 `LOAN_PRODUCT_FEATURE`, `TERM_TEXT`, `RATE_AVG_PCT`가 모두 있다. 개정 DDL에서 빠지면 해당 시드를 빼고 `seed_report.json`의 `omitted_missing_ddl`에 보고한다.

**납부 상태(v0.3.1 U2·U3):** 통신비·공과금 표의 `PAYMENT_STATUS_CODE`는 `ON_TIME`(납부일 ≤ 기한), `LATE`(납부일 > 기한), `UNPAID`(기준일 현재 미납, 납부일 NULL)다. 기관 응답의 `late` + 납부일 없음은 `map_bill_rows()`에서 `UNPAID`로 바꾼다. DDL의 `CK_UTP_PAID_DATE`·`CK_UUP_PAID_DATE`를 생성기 검사기가 실제로 평가한다. 원천 대조에서는 LATE+UNPAID 달 수가 원장 `telecom_late`·`utility_late`와 같은지 본다. 현재 테스트 원천 기준 UNPAID는 통신비 0행, 공과금 2행이다.

## 검사·적재

생성기는 받은 DDL에서 타입·문자 길이·숫자 자릿수·NOT NULL·CHECK(Oracle NULL/UNKNOWN 포함)·PK·UNIQUE·복합 FK·조건부 UNIQUE INDEX를 읽어 검사한다. 모든 행 검증과 원천 대조가 끝나야 파일을 쓴다. SQL*Plus 2,499자 줄 제한도 생성 SQL에 적용한다. 이 검사는 Oracle 실행을 대신하지 않으며 현재 실제 Oracle 적재는 하지 않았다.

성공한 출력의 `run_all.sql`은 `00_drop_all.sql` → 받은 DDL(내장 기준 INSERT 포함) → 테이블별 시드 → `99_check.sql`을 실행한다. SQL Developer F5 또는 SQL*Plus `@run_all.sql`을 사용한다. `WHENEVER SQLERROR/OSERROR EXIT FAILURE ROLLBACK`이 있으나 **DDL과 이미 COMMIT한 데이터는 오류 후 ROLLBACK으로 되돌아오지 않는다.** 반드시 새 개발 스키마에서 실행한다.

`00_drop_all.sql`은 첫 DROP 전에 USER_TABLES에서 옛 DB 표식(APP_MEMBER·MEMBER_MONTHLY_INPUT·MEMBER_LOAN·EXTERNAL_API_RESPONSE)을 확인하고 하나라도 있으면 오류로 종료한다. 단독 실행에도 WHENEVER SQLERROR EXIT가 적용된다. 표식이 없는 스키마의 공유 테이블까지 자동 식별하는 가드는 아니므로 별도 스키마 원칙은 유지한다.

`99_check.sql`은 테이블 47개·테이블별 기대 행 수·COMMENT 누락을 출력한다. COMMENT 결과는 받은 초안의 누락일 수 있으므로 원본 DDL을 임의 수정하지 않고 DB 담당에게 전달한다. `seed_report.json`에는 행 수·DDL 해시·누락 선택 필드만 있으며 개인정보·키는 없다.

테스트(저장소 루트, cryptography가 설치된 Python):

```text
python -B -m unittest discover -s docs/spec/sql/dummy_db/tools/tests -v
```

전체 400명 검사도 실행하려면 `AVENUE_TEST_SERVICE_DUMMY`에 별도 재생성 원천 경로를 설정한다. 테스트 키로 만든 SQL은 테스트 임시 폴더에서만 사용한다.
