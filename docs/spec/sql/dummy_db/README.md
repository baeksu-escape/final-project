# 서비스 DB DDL v0.3.2 더미 시드 — 별도 개발 스키마 권장

**기준 DDL은 `docs/spec/sql/avenue_ddl.sql`의 v0.3.2(51개 표)다.** 옛 v2.4 묶음은 11/12 삭제했고 이력은 git에 남아 있다. 폴더·파일 이름에는 버전을 넣지 않고 버전은 문서에 적는다. 별도 Oracle 개발 사용자(스키마)에 적재하는 것을 권장한다.

`01_create_tables.sql`은 기준 DDL의 바이트 동일 사본이며 시드와 검사 SQL은 DDL v0.3.2 기준이다. 13번 대출 시드는 11/13 v3.6.1 원천으로 교체했다.

`external_api/`는 INP-03(대안 데이터 불러오기)이 2차 mock 서버 전까지 읽는 기관 응답 더미(v3.6.1, 회원 400명 전원)이며 형식은 `external_api/README.md`를 따른다.

## 저장소 상태와 생성

**커밋용 시드는 팀 개발 키 한 쌍으로 만든다(회의 결정).** 키는 저장소 밖(디스코드 비공개 채널)으로만 공유하고, 그 키로 만든 시드 SQL을 이 폴더에 커밋한다. 절차는 아래 「팀 개발 키로 시드 만들기」에 있다.

**`run_all.sql` 규칙:** 시드 SQL이 이 폴더에 없을 때의 `run_all.sql`은 실행을 막는 안내 파일이다. 생성기로 이 폴더에 시드를 쓰면 `run_all.sql`도 시드까지 적재하는 생성기 출력으로 바뀐다. 테스트(`RunAllRuleTests`)가 "시드 파일이 있으면 run_all이 그 시드를 모두 부르고, 없으면 안내 파일"인지 검사한다. 생성기가 키·DDL·원천 검사 중 하나라도 실패하면 파일을 쓰지 않는다.

의존성은 `fastapi_server/data_generation/requirements.txt`의 `cryptography==50.0.2`, `bcrypt==5.0.0`을 포함한다. 상위 `fastapi_server/requirements.txt`는 수정하지 않았다. 데이터 생성은 기존 PyYAML 등도 필요하다.

1. 데이터 패키지 루트(`fastapi_server/data_generation/`)에서 기존 순서대로 `generate.build_members`, `generate.build_external_api`, `generate.build_loan_products`를 실행한다. 기존 출력에 새 `members/member_asset_snapshots_v02.csv`가 추가된다. 기존 원천 값과 난수 소비는 바꾸지 않는다.
2. 키와 시연 비밀번호는 `--env-file <저장소 밖 env 파일>`로 넘기거나(권장), 없으면 Python 프로세스의 `AVENUE_DEV_AES_KEY`, `AVENUE_DEV_HMAC_KEY`, `AVENUE_DEMO_PASSWORD` 환경변수에서 읽는다. 저장소 안 env 파일은 거부한다. 키 문자열을 명령 인자·저장소·로그에 넣지 않는다. AES 키는 Base64 디코딩 후 정확히 32바이트, HMAC 키는 별도 최소 32바이트 키다. 같은 키는 거부한다.
3. 저장소 루트에서 실행한다(원천과 출력은 별도 폴더).

```text
python -I -X utf8 docs/spec/sql/dummy_db/tools/build_db.py <service_dummy 폴더> <출력 폴더> --env-file <env 파일>
```

**출력 폴더 제한:** 출력은 이 `dummy_db` 폴더(커밋용 시드)이거나, OS 임시 폴더(`%TEMP%` 등) 아래이면서 저장소 밖인 폴더만 허용한다. 그 밖의 경로(예: `D:\out`)를 주면 '출력은 dummy_db 폴더 또는 저장소 밖 임시 폴더여야 합니다' 오류로 멈춘다. 원천 폴더와 겹치는 경로도 거부한다.

기본 DDL은 `docs/spec/sql/avenue_ddl.sql`이고, `01_create_tables.sql`은 생성 때 그 사본으로 함께 쓰인다. `--ddl <받은 개정 DDL>`로 별도 입력을 지정할 수 있고 표 수는 DDL에서 읽는다. 개정 시 시드 매핑과 제약도 함께 검수해야 한다. 키 누락·잘못된 Base64·동일 키·DDL/원천 불일치는 파일 쓰기 전에 오류로 중단한다. 미지원 CHECK 구문은 무시하지 않는다.

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
   python -I -X utf8 docs/spec/sql/dummy_db/tools/build_db.py <service_dummy 폴더> docs/spec/sql/dummy_db --env-file "$env:USERPROFILE\avenue-secrets\avenue_dev.env"
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
| 평가·게시판·신고·운영 로그·통계 | `ASSESSMENT`, `ASSESSMENT_FACTOR` 등은 빈 테이블. 게시글·게시글 로그·시스템 로그는 시연 원천이 없고, `FACT_DONG_LIVING_POP`·`FACT_HFS_WORKER_STAT`은 C조가 원자료를 적재한다 |

탈퇴 회원은 시드에 없다. 탈퇴 시 `WITHDRAWN`과 탈퇴 시각을 기록하고 개인정보를 표시값으로 바꾼다. `wd_` 아이디와 `탈퇴` 닉네임 접두어는 예약한다. 불러온 6개 표의 행은 동의 ID가 필수이며 직접 입력은 NULL이다(W3). 동의는 최대 1년이고 만료·철회·탈퇴 시 해당 동의로 불러온 행을 삭제한다.

**기준월은 임시 `2026-08`이다(TODO(D-16)).** 급여소득자의 이번 달/지난달 기준은 A팀·DB팀 합의 후 변경한다. 지출·대출·자산은 이 기준월의 한 세트다.

대출 종류·금리 방식은 원장 `members/ledgers/loans.csv`의 `loan_type_code`·`rate_type`에서 읽는다. 기관 응답 `financial_responses.jsonl`의 `loanTypeCode`와 같은 원천 값이며(DDL 주석은 기관 응답 기준으로 적혀 있다), 열이 없는 옛 원천이면 각각 `OTHER`·`UNKNOWN`을 쓴다. kind→종류 매핑은 가정이다(TODO(D-27), 대출 입력 항목 미확정). 대출별 월 상환액은 원천 기준월의 회원 총 상환액을 원장 연 상환액 비중으로 정수 배분하며, 합계를 정확히 보존한다. 비중이 모두 0이면 잔액 비중, 그것도 0이면 같은 비중을 쓴다. 실제 상환 스케줄을 재현한 값은 아니다.

**대출·동의 보존:** 전 회원에 대해 `USER_LOAN.MONTHLY_PAYMENT_AMT` 합계 = 원천 기준월 `debt_service_krw`를 검사한다(대출이 없으면 0). v0.3.2의 `USER_LOAN.CONSENT_ID`는 MANUAL이면 NULL, IMPORTED면 해당 LOANS 동의 ID로 연결한다. 저장소 시드의 IMPORTED 157행에는 동의 ID가 있다. 통신·간편결제·사회보험·신용 프로필의 IMPORTED 행과 USER_CONSENT는 응답 status와 무관하게 시작 동의 상태를 따른다. 동의 회원의 기관 응답이 OK가 아니면 정상 데이터로 간주하지 않고 중단한다.

**점수대별 참고 범위(시연 가정, N-12·N-37):** 새 DB 상품의 `MIN_ALT_SCORE`는 은행(업권 0) 780, 상호금융(5) 665, 카드·저축은행·캐피탈(1·2·3) 0으로 둔다. 이는 실제 상품 심사 기준이 아니며 기존 상품 CSV 값은 바꾸지 않는다. 각 등급의 최저점 `MIN_SCORE`가 이 조건을 만족하는 상품만 모아 `SCORE_BAND_OFFER`의 최저/최고 금리와 최대 한도를 계산한다. 따라서 등급 내 모든 점수에서 해당 조건을 만족하는 범위다. 평균 금리는 그 최저·최고의 중간값으로 실제 고객 통계 평균이 아니다. 직군·소득 등 개별 신청 자격이나 승인 결과를 뜻하지 않는다.

저장소 시드의 신용 프로필 318행에 카드 한도가 채워져 있다. `CARD_LIMIT_AMT`는 `(KC1000001 - L00000002) × 1000`원으로 계산하며 반올림하지 않는다. 원천 생성기의 총신용공여는 대출잔액·보증금액·카드 한도의 합이고 현재 보증 건수는 전원 0이다. 두 값 중 하나가 없거나 차이가 음수면 NULL이다. 보증금액이 생기면 이를 함께 빼야 한다. 이는 기존 시드의 가상 신용평가사 응답 매핑이며 프로필은 동의 회원의 `IMPORTED` 행이다. 1차 서비스에서는 신용평가사 API를 쓰지 않고 회원이 카드·신용 정보를 직접 입력하므로 `MANUAL`, `CONSENT_ID`는 NULL이다. 생성 보고서의 `card_spend_over_limit`는 월 사용액이 계산 한도를 초과한 행 수다. 재직/활동 기간 `WORK_PERIOD_MONTHS`는 NULL이다. `PASSWORD_HASH`는 시연 계정 4개(사용자 3·관리자 1)만 BCrypt 해시가 있고 나머지는 NULL이다.

현재 더미 원천에서 0원은 카드가 없는 회원이며, NULL은 원천 값이 없거나 계산이 음수인 경우다.

현재 받은 DDL에는 `LOAN_PRODUCT_FEATURE`, `TERM_TEXT`, `RATE_AVG_PCT`가 모두 있다. 개정 DDL에서 빠지면 해당 시드를 빼고 `seed_report.json`의 `omitted_missing_ddl`에 보고한다.

**납부 상태(v0.3.1 U2·U3):** 통신비·공과금 표의 `PAYMENT_STATUS_CODE`는 `ON_TIME`(납부일 ≤ 기한), `LATE`(납부일 > 기한), `UNPAID`(기준일 현재 미납, 납부일 NULL)다. 기관 응답의 `late` + 납부일 없음은 `map_bill_rows()`에서 `UNPAID`로 바꾼다. DDL의 `CK_UTP_PAID_DATE`·`CK_UUP_PAID_DATE`를 생성기 검사기가 실제로 평가한다. 원천 대조에서는 LATE+UNPAID 달 수가 원장 `telecom_late`·`utility_late`와 같은지 본다. 현재 테스트 원천 기준 UNPAID는 통신비 0행, 공과금 2행이다.

## 검사·적재

생성기는 받은 DDL에서 타입·문자 길이·숫자 자릿수·NOT NULL·CHECK(Oracle NULL/UNKNOWN 포함)·PK·UNIQUE·복합 FK·조건부 UNIQUE INDEX를 읽어 검사한다. 모든 행 검증과 원천 대조가 끝나야 파일을 쓴다. SQL*Plus 2,499자 줄 제한도 생성 SQL에 적용한다. DDL v0.3.2는 11/12 범영 님이 Oracle 적재를 확인했으며 시드는 11/13 경환이 `run_all.sql`로 적재해 `99_check.sql`의 표 51개·표별 행 수 일치를 확인했다.

성공한 출력의 `run_all.sql`은 `00_drop_all.sql` → 받은 DDL(내장 기준 INSERT 포함) → 테이블별 시드 → `99_check.sql`을 실행한다. SQL Developer F5 또는 SQL*Plus `@run_all.sql`을 사용한다. `WHENEVER SQLERROR/OSERROR EXIT FAILURE ROLLBACK`이 있으나 **DDL과 이미 COMMIT한 데이터는 오류 후 ROLLBACK으로 되돌아오지 않는다.** 반드시 새 개발 스키마에서 실행한다.

**최초 시드 적재:** 확정 `docs/spec/sql/avenue_ddl.sql`을 먼저 실행한 뒤 같은 스키마에서 `run_seed_only.sql`을 실행한다. DDL에 내장된 기준 데이터는 유지한다. 시드 대상 테이블이 모두 존재하고 비어 있는지 모든 시드 실행 전에 검사하며, 하나라도 없거나 기존 행이 있으면 중단한다. 이 검사는 동시 쓰기를 잠그지 않으므로 적재 중 다른 작업이 같은 테이블에 쓰지 않아야 한다. 기존 행의 병합·삭제·재적재는 지원하지 않는다. 시드 파일의 중간 COMMIT과 IDENTITY 변경 때문에 적재 도중 오류가 나면 전체 롤백할 수 없다. `99_check.sql`은 비교 결과를 출력하므로 직접 확인한다. 생성기 재실행 시 이 실행 파일도 함께 생성한다.

`00_drop_all.sql`은 첫 DROP 전에 USER_TABLES에서 옛 DB 표식(APP_MEMBER·MEMBER_MONTHLY_INPUT·MEMBER_LOAN·EXTERNAL_API_RESPONSE)을 확인하고 하나라도 있으면 오류로 종료한다. 단독 실행에도 WHENEVER SQLERROR EXIT가 적용된다. 표식이 없는 스키마의 공유 테이블까지 자동 식별하는 가드는 아니므로 별도 스키마 원칙은 유지한다.

`99_check.sql`은 DDL v0.3.2 기준 테이블 51개·테이블별 기대 행 수·COMMENT 누락을 출력한다. COMMENT 결과는 원본 DDL을 임의 수정하지 않고 DB 담당에게 전달한다. `seed_report.json`에는 행 수·DDL 해시·누락 선택 필드만 있으며 개인정보·키는 없다.

테스트(저장소 루트, cryptography가 설치된 Python):

```text
python -B -m unittest discover -s docs/spec/sql/dummy_db/tools/tests -v
```

전체 400명 검사도 실행하려면 `AVENUE_TEST_SERVICE_DUMMY`에 별도 재생성 원천 경로를 설정한다. 테스트 키로 만든 SQL은 테스트 임시 폴더에서만 사용한다.

다음 사람 메모: 시드 재생성 후 00/99 비교 테스트가 자동으로 원래 바이트 비교로 돌아간다(재생성 전에는 건너뜀).
