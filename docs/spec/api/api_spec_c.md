# API 명세서 — C팀 (재무 진단·시뮬레이터 등)

> C팀 API의 요청·응답 상세를 기능(N-ID)별로 적는다. 관리: C팀(광희·동주).
>
> - 🆕 11/18 `docs/spec/api_spec.md`에서 이 파일로 옮겼다(내용은 그대로). 원래 머리말의 작성 규칙(오류 형식, 금액·비율·기준월, `isXxx` 필드 이름)은 세 팀이 함께 쓰도록 [README](README.md) 「명세서 작성 규칙」으로 옮겼다.
> - 전체 API 목록과 ID는 [API 정의서](api_definition.md)에 있다.
>
> **최근 변경**
> - 🆕 11/20 (동주, FP-184) N-25 모형 성능 비교 ADM-01 `GET /api/admin/model-performance`·ADM-02 `/roc` 구현. ACTIVE 모델의 평가 표본(`MODEL_EVAL_SAMPLE`)으로 계산하고, 표본이 없으면 409 `MODEL_EVAL_NOT_READY`(새 오류 code). 맨 아래 「N-25 모형 성능 비교」 절.
> - 🆕 11/20 N-17 버틸 수 있는 개월 수의 총자산 사용 비율을 25%에서 15%로 변경했다(D-33 합의).
> - 🆕 11/20 (광희, FP-239) N-16 자산·부채 저장값 `GET /api/members/me/financial-health`(DIAG-03-1) 추가: 총자산·연소득·총부채·연 원리금·보유 대출 목록, 미입력은 null. 정의서의 옛 경로 `GET /api/diagnosis/health`를 대신한다. 비율은 화면이 이 값으로 DIAG-03 POST를 불러 구한다. 같은 PR에서 DIAG-09 '밀림' 반영: `paymentStatus=DELAYED`면 최근 1년 30일 이상 연체 +1로 예상 점수를 구하고 응답에 `assumedDelinquencyCount`를 추가, `paymentStatusApplied`는 밀림일 때 `true`(범영 11/20 동의).
> - 🆕 11/20 (동주, FP-160) N-15 같은 직군·연령대 회원 평균 `GET /api/members/me/peer-benchmark`(DIAG-01) 추가. 11/19 팀 결정대로 공공통계 대신 회원 표에서 계산한다. 정의서의 옛 경로 `/api/finance/peer-benchmark`·원천(FACT_*)은 범영 님이 정의서에 반영한다. DIAG-02(`/all`)는 쓰는 화면이 없어 만들지 않았다. PR 리뷰 반영: 미입력 자산·대출은 평균에서 빼고(O-15), 금액별 인원 3개를 추가했으며, 소득은 기준월 포함 최근 12개월만 쓴다.
> - 🆕 11/20 (광희, FP-167) N-17 시나리오 테스트 API 2개 추가: `GET /api/members/me/scenario-base`(기준값)·`POST /api/members/me/scenario-recalculate`(상환 여력 재계산). 정의서의 옛 경로 `POST /api/diagnosis/scenario/recalculate`(프론트 mock만 있던 것)를 대신한다. 버틸 수 있는 개월 수의 총자산 사용 비율 15%는 D-33 11/20 합의다. 금리 변화는 변동금리 대출의 상환액에만 반영하고 대출마다 금리 하한은 0%다(리뷰 반영, 고정 상환액은 줄지 않음).
> - 🆕 11/19 (광희, FP-180) N-30-1 용어 사전 `GET /api/glossary`(HELP-01) 추가, 기준 데이터 `docs/spec/sql/add_glossary_term.sql`(20개).
> - 🆕 11/19 (광희, FP-170 추가 수정) 저장 데이터를 읽는 API 5개를 팀 공통 규칙대로 `/api/members/me/**`로 옮기고 옛 경로를 지웠다(우찬 님 합의): SIM-01 `credit-care-base`, SIM-02 `credit-care-recalculate`, DIAG-07-1 `income-volatility`, DIAG-08-1 `cash-flow-forecast`, DIAG-09 `cash-flow-expected-score`. 로그인 확인은 보안 설정이 한다(토큰 없음 401, 관리자 403). SIM-01에 `topReductionFactors`, DIAG-08-1에 기준값 3개(`baseFixedExpenseAmount`·`baseOtherExpenseAmount`·`baseMonthlyLoanPayment`)를 추가했다(경환 님 요청).
> - 🆕 11/18 (광희, FP-170) SIM-01 `credit-care/base`·DIAG-09 `cash-flow/expected-score` 추가, SIM-02 Spring 구현(출발 평가 = 최근 SCORED, 404 `ASSESSMENT_NOT_FOUND`).

---

## N-22 소득 변동성 진단 · N-21 현금흐름 전망 (FP-203, 담당 광희)

| 메서드 | 경로 | 용도 | 데이터 출처 |
|---|---|---|---|
| GET | `/api/members/me/income-volatility` 🆕 11/19 | DIAG-07-1 · N-22 소득 변동성 진단 (로그인 회원) | DB(저장 데이터) |
| GET | `/api/members/me/cash-flow-forecast?…조건` 🆕 11/19 | DIAG-08-1 · N-21 현금흐름 전망 (로그인 회원) | DB + 쿼리 조건 |
| POST | `/api/diagnosis/income-volatility` | DIAG-07 · N-22 계산만 (값을 본문으로 받음) | 요청 본문 |
| POST | `/api/diagnosis/cash-flow/forecast` | DIAG-08 · N-21 계산만 (값을 본문으로 받음) | 요청 본문 |

- API ID(DIAG-xx)는 [API 정의서](api_definition.md)의 번호다.

- **화면은 GET을 쓴다.** POST는 FP-183에서 만든 계산 전용 경로로, 지우지 않고 남겨 둔다.
- **GET은 로그인한 회원 본인 것만 조회한다.** 회원은 `Authorization: Bearer <토큰>`에서 찾고, 주소로 회원 번호를 받지 않는다(11/17 변경, 이전의 `?userId=` 쿼리는 없어졌다. 보내도 무시한다).
- 🆕 11/19 저장 데이터를 읽는 GET은 팀 공통 규칙(내 데이터 = `/api/members/me/**`)대로 옮겼다. 옛 GET 경로(`/api/diagnosis/income-volatility`, `/api/diagnosis/cash-flow/forecast`)는 지웠다. 같은 주소의 POST(DIAG-07·08)는 그대로이고, 그 주소로 GET을 보내면 405다.
- 🆕 11/19 로그인 확인은 보안 설정이 한다(`/api/members/me/**` = `ROLE_USER`). 토큰이 없으면 401, 관리자 계정이면 403이다. 요청 본문만 쓰는 POST는 임시 개방 경로(`/api/diagnosis/**`)에 남는다.
- 오류:
  - 로그인 토큰이 없거나 쓸 수 없으면(만료·잠금·탈퇴) `401 UNAUTHORIZED` "로그인이 필요합니다." 관리자 계정이면 `403 FORBIDDEN` 🆕 11/19
  - 저장된 소득이 없으면 `404 NOT_FOUND`
  - 예측 기간(`forecastMonths`)이 3·6·12가 아니면 `400 INVALID_INPUT` (GET 쿼리·POST 본문 공통)
  - GET 현금흐름의 화면 조건이 범위 밖이면 `400 INVALID_INPUT`, `fieldErrors[0].field` = 쿼리 이름 (11/17 추가): `incomeVariationPct`가 0~200 정수가 아님 "소득 변동 폭은 0~200% 정수여야 합니다.", `fixedExpenseAmount`가 음수 "월 고정 지출은 0 이상의 원 단위 정수여야 합니다.", `paymentStatus`가 `ON_TIME`·`DELAYED`가 아님 "납부 상태를 선택해 주세요." DB를 읽기 전에 검사한다.
  - 빈 값(11/18 확인): `incomeVariationPct=`·`fixedExpenseAmount=`처럼 숫자 조건을 빈 값으로 보내면 생략과 같다. `paymentStatus=`(빈 문자열)는 400, `forecastMonths=`와 변화율 3개(`incomeChangePercent=` 등)는 숫자로 바꿀 수 없어 400이다(변화율은 숫자가 아닌 값도 400). 화면의 `getCashFlowForecast()`는 빈 값을 쿼리에서 빼고 보낸다.
  - 숫자 자리에 `abc`·`50.5`처럼 형식이 틀린 값을 보내면 `400 INVALID_INPUT`이지만, 지금은 공통 예외 처리기(A조)가 칸별 문구를 영어 변환 오류 문장으로 준다. 한국어 문구로 바꾸는 개선은 A조에 따로 요청한다(mock은 위 한국어 문구를 쓴다).
  - POST `/income-volatility`에 본문이 없거나 `monthlyIncomes`가 없거나 비어 있으면 `400 INVALID_INPUT`(field `monthlyIncomes`), POST `/cash-flow/forecast`에 본문이 없으면 `400 INVALID_INPUT`
  - 본문은 위의 공통 오류 형식이다.

### 계산에 쓰는 저장 데이터

| 값 | 테이블 | 규칙 |
|---|---|---|
| 최근 12개월 소득 | `USER_INCOME_MONTH` | 소득 기준월(가장 늦은 달)부터 최대 12행. 급여소득자(`SALARY`)는 월급 1행을 마지막 기준월까지 12개월로 펼친다(연소득 = 월급 × 12와 같은 해석) |
| 월 고정지출 (N-22) | `USER_EXPENSE_ITEM` | **소득 기준월**의 `EXPENSE_GROUP_CODE = 'FIXED'` 합계. 그 달에 행이 없으면 0 |
| 월 지출 합계 (N-21) | `USER_EXPENSE_ITEM` | **소득 기준월**의 모든 지출 그룹 합계. 그 달에 행이 없으면 0 |
| 월 원리금 (N-21) | `USER_LOAN` | **소득 기준월**의 `MONTHLY_PAYMENT_AMT` 합계. 대출이 없으면 0 |

- 기준월은 DDL 11/10 결정대로 `USER_INCOME_MONTH`의 가장 늦은 `BASE_MONTH` 하나로 정하고, 지출·대출도 같은 달 값을 쓴다(테이블마다 최신 달을 따로 잡으면 서로 다른 달 값이 섞이므로, 11/17 리뷰 반영).

### GET `/api/members/me/income-volatility` (DIAG-07-1) 🆕 11/19 경로 이동

요청: 쿼리 없음, `Authorization: Bearer <토큰>`

응답 `200`:

| 필드 | 형식 | 설명 | N-ID |
|---|---|---|---|
| `meanIncome` | 정수 | 12개월 평균 소득 | N-22-3 |
| `medianIncome` | 정수 | 12개월 중앙값(짝수 개면 가운데 두 값 평균) | N-22-3 |
| `incomeCv` | 소수 | 월 소득 변동계수(%) | N-22-3 |
| `standardDeviation` | 소수 | 월 소득 표준편차(원). 모표준편차(n으로 나눔), 소수 둘째 자리. POST(DIAG-07) 응답에도 있다 (11/17 추가) | N-22-3 |
| `highVolatility` | 불리언 | 변동계수 12% 초과면 `true` ("변동이 큼") | N-22-3 |
| `fixedExpenseToLowestIncomeRatio` | 소수 | 가장 낮은 달 소득 대비 고정지출(%) | N-22-3 |
| `zeroIncomeMonthsCount` | 정수 | 소득 0원인 달 수 | N-22-3 |
| `recent3MonthsAverageIncome` | 정수 | 최근 3개월 평균 소득 | N-22-3 |
| `recent3MonthsDiff` | 정수 | 최근 3개월 평균 − 12개월 평균 | N-22-3 |
| `peakMonth`, `peakIncome` | 문자열, 정수 | 소득이 가장 높은 달과 금액 | N-22-4 |
| `offPeakMonth`, `offPeakIncome` | 문자열, 정수 | 소득이 가장 낮은 달과 금액 | N-22-4 |
| `peakOffPeakGap` | 정수 | 성수기·비수기 소득 격차 (N-21-7과 같은 계산) | N-22-4 |
| `hasDeficitWarning` | 불리언 | 소득이 고정지출보다 적은 달이 있으면 `true` | N-22-5 |
| `deficitMonths[]` | 배열 | 부족했던 달 목록. 다시 오기까지 가까운 순 | N-22-5 |
| `deficitMonths[].yearMonth` | 문자열 | 부족했던 기준월 | N-22-5 |
| `deficitMonths[].income` | 정수 | 그 달 소득 | N-22-5 |
| `deficitMonths[].shortfallAmount` | 정수 | 고정지출 대비 모자란 금액 | N-22-5 |
| `deficitMonths[].monthsUntilNext` | 정수 | 마지막 입력월 다음부터 그 달이 다시 오기까지 남은 개월 수 | N-22-5 |
| `nearestDeficitMonth` | 문자열 또는 `null` | 가장 가까운 부족 달 | N-22-5 |
| `monthsUntilNearest` | 정수 또는 `null` | 그 달까지 남은 개월 수 | N-22-5 |
| `recommendedReserveAmount` | 정수 | 미리 모아 둘 금액(가장 가까운 부족 달의 모자란 금액). 없으면 0 | N-22-5 |

예시 (더미 시드 회원 2번, 프리랜서):

```json
{
  "meanIncome": 2099498,
  "medianIncome": 1903317,
  "incomeCv": 33.68,
  "standardDeviation": 707118.75,
  "highVolatility": true,
  "fixedExpenseToLowestIncomeRatio": 99.09,
  "zeroIncomeMonthsCount": 0,
  "recent3MonthsAverageIncome": 1691927,
  "recent3MonthsDiff": -407571,
  "peakMonth": "2025-11",
  "peakIncome": 3884117,
  "offPeakMonth": "2026-06",
  "offPeakIncome": 1327643,
  "peakOffPeakGap": 2556474,
  "hasDeficitWarning": false,
  "deficitMonths": [],
  "nearestDeficitMonth": null,
  "monthsUntilNearest": null,
  "recommendedReserveAmount": 0
}
```

### GET `/api/members/me/cash-flow-forecast` (DIAG-08-1) 🆕 11/19 경로 이동

요청 쿼리 (N-21-2 전망 조건):

| 쿼리 | 형식 | 필수 | 설명 |
|---|---|---|---|
| `incomeChangePercent` | 소수 | 아니오 (기본 0) | 소득 변화율(%). 예: `-10`은 10% 감소 |
| `expenseChangePercent` | 소수 | 아니오 (기본 0) | 지출 변화율(%) |
| `loanPaymentChangePercent` | 소수 | 아니오 (기본 0) | 원리금 변화율(%) |
| `forecastMonths` | 정수 | 아니오 (기본 6) | 예측 기간. **3·6·12만** 받는다(없거나 0이면 6). 그 밖의 값은 `400 INVALID_INPUT`, `fieldErrors[0].field = forecastMonths` |
| `incomeVariationPct` | 정수 0~200 | 아니오 | 소득 변동 폭(%). 과거 같은 달 패턴을 얼마나 반영할지 (11/17 추가) |
| `fixedExpenseAmount` | 정수 ≥ 0 | 아니오 (기본 저장값) | 월 고정지출(원). 저장된 고정지출(FIXED) 자리만 이 값으로 바꾼다 (11/17 추가) |
| `paymentStatus` | `ON_TIME`·`DELAYED` | 아니오 | 납부 상태. 현금흐름 전망은 값만 검사하고 계산에 쓰지 않는다(11/17 추가). 🆕 11/20 예상 점수(DIAG-09, N-21-8)는 `DELAYED`면 최근 1년 연체 +1로 계산한다(FP-239) |

계산 규칙:

- 기준 소득은 최근 12개월 평균이다. 여기에 변화율을 곱해 전망 기간 동안 매달 같은 값을 쓴다.
- 전망은 **마지막 입력월 다음 달부터** 시작한다(N-21-9 실적 뒤에 이어 그리기).
- 화면 조건 3개는 모두 생략할 수 있고, **생략하면 결과는 위 규칙과 같다**(11/17 추가, 경환 님 화면과 합의).
  - `incomeVariationPct`를 보내면 달마다 전망 소득 = 평균 + (과거 같은 달 소득 − 평균) × 변동 폭 ÷ 100. 같은 달(1~12월)이 과거 이력에 없으면 평균을 쓰고, 0원 아래로는 내려가지 않는다(원 단위 반올림). 0%면 매달 평균, 100%면 과거 패턴 그대로다. 그 뒤에 `incomeChangePercent`를 곱한다.
  - `fixedExpenseAmount`를 보내면 전망 월 지출 = 이 값 + (월 지출 합계 − 저장된 FIXED 합계). 그 뒤에 `expenseChangePercent`를 곱한다. 과거 `months`의 지출은 저장값 그대로다.
  - 전망 소득이 달마다 달라질 수 있으므로 `worstForecastMonth`·`totalAccumulatedSurplus`는 달별 순현금으로 구한다.

응답 `200`:

| 필드 | 형식 | 설명 | N-ID |
|---|---|---|---|
| `pastDeficitMonthsCount` | 정수 | 최근 12개월 중 월 지출 합계가 소득보다 큰 달 수 | N-21-6 |
| `peakOffPeakGap`, `peakMonth`, `peakIncome`, `offPeakMonth`, `offPeakIncome` | | N-22-4와 같은 값 | N-21-7 |
| `monthlyForecasts[]` | 배열 | 월별 전망 | N-21-5 |
| `monthlyForecasts[].forecastYearMonth` | 문자열 | 전망 월 | N-21-5 |
| `monthlyForecasts[].forecastIncome` | 정수 | 전망 소득 | N-21-5 |
| `monthlyForecasts[].forecastExpense` | 정수 | 전망 월 지출 합계 | N-21-5 |
| `monthlyForecasts[].forecastLoanPayment` | 정수 | 전망 월 원리금 | N-21-5 |
| `monthlyForecasts[].netCashFlow` | 정수 | 전망 순현금(소득 − 지출 − 원리금) | N-21-5 |
| `monthlyForecasts[].deficit` | 불리언 | 순현금이 0보다 작으면 `true` | N-21-5 |
| `worstForecastMonth`, `worstNetCashFlow` | 문자열, 정수 | 가장 빠듯한 달과 그 달 순현금 | N-21-5 |
| `totalAccumulatedSurplus` | 정수 | 전망 기간 누적 잉여 | N-21-9 |
| `months[]` | 배열 | 과거 월 실적. 오래된 달 → 최근 달 순서, 소득 기준월까지 최대 12개 (11/17 추가, 화면이 실적 뒤에 전망을 이어 그림) | N-21-9 |
| `months[].baseMonth` | 문자열 | 기준월 `"YYYY-MM"` | N-21-9 |
| `months[].incomeAmount` | 정수 | 그 달 소득. 급여소득자는 월급을 12개월로 펼친 값 | N-21-9 |
| `months[].expenseAmount` | 정수 | 월 지출 합계. 지출은 월별이 아니라 평소 월 금액 하나만 저장되므로 매달 같은 값 | N-21-9 |
| `baseFixedExpenseAmount` 🆕 11/19 | 정수 | 저장된 월 고정지출(FIXED 합계). 화면 고정지출 슬라이더의 처음 값. 조건(`fixedExpenseAmount`)을 보내도 저장값 그대로다 | N-21-1·2 |
| `baseOtherExpenseAmount` 🆕 11/19 | 정수 | 기타 지출 = 월 지출 합계 − 고정지출(할부·정기결제·기타) | N-21-1·2 |
| `baseMonthlyLoanPayment` 🆕 11/19 | 정수 | 저장된 월 대출 원리금 합계 | N-21-1·2 |

- 저장된 소득이 12개월보다 적은 자영업자·프리랜서는 `months`도 그만큼 짧다.
- 🆕 11/19 **월 지출 합계에는 대출 원리금이 들어 있지 않다.** 지출 항목(`USER_EXPENSE_ITEM`의 고정·할부·정기결제·기타)만 더하고, 원리금은 대출(`USER_LOAN`)에서 따로 읽는다. 그래서 화면이 월 지출을 `forecastExpense + forecastLoanPayment`로 계산해도 중복되지 않는다.
- 🆕 11/19 기준값 3개는 저장 데이터 조회(GET)에만 있다. POST(DIAG-08)는 저장값이 없어 `null`이다.
- POST `/api/diagnosis/cash-flow/forecast`(DIAG-08)도 요청의 `past12MonthsHistory`를 같은 모양의 `months`로 돌려준다.

예시 (회원 2번으로 로그인, `?incomeChangePercent=-10&forecastMonths=3`):

```json
{
  "pastDeficitMonthsCount": 0,
  "peakOffPeakGap": 2556474,
  "peakMonth": "2025-11",
  "peakIncome": 3884117,
  "offPeakMonth": "2026-06",
  "offPeakIncome": 1327643,
  "monthlyForecasts": [
    { "forecastYearMonth": "2026-09", "forecastIncome": 1889548, "forecastExpense": 1315514, "forecastLoanPayment": 0, "netCashFlow": 574034, "deficit": false },
    { "forecastYearMonth": "2026-10", "forecastIncome": 1889548, "forecastExpense": 1315514, "forecastLoanPayment": 0, "netCashFlow": 574034, "deficit": false },
    { "forecastYearMonth": "2026-11", "forecastIncome": 1889548, "forecastExpense": 1315514, "forecastLoanPayment": 0, "netCashFlow": 574034, "deficit": false }
  ],
  "worstForecastMonth": "2026-09",
  "worstNetCashFlow": 574034,
  "totalAccumulatedSurplus": 1722102,
  "months": [
    { "baseMonth": "2025-09", "incomeAmount": 1933611, "expenseAmount": 1315514 },
    { "baseMonth": "2025-10", "incomeAmount": 1341079, "expenseAmount": 1315514 },
    { "baseMonth": "2025-11", "incomeAmount": 3884117, "expenseAmount": 1315514 },
    { "baseMonth": "2025-12", "incomeAmount": 1873023, "expenseAmount": 1315514 },
    { "baseMonth": "2026-01", "incomeAmount": 2330585, "expenseAmount": 1315514 },
    { "baseMonth": "2026-02", "incomeAmount": 2804640, "expenseAmount": 1315514 },
    { "baseMonth": "2026-03", "incomeAmount": 1619240, "expenseAmount": 1315514 },
    { "baseMonth": "2026-04", "incomeAmount": 2715365, "expenseAmount": 1315514 },
    { "baseMonth": "2026-05", "incomeAmount": 1616535, "expenseAmount": 1315514 },
    { "baseMonth": "2026-06", "incomeAmount": 1327643, "expenseAmount": 1315514 },
    { "baseMonth": "2026-07", "incomeAmount": 1686835, "expenseAmount": 1315514 },
    { "baseMonth": "2026-08", "incomeAmount": 2061303, "expenseAmount": 1315514 }
  ],
  "baseFixedExpenseAmount": 1315514,
  "baseOtherExpenseAmount": 0,
  "baseMonthlyLoanPayment": 0
}
```

화면 조건 예시 (회원 2번, `?incomeVariationPct=100&fixedExpenseAmount=1000000&forecastMonths=3`, 바뀌는 필드만):

- 소득은 과거 같은 달(2025-09·10·11) 값을 그대로 따른다. 회원 2번은 지출이 모두 고정지출이라(FIXED 합계 = 지출 합계 = 1,315,514) 월 지출 = 1,000,000 + (1,315,514 − 1,315,514) = 1,000,000

```json
{
  "monthlyForecasts": [
    { "forecastYearMonth": "2026-09", "forecastIncome": 1933611, "forecastExpense": 1000000, "forecastLoanPayment": 0, "netCashFlow": 933611, "deficit": false },
    { "forecastYearMonth": "2026-10", "forecastIncome": 1341079, "forecastExpense": 1000000, "forecastLoanPayment": 0, "netCashFlow": 341079, "deficit": false },
    { "forecastYearMonth": "2026-11", "forecastIncome": 3884117, "forecastExpense": 1000000, "forecastLoanPayment": 0, "netCashFlow": 2884117, "deficit": false }
  ],
  "worstForecastMonth": "2026-10",
  "worstNetCashFlow": 341079,
  "totalAccumulatedSurplus": 4158807
}
```

### 프론트 사용법

- `features/diagnosis/api/diagnosisApi.js`:
  - `getIncomeVolatility()`
  - `getCashFlowForecast({ incomeChangePercent, expenseChangePercent, loanPaymentChangePercent, forecastMonths })`
  - 화면 조건도 같은 객체에 넣으면 쿼리로 붙는다(값이 없으면 빠짐): `getCashFlowForecast({ forecastMonths: 6, incomeVariationPct: 100, fixedExpenseAmount: 1000000, paymentStatus: 'ON_TIME' })`
  - 회원 번호는 넘기지 않는다. 공통 `client.js`가 로그인 토큰을 붙인다.
- mock 모드(`VITE_USE_MOCK`)에서는 로그인한 mock 회원이 누구든 위 예시와 같은 회원 2번 값을 돌려준다(로그인하지 않았으면 401). 전망 mock은 쿼리 조건을 반영해 계산한다.

### POST `/api/members/me/cash-flow-expected-score` (DIAG-09, N-21-8, FP-170) 🆕 11/18 · 🆕 11/19 경로 이동 · 🆕 11/20 밀림 반영(FP-239)

전망 조건 중 소득·지출 변화를 저장된 입력에 반영해 예상 대안 점수를 FastAPI ML-03으로 **다시 구한다. 저장하지 않는다**(O-6).

- 요청 본문(JSON). 이름은 현금흐름 전망 쿼리와 같고 모두 생략할 수 있다. 검사 규칙과 400 문구도 같다.

  | 필드 | 형식 | 점수에 쓰는 방법 |
  |---|---|---|
  | `incomeVariationPct` | 정수 0~200 | 각 달 소득 = 평균 + (그 달 − 평균) × %. 생략하면 100%(저장된 소득 그대로). ⚠️ 🆕 11/19 현금흐름 전망(DIAG-08-1)은 생략하면 0%(매달 평균)라 기본값이 다르다. DIAG-09를 0%로 하면 조건 없이도 소득이 평평해져 점수가 바뀌고, DIAG-08-1을 100%로 하면 기존 결과가 바뀌어 각각 유지한다. **전망과 예상 점수를 함께 보여 줄 때는 두 API에 같은 값을 보낸다**(화면은 항상 보냄, 경환 11/19 합의) |
  | `incomeChangePercent` | 소수 | 위 결과 × (1 + %/100). 0원 아래는 0, 원 단위 반올림. 급여소득자(1개월)는 이 값만 적용된다 |
  | `fixedExpenseAmount` | 정수 ≥ 0 | 저장된 FIXED 항목들의 비율을 지킨 채 합계를 이 값으로 맞춘다(반올림 차이는 마지막 항목). FIXED 항목이 없으면 FIXED 1행을 더한다 |
  | `expenseChangePercent` | 소수 | 위 결과의 모든 지출 항목 × (1 + %/100) |
  | `paymentStatus` | `ON_TIME`·`DELAYED` | 🆕 11/20 `DELAYED`(밀림)면 요청의 최근 1년 30일 이상 연체 건수(`creditProfile.delinqCount12m`, 피처 `DQ1200001`)를 **+1**한다. 저장값이 없으면(신용 이력 없음) 0으로 보고 1이 된다(모델 0.2가 null을 0으로 읽는 것과 같음, D-31). `ON_TIME`·생략이면 바꾸지 않는다(경환 제안, 범영 11/20 동의). `forecastMonths`·`loanPaymentChangePercent`는 보내도 점수에 쓰지 않는다 |

- 처리 순서(범영 11/18):
  1. 현재 점수는 점수가 나온(SCORED) 최근 평가다.
  2. 요청은 `ScoreInputAssembler.build()`로 만들고 소득·지출과(🆕 11/20) 밀림이면 연체 건수만 바꾼다. requestId는 매번 새 UUID, 모델은 ACTIVE 버전이다.
  3. `PredictionClient.score()`를 한 번만 부른다.
- 응답 `200`:

  | 필드 | 형식 | 설명 |
  |---|---|---|
  | `currentScore`, `currentGradeBandCode` | 정수, 문자열 | 점수가 나온 최근 평가의 대안 점수·등급 |
  | `expectedScore`, `expectedGradeBandCode` | 정수, 문자열 | 바꾼 조건으로 다시 구한 대안 점수·등급 |
  | `scoreDiff` | 정수 | `expectedScore − currentScore`. 조건만의 효과가 아니다: 마지막 진단 뒤 **입력을 고쳤거나**, 🆕 11/19 그 사이 **모델이 바뀌었다면**(`modelVersion` ≠ `baseModelVersion`) 그 차이도 섞인다. 모델 호출을 1번으로 유지하려고 고른 한계다(경환 11/19 합의) |
  | `modelVersion` | 문자열 | 예상 점수를 계산한 모델(ACTIVE) |
  | `baseModelVersion` | 문자열 | 🆕 11/19 현재 점수를 낸 모델. `modelVersion`과 다르면 화면이 "모델이 바뀌어 점수 차이가 클 수 있습니다"를 안내한다 |
  | `baseRequestId` | 문자열 | 현재 점수를 가져온 평가 |
  | `paymentStatusApplied` | 불리언 | 🆕 11/20 납부 상태가 점수에 반영됐는지. `paymentStatus`가 `DELAYED`면 `true`, `ON_TIME`·생략이면 `false` |
  | `assumedDelinquencyCount` | 정수 또는 `null` | 🆕 11/20 밀림일 때 점수 계산에 넣은 최근 1년 30일 이상 연체 건수(저장값 + 1). 밀림이 아니면 `null`. 화면 문구: "최근 1년 30일 이상 연체 1회 추가로 가정" |

  ```json
  { "currentScore": 588, "currentGradeBandCode": "CAUTION", "expectedScore": 563, "expectedGradeBandCode": "CAUTION",
    "scoreDiff": -25, "modelVersion": "DEV-DUMMY", "baseModelVersion": "DEV-DUMMY",
    "baseRequestId": "00000000-0000-4000-8000-000000000588", "paymentStatusApplied": true, "assumedDelinquencyCount": 1 }
  ```
  (예: 소득 −10%·밀림. 밀림이 아니면 `"paymentStatusApplied": false, "assumedDelinquencyCount": null`)
- 오류:

  | 상태 | code | 언제 |
  |---|---|---|
  | 400 | `INVALID_INPUT` | 조건 검사 실패(필드 = 이름). ML-03이 입력을 거절(4xx)하면 "입력값을 확인해 주세요." |
  | 401 | `UNAUTHORIZED` | 토큰 없음 |
  | 403 | `FORBIDDEN` | 🆕 11/19 관리자 계정(`/api/members/me/**`는 `ROLE_USER` 전용) |
  | 404 | `ASSESSMENT_NOT_FOUND` | 점수가 나온 평가가 하나도 없음(리포트와 같은 코드) |
  | 409 | `INPUT_INCOMPLETE` | 저장된 입력 기준월이 없거나 출생연도가 없음(점수 산출과 같은 문구). 🆕 11/19 소득이 직군에 필요한 개월 수(자영업자·프리랜서 12, 급여소득자 1)보다 적거나 같은 달이 겹치면 ML-03을 부르지 않고 "소득을 필요한 개월 수만큼 입력해 주세요."(점수 산출과 같음, 0원으로 채워 계산하지 않음) |
  | 409 | `ALT_DATA_EMPTY` | 🆕 11/23 통신비 또는 공과금 기관 기록이 0건이면 ML-03을 부르지 않고 "통신비·공과금 기록이 없어 예상 점수를 계산할 수 없어요." ML-03이 이런 요청을 422로 거절해 예전에는 400 "입력값을 확인해 주세요"로만 보였다(FP-239 리뷰 후속, 범영 님 제안). 기준은 점수 산출(RPT-01)의 `ALT_DATA_EMPTY`와 같다(간편결제·보험 0건은 막지 않음) |
  | 503 | `MODEL_NOT_READY` | ML-03 연결 실패·시간 초과·5xx. 저장하지 않으므로 MODEL_ERROR 기록을 남기지 않는다 |
- 프론트: `diagnosisApi.js`의 `getExpectedScore({ incomeVariationPct, incomeChangePercent, fixedExpenseAmount, expenseChangePercent, paymentStatus })`. mock은 "평균 소득 변화율 × 1점 − 월 지출 변화율 × 0.5점"(🆕 11/20 밀림이면 −15점 더)으로만 계산하며, 진짜 모델 점수가 아니다.

---

## N-15 동년배·같은 직군 비교 (DIAG-01, FP-160, 담당 동주) 🆕 11/20

자산·부채 건전성 화면의 "같은 직군 평균과 비교" 카드(N-15-3)에 쓰는 회원 평균이다. 11/19 팀 결정으로 공공통계(`FACT_HFS_*`) 대신 **서비스 회원 표**에서 요청 때마다 계산한다(적재 없음). 공공통계에는 프리랜서 구분이 없기 때문이다.

### GET `/api/members/me/peer-benchmark` (DIAG-01)

- 로그인한 일반 회원만(보안 설정: 토큰 없음 401, 관리자 403). 회원은 토큰에서 꺼내고 쿼리·본문은 없다.
- 응답 200 — 금액은 원, 평균은 반올림한 정수. 필드 이름은 건전성 화면 `peer`와 같다.

```json
{
  "workerTypeCode": "EMPLOYEE",
  "ageBandCode": "30S",
  "sameWorkerType": { "memberCount": 132, "annualIncomeAmount": 42000000, "totalAssetAmount": 85000000, "totalDebtAmount": 31000000,
                      "incomeMemberCount": 130, "assetMemberCount": 128, "debtMemberCount": 125 },
  "sameAgeBand":    { "memberCount": 3,   "annualIncomeAmount": null,     "totalAssetAmount": null,     "totalDebtAmount": null,
                      "incomeMemberCount": 3, "assetMemberCount": 3, "debtMemberCount": 2 }
}
```

| 필드 | 뜻 |
|---|---|
| `workerTypeCode` | 내 직군 (`EMPLOYEE`·`SELF_EMPLOYED`·`FREELANCER`) |
| `ageBandCode` | 내 연령대 (`20S`·`30S`·`40S`·`50_PLUS`) — 연 나이(올해 − 출생연도), 평가 저장과 같은 구간 |
| `sameWorkerType` | 같은 직군 회원 평균 (본인 포함) |
| `sameAgeBand` | 같은 연령대 회원 평균 (직군과 상관없이, 본인 포함) |
| `*.memberCount` | 그룹 회원 수 |
| `*.annualIncomeAmount`·`totalAssetAmount`·`totalDebtAmount` | 평균 연소득·총자산·총부채. 그 금액을 입력한 회원만 평균에 넣고, **그 인원이 5명 미만이면 그 금액만 null**(몇 명뿐인 평균은 그 사람들의 값이 드러난다) — 화면은 "비교할 회원이 부족합니다"로 처리 |
| `*.incomeMemberCount`·`assetMemberCount`·`debtMemberCount` 🆕 11/20 | 각 금액 평균에 들어간 회원 수 (PR 리뷰 반영) |

- 평균에 넣는 회원: 일반 회원, 탈퇴 아님, 직군·출생연도 있음, 소득 행이 1개 이상(더미 회원 포함).
- 회원 값(기준월 = 그 회원의 가장 늦은 소득월, DIAG-07-1과 같은 규칙). 미입력은 0원으로 넣지 않고 **그 금액 평균에서만 뺀다**(O-15 A안).

  | 금액 | 평균에 넣는 경우 | 빼는 경우 |
  |---|---|---|
  | 연소득 | 기준월 포함 **최근 12개월(달력)** 안에 직군별 필요 개월 수(`DIM_WORKER_TYPE`: 급여소득자 1, 자영업자·프리랜서 12)만큼 소득이 있음 → N-20-3 공유 함수 `FinancialHealthCalculator.calculateAnnualIncome`(급여소득자 = 기준월 월급 × 12, 자영업자·프리랜서 = 12개월 합). 1년 넘은 소득은 섞지 않는다 | 빠진 달이 있어 개월 수가 모자람 |
  | 총자산 | 기준월 `USER_ASSET_SNAPSHOT.TOTAL_ASSET_AMT`가 있음 | NULL(미입력)·자산 행 없음 |
  | 총부채 | 기준월 대출 행이 있으면 `BALANCE_AMT` 합, 행이 없고 `NO_LOAN_YN='Y'`(해당 없음)면 0 | 둘 다 아님(미입력) |
- 오류

  | 상태 | code | 언제 |
  |---|---|---|
  | 401 | `UNAUTHORIZED` | 토큰 없음·만료, 탈퇴·없는 계정 |
  | 403 | `FORBIDDEN` | 관리자 계정 |
  | 409 | `JOB_TYPE_REQUIRED` | 직군을 고르지 않음 |

- 참고: 지금 더미 회원은 20대가 60%이고 30대 이상의 부채가 거의 0이라 평균이 어색하게 보일 수 있다.
- 정의서의 DIAG-02(`/all`)·DIAG-05(기준금리 `/api/finance/policy-rates`)는 만들지 않는다. 기준금리는 N-17 `GET /api/members/me/scenario-base`의 `policyRate`(원천 `FACT_POLICY_RATE`, FP-153)를 쓴다. 🆕 11/20

---

## N-13 비교 분석 '내 위치' (RPT-05, FP-251, 담당 동주) 🆕 11/23

비교 분석 화면 맨 위 '내 위치' 카드 3개(N-13-4)에 쓰는 값이다. 내 대안 점수가 같은 직군·같은 연령대·같은 직군+연령대 회원 안에서 어디쯤인지 요청 때마다 계산한다(적재 없음). 

### GET `/api/members/me/score-percentile` (RPT-05)

- 로그인한 일반 회원만(보안 설정: 토큰 없음 401, 관리자 403). 회원은 토큰에서 꺼내고 쿼리·본문은 없다.
- 응답 200 (숫자는 예시)

```json
{
  "myScore": 709,
  "workerTypeCode": "SELF_EMPLOYED",
  "ageBandCode": "30S",
  "modelVersion": "LGBM-BASE-0.2",
  "minGroupSize": 5,
  "groups": [
    { "groupType": "WORKER_TYPE",     "memberCount": 40, "topPct": 37.5, "avgScore": 690.0, "diffFromAvg": 19.0 },
    { "groupType": "AGE_BAND",        "memberCount": 30, "topPct": 46.7, "avgScore": 714.0, "diffFromAvg": -5.0 },
    { "groupType": "WORKER_TYPE_AGE", "memberCount": 3,  "topPct": null, "avgScore": null,  "diffFromAvg": null }
  ]
}
```

| 필드 | 뜻 |
|---|---|
| `myScore` | 내 대안 점수(0~1000 정수) — ACTIVE 모델로 낸 가장 최근 SCORED 평가 |
| `workerTypeCode`·`ageBandCode` | 그 평가에 저장된 내 직군·연령대(평가 시점 값) |
| `modelVersion` | 비교에 쓴 ACTIVE 모델 |
| `minGroupSize` | 값을 내는 최소 인원(5). 화면 안내 문구에 쓴다 |
| `groups` | 항상 `WORKER_TYPE`(직군), `AGE_BAND`(연령대), `WORKER_TYPE_AGE`(직군+연령대) 순서로 3개 |
| `groups[].memberCount` | 집단 인원(본인 포함) |
| `groups[].topPct` | 상위 n%(소수 첫째 자리) = (나보다 점수가 높은 사람 수 + 1) ÷ 인원 × 100. 동점은 같은 순위. 1등이어도 0%가 아니다(20명 중 1등 = 5.0) |
| `groups[].avgScore` | 집단 평균 대안 점수(소수 첫째 자리) |
| `groups[].diffFromAvg` | `myScore − avgScore`(소수 첫째 자리). 음수면 평균보다 낮다 |

- 비교 대상은 관리자 통계 ADM-03과 같은 쿼리다(`AdminStatsMapper.selectLatestScoredMembers`): 서비스 회원이 ACTIVE 모델로 낸 최근 SCORED 평가 1건, 탈퇴 회원 제외(D-28). 평가 표본(`MODEL_EVAL_SAMPLE`)은 연령대가 없어 쓰지 않는다.
- 집단 인원이 `minGroupSize`보다 적으면 `topPct`·`avgScore`·`diffFromAvg`가 모두 null이다. 화면은 "표본이 적다"고 안내한다.
- 상위 n% 식은 명세 N-13-3에 없어 담당자가 정했다(11/23). 중앙값은 명세 처리·출력에 없어 넣지 않았다.
- 오류

  | 상태 | code | 언제 |
  |---|---|---|
  | 401 | `UNAUTHORIZED` | 토큰 없음·만료, 탈퇴·없는 계정 |
  | 403 | `FORBIDDEN` | 관리자 계정 |
  | 404 | `ASSESSMENT_NOT_FOUND` | ACTIVE 모델로 낸 내 점수가 없음(옛 모델 점수만 있는 경우 포함) — 화면은 점수 산출 안내 |

---

## N-17 시나리오 테스트 (FP-167, 담당 광희) 🆕 11/20

로그인 회원의 저장 데이터에 금리·소득·지출 변화를 넣어 **상환 여력**(월 잉여, 상환 부담률, 월 이자 변화, 버틸 수 있는 개월 수)을 다시 계산한다. **점수는 구하지 않고**(점수 예측은 N-21 DIAG-09) **저장하지 않는다**.

- 정의서의 옛 경로 `POST /api/diagnosis/scenario/recalculate`(DIAG-04, 프론트 mock만 있음)를 아래 두 경로로 대신한다. 기준값을 서버가 저장 데이터에서 읽으므로 요청에 기준값을 보내지 않는다.
- 로그인 확인은 보안 설정이 한다: 토큰 없음 `401 UNAUTHORIZED`, 관리자 계정 `403 FORBIDDEN`(`/api/members/me/**`는 `ROLE_USER` 전용).

### 계산에 쓰는 저장 데이터 (기준월 = 소득 기준월, 현금흐름 전망과 같음)

| 값 | 출처 | 없을 때 |
|---|---|---|
| 월 소득 | `USER_INCOME_MONTH` 최근 12개월 평균(급여소득자는 월급 그대로). DIAG-08-1과 같은 함수 | 소득이 하나도 없으면 404 |
| 월 지출 | `USER_EXPENSE_ITEM` 기준월 합계 | 0 |
| 월 상환액 | `USER_LOAN` 기준월 월 원리금 합계 | 0 |
| 변동금리 대출 | `USER_LOAN` 기준월 `RATE_TYPE_CODE = 'VARIABLE'` 행의 잔액·연 금리·월 원리금(고정·`UNKNOWN` 제외). 기준값 응답에는 잔액 합계만 준다 | 잔액 0(행 없음) |
| 총자산 | `USER_ASSET_SNAPSHOT.TOTAL_ASSET_AMT` 기준월 | `null`(미입력, 0으로 바꾸지 않음) |
| 현재 정책금리 | `FACT_POLICY_RATE`의 '한국은행 기준금리' 중 기준일이 가장 늦은 행(FP-153 적재 SQL) | `null` |

### GET `/api/members/me/scenario-base` (N-17-1)

- 응답 `200`:

  | 필드 | 형식 | 설명 |
  |---|---|---|
  | `monthlyIncomeAmount`, `monthlyExpenseAmount`, `monthlyPaymentAmount` | 정수(원) | 월 소득(12개월 평균)·지출·상환액 |
  | `variableLoanBalanceAmount` | 정수(원) | 금리 변화를 반영할 변동금리 대출 잔액 |
  | `totalAssetAmount` | 정수(원) 또는 `null` | 총자산. 미입력이면 `null`(버틸 개월 수를 구하지 않음) |
  | `policyRate` | 객체 또는 `null` | `{ baseDate: "2026-10-31", ratePct: 3.000 }` 출발 금리(연 %) |
  | `assumptions` | 문자열 배열 | 화면에 그대로 보여 줄 계산 가정 4개 |
  | `loanItems` | 배열 | 기준월 `LOAN_ID` 순 대출 항목: `loanId`, `loanTypeName`, `annualRatePct`(연 %, 예: 8.9), `rateTypeCode`(`FIXED`·`VARIABLE`·`UNKNOWN`), `monthlyPaymentAmount`(원). 대출이 없으면 빈 배열 |

  ```json
  { "monthlyIncomeAmount": 2099498, "monthlyExpenseAmount": 1315514, "monthlyPaymentAmount": 350000,
    "variableLoanBalanceAmount": 12000000, "totalAssetAmount": 30000000,
    "policyRate": { "baseDate": "2026-10-31", "ratePct": 3.000 },
    "assumptions": ["금리 변화는 변동금리 대출에만 반영하고, …"],
    "loanItems": [
      { "loanId": 101, "loanTypeName": "신용대출", "annualRatePct": 8.9, "rateTypeCode": "VARIABLE", "monthlyPaymentAmount": 200000 },
      { "loanId": 102, "loanTypeName": "주택담보대출", "annualRatePct": 4.2, "rateTypeCode": "FIXED", "monthlyPaymentAmount": 150000 }
    ] }
  ```

- 오류: `404 NOT_FOUND` "저장된 소득 데이터가 없습니다."(현금흐름 전망과 같음)

### POST `/api/members/me/scenario-recalculate` (N-17-2~5)

- 요청 본문(JSON). 모두 생략할 수 있고, 생략하면 0(변화 없음)이다. 본문이 없어도 된다.

  | 필드 | 형식 | 범위 | 뜻 |
  |---|---|---|---|
  | `ratePctPoint` | 소수 | −5 ~ +10 (%p) | 금리 변화. **변동금리 대출 잔액에만** 반영한다 |
  | `incomePct` | 소수 | −100 ~ +100 (%) | 월 소득 변화 |
  | `expensePct` | 소수 | −50 ~ +100 (%) | 월 지출 변화 |

- 계산(N-17-3 공통 재계산 틀, 원 단위 반올림):
  - 바뀐 소득·지출 = 기준값 × (1 + % ÷ 100)
  - 월 이자 변화 = Σ 변동금리 잔액 × (max(금리 + 변화, 0) − 금리) ÷ 100 ÷ 12. **대출마다 금리는 0% 아래로 내려가지 않는다.** 합계를 낸 뒤 한 번만 반올림한다(HALF_UP, −0.5원 → −1원. 프론트 mock도 같음)
  - 바뀐 상환액 = 고정 상환액 + max(0, 변동 상환액 + 월 이자 변화). 변동 상환액은 변동금리 대출 월 원리금 합계, 고정 상환액은 전체 월 상환액에서 그것을 뺀 값(고정·`UNKNOWN`)이다. **금리가 내려가도 고정 상환액은 줄지 않는다**
  - 월 잉여 = 소득 − 지출 − 상환액. 상환 부담률 = 연 원리금 ÷ 연소득 × 100(소수 둘째 자리, N-16-1·N-20-4와 같은 함수). 소득이 0 이하면 `null`
  - 버틸 수 있는 개월 수 = ⌊총자산 × **15%** ÷ 월 부족액⌋. 조건 반영 후 **적자일 때만** 값이 있고, 흑자이거나 총자산 미입력이면 `null`
    - 15%는 D-33 11/20 합의다(`ScenarioService.SURVIVABLE_ASSET_RATIO_PCT`).
- 응답 `200`:

  | 필드 | 형식 | 설명 |
  |---|---|---|
  | `current`, `changed` | 객체 | 지금·조건 반영 후. 각각 `monthlyIncomeAmount`, `monthlyExpenseAmount`, `monthlyPaymentAmount`, `monthlySurplusAmount`(원), `dsrPct`(%, 또는 `null`) |
  | `monthlyInterestChangeAmount` | 정수(원) | 월 이자 변화(±, 대출마다 금리 하한 0% 적용) |
  | `surplusDiffAmount` | 정수(원) | 조건 반영 후 월 잉여 − 지금 월 잉여 |
  | `survivableMonths` | 정수 또는 `null` | 버틸 수 있는 개월 수(위 규칙) |
  | `verdict` | 문자열 | `SHORTFALL`(조건 반영 후 적자), `IMPROVED`(지금보다 잉여 증가), `STILL_POSITIVE`(그 밖, 흑자 유지) |
  | `assumptions` | 문자열 배열 | 기준값 응답과 같은 계산 가정 |

  ```json
  { "current": { "monthlyIncomeAmount": 2099498, "monthlyExpenseAmount": 1315514, "monthlyPaymentAmount": 350000, "monthlySurplusAmount": 433984, "dsrPct": 16.67 },
    "changed": { "monthlyIncomeAmount": 1259699, "monthlyExpenseAmount": 1315514, "monthlyPaymentAmount": 370000, "monthlySurplusAmount": -425815, "dsrPct": 29.37 },
    "monthlyInterestChangeAmount": 20000, "surplusDiffAmount": -859799, "survivableMonths": 10, "verdict": "SHORTFALL",
    "assumptions": ["금리 변화는 변동금리 대출 잔액에만 반영하고, …"] }
  ```
  (예: 변동금리 대출 1,200만 원·연 5%·월 원리금 20만 원(전체 상환액 35만 원 중), 총자산 3,000만 원, `{ "ratePctPoint": 2, "incomePct": -40 }`. 같은 기준값에 `-5`%p면 금리가 0%까지만 내려가 월 이자 −50,000원, 상환액은 고정 15만 원이 남아 30만 원)
- 오류:

  | 상태 | code | 언제 |
  |---|---|---|
  | 400 | `INVALID_INPUT` | 범위 밖(필드 = 이름). 문구 예: "금리 변화는 -5~+10%p 사이로 입력해 주세요." 조건은 DB를 읽기 전에 검사한다. 숫자로 읽을 수 없는 값(예: `"abc"`)은 공통 처리로 "요청 형식이 올바르지 않습니다."(`fieldErrors` 없음) |
  | 404 | `NOT_FOUND` | 저장된 소득 데이터가 없음 |
- 프론트: `diagnosisApi.js`의 `getScenarioBase()`, `recalculateMemberScenario({ ratePctPoint, incomePct, expensePct })`. mock은 위 계산 규칙과 같고, 기준값은 예시값(소득·지출은 시드 회원 2번, 대출·자산은 예시)이다. 옛 `recalculateScenario`(옛 경로 mock)는 지우지 않고 두었다.

---

## N-16 자산·부채 건전성 · N-20 DSR 계산기 (FP-166, 담당 광희)

| 메서드 | 경로 | 용도 | 데이터 출처 |
|---|---|---|---|
| POST | `/api/diagnosis/dsr/calculate` | N-20-4 DSR·위험 단계 | 요청 본문 |
| POST | `/api/diagnosis/financial-health/calculate` | N-16-1·2 건전성 지표, N-16-3 값 바꿔 보기 | 요청 본문 |
| GET | `/api/members/me/financial-health` 🆕 11/20 | N-16-1·2·4 내 저장값(DIAG-03-1, FP-239) | 저장 데이터 (아래 「DIAG-03-1」) |

- 위 두 POST API는 **DB를 읽지 않고 받은 값으로 계산만** 한다. 저장값은 DIAG-03-1이 돌려주고, 화면은 그 값으로 POST를 불러 비율·위험 단계를 구한다.
- 상환 부담률(N-16-1)과 DSR(N-20-4)은 백엔드 `FinancialHealthCalculator.calculateRepaymentBurdenRatio()` **함수 하나를 함께 쓴다**.
- 비율은 `금액 ÷ 기준 × 100`이다. BigDecimal로 계산해 소수 둘째 자리에서 반올림(HALF_UP)한다.
- 오류: 금액이 음수이면 `400 INVALID_INPUT`이고 `fieldErrors[0].field`에 그 필드 이름(예: `totalAsset`)이 담긴다. DSR API는 연소득이 0이어도 `400`이다(`field`: `annualIncome`).

### 위험 단계 기준 (기준 **이상**이면 그 단계, 설정 상수)

| 비율 | 계산 | 주의 `CAUTION` | 위험 `DANGER` |
|---|---|---|---|
| 상환 부담률(DSR) | 연간 원리금 ÷ 연소득 | 30% 이상 | 40% 이상 |
| 자산 대비 부채 | 총부채 ÷ 총자산 | 40% 이상 | 60% 이상 |
| 순자산 대비 부채 | 총부채 ÷ 순자산 | 70% 이상 | 100% 이상 |

그 밖에는 `SAFE`다. **나누는 값(연소득·총자산·순자산)이 0 이하이면 비율과 단계가 `null`(계산 불가)**이다.

### POST `/api/diagnosis/dsr/calculate`

요청:

```json
{ "annualIncome": 30000000, "annualDebtService": 12000000 }
```

응답 `200` (기존 프론트 mock과 같은 필드):

| 필드 | 형식 | 설명 |
|---|---|---|
| `annualIncome`, `annualDebtService` | 정수 | 받은 값 그대로 |
| `dsrRatio` | 소수 | DSR(%) |
| `riskLevel` | 문자열 | `SAFE` / `CAUTION` / `DANGER` |
| `riskBadgeText` | 문자열 | `안전` / `주의` / `위험` |
| `description` | 문자열 | 단계 안내 문구 |

```json
{ "annualIncome": 30000000, "annualDebtService": 12000000, "dsrRatio": 40.0, "riskLevel": "DANGER", "riskBadgeText": "위험", "description": "상환 부담률이 40% 이상이라 연체 위험이 높은 위험 단계입니다." }
```

### POST `/api/diagnosis/financial-health/calculate`

요청:

| 필드 | 형식 | 설명 |
|---|---|---|
| `totalAsset` | 정수 | 총자산 |
| `annualIncome` | 정수 | 연소득(급여소득자 월급 × 12, 그 밖에는 월별 합, N-20-3) |
| `totalDebt` | 정수 | 총부채 = 대출 잔액 합계 |
| `annualDebtService` | 정수 | 연간 원리금 상환액 |

응답 `200`:

| 필드 | 형식 | 설명 |
|---|---|---|
| `totalAsset`, `totalDebt` | 정수 | 받은 값 |
| `netAsset` | 정수 | 순자산 = 총자산 − 총부채(음수 가능) |
| `repaymentBurdenRatio`, `repaymentBurdenLevel` | 소수 또는 `null`, 문자열 또는 `null` | 상환 부담률과 단계 |
| `debtToAssetRatio`, `debtToAssetLevel` | 위와 같음 | 자산 대비 부채와 단계 |
| `debtToNetAssetRatio`, `debtToNetAssetLevel` | 위와 같음 | 순자산 대비 부채와 단계 |

예시 (총자산 1억, 연소득 4,000만, 총부채 5,000만, 연 원리금 1,400만):

```json
{
  "totalAsset": 100000000,
  "totalDebt": 50000000,
  "netAsset": 50000000,
  "repaymentBurdenRatio": 35.0,
  "repaymentBurdenLevel": "CAUTION",
  "debtToAssetRatio": 50.0,
  "debtToAssetLevel": "CAUTION",
  "debtToNetAssetRatio": 100.0,
  "debtToNetAssetLevel": "DANGER"
}
```

프론트: `features/diagnosis/api/diagnosisApi.js`의 `calculateDsr(payload)`, `calculateFinancialHealth(payload)`. mock도 백엔드와 같은 규칙으로 계산한다.

### GET `/api/members/me/financial-health` — DIAG-03-1 자산·부채 저장값 (FP-239) 🆕 11/20

로그인 회원의 **저장된 값**을 돌려준다. 비율·위험 단계는 계산하지 않는다(화면이 이 값으로 위 POST를 부른다). 같은 직군 평균(`peer`)은 넣지 않는다. 화면이 DIAG-01(`/peer-benchmark`)의 `sameWorkerType`을 붙인다(경환 님 11/20).

- 로그인한 일반 회원만(보안 설정: 토큰 없음 401, 관리자 403). 회원은 토큰에서 꺼내고 쿼리·본문은 없다.
- 기준월 = 그 회원의 가장 늦은 소득월(DIAG-07-1·08-1·N-17과 같음). 미입력은 0원으로 바꾸지 않고 `null`이다(O-15 A안, DIAG-01과 같은 규칙).

  | 필드 | 값 | 미입력이면 |
  |---|---|---|
  | `baseMonth` | 기준월 `"YYYY-MM"` | — |
  | `totalAssetAmount` | 기준월 `USER_ASSET_SNAPSHOT.TOTAL_ASSET_AMT` | `null`(자산 행 없음·NULL) |
  | `annualIncomeAmount` | N-20-3 공유 함수 `calculateAnnualIncome`로 기준월 포함 최근 12개월(달력)의 합. 급여소득자는 월급을 12개월로 펼치므로 월급 × 12 | `null`(자영업자·프리랜서가 12개 달을 다 채우지 않음. 일부 합으로 연소득을 낮게 보이지 않게 한다) |
  | `totalDebtAmount` | 기준월 대출이 있으면 `BALANCE_AMT` 합, 대출 행이 없고 `NO_LOAN_YN='Y'`(해당 없음)면 0 | `null`(둘 다 아님) |
  | `annualPaymentAmount` | 같은 규칙으로 `MONTHLY_PAYMENT_AMT` 합 × 12, 해당 없음은 0 | `null` |
  | `loans[]` | N-16-4 보유 대출(기준월, `LOAN_ID` 순): `loanId`, `loanTypeCode`, `loanTypeName`(`DIM_LOAN_TYPE`), `balanceAmount`, `annualRatePct`(연 %), `rateTypeCode`(`FIXED`·`VARIABLE`·`UNKNOWN`), `remainingMonths`, `monthlyPaymentAmount` | 빈 배열 |

  ```json
  { "baseMonth": "2026-08", "totalAssetAmount": 30000000, "annualIncomeAmount": 25193976,
    "totalDebtAmount": 15000000, "annualPaymentAmount": 4200000,
    "loans": [ { "loanId": 101, "loanTypeCode": "CREDIT", "loanTypeName": "신용대출", "balanceAmount": 12000000,
                 "annualRatePct": 5.0, "rateTypeCode": "VARIABLE", "remainingMonths": 36, "monthlyPaymentAmount": 200000 } ] }
  ```
- 오류: `404 NOT_FOUND` "저장된 소득 데이터가 없습니다."(다른 저장값 API와 같음). 401·403은 위와 같다.
- 프론트: `diagnosisApi.js`의 `getMemberFinancialHealth()`. mock은 예시값이다(총자산·대출은 N-17 시나리오 기준값 예시와 같다).

---

## 공통 재계산 틀 (N-17-3 · N-18-4 · N-21-4, 백엔드 내부 함수)

API가 아니라 백엔드 기능들이 함께 쓰는 함수다. `finance/util/RecalculationFrame.apply(현재 값 Map, 바꿀 값 목록)`.

| 변경 방식 | 뜻 | 예 |
|---|---|---|
| `SET` | 값으로 바꾼다 | 통신비 정시 납부 기간 → 24 (N-18 슬라이더) |
| `PERCENT` | 비율로 바꾼다 | 소득 −20 → 현재 × 0.8 (N-17, N-21) |
| `ADD` | 더한다 | 금리 +1 (%p) (N-17) |

- 원래 값은 바꾸지 않고 새 값을 돌려준다(N-18-10 되돌리기).
- 현재 값에 없는 항목 이름이면 오류를 낸다.

---

## N-18-7 같은 점수대 참고 금리·한도 (FP-170, 담당 광희)

| 메서드 | 경로 | 용도 | 데이터 출처 |
|---|---|---|---|
| GET | `/api/simulation/score-band-offer?score=` | 점수대의 참고 금리·한도와 등급 | DB `SCORE_BAND_OFFER`, `SCORE_GRADE_BAND`(ACTIVE 버전) |

- **상품 추천(N-18-7 상품 3종)은 이 API에 없다.** 🆕 11/23 금리·한도와 상품을 함께 주려던 SIM-03(`/api/simulation/loans/recommend`)은 만들지 않기로 했다(정의서 Q-9). 화면은 이 API(SIM-04)와 대출 상품 목록 LOAN-01(경환 FP-90)을 합쳐 보여 준다.
- 금리·한도는 **더미 데이터**다. 화면에는 "같은 점수대의 참고 정보"로만 보여 준다(`dummyNotice`가 항상 `true`).
- 오류:
  - `score`가 없거나 숫자가 아니거나 0~1000 밖이면 `400 INVALID_INPUT`(범위 밖이면 `fieldErrors`에 `score`)
  - 맞는 점수대·등급 자료가 없으면(시드 미적재 등) `404 NOT_FOUND`

응답 `200`:

| 필드 | 형식 | 설명 |
|---|---|---|
| `score` | 정수 | 조회한 점수 |
| `gradeBand` | 문자열 | `GOOD` / `STANDARD` / `CAUTION` |
| `cutoffVersion` | 문자열 | 등급 구간 버전(예: `CUT-0.1`) |
| `bandMinScore`, `bandMaxScore` | 정수 | 점수대 범위 |
| `expectedMinRate`, `expectedMaxRate` | 소수 | 참고 연 금리 범위(%) |
| `expectedAvgRate` | 소수 또는 `null` | 참고 평균 금리(%). 화면은 "연 a~b% (평균 c%)" |
| `expectedLimitAmount` | 정수 | 참고 한도(원) |
| `baseDate` | 문자열 | 자료 기준일 `"YYYY-MM-DD"` |
| `dummyNotice` | 불리언 | 더미 안내 표시(항상 `true`) |

예시 (`?score=720`, 더미 시드 기준):

```json
{
  "score": 720,
  "gradeBand": "STANDARD",
  "cutoffVersion": "CUT-0.1",
  "bandMinScore": 665,
  "bandMaxScore": 779,
  "expectedMinRate": 5.28,
  "expectedMaxRate": 19.64,
  "expectedAvgRate": 12.46,
  "expectedLimitAmount": 47000000,
  "baseDate": "2026-09-18",
  "dummyNotice": true
}
```

프론트: `features/simulation/api/simulationApi.js`의 `getScoreBandOfferInfo(score)`. mock은 시드와 같은 3개 점수대 값을 돌려준다.

## N-18-1·10 시뮬레이터 입력 10개의 내 실제 값 (SIM-01, FP-170, 담당 광희) 🆕 11/18

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/members/me/credit-care-base` 🆕 11/19 | 출발 평가의 점수와 입력 10개의 원래 값, 감점 요인 상위 3개. \[내 실제 값으로 되돌리기\](N-18-10)도 이 값을 쓴다 |

- 🆕 11/19 옛 경로 `/api/simulation/credit-care/base`는 지웠다(팀 공통 규칙: 내 데이터 = `/api/members/me/**`).

- **출발 평가**(SIM-01·02 공통, 범영 11/18): 점수가 나온(`GRADE_STATUS_CODE = 'SCORED'`) 가장 최근 평가다. 최신 평가가 산출 불가(예: FastAPI가 잠깐 꺼져 MODEL_ERROR)여도 그 앞의 SCORED 평가를 쓴다. SCORED 평가가 하나도 없을 때만 404 `ASSESSMENT_NOT_FOUND`(리포트와 같은 코드)다.
- 저장된 피처값(`FEATURE_SNAPSHOT`)은 개인 금융 정보라 **통째로 보내지 않는다**. 아래 10개 값만 보낸다.
  - 8개는 출발 평가의 피처값에서 가져온다. 키와 피처의 대응은 FastAPI `simulation.py` `DIRECT_CHANGES`와 같다.
  - `EASYPAY_MONTHLY_COUNT`는 `dp_payment_count_12m ÷ 12`를 반올림한 값이다(ML-04가 × 12 하므로 그 반대).
  - 피처값에는 카드 사용률만 있다. 그래서 `CARD_LIMIT_AMT`·`CARD_MONTHLY_SPEND_AMT`는 그 평가 기준월의 카드 직접 입력(`USER_CREDIT_PROFILE`, MANUAL)에서 읽는다.
  - 값이 없으면 `null`이다(0으로 바꾸지 않는다).
- 응답 `200`:

```json
{
  "baseRequestId": "00000000-0000-4000-8000-000000000588",
  "assessedAt": "2026-11-17T10:00:00+09:00",
  "score": 588,
  "gradeBandCode": "CAUTION",
  "values": {
    "TELECOM_ON_TIME_MONTHS": 6, "UTILITY_LATE_MONTHS": 2, "EASYPAY_MONTHLY_COUNT": 5, "DELINQ_COUNT_12M": 1,
    "CASH_ADVANCE_MONTHS": 3, "NEW_LOAN_COUNT_3M": 1, "LOAN_BALANCE_AMT": 30000000, "PRIVATE_LENDER_LOAN_BALANCE_AMT": 0,
    "CARD_LIMIT_AMT": 5000000, "CARD_MONTHLY_SPEND_AMT": 3000000
  },
  "topReductionFactors": [
    { "rank": 1, "featureCode": "CL0631905", "featureName": "카드 한도 사용률", "featureValue": 60.0, "shapScore": -12, "recoverScore": null }
  ]
}
```
- 🆕 11/19 `topReductionFactors`(N-18-8, 경환 님 요청): 첫 화면의 "내 점수를 가장 많이 깎은 요인 3가지" 카드용이다.
  - 출발 평가 때 저장한 요인(`ASSESSMENT_FACTOR`)에서 고른다. **모델을 다시 부르지 않는다.**
  - 모양은 SIM-02와 같다. 고르는 규칙도 ML-04와 같다: 감점(`shapScore < 0`)이면서 시뮬레이터로 바꿀 수 있는(`DIM_FEATURE.SIMULATABLE_YN = 'Y'`) 항목을 감점이 큰 순서로(같으면 이름 순) 최대 3개 고른다.
  - `shapScore`는 저장값 그대로다(음수 = 감점, SIM-02와 같은 부호).
  - `recoverScore`는 저장돼 있지 않아 `null`이다. `featureValue`는 숫자로 바꿀 수 없으면 `null`, `featureName`이 비면 `featureCode`를 넣는다.
  - 감점 요인이 없으면 `[]`다.
- 오류: 401 `UNAUTHORIZED`(토큰 없음), 403 `FORBIDDEN`(관리자 계정) 🆕 11/19, 404 `ASSESSMENT_NOT_FOUND`
- 프론트: `simulationApi.js`의 `getCreditCareBase()`. mock은 SIM-02 mock의 출발 값과 같은 숫자를 돌려주고, 감점 요인도 SIM-02 mock과 같은 규칙으로 출발 값에서 고른다.

## N-18-5·8 시뮬레이터 점수 재계산 (SIM-02, 담당 광희) — FP-170 Spring 구현

> 🆕 11/18 Spring이 B조 ML-04(`POST /v1/assessments/simulate`, [B팀 명세서](api_spec_b.md) 4-4)를 불러 이 모양으로 바꿔 돌려준다. 출발 평가는 위 SIM-01과 같다(최근 SCORED). ML-04에는 그 평가의 requestId·**저장된** MODEL_VERSION·FEATURE_SET_VERSION·피처값을 보내고, 요청 requestId는 매번 새 UUID다. 시간 제한은 ML-03과 같다(연결 1초·응답 3초).

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/members/me/credit-care-recalculate` 🆕 11/19 | 로그인 회원의 최근 평가에서 출발해 바꾼 값으로 점수를 다시 구한다(저장 안 함) |

- 🆕 11/19 옛 경로 `/api/simulation/credit-care/recalculate`는 지웠다.

요청: 회원·출발 평가는 Spring이 로그인 정보로 찾는다. 화면은 바꾼 값만 보낸다.
```json
{ "changes": { "TELECOM_ON_TIME_MONTHS": 12, "CARD_LIMIT_AMT": 5000000, "CARD_MONTHLY_SPEND_AMT": 1000000 } }
```
- 키 10개(ML-04와 같음): `TELECOM_ON_TIME_MONTHS`, `DELINQ_COUNT_12M`, `CASH_ADVANCE_MONTHS`, `NEW_LOAN_COUNT_3M`, `LOAN_BALANCE_AMT`, `PRIVATE_LENDER_LOAN_BALANCE_AMT`, `UTILITY_LATE_MONTHS`(11/17 확정, 피처 정의서 C21), `EASYPAY_MONTHLY_COUNT`, `CARD_LIMIT_AMT`, `CARD_MONTHLY_SPEND_AMT`
- `EASYPAY_MONTHLY_COUNT`는 **월 횟수 그대로** 보낸다. 12개월 값 변환(× 12)은 FastAPI ML-04가 한다(`simulation.py`).
- 값이 `null`이면 키를 뺀 것과 같다(바꾸지 않음). 단 카드 한도·월 사용액은 한쪽만 값이 있고 다른 쪽이 `null`·없음이면 400이다.
- 카드 한도·월 사용액은 함께 보낸다. 한도가 0이면 오류가 아니라 카드 사용률을 결측으로 계산한다.

입력 범위 (B조 11/17: FastAPI ML-04는 범위를 검사하지 않고 소수는 정수로 잘라 계산하므로, **Spring이 먼저 막는다**):

| 키 | 허용 값 | 근거 |
|---|---|---|
| `TELECOM_ON_TIME_MONTHS` | 0~12 정수 | 11/20 확정(범영·광희) 🆕 11/25 |
| `UTILITY_LATE_MONTHS` | 0~12 정수 | 확정(정의서 8-2, 학습 데이터 기준) |
| ~~나머지 8개 (연체·현금서비스·신규 대출·간편결제 월 건수·대출 잔액·대부업 잔액·카드 한도·월 카드 사용액)~~ | ~~0 이상 정수~~ | ~~상한은 UI 슬라이더 범위가 정해지면 추가(TODO)~~ 🆕 11/25 아래 기준 적용 |
| `DELINQ_COUNT_12M` | 0~6 정수 | 화면 SLIDER_FIELDS·학습 데이터 기준 🆕 11/25 |
| `CASH_ADVANCE_MONTHS` | 0~10 정수 | 화면 SLIDER_FIELDS·학습 데이터 기준 🆕 11/25 |
| `NEW_LOAN_COUNT_3M` | 0~4 정수 | 화면 SLIDER_FIELDS·학습 데이터 기준 🆕 11/25 |
| `EASYPAY_MONTHLY_COUNT` | 0~60 정수 | 화면 SLIDER_FIELDS·학습 데이터 기준 🆕 11/25 |
| `LOAN_BALANCE_AMT`·`PRIVATE_LENDER_LOAN_BALANCE_AMT`·`CARD_LIMIT_AMT`·`CARD_MONTHLY_SPEND_AMT` | 0 이상 정수 | 금액은 상한 없음 🆕 11/25 |

- 범위가 정해지면 FastAPI에도 422 검사를 넣을지 B조와 함께 정한다.

응답 200: ML-04 응답에서 `requestId`·`shap`을 빼고, 감점 요인에 `featureName`(DIM_FEATURE)을 더한다.
```json
{
  "modelVersion": "DEV-DUMMY",
  "cutoffVersion": "CUT-0.1",
  "before": { "score": 588, "gradeBandCode": "CAUTION", "defaultProb": 0.21 },
  "after":  { "score": 618, "gradeBandCode": "CAUTION", "defaultProb": 0.21 },
  "delta":  { "total": 30, "financialEffect": 16, "alternativeEffect": 14 },
  "topReductionFactors": [
    { "rank": 1, "featureCode": "CL0631905", "featureName": "카드 한도 사용률", "featureValue": 60.0, "shapScore": -12, "recoverScore": 12 }
  ]
}
```
- `delta.total = financialEffect + alternativeEffect` (N-18-5 "금융 이력 영향"과 "대안 데이터 영향").
- `defaultProb`는 그대로 내려준다. 화면 표시 여부는 N-18-6 미정(D2)이다.

오류 400 `INVALID_INPUT` (`fieldErrors[].field`는 `changes.<키>`):
- 모르는 키 → "모르는 항목입니다."
- 음수·소수·숫자가 아닌 값 → "0 이상의 정수를 입력해 주세요."
- 상한 초과 → ~~"0~12 사이로 입력해 주세요."~~ 해당 키의 상한 N을 써서 "0~N 사이로 입력해 주세요." 🆕 11/25
- 카드 한쪽만 → `changes.CARD_LIMIT_AMT` "카드 한도와 월 카드 사용액은 함께 보내야 합니다."
- ML-04가 422를 주면 Spring이 같은 공통 형식(400)으로 바꾼다.

그 밖의 오류: 401 `UNAUTHORIZED`(토큰 없음), 403 `FORBIDDEN`(관리자 계정) 🆕 11/19, 404 `ASSESSMENT_NOT_FOUND`(점수가 나온 평가가 없음).

ML-04의 그 밖의 오류를 화면에 전달하는 규칙(FP-170 구현). 시뮬레이터는 결과를 저장하지 않으므로 NOT_SCORABLE로 저장하지 않고 오류를 그대로 알린다.

| ML-04 응답 | Spring → 화면 | 문구 |
|---|---|---|
| 422 `INVALID_INPUT` | 400 `INVALID_INPUT` + `fieldErrors` | 입력값을 확인해 주세요. |
| 503 `MODEL_NOT_READY` (실제 모델 파일 없음) | 503 `MODEL_NOT_READY` | 점수 계산 서버가 준비 중입니다. 잠시 후 다시 시도해 주세요. |
| 409 `VERSION_MISMATCH` (모르는 모델 버전) | 409 `VERSION_MISMATCH` | 저장된 평가의 모델이 바뀌었습니다. 점수를 다시 산출한 뒤 이용해 주세요. |
| 연결 실패·그 밖의 5xx | 503 `MODEL_NOT_READY` | 점수 계산 서버가 준비 중입니다. 잠시 후 다시 시도해 주세요. |

프론트: `features/simulation/api/simulationApi.js`의 `recalculateCreditCare({ changes })`. mock은 588점 예시에서 간단한 규칙으로 계산한다(진짜 모델 아님).

- Spring 검사(11/18 구현): JSON 정수만 받는다. `12.0`처럼 소수점이 있는 값과 문자열(`"2"`)은 "0 이상의 정수를 입력해 주세요."로 막는다.

## N-26-1~4 관리자 직군·연령별 통계 (ADM-03, FP-161, 담당 광희) 🆕 11/20

관리자 "직군·연령별 통계" 화면(FP-162)에 쓴다. **D-26·D-28 담당자 결정(11/20, 광희)**:
- 항목은 11/06 확정 UI대로 만든다: 요약, 대안 등급 분포, 직군별·연령대별 통계 표. 기능 명세 v3의 상자 그림·직군×연령 히트맵·통신비 연체 경험은 UI에 없어 만들지 않는다.
- 데이터는 **서비스 회원의 최근 SCORED 평가 1건**이다(`ASSESSMENT`, `DATASET_CODE='SERVICE'`). 명세의 합성 고객 12,000명은 `ASSESSMENT`에 적재되지 않았고, 평가 표본(`MODEL_EVAL_SAMPLE`)에는 연령대가 없어 쓰지 않는다.
- **탈퇴 회원(`WITHDRAWN`)의 평가는 뺀다.** 잠긴 회원(`LOCKED`)은 넣는다. DIAG-01 회원 평균·관리자 계정 목록과 같은 기준이다.

### GET `/api/admin/stats?groupBy=WORKER_TYPE|AGE_BAND`

- 관리자만(보안 설정: `/api/admin/**` = `ROLE_ADMIN`). 일반 회원 `403 FORBIDDEN`, 토큰 없음 `401`, 비밀번호 변경이 필요한 관리자 `403 PASSWORD_CHANGE_REQUIRED`.
- `groupBy`: `WORKER_TYPE`(직군별, 생략하면 이것)·`AGE_BAND`(연령대별). 그 밖의 값은 `400 INVALID_INPUT`(`fieldErrors[0].field` = `groupBy`).
- 대상 = 회원마다 **지금 ACTIVE 모델로 낸** 가장 최근 SCORED 서비스 평가 1건(`ASSESSED_AT`이 같으면 `ASSESSMENT_ID`가 큰 것). 직군·연령대는 **평가 시점 값**이다.
  - 🆕 11/23 **ACTIVE가 아닌 모델로 낸 평가는 세지 않는다**(리뷰 반영). 지금 ACTIVE가 `LGBM-BASE-0.2`이면 옛 모델(0.1)·Mock(`DEV-DUMMY`) 평가가 빠진다. 모델이 섞이면 기존 → 대안 비교가 모델 차이인지 알 수 없기 때문이다. Mock을 늘 빼는 것은 아니다: ACTIVE가 `DEV-DUMMY`이면(DDL 기본값, `rollback_model_to_dev_dummy.sql`로 되돌린 경우) Mock 평가만 집계되고 `modelVersion`이 `DEV-DUMMY`다. 조건은 회원별 최근 평가를 고르기 **전에** 건다. 그래서 옛 모델 평가만 있는 회원은 빠지고, 모델을 바꾼 직후에는 새 모델로 다시 점수를 낸 회원만 잡힌다.
  - ACTIVE 모델이 없으면 평가 인원 0명, `modelVersion` `null`이다.
- 점수 평균·비율은 소수 첫째 자리(HALF_UP). **값마다 실제로 계산에 들어간 인원이 5명(`minGroupSize`)보다 적으면 그 값은 `null`**이다(몇 명뿐이면 개인 점수가 드러난다, DIAG-01과 같은 기준). 🆕 11/23 그룹이 5명 이상이어도 기존 모델 산출자가 5명 미만이면 기존 평균·상승폭·기존 등급 값만 숨기고 대안 값은 보인다(리뷰 반영). 인원 수는 보인다.
  - 대안 평균·대안 등급 값 → `memberCount`명(SCORED면 대안 점수가 늘 있다)
  - 기존 평균·기존 등급 값·상승폭 → `tradScoredMemberCount`명(기존 모델로 산출된 회원, 상승폭은 두 점수가 다 있어야 해서 같은 인원)
- 응답 `200`:

  | 필드 | 형식 | 설명 |
  |---|---|---|
  | `groupBy`, `minGroupSize` | 문자열, 정수 | 요청한 구분, 숨김 기준(5) |
  | `summary.assessedMemberCount` | 정수 | 평가 고객 수(최근 SCORED 평가가 있는 회원, 탈퇴 제외) |
  | `summary.avgTradScore`·`avgAltScore` | 소수 또는 `null` | 평균 기존·대안 점수. 기존은 기존 모델로 산출된 회원만 |
  | `summary.avgScoreUplift` | 소수 또는 `null` | 상승폭 = 두 점수가 다 있는 회원의 (대안 − 기존) 평균 |
  | `summary.standardOrAboveRatePct` | 소수 또는 `null` | Standard 이상 비율(%) = 대안 등급 STANDARD·GOOD ÷ 대상 |
  | `summary.registeredMemberCount` | 정수 | 가입 회원 수(일반 회원, 탈퇴 제외, 관리자 계정은 세지 않음) |
  | `summary.todayScoredCount` | 정수 | 오늘 산출: 오늘 0시(서버 시간 Asia/Seoul) 이후 ACTIVE 모델로 저장된 서비스 SCORED 평가 수(탈퇴 제외). 관리자 전용 수치 |
  | `modelVersion` 🆕 11/23 | 문자열 또는 `null` | 통계 기준 모델(ACTIVE, 예: `LGBM-BASE-0.2`). 화면이 "모델 0.2 기준"처럼 안내하는 데 쓴다 |
  | `gradeDistribution` | 배열 또는 `null` | 전체 대안 등급 분포 `[{ gradeBandCode, count, ratePct }]`, CAUTION·STANDARD·GOOD 순서(0명도 있음) |
  | `summary.tradStandardOrAboveRatePct` 🆕 11/23 | 소수 또는 `null` | **기존 모델** Standard 이상 비율(%) = 기존 등급 STANDARD·GOOD ÷ **기존 등급이 있는 회원**(기존 모델로 산출된 회원만. 산출 못 한 회원은 기존 쪽 분모에서만 빠진다) |
  | `tradGradeDistribution` 🆕 11/23 | 배열 또는 `null` | 전체 **기존** 등급 분포. 모양은 `gradeDistribution`과 같고 비율의 분모는 기존 등급이 있는 회원 수 |
  | `groups[]` | 배열 | 직군 3개(`EMPLOYEE`·`SELF_EMPLOYED`·`FREELANCER`) 또는 연령대 4개(`20S`·`30S`·`40S`·`50_PLUS`)를 고정 순서로(0명도 있음). 각각 `groupCode`, `memberCount`, `avgTradScore`, `avgAltScore`, `avgScoreUplift`, `standardOrAboveRatePct`, `gradeDistribution`, 🆕 11/23 `tradStandardOrAboveRatePct`, `tradGradeDistribution`, `tradScoredMemberCount` |
  | `summary.tradScoredMemberCount`·`groups[].tradScoredMemberCount` 🆕 11/23 | 정수 | 기존 모델로 산출된 회원 수. 기존 값이 `null`일 때 "기존 모델 산출자가 부족함"을 화면이 안내하는 데 쓴다 |

- 🆕 11/23 등급 값은 11/06 UI처럼 **기존 → 대안**을 나란히 보여 주도록 두 벌이다: `standardOrAboveRatePct`·`gradeDistribution` = 대안 모델(처음부터 있던 필드, 이름·뜻 그대로), `trad*` = 기존 모델. 모든 값은 DB에 저장된 평가의 점수·등급(`ASSESSMENT.TRAD_*`·`ALT_*`)으로 계산한다.

  ```json
  { "groupBy": "WORKER_TYPE", "minGroupSize": 5, "modelVersion": "LGBM-BASE-0.2",
    "summary": { "assessedMemberCount": 14, "avgTradScore": 636.9, "avgAltScore": 705.4, "avgScoreUplift": 68.8,
                 "standardOrAboveRatePct": 71.4, "registeredMemberCount": 40, "todayScoredCount": 3, "tradStandardOrAboveRatePct": 30.8, "tradScoredMemberCount": 13 },
    "gradeDistribution": [ { "gradeBandCode": "CAUTION", "count": 4, "ratePct": 28.6 }, { "gradeBandCode": "STANDARD", "count": 8, "ratePct": 57.1 },
                           { "gradeBandCode": "GOOD", "count": 2, "ratePct": 14.3 } ],
    "tradGradeDistribution": [ { "gradeBandCode": "CAUTION", "count": 9, "ratePct": 69.2 }, { "gradeBandCode": "STANDARD", "count": 4, "ratePct": 30.8 },
                               { "gradeBandCode": "GOOD", "count": 0, "ratePct": 0.0 } ],
    "groups": [ { "groupCode": "EMPLOYEE", "memberCount": 6, "avgTradScore": 663.3, "avgAltScore": 720.0, "avgScoreUplift": 56.7,
                  "standardOrAboveRatePct": 83.3, "gradeDistribution": [ … ], "tradStandardOrAboveRatePct": 50.0, "tradGradeDistribution": [ … ], "tradScoredMemberCount": 6 },
                { "groupCode": "FREELANCER", "memberCount": 3, "avgTradScore": null, "avgAltScore": null, "avgScoreUplift": null,
                  "standardOrAboveRatePct": null, "gradeDistribution": null, "tradStandardOrAboveRatePct": null, "tradGradeDistribution": null, "tradScoredMemberCount": 2 } ] }
  ```
  (예시 14명 중 1명은 기존 모델로 산출되지 않아 기존 쪽 분모는 13명이다)
  (mock 예시값. `SELF_EMPLOYED` 행은 줄였다)
- 알려진 한계: 등급은 평가 때 저장된 값을 그대로 쓰고 다시 매기지 않는다. 🆕 11/23 등급 구간 버전(`ASSESSMENT.CUTOFF_VERSION`)은 모델 버전과 따로 저장되므로, **같은 ACTIVE 모델 평가라도 등급 구간 버전이 다를 수 있다**(예: 등급 구간을 CUT-0.2로 바꾼 앞뒤의 평가). 통계는 등급 구간 버전을 거르지 않으므로 이때 등급 분포에 두 기준이 섞인다(리뷰 반영). 시연 DB에서 ACTIVE 모델로 점수를 낸 회원이 적으면 대부분의 값이 5명 미만으로 비어 보인다.
- 프론트: `features/admin/api/adminStatsApi.js`의 `getAdminStats({ groupBy })`. mock은 예시 회원 14명으로 같은 규칙대로 계산한다.
- 화면: 🆕 11/23 `features/admin/pages/AdminStatsPage.jsx`(FP-162, `/admin/stats`). 숨긴 값(`null`)은 '—'로, 기존 분포만 숨겨지면 대안 분포만 글자로 보여 준다.

## N-26-5~7 사용자 비교 분석 (ADM-04, FP-164, 담당 광희) 🆕 11/23

주 메뉴 '비교 분석'(`/comparison`)에서 일반 회원이 직군 × 연령 격자(N-26-6)와 직군별·연령별 비교(N-26-7)를 본다. 11/23 동주·광희 합의로 나눠 만든다: 동주가 N-13 내 위치 API·`/comparison` 화면 틀·카드 3개, 광희가 이 API와 그 아래 격자·비교 화면(동주 PR 병합 뒤).
- **집계 기준은 ADM-03과 같다**(같은 매퍼·같은 계산 코드 `AdminStatsService.groupStats`): 회원마다 ACTIVE 모델로 낸 최근 SCORED 서비스 평가 1건, 탈퇴 회원 제외(D-28), 값마다 계산 인원이 5명 미만이면 `null`, 등급은 평가 때 저장된 값.
- 관리자 전용 수치(가입 회원 수·오늘 산출)는 넣지 않는다(N-26-5).

### GET `/api/members/me/group-comparison`

- 일반 회원만(보안 설정: `/api/members/me/**` = `ROLE_USER`). 관리자 `403`, 토큰 없음 `401`. 내 위치가 들어 있어 Q-8 규칙대로 `/api/members/me/` 아래에 둔다(DIAG-01 `peer-benchmark`와 같음). 쿼리 값은 없다.
- 한 번 호출로 화면의 보기 전환(직군 × 연령, 직군별, 연령별)에 필요한 값을 모두 준다(집단 20개라 응답이 작다).
- 응답 `200`:

  | 필드 | 형식 | 설명 |
  |---|---|---|
  | `modelVersion`, `minGroupSize` | 문자열 또는 `null`, 정수 | 통계 기준 모델(ACTIVE, 없으면 `null`), 숨김 기준(5) |
  | `me` | 객체 또는 `null` | 통계에 들어간 **내 평가**: `workerTypeCode`, `ageBandCode`(평가 시점 값이라 격자의 내 칸과 같다), `tradScore`, `altScore`, `tradGradeBandCode`, `altGradeBandCode`. 본인 값이라 숨기지 않는다. 기존 모델로 산출할 수 없었으면 `trad*`가 `null`. ACTIVE 모델로 점수가 나온 평가가 없으면 `me` 자체가 `null` |
  | `overall` | 집단 | 전체(`groupCode` = `ALL`). N-26-7 요약표의 전체 행, N-26-6 "전체 평균 대비" |
  | `byWorkerType[]` | 집단 3개 | `EMPLOYEE`·`SELF_EMPLOYED`·`FREELANCER` 고정 순서. 격자의 행 평균, N-26-7 직군별 |
  | `byAgeBand[]` | 집단 4개 | `20S`·`30S`·`40S`·`50_PLUS` 고정 순서. 격자의 열 평균, N-26-7 연령별 |
  | `grid[]` | 12칸 | `{ workerTypeCode, ageBandCode, stats: 집단 }`, 직군 순서 → 연령대 순서(0명 칸도 있음). `stats.groupCode`는 `직군:연령대`(예: `EMPLOYEE:30S`) |

  **집단** = ADM-03 `groups[]` 한 줄과 같은 모양: `groupCode`, `memberCount`, `avgTradScore`, `avgAltScore`, `avgScoreUplift`, `standardOrAboveRatePct`, `gradeDistribution`, `tradStandardOrAboveRatePct`, `tradGradeDistribution`, `tradScoredMemberCount`(뜻·숨김 규칙은 위 ADM-03 절).

  ```json
  { "modelVersion": "LGBM-BASE-0.2", "minGroupSize": 5,
    "me": { "workerTypeCode": "EMPLOYEE", "ageBandCode": "30S", "tradScore": 640, "altScore": 700,
            "tradGradeBandCode": "CAUTION", "altGradeBandCode": "STANDARD" },
    "overall": { "groupCode": "ALL", "memberCount": 14, "avgTradScore": 636.9, "avgAltScore": 705.4, "avgScoreUplift": 68.8, … },
    "byWorkerType": [ { "groupCode": "EMPLOYEE", "memberCount": 6, "avgAltScore": 720.0, … }, … ],
    "byAgeBand": [ { "groupCode": "20S", "memberCount": 3, "avgAltScore": null, … }, … ],
    "grid": [ { "workerTypeCode": "EMPLOYEE", "ageBandCode": "20S", "stats": { "groupCode": "EMPLOYEE:20S", "memberCount": 1, "avgAltScore": null, … } }, … ] }
  ```
  (mock 예시값, 줄였다)
- 화면이 계산할 것: 칸을 고른 뒤 "전체·직군·연령 평균 대비"는 `overall`·`byWorkerType`·`byAgeBand`의 같은 필드와 빼서 보여 준다. 내 칸은 `me.workerTypeCode`·`me.ageBandCode`로 찾는다.
- 알려진 한계
  - ADM-03과 같다: 등급 구간 버전을 거르지 않아 CUT-0.3 전환(#137) 전후 평가의 등급이 섞일 수 있다. 시연 DB는 평가 회원이 적어 격자 칸 대부분이 5명 미만('—')으로 보인다.
  - **빼기로 숨긴 값을 알아낼 수 있다.** 5명 기준은 값마다 따로 걸기 때문에, 행(직군) 평균은 보이고 그 행의 칸 하나만 숨겨졌으면 `행 합계 − 보이는 칸 합계`로 숨긴 칸(예: 1명)의 점수를 계산할 수 있다(인원 수는 보인다). 관리자 통계보다 보는 사람이 많아 문제가 커진다. 막으려면 2차 숨김(숨긴 칸이 하나뿐인 행·열은 다른 칸이나 평균도 숨김)이 필요하다. 지금은 기준을 ADM-03과 같게 두고 팀 결정을 기다린다.
- 프론트: `features/comparison/api/groupComparisonApi.js`의 `getGroupComparison()`. mock은 관리자 통계 mock의 예시 회원 14명·계산을 그대로 쓴다(데모 계정 `employee`만 `me`가 있다, 관리자 403).
- 화면: 🆕 11/23 `features/comparison/components/GroupCompareSection.jsx`(동주 님 `ComparisonPage`의 내 위치 카드 아래). 보기 전환(직군 × 연령 / 직군별 / 연령대별) 세 가지 모두 11/06 UI처럼 왼쪽은 공통 `HeatmapGrid` 색 칸(숨긴 값 '—', 11/23 동주 님 동의로 null 처리 추가)과 "칸에 표시할 값"(대안 점수·상승폭·보통 이상), 오른쪽은 선택한 집단 패널. 직군별·연령대별은 집단마다 기존 → 대안 두 칸(명세의 점 그래프 대신)이고 아래에 요약표(전체 행 포함).

---

## N-25 모형 성능 비교 (ADM-01·02, FP-184, 담당 동주) 🆕 11/20

> 관리자 「모형 성능 비교」 화면(FP-185)이 쓴다. **합성 학습 데이터로 낸 평가 결과**라 실제 신용평가·심사 결과가 아니며, 대안 모형이 나쁜 지표도 걸러 내지 않고 그대로 돌려준다.
> 평가 표본은 서비스 회원이 아니라 합성 학습 고객(`CUSTOMER_REF` SYN…·THF…)이라 회원 신용정보 열람 감사 로그(N-35) 대상이 아니다.

| 메서드 | 경로 | 설명 | 원천 |
|---|---|---|---|
| GET | `/api/admin/model-performance?group=&label=&cutoff=` | ADM-01 · N-25-1·2·4 컷오프 기준 지표 6개, 직군별 우량 고객 오거절률 | DB `MODEL_EVAL_SAMPLE`, `MODEL_ARTIFACT.METRICS_JSON` |
| GET | `/api/admin/model-performance/roc?group=&label=` | ADM-02 · N-25-3 ROC 곡선 점 | DB `MODEL_EVAL_SAMPLE` |

- 권한: `/api/admin/**`라 관리자(`ROLE_ADMIN`)만 부른다. 토큰 없음 401, 일반 회원 403(공통 보안 설정).
- **비교할 모델 = `MODEL_REGISTRY`의 ACTIVE 모델**(B팀 명세서 ML-03 "DB의 ACTIVE가 스위치"). 그 버전의 `MODEL_EVAL_SAMPLE` 행 중 TRAIN·VALID만 쓴다(TEST는 최종 평가 FP-144용이라 섞지 않는다).
- 프론트: `features/admin/api/modelPerformanceApi.js`의 `fetchModelPerformance({ group, label, cutoff })`, `fetchModelRoc({ group, label })`. mock은 같은 모양의 시연용 예시다.

### 쿼리 값

| 이름 | 값 | 생략하면 | 설명 |
|---|---|---|---|
| `group` | `LEGACY` \| `THINFILE` | `LEGACY` | 고객 집단(`MODEL_EVAL_SAMPLE.GROUP_CODE` 그대로). 두 집단은 정답 라벨 생성 방식이 달라 합치지 않는다('전체' 없음, 11/19 결정) |
| `label` | `DELINQ` \| `NONFIN` | `DELINQ` | 비교 라벨. 기존·대안 모두 **같은 라벨로 학습한 점수**끼리 비교한다(피처 정의서 C20). DELINQ = `SCORE_LEGACY_DELINQ`·`SCORE_ALT_DELINQ` + `LABEL_ANY_DELINQUENCY_12M`, NONFIN = `SCORE_LEGACY_NONFIN`·`SCORE_ALT_NONFIN` + `LABEL_NONFIN_EFFECT_12M` |
| `cutoff` | 정수 600~800 | 700 | 승인 기준 점수(ADM-01만). 화면 슬라이더는 10점 간격 |

### GET `/api/admin/model-performance` (ADM-01)

계산 규칙: 점수 ≥ `cutoff`면 승인, 미만이면 거절(부도로 예측). 라벨 1이 불량, 0이 우량이다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `group`·`label`·`cutoff` | 문자열·문자열·정수 | 요청 값(생략했으면 기본값) |
| `sampleBasis` | 문자열 | `VALID`(검증 표본만) \| `TRAIN_VALID`(TRAIN이 섞임. 씬파일은 이 모델이 학습하지 않은 집단이라 TRAIN도 평가에 쓴다) |
| `sampleCount`·`badCount` | 정수 | 표본 인원, 그중 불량 인원 |
| `aucBasis` | 문자열 | `SEED_MEAN_5`(METRICS_JSON 같은 라벨 비교 5개 시드 평균) \| `SINGLE_SEED`(이 표본으로 계산, 시드 1개). LEGACY는 평균 값이 있으면 `SEED_MEAN_5`, THINFILE은 항상 `SINGLE_SEED` |
| `legacy`·`alternative` | 객체 | 기존·대안 모형 지표(아래) |
| `byJob[]` | 배열 | 직군별(`DIM_WORKER_TYPE` 표시 순서) `{ jobType, sampleCount, badCount, legacyGoodRejectRate, alternativeGoodRejectRate }`. 직군별은 불량 수가 적어 값이 흔들리므로 화면에 인원을 함께 보여 준다 |

`legacy`·`alternative` 객체

| 필드 | 단위 | 계산 |
|---|---|---|
| `modelVersion` | 문자열 | ACTIVE 모델 버전(두 객체 같음) |
| `auc` | 0~1, 소수 넷째 자리 | ROC-AUC(확률). 위 `aucBasis` 참고. 직접 계산할 때는 불량·우량 한 명씩 골랐을 때 불량 쪽 점수가 더 낮을 확률(같으면 0.5) |
| `accuracy` | %, 소수 둘째 자리 | (우량 승인 + 불량 거절) / 전체 |
| `misclassCost` | 1인당 상대값, 소수 넷째 자리 | (우량 거절 + 불량 승인 × 5) / 전체 (부도 오승인 5배, decisions.md N-25) |
| `goodRejectRate` | % | 우량 거절 / 우량 |
| `badApproveRate` | % | 불량 승인 / 불량 |
| `approvalRate` | % | 승인 / 전체 |

분모가 0이면 0을 준다.

```json
{
  "group": "LEGACY", "label": "DELINQ", "cutoff": 700,
  "sampleBasis": "VALID", "sampleCount": 1800, "badCount": 174, "aucBasis": "SEED_MEAN_5",
  "legacy": { "modelVersion": "LGBM-BASE-0.2", "auc": 0.6047, "accuracy": 61.5, "misclassCost": 0.4321,
              "goodRejectRate": 30.25, "badApproveRate": 40.0, "approvalRate": 65.12 },
  "alternative": { "modelVersion": "LGBM-BASE-0.2", "auc": 0.6078, "...": "같은 필드" },
  "byJob": [ { "jobType": "EMPLOYEE", "sampleCount": 1411, "badCount": 130, "legacyGoodRejectRate": 31.5, "alternativeGoodRejectRate": 29.25 } ]
}
```
(건수·AUC 말고 지표 숫자는 모양 예시다. AUC는 ACTIVE 모델 `LGBM-BASE-0.2`의 연체 라벨 5개 시드 평균 🆕 11/20)

### GET `/api/admin/model-performance/roc` (ADM-02)

- 컷오프와 무관하고 `group`·`label`만 받는다.
- 기준 점수 t를 0, 10, …, 1010으로 올리며 "점수 < t면 거절"로 볼 때의 점을 준다(102개, (0,0)에서 (100,100)까지 순서대로).
  - `fpr` = 우량 거절률(%), `tpr` = 불량 거절률(%), 소수 둘째 자리.
- 곡선은 이 표본(시드 1개)으로 그린다. AUC 숫자는 주지 않는다. 화면 비교 표의 AUC(5개 시드 평균)와 섞이지 않게 하려는 것이다.

```json
{ "group": "THINFILE", "label": "NONFIN",
  "legacy": { "points": [ { "fpr": 0.0, "tpr": 0.0 }, "…", { "fpr": 100.0, "tpr": 100.0 } ] },
  "alternative": { "points": [ "…" ] } }
```

### 오류 (두 API 같음)

| 상태 | code | 언제 | 문구 |
|---|---|---|---|
| 400 | `INVALID_INPUT` | `group`·`label`이 허용값이 아님, `cutoff`가 600~800 밖. 틀린 칸마다 `fieldErrors[].field` = 쿼리 이름 | "고객 집단 값이 올바르지 않습니다." / "비교 라벨 값이 올바르지 않습니다." / "컷오프는 600~800점 사이로 넣어 주세요." |
| 400 | `INVALID_INPUT` | `cutoff`가 정수가 아님(공통 처리기) | field `cutoff` "형식이 올바르지 않습니다." |
| 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN` | 토큰 없음 / 관리자가 아님 | 공통 |
| 409 | `MODEL_EVAL_NOT_READY` 🆕 | ACTIVE 모델이 없거나, ACTIVE 모델 버전의 평가 표본이 아직 없음(예: 공용 DB가 아직 `DEV-DUMMY`, 적재 SQL 미실행). 409 = 지금 상태로는 처리할 수 없음(B팀 명세서 용어집) | "지금 사용 중인 모델(LGBM-BASE-0.2)의 평가 표본이 아직 준비되지 않았습니다." (괄호 안은 ACTIVE 버전) |

409가 나오면 ACTIVE 모델 버전에 맞는 평가 표본 SQL이 실행됐는지, `MODEL_REGISTRY`에서 그 버전이 ACTIVE인지 본다. 공용 DB는 그 SQL이 든 PR의 작성자가 병합 후 실행한다(sql README 「공용 DB 적용 규칙」, PR #124). 0.2 기준(🆕 11/20): `create_model_eval_sample.sql`(표가 없을 때) → `load_model_eval_sample_lgbm_base_0_2.sql` → `update_model_metrics_same_label_lgbm_base_0_2.sql`(LEGACY의 5개 시드 평균 AUC, 없으면 `aucBasis`가 `SINGLE_SEED`로 바뀜). 모델을 다시 학습하면 새 `MODEL_VERSION`으로 평가 표본도 다시 적재해야 화면이 나온다.

---

## N-30-1 금융 용어 사전 (HELP-01, FP-180, 담당 광희) 🆕 11/19

| 메서드 | 경로 | 설명 | 데이터 출처 |
|---|---|---|---|
| GET | `/api/glossary` | 용어 사전 전체(용어·쉬운 말·뜻 풀이). 툴팁(N-30-2, FP-157)과 챗봇(N-32)이 쓴다 | DB `GLOSSARY_TERM` |

- 인증: 로그인 필요(보안 설정 "그 밖의 `/api/**`"). 토큰이 없으면 `401 UNAUTHORIZED`다. 회원 데이터를 읽지 않으므로 관리자 계정도 부를 수 있다.
- 요청 값은 없다. 사전 전체를 **용어 이름 순서**(`ORDER BY TERM`)로 한 번에 돌려준다(수십 행).
- 사전이 비어 있어도 오류가 아니라 `{ "terms": [] }`다. 화면은 사전에 없는 말을 원래 말 그대로 보여 준다.
- 기준 데이터: [`docs/spec/sql/add_glossary_term.sql`](../sql/add_glossary_term.sql)(합성 교육용 문구 20개, 다시 실행해도 됨). dummy_db 생성기에는 들어 있지 않아 DDL·시드 다음에 따로 실행한다. 공용 DB는 PR 작성자가 병합 후 실행한다(sql README 「공용 DB 적용 규칙」).

응답 `200`:

| 필드 | 형식 | 설명 |
|---|---|---|
| `terms[]` | 배열 | 용어 목록 |
| `terms[].term` | 문자열 | 화면에 나오는 금융 용어(최대 50자) |
| `terms[].easyText` | 문자열 | 바꿔 보여 줄 쉬운 말(최대 200자) |
| `terms[].explanation` | 문자열 또는 `null` | 툴팁에 보일 뜻 풀이(최대 1000자) |

```json
{
  "terms": [
    { "term": "DSR", "easyText": "1년 소득 중 빚 갚는 데 쓰는 돈의 비율", "explanation": "총부채원리금상환비율의 줄임말입니다. …" },
    { "term": "원리금", "easyText": "갚아야 하는 원금과 이자를 합친 돈", "explanation": "빌린 돈(원금)과 그 돈을 빌린 대가(이자)를 합친 금액입니다. …" }
  ]
}
```

- `GLOSSARY_TERM.TERM_ID`는 화면이 쓰지 않아 보내지 않는다.
- SHAP 용어 풀이는 "점수에 어떻게 반영됐는지"만 설명하고 원인처럼 쓰지 않는다(AGENTS.md 5장).
- 프론트: `features/ai/api/glossaryApi.js`의 `getGlossary()`. mock은 시드 문구 5개를 같은 모양으로 돌려준다(로그인하지 않았으면 401).
