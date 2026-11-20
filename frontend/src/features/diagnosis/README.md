# FP-94·95 자산·부채 건전성·현금흐름 화면

N-16 자산·부채와 N-21 현금흐름 화면은 서버 API를 사용한다. 실제 서버·DB 연결은 별도 검증이 필요하다.

UI 원본은 `5unyCwrGcxS3WrWFUk9qid`의 `1794641606-4f83` 버전으로 앞선 FP90·91과 같다. 원본 HTML을 저장소에 복제하지 않았다.

## 파일과 역할

- Codex1: `pages/AssetDebtPage.jsx`, 건전성 components, `styles/assetDebt.css`, `api/financeApi.js`, `mocks/financeMockData.js`, `mocks/financeMockCalculations.js`, 라우트 두 화면 연결 및 문서.
- Claude: `pages/CashFlowPage.jsx`, 현금흐름 components·상태 훅, `styles/cashFlow.css`.
- Codex2: `utils/financeCalculations.js`, `adapters/financeAdapter.js`.
- root: 계획·조율·통합 검토. 각 코드의 읽기 교차 검수는 사용자 최종검수가 아니다.

## 공통 계약

- `getAssetDebtData(userId, workerTypeCode)`: `totalAssetAmount`, `annualIncomeAmount`, `totalDebtAmount`, `annualPaymentAmount`, `loans`, `peer`, `assumptions`.
- 자산·부채 기준값은 DIAG-03-1, 직군 평균은 DIAG-01의 `sameWorkerType`을 병렬 조회한다. mock 모드에서는 각 API의 mock 응답을 사용한다.
- 대출 행은 `loanId`, `loanTypeName`, `balanceAmount`, `annualRatePct`, `rateTypeCode`, `remainingMonths`, `monthlyPaymentAmount`. 표는 원본 UI 열(종류·잔액·금리·방식·월 상환)만 사용한다.
- `getCashFlowData(userId)`: DIAG-08-1 응답에서 정확히 12개 연속 월의 `months[{baseMonth,incomeAmount}]`와 기준값 `baseFixedExpenseAmount`·`baseOtherExpenseAmount`·`baseMonthlyLoanPayment`를 읽어 화면 이름 `fixedExpenseAmount`·`otherExpenseAmount`·`monthlyPaymentAmount`로 옮긴다(서버 값이며 mock 아님). 저장값이 없으면 null을 유지하고 예측은 불가로 표시한다. `currentScore`는 이 응답에 없다.
- `forecastCashFlow({userId,baseline,conditions})`: 조건은 `incomeVariationPct`, `fixedExpenseAmount`, `paymentStatus`, `months`. 결과는 `forecastMonths`, `monthlyExpenseAmount`, `cumulativeSurplusAmount`, `tightestMonth`, `scorePath`, `currentScore`, `endScore`, `source`.
- 금액은 정수 원 단위, 비율은 %, 점수는 0~1000이다. 미입력은 NULL을 유지한다. UI와 mock 요청 입구에서 형식·범위 검사를 하며 실제 서버 검증을 의미하지 않는다.
- `VITE_USE_MOCK=false`에서는 서버 API를 호출하며 mock으로 자동 대체하지 않는다.

## N-16 건전성

- 총자산·연소득·총부채 3개를 바꾸면 `calculateAssetDebtPreview`가 즉시 결과를 반환한다. 되돌리기는 기준값으로 복원하며 개별 대출 행은 바꾸지 않는다.
- 순수 비율 계산은 `calculateAssetDebt`와 공용 `calculateDsr`를 사용한다. 기준 상수는 DSR 30/40, 자산 대비 40/60, 순자산 대비 70/100 한 벌이다.
- 총자산 NULL은 0원과 다르다. 분모 0·순자산 0 이하의 비율은 NULL과 사유로 표시한다. 유효한 위험·주의는 미산출 지표 때문에 숨기지 않는다.
- 금액 입력은 공통 NumberInput을 사용해 음수·소수·안전정수 초과를 검사한다. NULL은 형식 오류 대신 미입력 안내로 구분한다.
- 같은 직군 평균은 회원 평균 API를 사용한다. 공통 CompareBar에 NULL을 넘겨 0으로 바꾸지 않고 비교 불가로 표시한다.
- 직군 평균 막대·범례·수치는 건전성 화면의 평균 행 안에서만 `--vio2` 토큰을 사용한다. 사용자 막대와 공통 컴포넌트·테마 정의는 변경하지 않는다.
- 시연 상환액은 총부채 변경 비율로 저장 연 상환액을 조정한다. 저장 부채가 0원인 경우 새 부채의 월 4.8% ×12를 사용한다. 이 추정은 mocks에만 있으며 실제 금융 계산 규칙이 아니다.

## N-21 현금흐름

- 첫 로드에 UI 기본 조건(변동 폭 100%, 제때 납부, 12개월, 저장 고정 지출)으로 한 번 예측한다. 이후 조건을 바꾸고 [예측 다시 하기]를 누르면 예측하며 마지막 적용 조건과 같으면 요청하지 않는다.
- 조건과 적용값을 분리하고 회원·직군·재조회·조건 변경·새 예측·화면 이탈 시 늦은 응답을 무효화한다. 빈 고정 지출·음수·소수·미완성 12개월 소득과 미입력/잘못된 기타 지출·월 상환액은 화면에서 요청하지 않는다. 실패 때만 다시 시도 버튼을 표시한다.
- 상태 안내는 조건 카드의 고정 5em 공간 한 곳에서 바뀌고 긴 문구는 스크롤로 읽는다. 다시 시도 버튼은 오른쪽 열에 유지한다. 다시 계산할 때도 이전 차트·요약을 유지하며 이전 조건 차트는 흐리게 표시한다. 처음 결과 로딩만 최소 높이 자리표시를 사용한다. 브라우저·반응형 시각 확인은 미실시다.
- 12개월 실적 다음에 3·6·12개월 전망과 월 지출선을 표시한다. 예상 점수는 시점을 정하지 않은 조건부 값으로 요약하며 소득 변동성 KPI도 함께 표시한다.
- 납부 밀림을 점수 계산에 반영한 경우 최근 1년 30일 이상 연체 1회 추가 가정을 안내한다. 제때 납부에는 해당 안내를 표시하지 않는다.
- 소득·지출·상환 기준값이 미입력이면 예측을 거부하며 0으로 채우지 않는다. 현재점수 NULL이면 점수 경로·결과만 미산출로 유지한다.

## 확인

이전 후속 요청과 기준값 guard 보완 완료 코드로 Codex1이 `npm.cmd run lint`·`npm.cmd run build`를 각 1회 실행해 통과했다(Vite 183 modules). 추적 파일과 미추적 신규 파일 전체의 공백 검사도 통과했다. Claude는 건전성·공유 데이터를, Codex1·Codex2는 현금흐름을 읽기 교차 검토했다. 급여소득자의 고정 월급 등 시연 자료값은 바꾸지 않았다.

브라우저 동작·반응형·실제 서버 연결과 사용자 최종검수는 미실시다. 화면 동작은 `npm.cmd run dev`로 직접 확인해야 한다. 프론트 테스트 파일은 추가하지 않았다.

## N-22 소득 변동성

- DIAG-07-1 `GET /api/members/me/income-volatility`에 연결했다(`api/incomeVolatilityApi.js`가 응답을 화면 모양으로 옮긴다). 프론트는 계산하지 않고 서버 값을 표시한다. mock 모드에서는 `diagnosisMockHandlers.js`가 같은 모양으로 응답한다.
- `IncomeVolatilitySection`은 현금흐름 화면(`CashFlowPage`)에 표시한다. 회원·직군 변경과 화면 이탈 시 늦은 응답을 버리고, 로딩·오류(다시 시도)를 표시하며 NULL 소득은 0으로 바꾸지 않는다. 변동계수 12% 초과 강조는 화면 표시 기준이다.
- 가장 가까운 부족 달: 서버의 `nearestDeficitMonth`는 지난 12개월 중 부족했던 달(과거)이므로, 마지막 입력월 + `monthsUntilNearest`로 앞으로 올 연·월을 계산해 보여 준다. 마지막 입력월(`baseline.months`)을 받지 못하면 "N개월 뒤"만 표시한다.
