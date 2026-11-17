# API 명세

> 팀이 합의한 API 요청·응답 형식을 기능(N-ID)별로 적는다. 아래 양식은 FP-203을 처음 쓰면서 제안한 것이다. 바꿔도 된다.
>
> - 성공 응답은 본문을 감싸지 않고 그대로 보낸다. **오류 응답은 백엔드 공통 형식 `{ "code", "message", "fieldErrors": [{ "field", "message" }] }`이다**(`global/exception`, `backend/README.md`). decisions.md D-20은 아직 "미정"으로 적혀 있어 문서 담당 확인이 필요하다.
> - 오류 코드: 입력 오류 `400 INVALID_INPUT`(어느 칸인지 `fieldErrors`에 담는다), 자료 없음 `404 NOT_FOUND`.
> - 금액은 원 단위 정수, 비율은 % 단위 소수(소수 둘째 자리), 기준월은 `"YYYY-MM"` 문자열이다.
> - Java DTO의 `boolean isXxx` 필드는 JSON에서 **`is`가 빠진 `xxx`**로 나간다(Lombok·Jackson 규칙). 예: `isHighVolatility` → `highVolatility`.

---

## N-22 소득 변동성 진단 · N-21 현금흐름 전망 (FP-203, 담당 광희)

| 메서드 | 경로 | 용도 | 데이터 출처 |
|---|---|---|---|
| GET | `/api/diagnosis/income-volatility?userId=` | N-22 소득 변동성 진단 | DB(저장 데이터) |
| GET | `/api/diagnosis/cash-flow/forecast?userId=&…조건` | N-21 현금흐름 전망 | DB + 쿼리 조건 |
| POST | `/api/diagnosis/income-volatility` | N-22 계산만 (값을 본문으로 받음) | 요청 본문 |
| POST | `/api/diagnosis/cash-flow/forecast` | N-21 계산만 (값을 본문으로 받음) | 요청 본문 |

- **화면은 GET을 쓴다.** POST는 FP-183에서 만든 계산 전용 경로로, 지우지 않고 남겨 둔다.
- `userId`는 로그인(JWT)이 생기기 전까지 쓰는 **임시 쿼리**다. 로그인 연동 후에는 토큰에서 회원을 찾으며, 이 값은 없어진다(`TODO(로그인 연동)`).
- 오류:
  - 저장된 소득이 없으면 `404 NOT_FOUND`
  - `userId`가 없거나 숫자가 아니면 `400 INVALID_INPUT`
  - 본문은 위의 공통 오류 형식이다.

### 계산에 쓰는 저장 데이터

| 값 | 테이블 | 규칙 |
|---|---|---|
| 최근 12개월 소득 | `USER_INCOME_MONTH` | 최신 기준월부터 최대 12행. 급여소득자(`SALARY`)는 월급 1행을 마지막 기준월까지 12개월로 펼친다(연소득 = 월급 × 12와 같은 해석) |
| 월 고정지출 (N-22) | `USER_EXPENSE_ITEM` | 최신 기준월의 `EXPENSE_GROUP_CODE = 'FIXED'` 합계 |
| 월 지출 합계 (N-21) | `USER_EXPENSE_ITEM` | 최신 기준월의 모든 지출 그룹 합계 |
| 월 원리금 (N-21) | `USER_LOAN` | 최신 기준월의 `MONTHLY_PAYMENT_AMT` 합계. 대출이 없으면 0 |

### GET `/api/diagnosis/income-volatility`

요청: `?userId=2`

응답 `200`:

| 필드 | 형식 | 설명 | N-ID |
|---|---|---|---|
| `meanIncome` | 정수 | 12개월 평균 소득 | N-22-3 |
| `medianIncome` | 정수 | 12개월 중앙값(짝수 개면 가운데 두 값 평균) | N-22-3 |
| `incomeCv` | 소수 | 월 소득 변동계수(%) | N-22-3 |
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

### GET `/api/diagnosis/cash-flow/forecast`

요청 쿼리 (N-21-2 전망 조건):

| 쿼리 | 형식 | 필수 | 설명 |
|---|---|---|---|
| `userId` | 정수 | 예 | 임시 회원 번호 |
| `incomeChangePercent` | 소수 | 아니오 (기본 0) | 소득 변화율(%). 예: `-10`은 10% 감소 |
| `expenseChangePercent` | 소수 | 아니오 (기본 0) | 지출 변화율(%) |
| `loanPaymentChangePercent` | 소수 | 아니오 (기본 0) | 원리금 변화율(%) |
| `forecastMonths` | 정수 | 아니오 (기본 6) | 예측 기간. 화면은 3·6·12 중 고른다 |

계산 규칙:

- 기준 소득은 최근 12개월 평균이다. 여기에 변화율을 곱해 전망 기간 동안 매달 같은 값을 쓴다.
- 전망은 **마지막 입력월 다음 달부터** 시작한다(N-21-9 실적 뒤에 이어 그리기).

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

예시 (회원 2번, `?userId=2&incomeChangePercent=-10&forecastMonths=3`):

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
  "totalAccumulatedSurplus": 1722102
}
```

### 프론트 사용법

- `features/diagnosis/api/diagnosisApi.js`:
  - `getIncomeVolatility(userId)`
  - `getCashFlowForecast(userId, { incomeChangePercent, expenseChangePercent, loanPaymentChangePercent, forecastMonths })`
- mock 모드(`VITE_USE_MOCK`)에서는 위 예시와 같은 회원 2번 값을 돌려준다. 전망 mock은 쿼리 조건을 반영해 계산한다.

---

## N-16 자산·부채 건전성 · N-20 DSR 계산기 (FP-166, 담당 광희)

| 메서드 | 경로 | 용도 | 데이터 출처 |
|---|---|---|---|
| POST | `/api/diagnosis/dsr/calculate` | N-20-4 DSR·위험 단계 | 요청 본문 |
| POST | `/api/diagnosis/financial-health/calculate` | N-16-1·2 건전성 지표, N-16-3 값 바꿔 보기 | 요청 본문 |

- 두 API 모두 **DB를 읽지 않고 받은 값으로 계산만** 한다. 저장 데이터 조회 연결(N-16·N-20 "저장 데이터 조회")은 후속 작업이다.
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

- **상품 추천(N-18-7 상품 3종)은 A조 담당이라 이 API에 없다.** A조 추천 API는 백엔드 `ScoreBandOfferService.findOffer(score)`를 재사용할 수 있다.
- 기존 프론트 mock `GET /api/simulation/loans/recommend`(금리·한도 + 상품)는 A조 몫으로 그대로 둔다.
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

## N-18-5·8 시뮬레이터 점수 재계산 (SIM-02, 담당 광희) — 🟡 제안, Spring 미구현

> 지금은 프론트 mock만 있다. Spring은 B조 ML-04(`POST /v1/assessments/simulate`, B팀 명세서 4-4)를 불러 이 모양으로 바꿔 돌려줄 예정이다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/simulation/credit-care/recalculate` | 로그인 회원의 최근 평가에서 출발해 바꾼 값으로 점수를 다시 구한다(저장 안 함) |

요청: 회원·출발 평가는 Spring이 로그인 정보로 찾는다. 화면은 바꾼 값만 보낸다.
```json
{ "changes": { "TELECOM_ON_TIME_MONTHS": 12, "CARD_LIMIT_AMT": 5000000, "CARD_MONTHLY_SPEND_AMT": 1000000 } }
```
- 키 10개(ML-04와 같음): `TELECOM_ON_TIME_MONTHS`, `DELINQ_COUNT_12M`, `CASH_ADVANCE_MONTHS`, `NEW_LOAN_COUNT_3M`, `LOAN_BALANCE_AMT`, `PRIVATE_LENDER_LOAN_BALANCE_AMT`, `UTILITY_LATE_MONTHS`(🟡 A-22 제안), `EASYPAY_MONTHLY_COUNT`, `CARD_LIMIT_AMT`, `CARD_MONTHLY_SPEND_AMT`
- 값이 `null`이거나 키가 없으면 바꾸지 않는다.
- 카드 한도·월 사용액은 함께 보낸다. 한도가 0이면 오류가 아니라 카드 사용률을 결측으로 계산한다.

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

오류 400 `INVALID_INPUT`: 모르는 키는 `changes.<키>` "모르는 항목입니다.", 카드 한쪽만 보내면 `changes.CARD_LIMIT_AMT`. ML-04의 422를 Spring이 공통 형식(400)으로 바꾼다.

프론트: `features/simulation/api/simulationApi.js`의 `recalculateCreditCare({ changes })`. mock은 588점 예시에서 간단한 규칙으로 계산한다(진짜 모델 아님).
