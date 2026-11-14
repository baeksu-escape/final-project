# 데이터 입력·정보 제공 동의·대안 데이터 불러오기 Spring API(INP-01~06) + '카드·신용 이용' 섹션

- **날짜:** 2026-11-14
- **작성자:** JWC / Claude Code
- **브랜치:** `feature-A/FP-85-86-93-bundle` (PR B)
  - origin/develop a4c9b3a는 이미 들어 있어 새로 merge할 것이 없었다.
- **관련 N-ID:** N-05-2~9, N-05-6(대안 데이터), N-05-9(정보 제공 동의), N-18-3(대부업 잔액)
- **관련 결정:**
  - O-13(입력이 덜 차면 점수 산출 409), O-15 A안(NO_LOAN_YN), O-16(최장 연체일수 칸 없음), D-16(기준월별 저장)
  - D-29(신용평가사 API 제외 → 카드·신용 직접 입력)
  - DDL v0.3.2 + FP-209
  - 사용자 결정 11/14
    - 자산은 합계를 '기타 자산'에 넣어 돌려준다.
    - 남은 기간은 필수로 하되 0은 허용한다.
    - '할부' 선택지를 추가한다.
    - 0건 불러오기 기록은 EXTERNAL_CONSENT_ID로 한다.

## 무엇을, 왜 바꿨나
- 데이터 입력 화면이 부르는 INP-01~06을 실제 Spring으로 만들었다. 실제 모드(`VITE_USE_MOCK=false`)에서도 같은 흐름이 돈다.
  - 계약(경로·필드·상태·오류 code)은 프론트 `dataInputApi.js`와 `mocks/*.js`를 기준으로 했다.
  - 저장 규칙은 DDL과 더미 시드 생성기(`build_db.py`)를 따랐다.
- 대출 '업권'(옛 더미 DB 값)을 '대출 종류'(DIM_LOAN_TYPE)로 바꿨다. DB `USER_LOAN.LOAN_TYPE_CODE`에 그대로 들어간다.
- '카드·신용 이용' 섹션을 추가했다. 점수 산출 때 B팀 `creditProfile`이 읽는 값을 회원이 직접 넣는다(D-29).

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `user/controller/FinancialInputController`, `ConsentController`, `AltDataController` (새 파일) | INP-01·02, INP-04~06, INP-03 |
| `user/service/FinancialInputService` (새 파일) | 입력 저장(한 트랜잭션)·복원·완료 현황 |
| `user/service/DataInputRules` (새 파일) | 서버 검사. 화면 `inputRules.js`·`validationLimits.js`와 같은 문구·상한 |
| `user/service/ConsentService` (새 파일) | 동의 조회·추가·철회. 철회하면 불러온 행을 6표에서 지운다 |
| `user/service/AltDataImportService` (새 파일) | 불러오기, EMPTY·BORROW, 완료 판정 |
| `user/service/DataInputUsers` (새 파일) | 직군 확인(409 JOB_TYPE_REQUIRED)과 서울 시각 |
| `user/service/altdata/AltDataSource`·`JsonlAltDataSource`·`AltDataConverter`·`AltDataKind` (새 파일) | 기관 응답 원천(1차 JSONL, 2차 mock 서버로 교체 가능), 변환 규칙, 5종 정의 |
| `user/dto/DataInputDtos`, `DataInputRows` (새 파일) | 요청·응답 record, 표 행 |
| `user/mapper/FinancialInputMapper`, `AltDataMapper` + XML (새 파일) | 입력 6표, 대안 데이터 4표, 철회 삭제 |
| `user/mapper/UserConsentMapper` + XML | 기존 가입 동의 insert는 그대로 두고 대안 데이터 동의 조회·추가·철회·불러오기 기록을 더했다 |
| `frontend/.../config/inputOptions.js` | `LOAN_TYPE_OPTIONS` 추가, 할부(INSTALLMENT) 선택지 추가. `LOAN_SECTOR_OPTIONS`는 지우지 않고 "쓰지 않음" 주석만 달았다 |
| `frontend/.../config/inputSections.js` | 대출 `sectorCode` → `loanTypeCode`, 남은 기간 필수, `creditProfile` 섹션 추가(대출 바로 뒤) |
| `frontend/.../config/validationLimits.js` | 금리 상한 100 → 20(CK_ULN_RATE), 신용 칸 상한 추가 |
| `frontend/.../validation/inputRules.js`·`inputValidation.js`, `utils/inputValues.js` | 사용액 ≤ 한도 규칙. 비활성 칸은 검사하지 않고 null로 보낸다. 체크 칸은 true/false로 보낸다 |
| `frontend/.../components/FieldControl.jsx`·`SectionFields.jsx` | `checkbox` 칸(공통 Checkbox)과 `disabled` 전달. 새 className은 없다 |
| `frontend/.../components/AltDataImport.jsx` | 응답 `notice`를 기존 안내 자리에 보여 준다(로직만) |
| `src/test/…` | 서비스 3개, 변환 1개, 원천 1개, API 계약 1개 테스트. 합성 JSONL 2명분 |

## DB·API 변경
- **DB:** 표·열 변경은 없다. DDL을 실행하지 않았다.
  - 쓰는 표: USER_INCOME_MONTH, APP_USER.WORK_PERIOD_MONTHS, USER_LOAN, USER_ASSET_SNAPSHOT(NO_LOAN_YN), USER_EXPENSE_ITEM, USER_CREDIT_PROFILE, USER_CONSENT, USER_TELECOM_PAYMENT, USER_UTILITY_PAYMENT, USER_EASYPAY_USAGE, USER_SOCIAL_INSURANCE_PAYMENT
  - 시각 열(CREATED_AT·UPDATED_AT 등)은 DB 기본값 대신 서버 Clock(서울)으로 넣는다. 컨테이너 UTC로 9시간 어긋나는 문제를 피하기 위해서다(PR A의 LINKED_AT 문제 참고).
- **API:** 경로는 프론트와 같다. 필드는 다음만 바뀌거나 추가됐다.
  - **INP-02 필드 변경:** 대출 `sectorCode` → `loanTypeCode`(DIM_LOAN_TYPE 코드)
  - INP-02 추가: `creditProfile` 섹션 `{ cardLimitAmount, cardMonthlySpendAmount, delinquencyCount12m, cashAdvanceMonths, newLoanCount3m, privateLenderLoanBalanceAmount, noCreditHistory }`
  - INP-03 응답 추가: `notice`(기관 기록이 없는 계정일 때만)
  - 오류 code: `CONSENT_REQUIRED`(409), `ALT_DATA_SOURCE_UNAVAILABLE`(503), `JOB_TYPE_REQUIRED`(409, mock과 같음), `INVALID_INPUT`(400 + fieldErrors)

## 저장 규칙 요약
- **소득**
  - 급여소득자: 기준월 SALARY 1행
  - 자영업자·프리랜서: 최근 12개월을 달마다 MONTHLY_INCOME으로 MERGE하고, 빈 달은 지운다
- **대출:** 그 기준월 MANUAL 행만 다시 쓴다. IMPORTED 행은 그대로 둔다.
- **자산·대출 없음:** 저장할 때마다 기준월 행을 MERGE한다(저장한 기준월 기록 겸 savedAt).
  - TOTAL_ASSET_AMT: 4칸 합계, 모두 비면 NULL
  - NO_LOAN_YN: 대출 줄이 있으면 N, 줄 없이 "대출 없음"이면 Y, 둘 다 아니면 NULL
- **지출:** FIXED / INSTALLMENT / SUBSCRIPTION / OTHER(+ EXPENSE_CATEGORY 종류 이름, DESCRIPTION 내용)
- **카드·신용:** MANUAL, CB_AVAILABLE_YN='N', CB_GRADE NULL, BASE_DATE = 기준월 말일
  - CARD_UTIL_PCT = 사용액 / 한도 × 100
  - "신용 이력이 없어요": 연체·현금서비스·신규 대출·카드 값을 NULL로 저장하고 CREDIT_HISTORY_DAYS = 0으로 기록한다(다시 열 때 체크 복원)
- **동의:** ALT_DATA_PROVISION 5쌍, REQUIRED_YN='N', TERMS_VERSION='DEV-0.2', EXPIRES_AT = +365일(작업 6 보정, 시드와 같음). 철회하면 WITHDRAWN_AT을 채우고 그 CONSENT_ID의 IMPORTED 행을 지운다.
- **불러오기:** 이 회원·이 항목의 IMPORTED 행을 지우고 새로 넣는다(SOURCE_CODE='IMPORTED', CONSENT_ID, BASE_DATE).
  - 성공하면(0건 포함) `EXTERNAL_CONSENT_ID = 'DUMMY-MEM{USER_ID 6자리}-{ITEM_CODE}'`를 남긴다(작업 6 보정, 시드와 같음).
  - 완료 = 유효한 동의 + 이 값 있음.

## mock과 다른 점
- **시각 형식:** 서버는 `+09:00`(서울)으로 보내고, mock은 `Z`(UTC)로 보낸다. 화면은 앞 10자만 쓴다.
- **불러온 행의 기간**
  - mock은 기준월로 끝나는 12개월을 만들어 낸다.
  - 서버는 기관 응답 파일 행을 그대로 저장한다. 지금 파일은 2025-09~2026-08이고, 더미 시드와 같은 방식이다.
- **기관 기록이 없는 계정:** 서버는 `notice`를 준다.
  - EMPTY: 0건 + "이 계정은 기관 기록이 없습니다."
  - BORROW: 같은 직군 더미 회원의 응답 + "시연용 예시 데이터입니다."
  - mock은 언제나 데이터를 만든다.
- **자산:** 다시 열면 '기타 자산'에 합계가 들어간다(칸별 내역은 저장하지 않음).
- **다시 열 때 대출 목록:** 직접 입력한 대출(MANUAL)만 보인다. 불러온 대출은 완료 현황에만 반영된다.
- **사회보험 납부 상태 글자:** 일부 납부·납부 기한 전·납부 대상 아님·확인 불가를 더했다(mock은 정상 납부·연체·미납만 있음).
- **INP-01 `altData[key].importedAt`:** 0건으로 불러온 종류는 null이다.

## 시드(build_db.py)와 다른 점
- `EXTERNAL_CONSENT_ID`: 시드는 `DUMMY-{member_id}-{ITEM}`(예: DUMMY-MEM000001-EASYPAY)이고, 이 작업은 사용자 결정대로 `DUMMY-{PROVIDER_CODE}-{ITEM_CODE}`다. 완료 판정은 값이 있는지만 보므로 시드 회원도 '불러옴'으로 나온다.
- 대안 데이터 동의 `REQUIRED_YN`: 시드는 'N'이고, 작업 지시대로 'Y'(점수 산출 필수 5종)로 했다.
- 통신·공과금 응답에는 `as_of_date`가 없다. 그래서 BASE_DATE에 원천 파일 전체의 가장 늦은 as_of_date를 쓴다(시드도 전체 기준일 하나를 씀).
- **[2026-11-14 작업 6 보정] 위 두 차이는 없앴다.** 동의 저장 값을 시드와 같게 했다: REQUIRED_YN='N', TERMS_VERSION='DEV-0.2', EXPIRES_AT = AGREED_AT + 365일, EXTERNAL_CONSENT_ID = `DUMMY-MEM{USER_ID 6자리}-{ITEM_CODE}`(BORROW 모드도 내 회원코드). 유효한 동의 판정(`ConsentService.isActive`: AGREED_YN='Y' AND WITHDRAWN_AT IS NULL AND (EXPIRES_AT IS NULL OR EXPIRES_AT > 지금))은 이미 이 조건이라 바꾸지 않았다.

## 확인
- 확인함
  - `./mvnw test`: 132개 통과, 실패 0(이전 90 + 새 42)
    - ConsentServiceTest 7, AltDataImportServiceTest 8, FinancialInputServiceTest 15, AltDataConverterTest 5, JsonlAltDataSourceTest 2, DataInputApiContractTest 5
  - `npm run lint`·`npm run build` 통과
  - mock 모드 화면 5흐름(Playwright, 저장소 밖 스크립트) 통과
    - 5종 동의 → 불러오기 → 연결 해제
    - 4종이면 점수 산출 막힘
    - 탈퇴 → 로그인 화면 알림
    - 직군 없는 계정의 마이페이지
    - 신용 섹션 체크 시 비활성·대출 종류 6개·할부 선택지
- 확인 못 함 (작업 3에서 로컬 Docker로 확인)
  - 실제 Oracle에서 MERGE, IDENTITY 키 받기, NULL 바인딩
  - 실제 기관 응답 파일 400명분 읽기
  - 화면 → Spring → DB 전체 흐름

## 다음 사람이 알아야 할 것
- **자산 칸별 저장은 2차다.** DDL에 열을 추가해야 한다.
- **간편결제 MISSING 달:** 건수·금액이 null이라 표에 "건"·"원"만 보일 수 있다. 화면 표시 방식은 프론트 담당이 정할 일이라 고치지 않았다.
- **금융(financial/LOANS)·신용평가사 불러오기는 만들지 않았다**(1차 화면에 없음, `AltDataKind` TODO).
- **`avenue.altdata.source-dir`:** 견본에는 빈 값으로 두었다. 각자 저장소의 `docs/spec/sql/dummy_db/external_api` 절대 경로를 넣는다.
  - 폴더가 없으면 앱은 뜨지만 불러오기는 503이다.
- **PR 본문 "리뷰어가 볼 곳"에 적을 것**
  - INP-02 필드 변경 `sectorCode` → `loanTypeCode`
  - 자산 4칸은 합계만 저장해서 다시 열면 '기타 자산'에 합계가 들어간다(칸별 저장은 2차, DDL 필요)
  - '카드·신용 이용' 섹션과 '할부' 선택지 추가
  - FieldControl에 체크 칸이 추가됨(공통 Checkbox, 새 className 없음)

## [2026-11-14 · JWC / Claude Code] PR #52 리뷰 반영
- **1. 카드·신용 저장 실패를 성공으로 응답하던 문제:** `mergeManualCredit`이 0행을 바꾸면 409로 실패시킨다.
  - 원인: 같은 기준일에 IMPORTED 행이 있으면(`UK_UCP_USER_DATE`) MERGE가 0행을 바꾼다.
  - 응답: 409 `CREDIT_PROFILE_IMPORTED` "불러온 신용 정보가 있어 직접 입력을 저장할 수 없습니다."(fieldErrors 없음)
  - 저장 트랜잭션 전체(소득·대출 포함)를 되돌린다.
- **2. 소득 12개월 구간:** 동작은 바꾸지 않았다. 저장한 기준월의 구간은 이번 입력이 기준이라, 구간 안의 달은 이번 값으로 바뀌거나(빈 달은 삭제) 구간 밖은 그대로다. 주석과 테스트 이름을 실제 동작에 맞췄다.
- **3. 불러오기 baseMonth:** 형식(YYYY-MM)이 틀리면 400 + `fieldErrors[{field:'baseMonth'}]`이다. 저장에는 쓰지 않는다(기관 파일 기간 그대로, 화면 기준월 확인용).
- **4·5. 동시 요청 중복:** DB 제약은 추가하지 않았다. 대신 쓰기 트랜잭션 맨 앞에서 `UserAccountMapper.lockUser`(`SELECT USER_ID FROM APP_USER WHERE USER_ID = ? FOR UPDATE`)로 회원 행을 잠근다.
  - 적용 API: INP-02·03·05·06, MEM-07
- **6. BORROW 후보:** 기관 파일은 시작할 때 `JsonlAltDataSource`가 메모리 색인(파일 → USER_ID → 응답)으로 읽어 두며, `find`는 이 색인을 바로 찾는다.
  - 이번 변경: 후보 목록(종류·직군별, 오름차순)을 처음 한 번만 만들어 둔다. 후보가 없으면 저장하지 않는다.
  - 고르는 규칙(후보[USER_ID % 후보 수])은 그대로다.
- **API 변경:** INP-02에 409 `CREDIT_PROFILE_IMPORTED`, INP-03에 400 baseMonth 칸 오류가 생겼다. 요청·응답 필드는 그대로다.
- **확인:** `./mvnw test` 153개 통과
  - 새 테스트: 신용 409·롤백 대상, 잠금 순서(입력 저장·동의·철회·불러오기·탈퇴), baseMonth 형식, 후보 캐시
  - `UserLockSqlTest`: H2(Oracle 모드)에서 lockUser SQL이 같은 회원의 두 번째 트랜잭션을 막고 다른 회원은 막지 않음
- **확인 못 함:** 실제 Oracle에서의 잠금 대기, IMPORTED 신용 행이 있을 때의 409(지금 화면에는 신용 불러오기가 없음)

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
