# API 명세

> 팀이 합의한 API 요청·응답 형식을 기능(N-ID)별로 적는다. 아래 양식은 FP-203을 처음 쓰면서 제안한 것이다. 바꿔도 된다.
>
> - **공통 응답 형식(D-20)은 미정이다.** 지금은 응답 본문을 감싸지 않고 그대로 보낸다.
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
  - 저장된 소득이 없으면 `404`
  - `userId`가 없거나 숫자가 아니면 `400`
  - 본문 형식은 Spring 기본값이다(D-20 미정).

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
