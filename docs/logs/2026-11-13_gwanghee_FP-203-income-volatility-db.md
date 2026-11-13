# FP-203 소득 변동성·현금흐름 API를 저장 데이터(DB) 조회로 연결

- **날짜:** 2026-11-13
- **작성자:** 광희 (C조) / Claude Code
- **브랜치:** `feature-C/FP-183-ImplementIncomeVolatilityANDCashFlowCalculationLogic` (FP-183 코드가 develop에 없어 이어서 작업)
- **관련 N-ID:** N-22-1, N-22-3, N-22-4, N-22-5, N-21-1, N-21-2, N-21-5, N-21-6, N-21-7
- **관련 결정:** D-20(공통 응답 형식 미정), D-24·투표 D9(급여소득자 연소득 = 월급 × 12)

## 무엇을, 왜 바꿨나
- 명세 N-22-1·N-21-1("저장 데이터 조회")에 맞춰, 요청 본문 대신 DB의 소득·지출·원리금으로 계산하는 GET API 2개를 추가했다. FP-183의 POST 2개는 지우지 않고 그대로 두었다.
- 계산 오류 2건을 고쳤다.
  - N-22-3 중앙값 자리에 평균이 들어가던 것을 실제 중앙값으로 바꿨다.
  - N-21 전망이 오늘 날짜 다음 달부터 시작하던 것을 마지막 입력월 다음 달부터 시작하도록 바꿨다(N-21-9 실적 뒤에 이어 그리기).
- 동주에게 응답 형식을 공유하려고 `docs/spec/api_spec.md`에 첫 명세를 적었고, 프론트 mock도 추가했다.

## 바뀐 파일
| 파일 | 변경 내용 (1줄) |
|------|-----------------|
| `backend/.../finance/mapper/IncomeVolatilityMapper.java` (신규) | 최근 12개월 소득, 최신 고정지출·지출 합계·월 원리금 조회 4개 |
| `backend/src/main/resources/mapper/finance/IncomeVolatilityMapper.xml` (신규) | 위 조회 SQL(최신 기준월 = `MAX(BASE_MONTH)`, 없으면 0) |
| `backend/.../finance/dto/IncomeMonthRow.java` (신규) | 소득 조회 결과 1행(기준월, 금액, 소득 종류) |
| `backend/.../finance/dto/CashFlowConditionRequest.java` (신규) | GET 전망 조건(변화율 3개, 예측 기간) |
| `backend/.../finance/service/IncomeVolatilityService.java` | mapper 주입, 저장 데이터 진단·전망 메서드 추가, 급여소득자 12개월 펼침, 전망 시작월 수정 |
| `backend/.../finance/controller/IncomeVolatilityController.java` | `GET /api/diagnosis/income-volatility`, `GET /api/diagnosis/cash-flow/forecast` 추가 |
| `backend/.../finance/util/IncomeVolatilityCalculator.java` | `calculateMedianIncome()` 추가, 응답 중앙값에 사용 |
| `backend/src/test/.../service/IncomeVolatilityServiceTest.java` | 가짜 mapper 주입, 저장 데이터 경로 테스트 4건 추가 |
| `backend/src/test/.../util/IncomeVolatilityCalculatorTest.java` | 중앙값 테스트 1건 추가 |
| `backend/src/test/.../controller/IncomeVolatilityControllerTest.java` (신규) | GET 2개의 쿼리·JSON 필드 이름·400·404 확인 4건 |
| `backend/src/test/.../mapper/IncomeVolatilityMapperIT.java` (신규) | 시드 적재 전제 조건 1건 + 실제 Oracle 조회 확인 3건. `-Ddb.it=true`일 때만 실행 |
| `docs/spec/api_spec.md` | 첫 내용: 양식 제안 + FP-203 요청·응답 명세와 예시 |
| `frontend/src/features/diagnosis/api/diagnosisApi.js` | `getIncomeVolatility()`, `getCashFlowForecast()` 추가 |
| `frontend/src/features/diagnosis/mocks/diagnosisMockData.js` | 시드 회원 2번 기준 응답 예시 추가 |
| `frontend/src/features/diagnosis/mocks/diagnosisMockHandlers.js` | GET 2개 mock 등록 |

## DB·API 변경
- DB: 없음 (기존 `USER_INCOME_MONTH`, `USER_EXPENSE_ITEM`, `USER_LOAN`을 읽기만 함)
- API:
  - `GET /api/diagnosis/income-volatility?userId=` (신규)
  - `GET /api/diagnosis/cash-flow/forecast?userId=&incomeChangePercent=&expenseChangePercent=&loanPaymentChangePercent=&forecastMonths=` (신규)
  - 기존 POST 2개는 그대로다. 단, 응답의 `medianIncome` 값이 평균에서 중앙값으로 바뀌었고, POST 전망 시작월도 과거 이력 마지막 달 + 1로 바뀌었다.
- 영향을 받는 기능·팀원: 동주(N-21·N-22 화면), A조(로그인 연동 시 `userId` 쿼리 제거)

## 확인
- 확인함:
  - `./mvnw test -Dtest='IncomeVolatility*Test'` 20건 통과
    - Calculator 6건
    - Service 10건
    - Controller 4건
  - JSON 불리언 필드가 `highVolatility`·`deficit`(is 없음)으로 나가는 것을 Controller 테스트로 고정했다.
  - `npm run lint` 오류 0
  - Oracle 통합 테스트(`-Ddb.it=true`): 로컬 XEPDB1 접속과 조회 SQL 실행까지는 오류 없이 확인했다.
    - 처음에는 `ORA-01017`(URL이 XE 컨테이너 DB를 가리킴), 다음에는 접속 거절(포트 10000)이 났다. 둘 다 사용자가 설정을 고쳐 해결했다.
  - 통합 테스트에 전제 조건 검사(`seedDataLoaded`)를 추가했다. 시드가 비어 있으면 표별 행 수를 출력하며 실패한다.
- 확인 못 함:
  - 실제 시드 값 대조. 로컬 스키마에 테이블은 있으나 시드가 0건이다(APP_USER·USER_INCOME_MONTH·USER_EXPENSE_ITEM·USER_LOAN 모두 0). `dummy_db/run_all.sql` 적재 후 다시 실행해야 한다.
  - 화면 동작(이번 작업에는 화면이 없다).

## 다음 사람이 알아야 할 것
- `userId` 쿼리는 로그인 전 임시값이다. 로그인(JWT) 연동 후에는 토큰에서 회원 번호를 읽도록 바꾸고 쿼리를 없앤다(`TODO(로그인 연동)`).
- 해석으로 정한 것이라 문서 담당 확인이 필요한 항목:
  - 급여소득자 월급 1행을 12개월로 펼친다.
  - N-22 고정지출은 `FIXED`만 합친다.
  - N-21 지출은 모든 지출 그룹을 합친다.
- 로컬 빌드에서 `target/`에 오래된 클래스가 남아 있으면 컴파일·MyBatis 스캔 오류(`disagree on InnerClasses attribute`)가 난다. 이럴 때는 `./mvnw clean`을 실행한다.
- `IncomeVolatilityCalculator.calculatePeakOffPeakGap()`은 N-21-7과 N-22-4가 함께 쓰는 함수다.

## 검수
> 검수 담당: 문서 담당자 · 형상 관리자 · 조장 (`README.md` 참고)

| 이름 | 역할 | 날짜 | 의견 |
|------|------|------|------|
| | | | |
